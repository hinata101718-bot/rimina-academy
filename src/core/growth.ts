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
  // 8夜目：合計も5%きざみ
  for (const k of STATS) out[k] = Math.max(0, Math.min(100, round5(out[k])));
  return out;
}

/** 5の倍数に丸める（四捨五入）。8夜目：成長率は5%きざみ */
export function round5(v: number): number { return Math.round(v / 5) * 5; }

/** 成長率の内わけ：本人 ＋ 兵種 ＋ 才能・特徴 ＝ 合計（個人ページ用） */
export interface GrowthPart { own: number; cls: number; extra: number; total: number }
export function growthParts(st: Student): Record<keyof Stats, GrowthPart> {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  const total = growthRates(st);
  const tal = st.talent ? TALENTS[st.talent]?.stats ?? {} : {};
  const out = {} as Record<keyof Stats, GrowthPart>;
  for (const k of STATS) {
    const own = st.growth[k] - ((tal as Partial<Stats>)[k] ?? 0);
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

export function levelUp(rng: Rng, st: Student): Partial<Stats> {
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
  return gains;
}
