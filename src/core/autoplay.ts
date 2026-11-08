// オートプレイ（長期シミュレーション・テスト用）。画面なしで1年を進める
import { B } from '../data/balance';
import { WEAPONS } from '../data/weapons';
import type { SkillId } from './types';
import type { GameState, Student } from './state';
import { enrolled, available, deployLimit, capacity } from './game';
import { nextWeek, startBattle, finishBattle, finishCareers, admit, autoAdmitIds, battleCtx, rng, ensureReinforcementFactory, startAutoQuest } from './flow';
import { defaultPlan, skipAuto, type AutoChoice } from './battle/auto';
import { autoPlayerPhase, endPlayerPhase, rewind, canRewind } from './battle/engine';
import { autoExam } from './exam';
import { autoRecommend, suitablePath, availableChoices as availableChoicesOf, type CareerChoice, type CareerPlan } from './career';
import { COUNTRIES } from '../data/people';
import { activeAlumni } from './world';
import { effectiveStats } from './game';
import type { CountryId, Path } from './types';
import { upgradeFacility, hireTeacher, facilityCost, buyWeapon, type FacilityId } from './teachers';
import type { Deploy } from './battle/setup';
import { meetsRank } from './util';
import { CLASSES } from '../data/classes';
import { retireInstructor, successorCandidates, askSuccessor, externalSuccessor, viceEligible, setVice } from './instructor';

/** 武器の自動割り当て */
export function autoDeploy(s: GameState, limit = deployLimit(s)): Deploy[] {
  return deployFor(s, enrolled(s).filter(available).sort((a, b) => b.level - a.level).slice(0, limit).map((x) => x.id));
}

/** 決めたメンバーに、武器庫の武器・杖と傷薬を割り当てる */
export function deployFor(s: GameState, ids: string[]): Deploy[] {
  const list = ids.map((id) => s.students[id]).filter(Boolean);
  const used = new Set<string>();
  let items = s.items.vulnerary;
  return list.map((st) => {
    const w = bestArmoryWeapon(s, st, used, false);
    if (w) used.add(w);
    const staff = bestArmoryWeapon(s, st, used, true);
    if (staff) used.add(staff);
    const item = items > 0 ? (items--, 'vulnerary' as const) : null;
    return { studentId: st.id, armoryUid: w, item, staffUid: staff };
  });
}

export function canEquip(st: Student, weaponId: string): boolean {
  const w = WEAPONS[weaponId];
  if (!w) return false;
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  if (!c.weapons.includes(w.type)) return false;
  const skill = (w.type === 'holy' || w.type === 'staff' ? 'faith' : w.type) as SkillId;
  return meetsRank(st.skills[skill] ?? 0, w.rank);
}

export function bestArmoryWeapon(s: GameState, st: Student, used: Set<string>, staff: boolean): string | null {
  let best: { uid: string; score: number } | null = null;
  for (const a of s.armory) {
    if (used.has(a.uid)) continue;
    const w = WEAPONS[a.weaponId];
    if (!w || (w.type === 'staff') !== staff || !canEquip(st, a.weaponId)) continue;
    const skill = (w.type === 'holy' || w.type === 'staff' ? 'faith' : w.type) as SkillId;
    const score = (st.skills[skill] ?? 0) + w.might * 5;
    if (!best || score > best.score) best = { uid: a.uid, score };
  }
  return best?.uid ?? null;
}

/** 戦闘を自動で最後まで */
export function autoBattle(s: GameState): void {
  const b = s.battle;
  if (!b) return;
  ensureReinforcementFactory(s);
  const ctx = battleCtx(s);
  let guard = 0;
  const careful = new Set<string>();
  const carefulUntil = new Map<string, number>();
  // 人が遊ぶときのように、教え子が戦死したら巻き戻してやり直す
  const deaths = () => s.battle!.fallen.filter((f) => f.outcome === 'dead').length;
  while (s.battle && s.battle.phase !== 'done' && guard++ < 80) {
    const d0 = deaths();
    const turn = s.battle.turn;
    for (const [k, until] of carefulUntil) if (s.battle.turn > until) { careful.delete(k); carefulUntil.delete(k); }
    autoPlayerPhase(s.battle, ctx, careful);
    if ((s.battle.phase as string) !== 'done') endPlayerPhase(s.battle, ctx);
    if (deaths() > d0 && s.battle.rewindsLeft > 0) {
      for (const f of s.battle.fallen.slice(0)) if (f.outcome === 'dead') { const u = s.battle.units.find((x) => x.studentId === f.studentId); if (u) { careful.add(u.uid); carefulUntil.set(u.uid, turn + 1); } }
      const back = s.battle.turn > turn ? 2 : 1;
      if (canRewind(s.battle) >= back) { s.battle = rewind(s.battle, back); s.battle.rng = (s.battle.rng + 7919 * guard) | 0; continue; }
    }
    if ((s.battle.phase as string) === 'done') break;
  }
  if (s.battle && s.battle.phase !== 'done') { s.battle.phase = 'done'; s.battle.result = 'lose'; }
  finishBattle(s);
}

/** 自動の戦闘を最後まで（選択はおすすめのもの）進めて、結果を反映する */
export function finishAuto(s: GameState, pick?: (c: AutoChoice) => number): void {
  if (!s.battle?.auto) return;
  skipAuto(s, battleCtx(s), pick ?? autoChoicePick);
  if (s.battle && s.battle.phase !== 'done') { s.battle.phase = 'done'; s.battle.result = 'lose'; }
  finishBattle(s);
}
let autoChoicePick: ((c: AutoChoice) => number) | undefined;
/** シミュレーション用：選択の選び方を差し替える */
export function setAutoChoicePick(f: ((c: AutoChoice) => number) | undefined): void { autoChoicePick = f; }
let manualInSim = false;
/** シミュレーション用：手動の戦闘（4夜目までの戦い方）で回す */
export function setManualInSim(v: boolean): void { manualInSim = v; }

// ---------- 進路の方針（長期シミュレーション用） ----------
export type CareerPolicy = 'auto' | 'peace' | 'unify' | 'none' | 'neutral';
let careerPolicy: CareerPolicy = 'auto';
export function setCareerPolicy(p: CareerPolicy): void { careerPolicy = p; }

/** 方針に沿って進路を決める。peace＝文官を三国へ均等に、unify＝一番強い国へ武官・参謀を集める */
export function autoCareerPlans(s: GameState, policy: CareerPolicy = careerPolicy): CareerPlan[] {
  const third = enrolled(s).filter((x) => x.grade === 3);
  if (policy === 'auto') return third.map((st) => ({ studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) }));
  // 何もしない：教え子を三国の軍に送らない（故郷か傭兵へ）
  if (policy === 'none') return third.map((st) => ({ studentId: st.id, recommend: availableChoicesOf(st).includes('home') ? 'home' : 'merc', path: suitablePath(st) }));
  if (policy === 'unify') {
    const top = [...COUNTRIES].sort((a, b) => s.world.power[b] - s.world.power[a])[0];
    return third.map((st) => {
      const rec: CareerChoice = st.offers.includes(top) ? top : autoRecommend(s, st);
      const path = suitablePath(st) === 'civil' ? 'warrior' : suitablePath(st);
      return { studentId: st.id, recommend: rec, path };
    });
  }
  // 中立狙い：三国へ均等に（卒業生の少ない国から順に）。道は本人に向いたもの
  if (policy === 'neutral') {
    const n: Record<CountryId, number> = { kingdom: activeAlumni(s, 'kingdom').length, empire: activeAlumni(s, 'empire').length, alliance: activeAlumni(s, 'alliance').length };
    return third.map((st) => {
      const opts = (st.offers.length ? st.offers : []).slice().sort((a, b) => n[a] - n[b] || s.world.friendship[a] - s.world.friendship[b]);
      const c = opts[0];
      if (!c) return { studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) };
      n[c] += 1;
      // 和平の円卓より先に中立を目指すので、文官ではなく武官・参謀に
      const path = suitablePath(st) === 'civil' ? 'strategist' : suitablePath(st);
      return { studentId: st.id, recommend: c, path };
    });
  }
  // 和平狙い：魅力の高い子から半分ほどを文官にして、文官の少ない国へ
  const civilCount = (c: CountryId) => activeAlumni(s, c).filter((st) => st.career!.path === 'civil').length;
  const counts: Record<CountryId, number> = { kingdom: civilCount('kingdom'), empire: civilCount('empire'), alliance: civilCount('alliance') };
  const byCha = [...third].sort((a, b) => effectiveStats(b).cha + (b.house === 'noble' ? 3 : 0) - effectiveStats(a).cha - (a.house === 'noble' ? 3 : 0));
  const nCivil = Math.ceil(third.length * 0.55);
  return byCha.map((st, i) => {
    if (i >= nCivil) return { studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) };
    const opts = (st.offers.length ? st.offers : COUNTRIES).slice().sort((a, b) => counts[a] - counts[b]);
    const c = opts[0];
    counts[c] += 1;
    return { studentId: st.id, recommend: st.offers.includes(c) ? c : autoRecommend(s, st), path: 'civil' as Path };
  });
}

/** 処理待ちの画面を自動で片付ける */
export function autoPending(s: GameState): void {
  let guard = 0;
  while (s.pending.length && guard++ < 50) {
    const p = s.pending[0];
    if (p.type === 'questBoard') {
      const real = s.quests.filter((q) => q.real);
      const lv = enrolled(s).reduce((a, x) => a + x.level, 0) / Math.max(1, enrolled(s).length);
      const ok = real.filter((q) => q.danger <= (lv > 8 ? 3 : 2));
      // 中立狙い：友好度のいちばん低い国の依頼を優先（三国の依頼を均等に）
      const pick = (careerPolicy === 'neutral' ? [...ok].sort((a, b) => questFriend(s, a.clientCountry) - questFriend(s, b.clientCountry) || b.reward - a.reward)[0] : undefined)
        ?? ok.sort((a, b) => b.reward - a.reward)[0] ?? s.quests[0];
      if (manualInSim) { startBattle(s, pick.id, autoDeploy(s)); autoBattle(s); continue; }
      const d = autoDeploy(s);
      startAutoQuest(s, pick.id, d, defaultPlan(s, pick, d));
      finishAuto(s);
      continue;
    }
    if (p.type === 'career') {
      finishCareers(s, autoCareerPlans(s));
      continue;
    }
    if (p.type === 'entrance') { admit(s, autoAdmitIds(s)); continue; }
    if (p.type === 'retire') {
      // 人が遊ぶときに近づけて、60歳を過ぎたら引退する（65歳は必ず）
      if (p.forced || s.instructor.age >= AUTO_RETIRE_AGE) { retireInstructor(s, rng(s)); continue; }
      s.pending.shift(); continue;
    }
    if (p.type === 'successor') { autoSuccessor(s); continue; }
    if (p.type === 'ending') { autoEnding(s); continue; }
    s.pending.shift();
  }
}

const AUTO_RETIRE_AGE = 60;
function questFriend(s: GameState, c: CountryId | null): number { return c ? s.world.friendship[c] : 999; }
/** 後継選び：講師→信頼の高い卒業生の順に3人まで頼み、だめなら外部の教官 */
export function autoSuccessor(s: GameState): void {
  const r = rng(s);
  for (let i = 0; i < 3; i++) {
    const c = successorCandidates(s).filter((x) => !x.recall || i > 0)[0] ?? successorCandidates(s)[0];
    if (!c) break;
    if (askSuccessor(s, r, c.st.id).ok) return;
  }
  externalSuccessor(s, r);
}
let endingHook: ((s: GameState) => void) | null = null;
/** エンディングのあとの選び方（長期シミュレーション用に差し替えられる） */
export function setAutoEnding(f: ((s: GameState) => void) | null): void { endingHook = f; }
function autoEnding(s: GameState): void {
  if (endingHook) endingHook(s);
  else s.pending.shift();
}

/** 学校経営の自動判断（月に1回） */
export function autoManage(s: GameState): void {
  const r = rng(s);
  for (const st of enrolled(s)) autoExam(s, r, st);
  // 施設
  const order: FacilityId[] = ['training', 'chapel', 'library', 'dining', 'stable', 'range'];
  for (const f of order) {
    const c = facilityCost(s, f);
    if (c !== null && s.money >= c + (careerPolicy === 'neutral' ? 500 : 1200)) { upgradeFacility(s, f); break; }
  }
  // 講師
  if (s.teacherCandidates.length && s.money > 3000 && s.teachers.length < B.teachers.max - 1) {
    const t = s.teacherCandidates.sort((a, b) => b.points - a.points)[0];
    if (t.salary * 12 < s.money / 2) hireTeacher(s, t.id);
  }
  // 上等な武器（お金に余裕があれば、使える子がいるものを）
  if (s.money > 9000) {
    const premium = Object.values(WEAPONS).filter((x) => x.price >= 3000 && (x.type !== 'gun' || s.world.gunUnlocked) && !s.armory.some((a) => a.weaponId === x.id) && enrolled(s).some((st) => canEquip(st, x.id)));
    if (premium.length) { const w = r.pick(premium); buyWeapon(s, w.id, w.price); }
  }
  // 武器
  if (s.money > 2500 && s.armory.length < enrolled(s).length + 4) {
    const w = r.pick(Object.values(WEAPONS).filter((x) => x.price > 0 && x.price <= 800 && (x.type !== 'gun' || s.world.gunUnlocked)));
    buyWeapon(s, w.id, w.price);
  }
  // 副教官：なれる講師がいれば、担任のいない学年に（方針はバランス）
  for (const t of viceEligible(s)) {
    if ((s.vice ?? []).some((v) => v.teacherId === t.id)) continue;
    const g = [1, 2, 3].find((x) => !(s.vice ?? []).some((v) => v.grade === x));
    if (g) setVice(s, t.id, g, 'balance');
  }
  // 重点科目
  for (const g of [1, 2, 3]) {
    const list = enrolled(s).filter((x) => x.grade === g);
    if (!list.length) continue;
    const count: Record<string, number> = {};
    for (const st of list) for (const k of st.targets) count[k] = (count[k] ?? 0) + 1;
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]).map((x) => x[0] as SkillId);
    if (top.length >= 2) s.focus[g] = [top[0], top[1]];
  }
  void capacity; void B;
}

/** 1週間ぶん自動で進める */
export function autoWeek(s: GameState): void {
  autoPending(s);
  if (s.week === 1) autoManage(s);
  nextWeek(s);
  autoPending(s);
}

export function autoYears(s: GameState, years: number, onYear?: (s: GameState) => void): void {
  const target = s.year + years;
  let guard = 0;
  while (s.year < target && guard++ < years * 60) {
    const y = s.year;
    autoWeek(s);
    if (s.year !== y) onYear?.(s);
  }
}
