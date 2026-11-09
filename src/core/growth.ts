// 経験値とレベルアップ
import { B, STATS, SKILLS } from '../data/balance';
import { CLASSES } from '../data/classes';
import { TRAITS, TALENTS } from '../data/people';
import type { Stats, SkillId } from './types';
import type { GameState, Student, GrowthEntry } from './state';
import { Rng } from './rng';

export function growthRates(st: Student): Stats {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  const out = { ...st.growth };
  for (const [k, v] of Object.entries(c.growth)) out[k as keyof Stats] += v as number;
  const yi = Math.max(0, Math.min(2, (st.grade || 3) - 1));
  for (const t of st.traits) {
    const g = TRAITS[t].growthByYear;
    if (g && st.status === 'enrolled') for (const k of STATS) out[k] += g[yi];
  }
  if (st.career) for (const k of STATS) out[k] = out[k] * (1 + st.career.growthMul);
  // 19夜目：全盛期と衰え（若いうちは伸び、年をとると伸びにくくなる）
  const pm = primeMul(st.age);
  if (pm !== 1) for (const k of STATS) out[k] = out[k] * pm;
  // 8夜目：合計も5%きざみ
  for (const k of STATS) out[k] = Math.max(0, Math.min(100, round5(out[k])));
  return out;
}

/** 19夜目：全盛期と衰え。年齢ごとの伸びやすさの倍率（衰えは decline で） */
export function primeMul(age: number): number { const P = B.prime; return age <= P.peakEnd ? 1 : age <= P.slowEnd ? P.slowMul : age <= P.stopAt ? P.lateMul : 0; }
/** 年をとると能力が落ちる（年度末に呼ぶ。宿敵も教え子も） */
export function decline(st: { age: number; stats: Stats }, rng: Rng): string[] {
  const P = B.prime;
  if (st.age < P.declineAt) return [];
  const out: string[] = [];
  for (const k of STATS) if (rng.chance(P.declineChance + (st.age - P.declineAt) * P.declinePerYear) && st.stats[k] > 3) { st.stats[k] -= 1; out.push(k); }
  return out;
}
/** 全盛期の言葉 */
export function primeLabel(age: number): string { const P = B.prime; return age <= P.peakEnd ? '伸び盛り' : age <= P.slowEnd ? '全盛期' : age < P.declineAt ? '円熟' : '衰え'; }

/** 5の倍数に丸める（四捨五入）。8夜目：成長率は5%きざみ */
export function round5(v: number): number { return Math.round(v / 5) * 5; }

/** 成長率の内わけ：本人 ＋ 兵種 ＋ 才能・特徴 ＝ 合計（個人ページ用） */
export interface GrowthPart { own: number; cls: number; extra: number; total: number }
export function growthParts(st: Student): Record<keyof Stats, GrowthPart> {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  const total = growthRates(st);
  const out = {} as Record<keyof Stats, GrowthPart>;
  for (const k of STATS) {
    const own = st.growth[k]; // 10夜目：隠れた才能はなくなり、本人の成長率に入っている
    const cls = (c.growth as Partial<Stats>)[k] ?? 0;
    out[k] = { own, cls, extra: total[k] - own - cls, total: total[k] };
  }
  return out;
}

/** 兵種の補正が見えるようにする（兵種図鑑：生徒か卒業生が初めてなった兵種） */
export function markClassSeen(s: GameState, classId: string): boolean {
  s.classSeen ??= [];
  if (s.classSeen.includes(classId)) return false;
  s.classSeen.push(classId);
  return true;
}

export interface LevelUpResult { level: number; gains: Partial<Stats> }

// ---- 成長の記録（演出用） ----
let collector: Map<string, LevelUpResult[]> | null = null;
export interface GrowthSnap { exp: number; level: number; stats: Stats; skills: Record<SkillId, number> }
/** 記録を始める（この間の gainExp のレベルアップを生徒ごとに集める） */
export function startGrowthLog(): void { collector = new Map(); }
export function stopGrowthLog(): void { collector = null; }
export function snapGrowth(st: Student): GrowthSnap {
  return { exp: st.exp, level: st.level, stats: { ...st.stats }, skills: { ...st.skills } };
}
export function diffGrowth(st: Student, snap: GrowthSnap, spells: string[] = [], why?: string): GrowthEntry {
  const skills = SKILLS.filter((k) => Math.round(st.skills[k]) !== Math.round(snap.skills[k])).map((k) => ({ k, p0: snap.skills[k], p1: st.skills[k] }));
  return {
    id: st.id, exp0: snap.exp, lv0: snap.level, exp1: st.exp, lv1: st.level,
    ups: collector?.get(st.id) ?? [], stats0: snap.stats, skills, spells, why,
  };
}

/** 経験値を加える。レベルアップした内容を返す */
export function gainExp(s: GameState, rng: Rng, st: Student, amount: number, mulDifficulty = true): LevelUpResult[] {
  const ups: LevelUpResult[] = [];
  if (st.level >= B.student.maxLevel) return ups;
  st.exp += Math.round(amount * (mulDifficulty ? s.settings.mods.exp : 1));
  while (st.exp >= B.student.expPerLevel && st.level < B.student.maxLevel) {
    st.exp -= B.student.expPerLevel;
    st.level += 1;
    ups.push({ level: st.level, gains: levelUp(rng, st) });
  }
  if (collector && ups.length) collector.set(st.id, [...(collector.get(st.id) ?? []), ...ups]);
  if (st.level >= B.student.maxLevel) st.exp = 0;
  return ups;
}

/** シミュレーション用：在学中のレベルアップの回数と、上がった能力の数の合計（10夜目：平均3〜4つが目標） */
export const growthCount = { ups: 0, stats: 0, pinned: 0 };
export function levelUp(rng: Rng, st: Student): Partial<Stats> {
  const out = levelUpMain(rng, st);
  if (st.status === 'enrolled') { growthCount.ups += 1; growthCount.stats += Object.keys(out).length; }
  return out;
}
function levelUpMain(rng: Rng, st: Student): Partial<Stats> {
  const g = growthRates(st);
  const school = st.status === 'enrolled';
  const gains: Partial<Stats> = {};
  for (const k of STATS) {
    const cap = k === 'hp' ? (school ? B.student.hpCapSchool : B.student.hpCapGrad) : school ? B.student.statCapSchool : B.student.statCapGrad;
    let inc = 0;
    let rate = g[k];
    while (rate > 0) { if (rng.next() * 100 < Math.min(100, rate)) inc++; rate -= 100; }
    if (inc && st.stats[k] < cap) { st.stats[k] = Math.min(cap, st.stats[k] + inc); gains[k] = inc; }
  }
  // 8夜目「2ピン保証」（ヒナタさん指定）：上がった能力が2つ未満なら、まだ上がっていない能力から成長率の高いものほど選ばれやすいくじで、2つになるまで足す（上限の能力は除く）
  let guard = 0;
  while (Object.keys(gains).length < B.student.levelUpMin && guard++ < 10) {
    const cands = STATS.filter((k) => !gains[k] && st.stats[k] < (k === 'hp' ? (school ? B.student.hpCapSchool : B.student.hpCapGrad) : school ? B.student.statCapSchool : B.student.statCapGrad));
    if (!cands.length) break;
    const k = rng.weighted(cands, (x) => Math.max(5, g[x]));
    st.stats[k] += 1; gains[k] = 1;
    if (st.status === 'enrolled') growthCount.pinned += 1;
  }
  return gains;
}
