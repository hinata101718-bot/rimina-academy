// カレンダー：今月の行事と「次の行事まであと○週」。DOMに依存しない
import type { GameState } from './state';
import { examCandidates } from './exam';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** 月（0=4月）→季節 */
export function seasonOf(month: number): Season {
  if (month <= 1 || month === 11) return 'spring';
  if (month <= 4) return 'summer';
  if (month <= 7) return 'autumn';
  return 'winter';
}
export const SEASON_NAMES: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

/** slot：1〜4＝その週、5＝月末 */
export interface CalEvent { slot: number; label: string; icon: string; big?: boolean }

/** 一年の決まった行事 */
const YEARLY: { month: number; slot: number; label: string; icon: string }[] = [
  { month: 0, slot: 1, label: '入学式', icon: 'ceremony' },
  { month: 3, slot: 1, label: '夏の合宿', icon: 'camp' },
  { month: 5, slot: 5, label: '公開演武会', icon: 'flag' },
  { month: 8, slot: 1, label: '収穫祭', icon: 'lantern' },
  { month: 11, slot: 5, label: '卒業式', icon: 'ceremony' },
];

export function monthEvents(s: GameState, month = s.month): CalEvent[] {
  const out: CalEvent[] = YEARLY.filter((e) => e.month === month).map((e) => ({ slot: e.slot, label: e.label, icon: e.icon, big: true }));
  if (month === 3) for (const w of [2, 3, 4]) out.push({ slot: w, label: '合宿', icon: 'camp' });
  if (month === 8) for (const w of [2, 3, 4]) out.push({ slot: w, label: '収穫祭', icon: 'lantern' });
  if (month === s.month && s.world.schoolDefensePending) out.push({ slot: 5, label: '学校防衛戦', icon: 'shield', big: true });
  else if (month !== 5) out.push({ slot: 5, label: '月末の依頼', icon: 'battle' });
  if (month === s.month && examCandidates(s).length) out.push({ slot: s.week, label: '兵種試験', icon: 'exam' });
  return out;
}

/** 次の大きな行事まであと何週か（0＝今週） */
export function nextEvent(s: GameState): { label: string; weeks: number } | null {
  const pos = (m: number, slot: number) => m * 4 + Math.min(4, slot) - 1 + (slot === 5 ? 0.5 : 0);
  const now = pos(s.month, s.week);
  let best: { label: string; weeks: number } | null = null;
  for (const e of YEARLY) {
    let p = pos(e.month, e.slot);
    if (p < now) p += 48;
    const weeks = Math.ceil(p - now);
    if (!best || weeks < best.weeks) best = { label: e.label, weeks };
  }
  return best;
}
