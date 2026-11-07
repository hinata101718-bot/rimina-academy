// 経験値とレベルアップ
import { B, STATS } from '../data/balance';
import { CLASSES } from '../data/classes';
import { TRAITS } from '../data/people';
import type { Stats } from './types';
import type { GameState, Student } from './state';
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
  for (const k of STATS) out[k] = Math.max(0, Math.min(100, Math.round(out[k])));
  return out;
}

export interface LevelUpResult { level: number; gains: Partial<Stats> }

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
