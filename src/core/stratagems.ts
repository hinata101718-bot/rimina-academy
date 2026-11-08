// 策（作戦カード）・陣形・部隊長（9夜目）。DOMに依存しない
import { aptMul, isGood } from './aptitude';
import { addSkill } from './week';
import { STRATS, STRAT, STRAT_IDS, MAP_TAGS, SQUADS, FORMATION, type StratId, type StratDef, type StratEffect } from '../data/stratagems';
import { OFFICER_TRAITS } from '../data/officers';
import { CLASSES } from '../data/classes';
import { WEAPONS } from '../data/weapons';
import type { UnitMod, RoleId } from '../data/autobattle';
import type { GameState, Quest, Student, EnemyOfficer } from './state';
import type { BattleState, Unit } from './battle/types';
import type { MoveType } from './types';
import { Rng } from './rng';
import { fx } from './mentor';
import { enrolled, effectiveStats } from './game';

export const START_STRATS: StratId[] = STRAT_IDS.filter((id) => STRATS[id].unlock.start);

/** 学校で使える策 */
export function knownStrats(s: GameState): StratId[] {
  return (s.strats ?? START_STRATS).filter((x): x is StratId => !!STRATS[x as StratId]);
}
/** 出撃前に選べる策の枚数（先生の「軍師の眼」で+1） */
export function stratSlots(s: GameState): number { return STRAT.slots + fx(s, 'stratSlots'); }

/** 軍略（10夜目：技能ランクの「軍略」。9夜目の0〜100の数値に合わせた目安＝技能ポイント÷2） */
export function stratOf(st: Student | null | undefined): number { return Math.round((st?.skills?.tactics ?? 0) / 2); }
/** 軍略が身につく（策を立てた戦いなど）。得意・苦手の倍率つき */
export function addStrat(st: Student, v: number): void { addSkill(st, 'tactics', v * 2 * aptMul(st, 'tactics')); }
/** 統率が身につく（部隊長を務めた戦い） */
export function addCommand(st: Student, v: number): void { addSkill(st, 'command', v * aptMul(st, 'command')); }
/** 部隊長の腕前（10夜目：統率ランクで決まる。魅力は統率の伸びやすさに少し効く）。統率の技能ポイント÷8 */
export function captainScore(st: Student): number { return Math.round((st.skills?.command ?? 0) / 8); }
/** 策を立てる腕前（軍略・魅力。軍略が得意・軍略の芽が開いた子は上乗せ） */
export function plannerScore(st: Student): number {
  return stratOf(st) * STRAT.plannerStrat + effectiveStats(st).cha * STRAT.plannerCha + (isGood(st, 'tactics') ? STRAT.talent : 0);
}
export function defaultCaptain(s: GameState, ids: string[]): string | undefined {
  return ids.map((id) => s.students[id]).filter(Boolean).sort((a, b) => b.grade * 6 + captainScore(b) - a.grade * 6 - captainScore(a))[0]?.id;
}
export function defaultPlanner(s: GameState, ids: string[]): string | undefined {
  return ids.map((id) => s.students[id]).filter(Boolean).sort((a, b) => plannerScore(b) - plannerScore(a))[0]?.id;
}
/** 部隊長の腕前による補正（命中+） */
export function captainMod(st: Student | null | undefined): UnitMod {
  if (!st) return {};
  const v = Math.min(SQUADS.captainMax, Math.floor((captainScore(st) / 10) * SQUADS.captainPer10));
  return { hit: v, avo: v };
}
/** 教官が同行しない部隊（10夜目）：部隊長がここぞの判断でよい手を選ぶ見込み（0〜1） */
export function awayJudgeRate(captain: Student | null | undefined, planner: Student | null | undefined): number {
  const A = SQUADS.away;
  return Math.min(A.max, A.base + (captain ? captainScore(captain) * A.perCaptain : 0) + (planner ? plannerScore(planner) * A.perPlanner : 0));
}
/** 役割から前列・後列 */
export function defaultRow(role: RoleId): 'front' | 'back' { return role === 'back' || role === 'heal' ? 'back' : 'front'; }
export function formationMod(row: 'front' | 'back'): UnitMod { return row === 'front' ? FORMATION.front : FORMATION.back; }

// ---------- 成功の見込み ----------
export interface StratOdds {
  rate: number;
  /** 出撃前に見せる「効きそう」「向かない」の理由（分かっていることだけ） */
  good: string[]; bad: string[];
  /** 雨の火計など、必ず不発 */
  dud: boolean;
  /** 敵将の弱点を突く（分かっている特徴で） */
  weak: boolean;
}
interface OddsIn { q: Pick<Quest, 'template' | 'weather' | 'objective'>; planner?: Student | null; captain?: Student | null; members: Student[]; traits: string[]; known: string[]; early?: boolean }
/** 成功の見込み。traits＝敵将の本当の特徴、known＝分かっている特徴（理由の文にだけ使う） */
export function stratOdds(id: StratId, x: OddsIn): StratOdds {
  const d = STRATS[id];
  let rate = d.base;
  const good: string[] = [], bad: string[] = [];
  if (x.planner) rate += plannerScore(x.planner);
  if (d.captainCha && x.captain) rate += effectiveStats(x.captain).cha * STRAT.captainCha;
  const tags = MAP_TAGS[x.q.template] ?? [];
  if (d.terrain) { if (d.terrain.some((t) => tags.includes(t))) { rate += STRAT.terrainFit; good.push('地形が合う'); } }
  if (d.weather?.includes(x.q.weather)) { rate += STRAT.weatherFit; good.push(x.q.weather === 'fog' ? '霧の日' : x.q.weather === 'rain' ? '雨の日' : '晴れの日'); }
  if (d.objectives?.includes(x.q.objective)) { rate += STRAT.objectiveFit; good.push('この依頼に合う'); }
  const dud = !!d.fizzle?.includes(x.q.weather);
  if (dud) bad.push(x.q.weather === 'rain' ? '雨で不発' : '天候が合わない');
  let weak = false;
  for (const t of d.weak ?? []) if (x.traits.includes(t)) { rate += STRAT.weakHit; if (x.known.includes(t)) { weak = true; good.push(`敵将は「${OFFICER_TRAITS[t]?.name}」`); } }
  for (const t of d.bad ?? []) if (x.traits.includes(t)) { rate += STRAT.badHit; if (x.known.includes(t)) bad.push(`敵将は「${OFFICER_TRAITS[t]?.name}」`); }
  if (d.needMove && !x.members.some((st) => d.needMove!.includes((CLASSES[st.classId] ?? CLASSES.novice).moveType as MoveType))) { rate += STRAT.missingNeed; bad.push('騎馬・飛行の子がいない'); }
  if (d.minMembers && x.members.length < d.minMembers) { rate += STRAT.missingNeed; bad.push(`${d.minMembers}人以上が要る`); }
  if (x.early) rate += STRAT.early;
  return { rate: dud ? 0 : Math.max(STRAT.min, Math.min(STRAT.max, Math.round(rate))), good, bad, dud, weak };
}
export function oddsLabel(rate: number): string { return rate >= 75 ? '高い' : rate >= 55 ? 'まずまず' : rate >= 35 ? '五分' : '低い'; }

// ---------- 戦場で使う ----------
export interface StratRec { id: StratId; ok: boolean; dud?: boolean; weak?: boolean; rate: number; early?: boolean; text: string }

function addMod(u: Unit, m: UnitMod | undefined, k = 1): void {
  if (!m) return;
  u.mod ??= {};
  for (const key of ['hit', 'avo', 'dmg', 'def', 'crit'] as const) if (m[key]) u.mod[key] = (u.mod[key] ?? 0) + Math.round((m[key] as number) * k);
}
function fill(t: string, v: Record<string, string>): string { return t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m); }

/** 策を切る：成功の判定、効き目、黄色い帯の文。記録を b.auto.strats に残す */
export function fireStrat(s: GameState, b: BattleState, q: Pick<Quest, 'template' | 'weather' | 'objective'>, id: StratId, o: EnemyOfficer | null, early = false): StratRec | null {
  const a = b.auto;
  if (!a || !STRATS[id]) return null;
  const d: StratDef = STRATS[id];
  const r = new Rng(b as unknown as { rng: number });
  const plan = a.plan ?? {};
  const members = b.units.filter((u) => u.side === 'player' && u.studentId && !u.dead).map((u) => s.students[u.studentId!]).filter(Boolean);
  const planner = plan.planner ? s.students[plan.planner] : null;
  const captain = plan.captain ? s.students[plan.captain] : null;
  const odds = stratOdds(id, { q, planner, captain, members, traits: o?.traits ?? [], known: o?.knownTraits ?? [], early });
  // 10夜目：軍略の高い教え子が敵将になると、策を見抜いてくる
  const alum = o?.alumniId ? s.students[o.alumniId] : null;
  const sees = !!alum && (alum.skills?.tactics ?? 0) >= STRAT.alumniSeeAt;
  const ok = !odds.dud && r.next() * 100 < odds.rate - (sees ? STRAT.alumniSee : 0);
  const weakHit = !!o && (d.weak ?? []).some((t) => o.traits.includes(t));
  const mul = ok && weakHit ? STRAT.weakMul : 1;
  const eff: StratEffect = ok ? d.win : d.lose;
  const allies = b.units.filter((u) => (u.side === 'player' || u.side === 'ally') && !u.dead);
  const foes = b.units.filter((u) => u.side === 'enemy' && !u.dead && !u.captive);
  const L = a.leader;
  const lu = L ? b.units.find((u) => u.uid === L.uid) : null;
  for (const u of allies) addMod(u, eff.ally, mul);
  for (const u of foes) addMod(u, eff.foe, mul);
  if (lu) addMod(lu, eff.leaderFoe, mul);
  if (eff.foeHpPct) for (const u of foes) u.hp = Math.max(1, u.hp - Math.max(1, Math.round(u.maxHp * eff.foeHpPct * mul)));
  if (eff.injury) a.injury = (a.injury ?? 0) + eff.injury;
  if (eff.duel) a.duelOffer = true;
  if (eff.noFlee && L) L.noFlee = true;
  if (eff.reveal) a.reveal = true;
  // 11夜目：策の文は、その子の今の武器に合わせる（杖の子が「剣を掲げる」と言わないように）
  const raise = (st: Student | null) => { const u = st ? b.units.find((x) => x.studentId === st.id) : null; const w = u?.weaponId ? WEAPONS[u.weaponId] : null; return !w ? '声を張り上げる' : w.type === 'bow' ? '弓を空へ向ける' : w.type === 'gun' ? '銃を高く掲げる' : w.type === 'staff' || w.type === 'holy' ? '杖を高く掲げる' : w.type === 'magic' ? '魔道書を開き、光を灯す' : `${w.name}を掲げる`; };
  const v = { leader: L?.name ?? '敵将', a: planner?.given ?? '策を立てた子', c: captain?.given ?? '部隊長', craise: raise(captain), araise: raise(planner) };
  const text = !ok && sees && !odds.dud ? `かつての教え子、${alum!.given}が策を見抜いた` : fill(r.pick(odds.dud ? d.dud ?? d.ng : ok ? d.ok : d.ng), v);
  const rec: StratRec = { id, ok, dud: odds.dud || undefined, weak: weakHit || undefined, rate: odds.rate, early: early || undefined, text };
  (a.strats ??= []).push(rec);
  a.held = (a.held ?? []).filter((x) => x !== id);
  b.rng = r.h.rng;
  return rec;
}

/** 策の講評（結果の画面） */
export function stratReview(recs: StratRec[]): string[] {
  return recs.map((x) => {
    const n = STRATS[x.id].name;
    if (x.dud) return `「${n}」は不発。天候が合わなかった`;
    if (x.ok && x.weak) return `「${n}」が敵将の弱点を突いた。大きな効き目があった`;
    if (x.ok) return `「${n}」は成功（見込み${x.rate}%）${x.early ? '。早めに切ったのが効いた' : ''}`;
    return `「${n}」は外れた（見込み${x.rate}%）。${x.rate < 40 ? '条件が合っていなかったかもしれない' : '運が悪かった'}`;
  });
}

// ---------- 覚える ----------
/** 新しく覚えられる策を調べて、覚える（発見の演出を処理待ちに）。覚えた策を返す */
export function checkStratUnlocks(s: GameState): StratId[] {
  const known = new Set(knownStrats(s));
  const list = enrolled(s);
  const got: StratId[] = [];
  for (const id of STRAT_IDS) {
    if (known.has(id)) continue;
    const u = STRATS[id].unlock;
    let by: Student | undefined; let why = '';
    if (u.strat !== undefined && u.cha === undefined) { by = list.find((st) => stratOf(st) >= u.strat!); if (by) why = `${by.given}の軍略が身についてきた`; }
    if (!by && u.cha !== undefined) { by = list.find((st) => effectiveStats(st).cha >= u.cha! && (u.strat === undefined || stratOf(st) >= u.strat)); if (by) why = `${by.given}の人を動かす力が育った`; }
    if (!by && u.move) { by = list.find((st) => u.move!.types.includes((CLASSES[st.classId] ?? CLASSES.novice).moveType as MoveType) && stratOf(st) >= u.move!.strat); if (by) why = `${by.given}が騎馬・飛行の戦い方を覚えた`; }
    if (!by && u.talent) { by = list.find((st) => isGood(st, 'tactics') && stratOf(st) >= (u.strat ?? 0) * 0.6); if (by) why = `${by.given}の軍略の才が策を思いついた`; }
    if (!by) continue;
    (s.strats ??= [...START_STRATS]).push(id);
    known.add(id);
    got.push(id);
    s.pending.push({ type: 'newStrat', id, by: by.id, why });
  }
  return got;
}
