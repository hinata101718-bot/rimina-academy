import { RANKS, RANK_POINTS, STATS } from '../data/balance';
import type { Rank, SkillId, Stats, CountryId } from './types';

export function rankOf(points: number): Rank {
  let r: Rank = 'E';
  for (const k of RANKS) if (points >= RANK_POINTS[k]) r = k;
  return r;
}
export function rankIndex(r: Rank): number { return RANKS.indexOf(r); }
export function meetsRank(points: number, need: Rank): boolean { return points >= RANK_POINTS[need]; }
/** ランクの大分類（E/D/C/B/A/S） */
export function rankLetter(points: number): string { return rankOf(points).replace('+', ''); }
export function nextRankPoints(points: number): number | null {
  for (const k of RANKS) if (RANK_POINTS[k] > points) return RANK_POINTS[k];
  return null;
}
export function emptyStats(v = 0): Stats {
  const s = {} as Stats; for (const k of STATS) s[k] = v; return s;
}
export function emptySkills(v = 0): Record<SkillId, number> {
  return { sword: v, lance: v, axe: v, bow: v, magic: v, faith: v, riding: v, heavy: v, flying: v, gun: v, tactics: v, command: v };
}
export function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
export function relKey(a: CountryId, b: CountryId): 'ke' | 'ea' | 'ak' {
  const s = [a, b].sort().join('-');
  if (s === 'empire-kingdom') return 'ke';
  if (s === 'alliance-empire') return 'ea';
  return 'ak';
}
export function pairKey(a: string, b: string): string { return a < b ? `${a}|${b}` : `${b}|${a}`; }
export const MONTH_NAMES = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
export function absMonth(year: number, month: number): number { return (year - 1) * 12 + month; }

/** いちばん育った技能 */
export function bestSkillOf(st: { skills: Record<string, number> }): import('./types').SkillId {
  return (['sword', 'lance', 'axe', 'bow', 'magic', 'faith', 'riding', 'heavy', 'flying', 'gun', 'tactics', 'command'] as import('./types').SkillId[]).filter((k) => k !== 'gun' || (st.skills.gun ?? 0) > 0).sort((a, b) => (st.skills[b] ?? 0) - (st.skills[a] ?? 0))[0];
}

/** 21夜目④：期の呼び名。はじめからいた上級生（期が0以下）は「はじめの上級生」 */
export function cohortName(n: number, short = false): string { return n >= 1 ? `${n}期${short ? '' : '生'}` : 'はじめの上級生'; }
