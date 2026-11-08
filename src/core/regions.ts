// 勢力図（13夜目）：地域の持ち主・戦いで動く国境・戦いの印・地域にいる教え子・名産。DOMに依存しない
import { REGIONS, REGION_ADJ, REGION_BY_ID, REGION_BY_IDX, type RegionHome } from '../data/regions';
import { COUNTRY_SHORT } from '../data/people';
import { B } from '../data/balance';
import type { CountryId } from './types';
import type { GameState, Student, Quest } from './state';
import { Rng } from './rng';
import { atWar } from './world';

export type Owner = RegionHome;
const COUNTRIES: CountryId[] = ['kingdom', 'empire', 'alliance'];
export const OWNER_NAMES: Record<Owner, string> = { kingdom: '王国', empire: '帝国', alliance: '同盟', school: 'リミナ分校', wild: '無主地' };

/** 地域の持ち主（なければはじめの形で作る） */
export function ensureRegions(s: GameState): Record<string, Owner> {
  s.world.regions ??= Object.fromEntries(REGIONS.map((r) => [r.id, r.home]));
  for (const r of REGIONS) s.world.regions[r.id] ??= r.home;
  return s.world.regions;
}
export function ownerOf(s: GameState, id: string): Owner { return s.world.regions?.[id] ?? REGION_BY_ID[id]?.home ?? 'wild'; }
/** となりあう地域の id */
export function neighbors(id: string): string[] {
  const r = REGION_BY_ID[id]; if (!r) return [];
  return REGION_ADJ.filter(([a, b]) => a === r.idx || b === r.idx).map(([a, b]) => REGION_BY_IDX[a === r.idx ? b : a]?.id).filter((x): x is string => !!x);
}
/** 2つの国がとなりあう地域（国境）。a 側の地域の id */
export function borderOf(s: GameState, a: CountryId, b: CountryId): string[] {
  return REGIONS.filter((r) => ownerOf(s, r.id) === a && neighbors(r.id).some((n) => ownerOf(s, n) === b)).map((r) => r.id);
}
function atWarPair(s: GameState, a: CountryId, b: CountryId): boolean { return atWar(s, a, b); }
/** 地域の持ち主を変える（年表・新聞・変化の記録に） */
export function setOwner(s: GameState, id: string, to: Owner, why = ''): void {
  const from = ownerOf(s, id);
  if (from === to) return;
  ensureRegions(s)[id] = to;
  const r = REGION_BY_ID[id];
  (s.world.regionLog ??= []).push({ year: s.year, month: s.month, id, from, to });
  if (s.world.regionLog.length > 60) s.world.regionLog.splice(0, s.world.regionLog.length - 60);
  if (to !== 'school' && from !== 'school') s.chronicle.push({ year: s.year, month: s.month, text: `${r?.name ?? id}が${OWNER_NAMES[to]}の手に（${OWNER_NAMES[from]}から）${why}`, kind: 'world' });
}

/** 年度末：戦争中の国どうしで、強いほうが国境の地域を奪うことがある。統一のときは大陸が一色に */
export function yearlyRegions(s: GameState, r: Rng): string[] {
  ensureRegions(s);
  const out: string[] = [];
  const last = (s.endings ?? [])[s.endings!?.length - 1];
  if (last && last.kind === 'unify' && last.country && last.year === s.year) {
    for (const x of REGIONS) if (x.home !== 'school' && ownerOf(s, x.id) !== last.country) setOwner(s, x.id, last.country as CountryId, '（統一）');
    out.push(`大陸は${COUNTRY_SHORT[last.country as CountryId]}の色に染まった`);
    return out;
  }
  const P = B.regions;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const a = COUNTRIES[i], b = COUNTRIES[j];
    if (!atWarPair(s, a, b)) continue;
    const pa = s.world.power[a], pb = s.world.power[b];
    const [win, lose] = pa >= pb ? [a, b] : [b, a];
    const diff = Math.abs(pa - pb);
    const cand = borderOf(s, lose, win).filter((id) => REGION_BY_ID[id].kind !== 'capital');
    if (!cand.length) continue;
    if (r.chance(Math.min(P.captureMax, P.captureBase + diff * P.capturePerPower))) {
      const id = r.pick(cand);
      setOwner(s, id, win);
      out.push(`${REGION_BY_ID[id].name}が${COUNTRY_SHORT[win]}の手に落ちた`);
    }
  }
  // 平和が続くと、奪われた地域がもとの国に戻ることがある（和平の約束）
  if (!atWar(s, 'kingdom', 'empire') && !atWar(s, 'empire', 'alliance') && !atWar(s, 'kingdom', 'alliance') && r.chance(P.returnInPeace)) {
    const back = REGIONS.filter((x) => x.home !== 'school' && x.home !== 'wild' && ownerOf(s, x.id) !== x.home);
    if (back.length) { const x = r.pick(back); setOwner(s, x.id, x.home, '（和平の約束で返された）'); out.push(`${x.name}がもとの${OWNER_NAMES[x.home]}に戻った`); }
  }
  return out;
}

/** 戦いの最中の地域（⚔）：戦争中の国どうしの国境 */
export function warRegions(s: GameState): string[] {
  const out = new Set<string>();
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const a = COUNTRIES[i], b = COUNTRIES[j];
    if (!atWarPair(s, a, b)) continue;
    const bd = borderOf(s, a, b);
    if (bd.length) out.add(bd[0]);
  }
  return [...out];
}
/** その地域にいる教え子（その国に仕える卒業生を、名前から地域に割りふる） */
export function alumniIn(s: GameState, id: string): Student[] {
  const owner = ownerOf(s, id);
  if (owner === 'school') return Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive && (x.career.kind === 'stay' || x.career.instructor));
  if (owner === 'wild') return Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive && !x.career.retired && x.career.kind === 'merc').slice(0, 6);
  const mine = REGIONS.filter((r) => ownerOf(s, r.id) === owner).map((r) => r.id);
  return Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive && !x.career.retired && x.career.kind === 'army' && x.career.country === owner)
    .filter((x) => mine[[...x.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % mine.length] === id);
}
/** 三国の地域の数（帯の割合） */
export function regionShare(s: GameState): Record<Owner, number> {
  const out: Record<Owner, number> = { kingdom: 0, empire: 0, alliance: 0, school: 0, wild: 0 };
  for (const r of REGIONS) out[ownerOf(s, r.id)] += 1;
  return out;
}
/** 国の地域の多さによる倍率（はじめの数と比べる）：援助金・入学者の出身に効く（13夜目の段階2） */
export function regionMul(s: GameState, c: CountryId): number {
  const home = REGIONS.filter((r) => r.home === c).length;
  const now = REGIONS.filter((r) => ownerOf(s, r.id) === c).length;
  return Math.max(B.regions.mulMin, Math.min(B.regions.mulMax, now / Math.max(1, home)));
}

/** 依頼の場所（13夜目の段階2）：依頼主と敵の国の国境、なければ依頼主の地域 */
export function questRegion(s: GameState, q: Pick<Quest, 'clientCountry' | 'enemyCountry' | 'kind'>, r: Rng): string | undefined {
  if (q.clientCountry && q.enemyCountry) {
    const bd = [...borderOf(s, q.clientCountry, q.enemyCountry), ...borderOf(s, q.enemyCountry, q.clientCountry)];
    if (bd.length) return r.pick(bd);
  }
  if (q.clientCountry) { const mine = REGIONS.filter((x) => ownerOf(s, x.id) === q.clientCountry); if (mine.length) return r.pick(mine).id; }
  if (q.kind === 'bandit') return REGIONS.find((x) => x.home === 'wild')?.id;
  return undefined;
}
/** 依頼の結果で地域の色が変わる（守る・奪う戦い） */
export function questRegionResult(s: GameState, q: Quest, win: boolean, r: Rng): string | null {
  if (!q.region || !q.real || q.small || !q.clientCountry || !q.enemyCountry) return null;
  const owner = ownerOf(s, q.region);
  const name = REGION_BY_ID[q.region]?.name ?? '';
  if (REGION_BY_ID[q.region]?.kind === 'capital') return null;
  if (win && owner === q.enemyCountry && r.chance(B.regions.questTake)) { setOwner(s, q.region, q.clientCountry, '（教え子たちの戦いで）'); return `${name}を${COUNTRY_SHORT[q.clientCountry]}が取りもどした`; }
  if (!win && owner === q.clientCountry && r.chance(B.regions.questLose)) { setOwner(s, q.region, q.enemyCountry, ''); return `${name}が${COUNTRY_SHORT[q.enemyCountry]}の手に落ちた`; }
  return null;
}

/** 勢力図を前に見たときからの変化（③：場面で見せる） */
export function mapChanges(s: GameState): { id: string; from: Owner; to: Owner; year: number }[] {
  const seen = s.mapSeen;
  if (!seen) return [];
  const now = Object.fromEntries(REGIONS.map((r) => [r.id, ownerOf(s, r.id)]));
  return REGIONS.filter((r) => seen.o[r.id] && seen.o[r.id] !== now[r.id]).map((r) => ({ id: r.id, from: seen.o[r.id] as Owner, to: now[r.id], year: [...(s.world.regionLog ?? [])].reverse().find((x) => x.id === r.id)?.year ?? s.year }));
}
export function markMapSeen(s: GameState): void { s.mapSeen = { at: s.year * 12 + s.month, o: Object.fromEntries(REGIONS.map((r) => [r.id, ownerOf(s, r.id)])) }; }
