// オートプレイ（長期シミュレーション・テスト用）。画面なしで1年を進める
import { B } from '../data/balance';
import { WEAPONS } from '../data/weapons';
import type { SkillId } from './types';
import { recommendCard, todayCards } from './lessons';
import type { GameState, Student } from './state';
import { enrolled, available, deployLimit, capacity } from './game';
import { autoSpend } from './mentor';
import { instructorCaps, goodSkillsOf } from './instructor';
import { chooseLesson, startBattle, finishBattle, finishCareers, admit, autoAdmitIds, battleCtx, rng, ensureReinforcementFactory, startAutoQuest } from './flow';
import { defaultPlan, skipAuto, recommendDeploy, type AutoChoice } from './battle/auto';
import { squadCount, squadLimit, startSortie } from './flow';
import { battleItems } from './battle/blog';
import type { SquadPlan } from './state';
import { autoPlayerPhase, endPlayerPhase, rewind, canRewind } from './battle/engine';
import { autoExam } from './exam';
import { autoRecommend, suitablePath, availableChoices as availableChoicesOf, type CareerChoice, type CareerPlan } from './career';
import { COUNTRIES } from '../data/people';
import { activeAlumni } from './world';
import { effectiveStats } from './game';
import type { CountryId, Path } from './types';
import { isStock, stockList, armScore } from './loot';
import { upgradeFacility, hireTeacher, facilityCost, type FacilityId } from './teachers';
import type { Deploy } from './battle/setup';
import { meetsRank } from './util';
import { CLASSES } from '../data/classes';
import { retireInstructor, successorCandidates, askSuccessor, externalSuccessor, viceEligible, setVice } from './instructor';

/** 武器の自動割り当て */
export function autoDeploy(s: GameState, limit = deployLimit(s)): Deploy[] {
  return deployFor(s, enrolled(s).filter(available).sort((a, b) => b.level - a.level).slice(0, limit).map((x) => x.id));
}

/** 決めたメンバーに、武器庫の武器・杖と傷薬を割り当てる */
export function deployFor(s: GameState, ids: string[], usedArms?: Set<string>, itemsUsed = 0): Deploy[] {
  const list = ids.map((id) => s.students[id]).filter(Boolean);
  const used = usedArms ?? new Set<string>();
  let items = Math.max(0, s.items.vulnerary - itemsUsed);
  return list.map((st) => {
    const w = bestArmoryWeapon(s, st, used, false);
    if (w && !isStock(w)) used.add(w);
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
  // 10夜目：鉄の武器は学校の備え（数の制限なし）。戦利品の武器のほうが合えば、そちらを
  for (const a of [...s.armory, ...(staff ? [] : stockList(s))]) {
    if (used.has(a.uid)) continue;
    const w = WEAPONS[a.weaponId];
    if (!w || (w.type === 'staff') !== staff || !canEquip(st, a.weaponId)) continue;
    const score = armScore(st, a);
    if (score < 0) continue;
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

/**
 * おすすめの編成（9夜目：全部隊ぶん一度に）。fixed＝部隊ごとに決めてある依頼。
 * pool を渡すと、その順でメンバーを選ぶ（シミュレーションはレベル順）。ふだんはおすすめの編成（相性・回復役）
 */
export function recommendSquads(s: GameState, fixed: (string | null | undefined)[] = [], pool?: (used: Set<string>) => Student[]): SquadPlan[] {
  const n = squadCount(s);
  const list = enrolled(s);
  const lv = list.reduce((a, x) => a + x.level, 0) / Math.max(1, list.length);
  const used = new Set<string>(), usedQ = new Set<string>(), arms = new Set<string>();
  let items = 0;
  const out: SquadPlan[] = [];
  for (let i = 0; i < n; i++) {
    let qid = fixed[i] && !usedQ.has(fixed[i]!) && s.quests.some((q) => q.id === fixed[i]) ? fixed[i]! : null;
    if (!qid) {
      // この部隊に入りそうな子のレベル（残りの子の上から）に合う依頼
      const rest = list.filter((x) => available(x) && !used.has(x.id)).map((x) => x.level).sort((a, c) => c - a).slice(0, squadLimit(s, i));
      const slv = rest.length ? rest.reduce((a, c) => a + c, 0) / rest.length : lv;
      const maxDanger = i === 0 ? (lv > 8 ? 3 : 2) : 2;
      const cands = s.quests.filter((q) => !usedQ.has(q.id));
      const real = cands.filter((q) => q.real && q.danger <= maxDanger && (i === 0 || q.level <= slv + 1)).sort((a, c) => (i === 0 ? 0 : c.level - a.level) || c.reward - a.reward);
      qid = (real[0] ?? cands.find((q) => !q.real) ?? cands[0])?.id ?? null;
    }
    if (!qid) break;
    const q = s.quests.find((x) => x.id === qid)!;
    const limit = squadLimit(s, i);
    const ids = pool ? pool(used).slice(0, limit).map((x) => x.id) : recommendDeploy(s, q, limit, (x) => x.map((id) => ({ studentId: id, armoryUid: null, item: null, staffUid: null })), used).map((d) => d.studentId);
    if (!ids.length) break;
    usedQ.add(qid);
    ids.forEach((id) => used.add(id));
    const d = deployFor(s, ids, arms, items);
    items += d.filter((x) => x.item).length;
    out.push({ questId: qid, deploy: d, plan: defaultPlan(s, q, d), manual: s.settings.manualBattle || undefined });
  }
  return out;
}

/** 戦いの記録のカードの数（タップで進めるときの回数の目安。9夜目） */
function battleCards(s: GameState): number {
  const b = s.battle;
  if (!b?.auto) return 0;
  skipAuto(s, battleCtx(s), autoChoicePick);
  return battleItems(s.battle!).filter((x) => x.k !== 'sync' && x.k !== 'turn' && x.k !== 'title').length;
}

/** 自動の戦闘を最後まで（選択はおすすめのもの）進めて、結果を反映する */
export function finishAuto(s: GameState, pick?: (c: AutoChoice) => number): void {
  if (!s.battle?.auto) return;
  skipAuto(s, battleCtx(s), pick ?? autoChoicePick);
  if (s.battle && s.battle.phase !== 'done') { s.battle.phase = 'done'; s.battle.result = 'lose'; }
  finishBattle(s);
}
let autoChoicePick: ((c: AutoChoice) => number) | undefined;
/** シミュレーション用の選び方：たいていはおすすめ、ときどき別のもの（人が遊ぶときに近づける） */
export function humanLikePick(seed = 1): (c: AutoChoice) => number {
  let h = seed | 0;
  return (c) => { h = (Math.imul(h ^ (h >>> 13), 1103515245) + 12345) | 0; const v = ((h >>> 8) & 0xffff) / 0xffff; return v < 0.7 ? c.recommended : Math.floor(v * 1000) % c.options.length; };
}
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
    opCount.pending += 1;
    if (p.type === 'questBoard') {
      const real = s.quests.filter((q) => q.real);
      const lv = enrolled(s).reduce((a, x) => a + x.level, 0) / Math.max(1, enrolled(s).length);
      const ok = real.filter((q) => q.danger <= (lv > 8 ? 3 : 2));
      // 中立狙い：友好度のいちばん低い国の依頼を優先（三国の依頼を均等に）
      const pick = (careerPolicy === 'neutral' ? [...ok].sort((a, b) => questFriend(s, a.clientCountry) - questFriend(s, b.clientCountry) || b.reward - a.reward)[0] : undefined)
        ?? ok.sort((a, b) => b.reward - a.reward)[0] ?? s.quests[0];
      if (manualInSim) { startBattle(s, pick.id, autoDeploy(s)); autoBattle(s); continue; }
      // 9夜目：部隊の数だけ依頼を選ぶ（1つ目は今まで通り。2つ目からは危険の少ない依頼か演習）
      const squads = recommendSquads(s, [pick.id], (ids) => enrolled(s).filter(available).filter((x) => ids.has(x.id) === false).sort((a, b) => b.level - a.level));
      opCount.squads = (opCount.squads ?? 0) + squads.length;
      startSortie(s, squads);
      let g2 = 0;
      while (s.battle?.auto && g2++ < 5) {
        opCount.battle += 1 + (s.battle.auto.choice ? 1 : 0);
        opCount.cards = (opCount.cards ?? 0) + battleCards(s);
        finishAuto(s);
      }
      // 部隊ごとの勝ち負け（シミュレーションの集計用）
      const res = s.pending.find((x) => x.type === 'sortieResult' || x.type === 'battleResult');
      const reps = res?.type === 'sortieResult' ? res.reports : res?.type === 'battleResult' ? [res] : [];
      for (const rp of reps) if (rp.away) { const A = (opCount.away ??= { w: 0, l: 0, dead: 0, good: 0, calls: 0 }); A[rp.win ? 'w' : 'l'] += 1; A.dead += (rp.fallen ?? []).filter((f) => f.outcome === 'dead').length; A.calls += (rp.calls ?? []).length; A.good += (rp.calls ?? []).filter((c) => c.good).length; }
      for (const rp of reps) { const i = rp.squad ?? 0; const k = rp.win ? 'w' : 'l'; (opCount.sq ??= { w: [0, 0, 0], l: [0, 0, 0], dead: [0, 0, 0], inj: [0, 0, 0] })[k][i] += 1; opCount.sq.dead[i] += (rp.fallen ?? []).filter((f) => f.outcome === 'dead').length; opCount.sq.inj[i] += (rp.fallen ?? []).filter((f) => f.outcome === 'injured').length; }
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
  // 10夜目：武器は買わない（戦利品）。15夜目：道具は毎月自動で補充される
  // 副教官：なれる講師がいれば、担任のいない学年に（方針はバランス）
  for (const t of viceEligible(s)) {
    if ((s.vice ?? []).some((v) => v.teacherId === t.id)) continue;
    const g = [1, 2, 3].find((x) => !(s.vice ?? []).some((v) => v.grade === x));
    if (g) setVice(s, t.id, g, 'balance');
  }
  // 先生の経験ポイント（8夜目）：特殊能力を優先し、余れば得意科目の技能
  autoSpend(s, instructorCaps(s), goodSkillsOf(s));
  void capacity; void B;
}

let gradeHook: ((s: GameState) => void) | null = null;
/** シミュレーション用：学年の終わり（3月の第4週の月曜）に呼ぶ */
export function setGradeHook(f: ((s: GameState) => void) | null): void { gradeHook = f; }
/** シミュレーション用：画面の操作の回数の目安（授業カード1回＋結果を閉じる1回など） */
export const opCount: { lesson: number; pending: number; battle: number; squads?: number; cards?: number; sq?: { w: number[]; l: number[]; dead: number[]; inj: number[] }; away?: { w: number; l: number; dead: number; good: number; calls: number }; escorted?: number } = { lesson: 0, pending: 0, battle: 0, squads: 0, cards: 0 };

/** 1日ぶん自動で進める（7夜目：おすすめの授業カードを選ぶ） */
export function autoDay(s: GameState): void {
  autoPending(s);
  if (gradeHook && s.month === 11 && s.week === 4 && (s.day ?? 1) === 1) gradeHook(s);
  if (s.week === 1 && (s.day ?? 1) === 1) autoManage(s);
  if (s.pending.length || s.battle) return;
  todayCards(s);
  chooseLesson(s, lessonPick ? lessonPick(s) : recommendCard(s));
  opCount.lesson += 1;
  autoPending(s);
}
/** 1週間ぶん自動で進める（月〜金） */
export function autoWeek(s: GameState): void {
  const w = s.absWeek;
  let guard = 0;
  while (s.absWeek === w && guard++ < 8 && !s.gameOver) autoDay(s);
}
let lessonPick: ((s: GameState) => number) | null = null;
/** シミュレーション用：授業カードの選び方を差し替える */
export function setLessonPick(f: ((s: GameState) => number) | null): void { lessonPick = f; }

export function autoYears(s: GameState, years: number, onYear?: (s: GameState) => void): void {
  const target = s.year + years;
  let guard = 0;
  while (s.year < target && guard++ < years * 60 && !s.gameOver) {
    const y = s.year;
    autoWeek(s);
    if (s.year !== y) onYear?.(s);
  }
}
