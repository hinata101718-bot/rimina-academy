// 武器のレアリティ（14夜目）。DOM非依存
// ノーマル＝学校の備えの鉄の武器、レア＝鋼・銀・名匠・変わった武器（添え名がつくことがある）、
// ユニーク＝敵将の銘入り（添え名2つ）、レジェンド＝大陸に12振りの伝説の武器（専用の心得・持ち主を選ぶ）
import type { GameState, ArmoryItem, Student, LootItem } from './state';
import { RANK_POINTS, B } from '../data/balance';
import { AFFIXES, AFFIX_IDS, LEGENDS, LEGEND_BY_ID, type Rarity, type WeaponMod } from '../data/rarity';
import { WEAPONS } from '../data/weapons';
import { STOCK_IDS } from './loot';
import { Rng } from './rng';
import { chronicle } from './game';

export function rarityOf(a: { weaponId: string; named?: unknown; legend?: string; engraved?: string } | null | undefined): Rarity {
  if (!a) return 'normal';
  if (a.legend) return 'legend';
  if (a.named) return 'unique';
  if (STOCK_IDS.has(a.weaponId)) return 'normal';
  return 'rare';
}

/** 武器の名前（レジェンドは伝説の名、ユニークは銘、レアは添え名つき） */
export function itemName(a: { weaponId: string; named?: { name: string }; legend?: string; affix?: string[] } | null | undefined): string {
  if (!a) return '';
  if (a.legend && LEGEND_BY_ID[a.legend]) return LEGEND_BY_ID[a.legend].name;
  if (a.named) return a.named.name;
  const w = WEAPONS[a.weaponId]?.name ?? '';
  const af = (a.affix ?? []).map((x) => AFFIXES[x]?.name).filter(Boolean);
  return af.length ? `${af.join('')}${w}` : w;
}

/** 武器の上乗せ（銘・添え名・伝説の心得） */
export function itemMod(a: ArmoryItem | null | undefined): WeaponMod {
  const m: Required<WeaponMod> = { dmg: 0, hit: 0, crit: 0, avo: 0, def: 0 };
  if (!a) return m;
  if (a.named) { m.dmg += a.named.might; m.hit += a.named.hit; m.crit += a.named.crit; }
  for (const x of a.affix ?? []) { const f = AFFIXES[x]?.mod; if (f) for (const k of Object.keys(f) as (keyof WeaponMod)[]) m[k] += f[k] ?? 0; }
  const L = a.legend ? LEGEND_BY_ID[a.legend] : null;
  if (L) for (const k of Object.keys(L.mod) as (keyof WeaponMod)[]) m[k] += L.mod[k] ?? 0;
  return m;
}
/** 伝説の武器の心得の上乗せ（敵将が持つときにも） */
export function legendModOf(id: string): WeaponMod { return { ...(LEGEND_BY_ID[id]?.mod ?? {}) }; }
/** 上乗せの点数（おすすめの持たせ方に使う） */
export function modScore(m: WeaponMod): number { return (m.dmg ?? 0) * 5 + (m.hit ?? 0) * 0.6 + (m.crit ?? 0) * 0.6 + (m.avo ?? 0) * 0.6 + (m.def ?? 0) * 4; }

/** 添え名を n 個（重ならない） */
export function rollAffix(r: Rng, n: number): string[] {
  const out: string[] = [];
  while (out.length < n) { const x = r.pick(AFFIX_IDS); if (!out.includes(x)) out.push(x); }
  return out;
}

/** 伝説の武器が、その子を持ち主に選ぶか */
export function legendFits(st: Student, legendId: string): boolean {
  const L = LEGEND_BY_ID[legendId];
  if (!L) return false;
  const skill = L.type as keyof Student['skills'];
  if ((st.skills[skill] ?? 0) < RANK_POINTS[L.cond.rank]) return false;
  switch (L.cond.kind) {
    case 'trust': return st.trust >= 60;
    case 'noble': return st.house === 'noble';
    case 'frontier': return st.origin === 'frontier';
    case 'kills': return st.kills >= 10;
    case 'cha': return (st.trust ?? 0) >= 60;
    case 'grade3': return st.grade >= 3 || st.status === 'graduated';
    default: return true;
  }
}

// ---------- 伝説の武器の行方 ----------
/** はじめの行方：敵の将軍（頭目）が何振りか持ち、ほかは行方知れず */
export function ensureLegends(s: GameState, r: Rng = new Rng({ rng: (s.createdAt ^ 0x1e9e) | 0 })): void {
  if (s.legends) return;
  s.legends = {};
  const heads = (s.officers ?? []).filter((o) => o.status === 'active' && o.rank === 0 && o.kind !== 'monster');
  const pool = r.shuffle(LEGENDS.filter((l) => l.type !== 'gun'));
  for (const L of LEGENDS) s.legends[L.id] = { holder: 'none', log: [] };
  for (let i = 0; i < Math.min(B.loot.legendHeld, heads.length, pool.length); i++) {
    const o = heads[i], L = pool[i];
    s.legends[L.id] = { holder: 'officer', officerId: o.id, log: [{ year: s.year, text: `${o.family ? `${o.given}・${o.family}` : o.given}が持っている` }] };
  }
}
/** 敵将が持っている伝説の武器 */
export function legendOfOfficer(s: GameState, officerId: string | undefined | null): string | null {
  if (!officerId || !s.legends) return null;
  return Object.entries(s.legends).find(([, v]) => v.holder === 'officer' && v.officerId === officerId)?.[0] ?? null;
}
/** 行方知れずの伝説の武器から1振り（銃は銃の登場後） */
export function unclaimedLegend(s: GameState, r: Rng): string | null {
  const free = Object.entries(s.legends ?? {}).filter(([id, v]) => v.holder === 'none' && (LEGEND_BY_ID[id]?.type !== 'gun' || s.world.gunUnlocked)).map(([id]) => id);
  return free.length ? r.pick(free) : null;
}
/** 伝説の武器を戦利品にする */
export function legendLoot(legendId: string, from: string): LootItem {
  const L = LEGEND_BY_ID[legendId];
  return { weaponId: L.base, kind: 'legend', legend: legendId, from };
}
/** 武器庫に入った伝説の武器の行方を記す（takeLoot から） */
export function legendTaken(s: GameState, a: ArmoryItem, text: string): void {
  if (!a.legend) return;
  ensureLegends(s);
  const st = s.legends![a.legend];
  st.holder = 'school'; st.uid = a.uid; st.officerId = undefined; st.studentId = undefined;
  st.log.push({ year: s.year, text });
  chronicle(s, `伝説の武器「${LEGEND_BY_ID[a.legend].name}」が学校の武器庫に（${text}）`, 'school');
  s.pending.push({ type: 'legend', id: a.legend, uid: a.uid });
}

/** 年度末：敵将が去ったら、伝説の武器はその陣営の新しい将軍へ（いなければ行方知れず）。ときどき古戦場で見つかる */
export function yearlyLegends(s: GameState, r: Rng): LootItem | null {
  ensureLegends(s, r);
  for (const [id, v] of Object.entries(s.legends!)) {
    if (v.holder !== 'officer') continue;
    const o = (s.officers ?? []).find((x) => x.id === v.officerId);
    if (o && o.status === 'active') continue;
    const next = o ? (s.officers ?? []).find((x) => x.faction === o.faction && x.status === 'active' && x.rank === 0 && !legendOfOfficer(s, x.id)) : null;
    if (next) { v.officerId = next.id; v.log.push({ year: s.year, text: `${next.given}の手に渡った` }); }
    else { v.holder = 'none'; v.officerId = undefined; v.log.push({ year: s.year, text: '持ち主が去り、行方知れずに' }); }
    void id;
  }
  for (const v of Object.values(s.legends!)) if (v.holder === 'alumni') {
    const st = v.studentId ? s.students[v.studentId] : null;
    if (!st || (st.career && !st.career.alive) || st.status === 'dead') { v.holder = 'none'; v.studentId = undefined; v.log.push({ year: s.year, text: '持ち主の卒業生が亡くなり、行方知れずに' }); }
  }
  if (r.chance(B.loot.legendFind)) { const id = unclaimedLegend(s, r); if (id) return legendLoot(id, '古戦場を掘り返した農夫が見つけ、学校に届けた'); }
  return null;
}

/** 卒業：その子がいちばん使ったユニーク以上の武器を持っていく（後輩に託すときは武器庫に残す） */
export function favoriteItem(s: GameState, st: Student): ArmoryItem | null {
  const list = s.armory.filter((a) => (a.named || a.legend) && (a.uses?.[st.id] ?? 0) >= 2);
  return list.sort((a, b) => (b.uses?.[st.id] ?? 0) - (a.uses?.[st.id] ?? 0))[0] ?? null;
}
export function graduateWith(s: GameState, st: Student, a: ArmoryItem): void {
  s.armory = s.armory.filter((x) => x.uid !== a.uid);
  if (a.legend && s.legends?.[a.legend]) { const v = s.legends[a.legend]; v.holder = 'alumni'; v.studentId = st.id; v.uid = undefined; v.log.push({ year: s.year, text: `卒業する${st.given}が持っていった` }); }
}

/** 武器の図鑑に載せる */
export function seeWeapon(s: GameState, a: { weaponId: string; legend?: string }): void {
  s.weaponSeen ??= [];
  for (const k of [a.weaponId, a.legend ? `legend:${a.legend}` : '']) if (k && !s.weaponSeen.includes(k)) s.weaponSeen.push(k);
}
