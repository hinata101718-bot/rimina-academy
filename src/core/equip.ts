// 22夜目⑤：生徒ごとの武器の装備。DOMに依存しない
// 武器庫の武器（学校の備えの鉄の武器は除く）を、1つにつき1人だけが装備する。装備のない子は、出撃のたびに自動で選ぶ（今までどおり）
import { WEAPONS } from '../data/weapons';
import type { GameState, Student, ArmoryItem } from './state';
import { canEquip } from './sortie';
import { armScore } from './loot';
import { notify } from './game';
import { itemName } from './rarity';

/** その子がいま装備している武器（使えないものは null） */
export function equipped(s: GameState, st: Student): ArmoryItem | null {
  if (!st.equip) return null;
  return s.armory.find((a) => a.uid === st.equip) ?? null;
}
/** その武器を装備している子 */
export function holderOf(s: GameState, uid: string): Student | null {
  return Object.values(s.students).find((x) => x.status === 'enrolled' && x.equip === uid) ?? null;
}
/** その子が使える武器庫の武器（兵種と技能のランク・伝説の武器は持ち主を選ぶ）。よい順 */
export function equippable(s: GameState, st: Student): ArmoryItem[] {
  return s.armory.filter((a) => WEAPONS[a.weaponId] && WEAPONS[a.weaponId].type !== 'staff' && canEquip(st, a.weaponId) && armScore(st, a) >= 0)
    .sort((a, b) => armScore(st, b) - armScore(st, a));
}
/** 装備する（ほかの子が持っていたら付け替える）。uid が null なら外す */
export function equipItem(s: GameState, studentId: string, uid: string | null): { ok: boolean; from?: string } {
  const st = s.students[studentId];
  if (!st) return { ok: false };
  if (!uid) { st.equip = null; return { ok: true }; }
  const a = s.armory.find((x) => x.uid === uid);
  if (!a || !equippable(s, st).includes(a)) return { ok: false };
  const h = holderOf(s, uid);
  if (h && h.id !== st.id) h.equip = null;
  st.equip = uid;
  return { ok: true, from: h && h.id !== st.id ? h.given : undefined };
}
/** おまかせで選ぶ：ほかの子が装備していない武器のうち、いちばんよいもの（なければ外す） */
export function autoEquip(s: GameState, studentId: string): ArmoryItem | null {
  const st = s.students[studentId];
  if (!st) return null;
  const best = equippable(s, st).find((a) => { const h = holderOf(s, a.uid); return !h || h.id === st.id; }) ?? null;
  st.equip = best?.uid ?? null;
  return best;
}
/** 兵種が変わった・卒業した・武器がなくなったなどで使えなくなった装備を外す（お知らせつき） */
export function checkEquips(s: GameState): string[] {
  const out: string[] = [];
  for (const st of Object.values(s.students)) {
    if (!st.equip) continue;
    const a = s.armory.find((x) => x.uid === st.equip);
    if (st.status !== 'enrolled') { st.equip = null; continue; }
    if (!a) { st.equip = null; continue; }
    if (!equippable(s, st).includes(a)) {
      st.equip = null;
      const t = `${st.given}は今の兵種では${itemName(a)}を使えないので、装備を外しました`;
      notify(s, t, st.id); out.push(t);
    }
  }
  return out;
}
