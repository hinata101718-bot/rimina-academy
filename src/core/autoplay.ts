// オートプレイ（長期シミュレーション・テスト用）。画面なしで1年を進める（19夜目：新しい戦い）
import type { GameState } from './state';
import type { CountryId, Path } from './types';
import { COUNTRIES } from '../data/people';
import { enrolled } from './game';
import { recommendCard, todayCards } from './lessons';
import { chooseLesson, startSortie, finishCareers, admit, autoAdmitIds, rng } from './flow';
import { autoExam } from './exam';
import { autoRecommend, suitablePath, availableChoices as availableChoicesOf, type CareerChoice, type CareerPlan } from './career';
import { activeAlumni } from './world';
import { autoSpend } from './mentor';
import { instructorCaps, goodSkillsOf, retireInstructor, successorCandidates, askSuccessor, externalSuccessor } from './instructor';
import { recommendQuest, recommendSquad } from './sortie';
import { presence } from './util';
import { effectiveStats } from './game';

// ---------- 進路の方針（長期シミュレーション用） ----------
export type CareerPolicy = 'auto' | 'peace' | 'unify' | 'none' | 'neutral';
let careerPolicy: CareerPolicy = 'auto';
export function setCareerPolicy(p: CareerPolicy): void { careerPolicy = p; }

/** 方針に沿って進路を決める。peace＝文官を三国へ均等に、unify＝一番強い国へ武官・参謀を集める */
export function autoCareerPlans(s: GameState, policy: CareerPolicy = careerPolicy): CareerPlan[] {
  const third = enrolled(s).filter((x) => x.grade === 3);
  if (policy === 'auto') return third.map((st) => ({ studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) }));
  if (policy === 'none') return third.map((st) => ({ studentId: st.id, recommend: availableChoicesOf(st).includes('home') ? 'home' : 'merc', path: suitablePath(st) }));
  if (policy === 'unify') {
    const top = [...COUNTRIES].sort((a, b) => s.world.power[b] - s.world.power[a])[0];
    return third.map((st) => ({ studentId: st.id, recommend: (st.offers.includes(top) ? top : autoRecommend(s, st)) as CareerChoice, path: suitablePath(st) === 'civil' ? 'warrior' : suitablePath(st) }));
  }
  if (policy === 'neutral') {
    const n: Record<CountryId, number> = { kingdom: activeAlumni(s, 'kingdom').length, empire: activeAlumni(s, 'empire').length, alliance: activeAlumni(s, 'alliance').length };
    return third.map((st) => {
      const c = (st.offers.length ? st.offers : []).slice().sort((a, b) => n[a] - n[b])[0];
      if (!c) return { studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) };
      n[c] += 1;
      return { studentId: st.id, recommend: c, path: suitablePath(st) === 'civil' ? 'strategist' : suitablePath(st) };
    });
  }
  const civilCount = (c: CountryId) => activeAlumni(s, c).filter((st) => st.career!.path === 'civil').length;
  const counts: Record<CountryId, number> = { kingdom: civilCount('kingdom'), empire: civilCount('empire'), alliance: civilCount('alliance') };
  const byP = [...third].sort((a, b) => presence(effectiveStats(b)) + (b.house === 'noble' ? 3 : 0) - presence(effectiveStats(a)) - (a.house === 'noble' ? 3 : 0));
  const nCivil = Math.ceil(third.length * 0.55);
  return byP.map((st, i) => {
    if (i >= nCivil) return { studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) };
    const c = (st.offers.length ? st.offers : COUNTRIES).slice().sort((a, b) => counts[a] - counts[b])[0];
    counts[c] += 1;
    return { studentId: st.id, recommend: st.offers.includes(c) ? c : autoRecommend(s, st), path: 'civil' as Path };
  });
}

/** シミュレーション用：画面の操作の回数の目安 */
export const opCount: { lesson: number; pending: number; battle: number; nemesis: number; reunions: number } = { lesson: 0, pending: 0, battle: 0, nemesis: 0, reunions: 0 };

const AUTO_RETIRE_AGE = 60;
let endingHook: ((s: GameState) => void) | null = null;
export function setAutoEnding(f: ((s: GameState) => void) | null): void { endingHook = f; }
let pendingHook: ((s: GameState, p: GameState['pending'][number]) => void) | null = null;
/** シミュレーション用：処理待ちを片付ける前に見る */
export function setPendingHook(f: typeof pendingHook): void { pendingHook = f; }

/** 処理待ちの画面を自動で片付ける */
export function autoPending(s: GameState): void {
  let guard = 0;
  while (s.pending.length && guard++ < 60) {
    const p = s.pending[0];
    opCount.pending += 1;
    pendingHook?.(s, p);
    if (p.type === 'questBoard' || p.type === 'sortieChoice') {
      const q = recommendQuest(s);
      if (!q) { s.pending.shift(); continue; }
      opCount.battle += 1;
      if (q.nemesisId) opCount.nemesis += 1;
      startSortie(s, [recommendSquad(s, q, false)]);
      if (s.pending[0] === p) s.pending.shift();
      continue;
    }
    if (p.type === 'nemesis') { if (p.kind === 'reunion' || p.kind === 'revived') opCount.reunions += 1; s.pending.shift(); continue; }
    if (p.type === 'career') { finishCareers(s, autoCareerPlans(s)); continue; }
    if (p.type === 'entrance' || p.type === 'admission') { admit(s, autoAdmitIds(s)); continue; }
    if (p.type === 'retire') {
      if (p.forced || s.instructor.age >= AUTO_RETIRE_AGE) { retireInstructor(s, rng(s)); continue; }
      s.pending.shift(); continue;
    }
    if (p.type === 'successor') { autoSuccessor(s); continue; }
    if (p.type === 'ending') { if (endingHook) endingHook(s); else s.pending.shift(); continue; }
    s.pending.shift();
  }
}

/** 後継選び：信頼の高い教え子・卒業生から3人まで頼み、だめなら外部の教官 */
export function autoSuccessor(s: GameState): void {
  const r = rng(s);
  for (let i = 0; i < 3; i++) {
    const c = successorCandidates(s)[i] ?? successorCandidates(s)[0];
    if (!c) break;
    if (askSuccessor(s, r, c.st.id).ok) return;
  }
  externalSuccessor(s, r);
}

/** 学校の自動判断（月に1回）：兵種試験・先生の経験ポイント */
export function autoManage(s: GameState): void {
  const r = rng(s);
  for (const st of enrolled(s)) autoExam(s, r, st);
  autoSpend(s, instructorCaps(s), goodSkillsOf(s));
}

let lessonPick: ((s: GameState) => number) | null = null;
export function setLessonPick(f: ((s: GameState) => number) | null): void { lessonPick = f; }

/** 1日（1回の授業）ぶん自動で進める */
export function autoDay(s: GameState): void {
  autoPending(s);
  if (s.week === 1 && (s.day ?? 1) === 1) autoManage(s);
  if (s.pending.length || s.battle) return;
  todayCards(s);
  chooseLesson(s, lessonPick ? lessonPick(s) : recommendCard(s));
  opCount.lesson += 1;
  autoPending(s);
}
export function autoWeek(s: GameState): void {
  const w = s.absWeek;
  let guard = 0;
  while (s.absWeek === w && guard++ < 8 && !s.gameOver) autoDay(s);
}
export function autoYears(s: GameState, years: number, onYear?: (s: GameState) => void): void {
  const target = s.year + years;
  let guard = 0;
  while (s.year < target && guard++ < years * 80 && !s.gameOver) {
    const y = s.year;
    autoWeek(s);
    if (s.year !== y) onYear?.(s);
  }
}
