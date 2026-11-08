// 戦利品（10夜目）：武器は買わずに、戦いで手に入れる。鉄の武器は学校の備えで、数の制限なし。DOMに依存しない
import { B } from '../data/balance';
import { WEAPONS, ARMS } from '../data/weapons';
import type { WeaponType } from './types';
import type { GameState, ArmoryItem, LootItem, Quest, Student } from './state';
import type { BattleState, Unit } from './battle/types';
import { Rng } from './rng';

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
export function armoryName(a: ArmoryItem | null | undefined): string { return a ? a.named?.name ?? WEAPONS[a.weaponId]?.name ?? '' : ''; }
/** 学校の備えで使える鉄の武器（銃は銃の登場後） */
export function stockList(s: GameState): ArmoryItem[] {
  return Object.values(STOCK).filter((id): id is string => !!id && (id !== 'matchlock' || s.world.gunUnlocked)).map((id) => ({ uid: stockUid(id), weaponId: id }));
}

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
function wtype(u: Unit | undefined): WeaponType | null {
  const w = u?.weaponId ? WEAPONS[u.weaponId] : u?.weapons?.[0] ? WEAPONS[u.weapons[0]] : null;
  return w && TYPE_NAME[w.type] ? w.type : null;
}

/** この戦いの戦利品を決める（戦いの終わりに1回）。雑兵の落とし物・敵将の銘入りの武器（必ず）・依頼の報酬 */
export function rollLoot(s: GameState, b: BattleState, q: Quest | undefined, names: (uid: string) => string): LootItem[] {
  if (b.loot) return b.loot;
  const L = B.loot;
  const r = new Rng({ rng: (b.rng ^ 0x6c6f6f74) | 0 });
  const out: LootItem[] = [];
  const leader = b.auto?.leader ?? b.leader ?? null;
  // 雑兵の落とし物（演習では落とさない）
  if (b.real) {
    let n = 0;
    for (const u of b.units) {
      if (n >= L.maxDrops) break;
      if (u.side !== 'enemy' || !u.dead || b.retreated.includes(u.uid) || u.studentId || (leader && u.uid === leader.uid)) continue;
      const t = wtype(u);
      if (!t || !r.chance(L.dropChance)) continue;
      const tier = u.level >= L.masterLv && r.chance(L.masterChance) ? 'master' : u.level >= L.silverLv && r.chance(L.silverChance) ? 'silver' : 'steel';
      const id = tierOf(t, tier);
      if (!id || (t === 'gun' && !s.world.gunUnlocked)) continue;
      out.push({ weaponId: id, kind: 'drop', from: `${names(u.uid)}が落とした` });
      n++;
    }
  }
  // 敵将を討ち取ったら、その武器を必ず（銘入り）
  if (leader) {
    const lu = b.units.find((u) => u.uid === leader.uid);
    const o = leader.officerId ? (s.officers ?? []).find((x) => x.id === leader.officerId) : null;
    const fell = !!lu?.dead && !leader.fled && !b.retreated.includes(leader.uid) && leader.settled !== 'spare' && leader.settled !== 'persuade';
    const t = wtype(lu);
    if (fell && t && o && o.kind !== 'monster') {
      const lv = lu!.level;
      const id = tierOf(t, lv < L.namedSteelLv ? 'steel' : lv < L.namedSilverLv ? 'silver' : 'master');
      if (id) {
        const given = o?.given ?? leader.name;
        const ep = o?.epithet ? `「${o.epithet}」` : '';
        const killer = b.hitBy?.[leader.uid]?.length ? b.units.find((x) => x.uid === b.hitBy[leader.uid][b.hitBy[leader.uid].length - 1])?.studentId : undefined;
        const kst = killer ? s.students[killer] : null;
        const name = `${given}の${TYPE_NAME[t]}`;
        const story = `${ep}${o ? `${given}` : leader.name}が戦場で振るっていた${TYPE_NAME[t]}。${s.year}年目、${kst ? `${kst.given}が` : ''}討ち取って手に入れた。`;
        out.push({ weaponId: id, kind: 'named', from: `${leader.name}を討ち取った`, named: { name, story, officerId: o?.id, by: kst?.id, year: s.year, ...L.named } });
      }
    }
  }
  // 依頼の報酬
  if (q?.rewardWeapon && b.result === 'win' && WEAPONS[q.rewardWeapon]) out.push({ weaponId: q.rewardWeapon, kind: 'reward', from: `${q.client}からの報酬` });
  b.loot = out;
  return out;
}

/** 戦利品を武器庫へ */
export function takeLoot(s: GameState, loot: LootItem[]): LootItem[] {
  for (const x of loot) {
    if (x.uid) continue;
    const uid = `w${s.nextId++}`;
    x.uid = uid;
    s.armory.push({ uid, weaponId: x.weaponId, named: x.named, got: { kind: x.kind, year: s.year, text: x.from } });
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
  return (st.skills[skill] ?? 0) + (w.might + (a.named?.might ?? 0)) * 5 + (a.named ? 3 : 0);
}
void ARMS;
