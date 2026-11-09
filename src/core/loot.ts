// 戦利品（10夜目）：武器は買わずに、戦いで手に入れる。鉄の武器は学校の備えで、数の制限なし。DOMに依存しない
import { B } from '../data/balance';
import { WEAPONS, ARMS } from '../data/weapons';
import type { WeaponType } from './types';
import type { GameState, ArmoryItem, LootItem, Quest, Student } from './state';
import type { TBattle, TUnit } from './tactics/types';
import { Rng } from './rng';
import { itemName, rollAffix, legendOfOfficer, legendLoot, unclaimedLegend, legendTaken, seeWeapon, itemMod, modScore, legendFits } from './rarity';
import { tip } from './tutorial';

/** 学校の備え（鉄の武器。数の制限なし）。出撃の割り当てでは uid を「stock:武器id」で表す */
export const STOCK: Partial<Record<WeaponType, string>> = { sword: 'iron_sword', lance: 'iron_lance', axe: 'iron_axe', bow: 'iron_bow', gun: 'matchlock' };
export const STOCK_IDS = new Set(Object.values(STOCK));
export function isStock(uid: string | null | undefined): boolean { return !!uid && uid.startsWith('stock:'); }
export function stockUid(weaponId: string): string { return `stock:${weaponId}`; }
/** 割り当ての uid から武器庫の品（学校の備えはその場で作る） */
export function armoryItem(s: GameState, uid: string | null | undefined): ArmoryItem | null {
  if (!uid) return null;
  if (isStock(uid)) { const id = uid.slice(6); return WEAPONS[id] ? { uid, weaponId: id } : null; }
  return s.armory.find((a) => a.uid === uid) ?? null;
}
/** 武器の名前（銘入りは銘） */
export function armoryName(a: ArmoryItem | null | undefined): string { return a ? itemName(a) : ''; } // 14夜目：伝説の名・銘・添え名つき
/** 学校の備えで使える鉄の武器（銃は銃の登場後） */
export function stockList(s: GameState): ArmoryItem[] {
  return Object.values(STOCK).filter((id): id is string => !!id && (id !== 'matchlock' || s.world.gunUnlocked)).map((id) => ({ uid: stockUid(id), weaponId: id }));
}

/** 変わった武器（宝箱・落とし物でまれに） */
const SPECIALS: Partial<Record<WeaponType, string[]>> = { sword: ['killing_edge', 'gale_blade'], lance: ['javelin', 'piercer'], axe: ['hand_axe', 'reaper_axe'], bow: ['longbow', 'piercing_bow'] };
const TYPE_NAME: Record<string, string> = { sword: '剣', lance: '槍', axe: '大斧', bow: '弓', gun: '銃' };

/** 種類と段階（鋼・銀・名匠）の武器 */
function tierOf(type: WeaponType, tier: 'steel' | 'silver' | 'master'): string | null {
  const map: Record<string, Record<string, string>> = {
    sword: { steel: 'steel_sword', silver: 'silver_sword', master: 'master_sword' },
    lance: { steel: 'steel_lance', silver: 'silver_lance', master: 'master_lance' },
    axe: { steel: 'steel_axe', silver: 'silver_axe', master: 'master_axe' },
    bow: { steel: 'steel_bow', silver: 'silver_bow', master: 'master_bow' },
    gun: { steel: 'improved_gun', silver: 'long_gun', master: 'master_gun' },
  };
  return map[type]?.[tier] ?? null;
}
const CLASS_WT: Record<string, WeaponType> = { swordsman: 'sword', thief: 'sword', swordmaster: 'sword', warrior: 'axe', lancer: 'lance', cavalier: 'lance', pegasus_rider: 'lance', fighter: 'axe', armor_knight: 'axe', archer: 'bow' };
function wtype(u: TUnit | undefined): WeaponType | null { return u ? CLASS_WT[u.classId] ?? null : null; }
function hashN(x: string): number { let h = 7; for (const c of x) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function lvOf(u: TUnit): number { return Math.max(1, Math.round((u.str + u.def) * 1.4)); }

/** この戦いの戦利品を決める（19夜目：新しい戦い）。雑兵の落とし物・敵将の銘入りの武器・依頼の報酬 */
export function rollLoot(s: GameState, b: TBattle, q: Quest | undefined): LootItem[] {
  const L = B.loot;
  const r = new Rng({ rng: hashN(`${b.questId}|${s.year}|${s.month}|loot`) });
  const out: LootItem[] = [];
  const lu = b.units.find((u) => u.boss);
  if (b.real && b.result === 'win') {
    let n = 0;
    for (const u of b.units) {
      if (n >= L.maxDrops) break;
      if (u.side !== 'foe' || u.alive || u.boss || u.down === 'fled') continue;
      const t = wtype(u);
      if (!t || !r.chance(L.dropChance)) continue;
      const lv = lvOf(u);
      const tier = lv >= L.masterLv && r.chance(L.masterChance) ? 'master' : lv >= L.silverLv && r.chance(L.silverChance) ? 'silver' : 'steel';
      const sp = SPECIALS[t];
      const id = sp?.length && r.chance(L.specialChance) ? r.pick(sp) : tierOf(t, tier);
      if (!id) continue;
      out.push({ weaponId: id, kind: 'drop', from: `${u.name}が落とした`, ...(r.chance(L.rareAffixChance) ? { affix: rollAffix(r, 1) } : {}) });
      n++;
    }
    if (q?.tutorial && !n) { const u = b.units.find((x) => x.side === 'foe' && !x.alive && wtype(x)); const id = u ? tierOf(wtype(u)!, 'steel') : null; if (u && id) out.push({ weaponId: id, kind: 'drop', from: `${u.name}が落とした` }); }
  }
  // 敵将を討ち取ったら、その武器（銘入り）
  const o = lu?.officerId ? (s.officers ?? []).find((x) => x.id === lu.officerId) : null;
  if (lu && o) {
    const fell = !lu.alive && lu.down === 'dead';
    const t = wtype(lu) ?? 'sword';
    const bond = Object.values(s.rivalries ?? {}).some((rv) => rv.oid === o.id && (rv.stage >= 1 || !!rv.vow));
    const sure = (o.rank ?? 2) <= 1 || bond || !!lu.nemesis;
    if (fell && o.kind !== 'monster' && (sure || r.chance(L.namedChance))) {
      const cap = (o.rank ?? 2) >= 2 ? 0 : o.rank === 1 ? 1 : 2;
      const lvTier = o.level < L.namedSteelLv ? 0 : o.level < L.namedSilverLv ? 1 : 2;
      const id = tierOf(t, (['steel', 'silver', 'master'] as const)[Math.min(cap, lvTier)]);
      if (id) {
        const killer = b.units.find((x) => x.uid === lu.lastHitBy)?.studentId;
        const kst = killer ? s.students[killer] : null;
        const ep = o.epithet ? `「${o.epithet}」` : '';
        const name = `${o.given}の${TYPE_NAME[t]}`;
        const story = `${ep}${o.given}が戦場で振るっていた${TYPE_NAME[t]}。${s.year}年目、${kst ? `${kst.given}が` : ''}討ち取って手に入れた。`;
        out.push({ weaponId: id, kind: 'named', from: `${lu.name}を討ち取った`, affix: rollAffix(r, 2), named: { name, story, officerId: o.id, by: kst?.id, year: s.year, ...L.named } });
      }
    }
    const lg = legendOfOfficer(s, o.id);
    if (fell && lg) out.push(legendLoot(lg, `${lu.name}を討ち取り、取りもどした`));
    const rv3 = Object.values(s.rivalries ?? {}).some((rv) => rv.oid === o.id && rv.stage >= 3);
    if (rv3 && fell && b.result === 'win' && !lg && r.chance(L.legendRival)) { const id = unclaimedLegend(s, r); if (id) out.push(legendLoot(id, `宿敵${lu.name}との決着の地で見つかった`)); }
  }
  // 21夜目：盗賊の系統が宝箱から見つけた武器
  for (const f of b.found ?? []) if (f.weaponId && WEAPONS[f.weaponId]) out.push({ weaponId: f.weaponId, kind: 'drop', from: `${b.units.find((u) => u.uid === f.by)?.name ?? '教え子'}が宝箱から見つけた` });
  if (q?.rewardWeapon && b.result === 'win' && WEAPONS[q.rewardWeapon]) out.push({ weaponId: q.rewardWeapon, kind: 'reward', from: `${q.client}からの報酬`, ...(r.chance(L.rareAffixChance) ? { affix: rollAffix(r, 1) } : {}) });
  return out;
}

/** 戦利品を武器庫へ */
export function takeLoot(s: GameState, loot: LootItem[]): LootItem[] {
  for (const x of loot) {
    if (x.uid) continue;
    const uid = `w${s.nextId++}`;
    x.uid = uid;
    const item = { uid, weaponId: x.weaponId, named: x.named, ...(x.affix?.length ? { affix: x.affix } : {}), ...(x.legend ? { legend: x.legend } : {}), got: { kind: x.kind, year: s.year, text: x.from } };
    s.armory.push(item);
    seeWeapon(s, item);
    if (item.legend) { legendTaken(s, item, x.from); tip(s, 'legend'); }
    // 敵将を討った子の年表に（宿敵を討った武器は物語になる）
    const by = x.named?.by ? s.students[x.named.by] : null;
    if (by && x.named) by.history.push({ year: s.year, text: `${x.from.replace(/を討ち取った$/, '')}を討ち、「${x.named.name}」を手に入れた` });
  }
  return loot;
}

/** 依頼に報酬の武器をつける（依頼を並べるとき） */
export function questRewardWeapon(s: GameState, q: Quest, r: Rng): string | undefined {
  if (!q.real || q.danger < 2 || q.small || !r.chance(B.loot.questChance)) return undefined;
  const types = (['sword', 'lance', 'axe', 'bow'] as WeaponType[]).concat(s.world.gunUnlocked ? ['gun'] : []);
  const id = tierOf(r.pick(types), q.level >= B.loot.namedSilverLv ? (r.chance(0.3) ? 'master' : 'silver') : q.level >= B.loot.silverLv ? 'silver' : 'steel');
  return id ?? undefined;
}

/** 評判の段階が上がったとき、国から届く武器（銀か名匠） */
export function repGift(s: GameState, tier: number, r: Rng): LootItem | null {
  if (!B.loot.giftOnRank || tier < 2) return null;
  const types = (['sword', 'lance', 'axe', 'bow'] as WeaponType[]);
  const id = tierOf(r.pick(types), tier >= 4 ? 'master' : 'silver');
  return id ? { weaponId: id, kind: 'gift', from: '学校の評判を聞いた国から' } : null;
}

/** 武器のよさ（自動の割り当て） */
export function armScore(st: Student, a: ArmoryItem): number {
  const w = WEAPONS[a.weaponId];
  if (!w) return -1;
  const skill = (w.type === 'holy' || w.type === 'staff' ? 'faith' : w.type) as keyof Student['skills'];
  // 14夜目：伝説の武器は持ち主を選ぶ。添え名・銘・心得の上乗せも考えに入れる
  if (a.legend && !legendFits(st, a.legend)) return -1;
  return (st.skills[skill] ?? 0) + w.might * 5 + modScore(itemMod(a)) + (a.named || a.legend ? 3 : 0);
}
void ARMS;
