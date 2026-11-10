// 22夜目⑤：生徒ごとの武器の装備（docs/feedback.md「生徒ごとに武器を装備したい」）。DOMに依存しない
// 1つの武器を持てるのは1人だけ。装備のない子は、出撃のたびに今までどおり自動で持たせる（学校の備えの鉄の武器も）
import { WEAPONS } from '../data/weapons';
import { WTYPE_ATK } from '../data/tactics';
import type { GameState, Student, ArmoryItem } from './state';
import { canEquip, bestArmoryWeapon } from './sortie';
import { armoryItem, isStock } from './loot';
import { itemName, itemMod, rarityOf } from './rarity';
import { notify } from './game';

/** その武器を装備している子（在学中の子だけ） */
export function holderOf(s: GameState, uid: string, except?: string): Student | null {
  return Object.values(s.students).find((x) => x.status === 'enrolled' && x.equip === uid && x.id !== except) ?? null;
}
/** 装備している武器（武器庫にない・使えないものは null） */
export function equipped(s: GameState, st: Student): ArmoryItem | null {
  if (!st.equip) return null;
  const a = armoryItem(s, st.equip);
  return a && !isStock(a.uid) && canEquip(st, a.weaponId) ? a : null;
}
/** 装備する（ほかの子が持っていれば、付け替える）。null で外す */
export function equipWeapon(s: GameState, st: Student, uid: string | null): { ok: boolean; from?: string } {
  if (!uid) { st.equip = undefined; return { ok: true }; }
  const a = armoryItem(s, uid);
  if (!a || isStock(uid) || !canEquip(st, a.weaponId)) return { ok: false };
  const h = holderOf(s, uid, st.id);
  if (h) h.equip = undefined;
  st.equip = uid;
  return { ok: true, from: h?.given };
}
/** おまかせで選ぶ：ほかの子が装備していない武器のうち、いちばん合うもの（学校の備えの鉄がいちばんなら、装備なし＝自動） */
export function autoEquip(s: GameState, st: Student): string | null {
  const taken = new Set(Object.values(s.students).filter((x) => x.status === 'enrolled' && x.id !== st.id && x.equip).map((x) => x.equip!));
  const best = bestArmoryWeapon(s, st, taken);
  st.equip = best && !isStock(best) ? best : undefined;
  return st.equip ?? null;
}
/** その子が装備できる武器庫の武器（愛用の回数の多い順 → 威力の高い順） */
export interface EquipOption { a: ArmoryItem; name: string; might: number; atk: string; rarity: ReturnType<typeof rarityOf>; uses: number; holder: Student | null }
export function equipOptions(s: GameState, st: Student): EquipOption[] {
  const out: EquipOption[] = [];
  for (const a of s.armory) {
    const w = WEAPONS[a.weaponId];
    if (!w || w.type === 'staff' || !canEquip(st, a.weaponId)) continue;
    out.push({ a, name: itemName(a), might: w.might + (a.named?.might ?? 0) + (itemMod(a).dmg ?? 0), atk: WTYPE_ATK[w.type]?.type ?? 'slash', rarity: rarityOf(a), uses: a.uses?.[st.id] ?? 0, holder: holderOf(s, a.uid, st.id) });
  }
  return out.sort((x, y) => Number(x.a.uid === st.equip) * -1 + Number(y.a.uid === st.equip) || y.uses - x.uses || y.might - x.might);
}
/** 使えなくなった装備を外す（兵種が変わった・武器庫から消えた・卒業した）。外した子にはお知らせ */
export function checkEquip(s: GameState, st: Student, quiet = false): boolean {
  if (!st.equip) return false;
  const a = armoryItem(s, st.equip);
  const gone = !a || isStock(st.equip) || st.status !== 'enrolled';
  if (!gone && canEquip(st, a!.weaponId)) return false;
  const name = a ? itemName(a) : '';
  st.equip = undefined;
  if (!quiet && !gone && name) notify(s, `${st.given}は兵種が変わり、${name}を使えなくなったので外した`, st.id);
  return true;
}
export function cleanEquips(s: GameState): void {
  const seen = new Set<string>();
  for (const st of Object.values(s.students)) {
    if (!st.equip) continue;
    if (checkEquip(s, st, st.status !== 'enrolled')) continue;
    if (seen.has(st.equip)) { st.equip = undefined; continue; }
    seen.add(st.equip);
  }
}
