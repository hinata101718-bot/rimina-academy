// 戦闘の計算式（FE準拠）
import { B } from '../../data/balance';
import { WEAPONS } from '../../data/weapons';
import { ABILITIES } from '../../data/abilities';
import { CLASSES } from '../../data/classes';
import { PERSONALITIES } from '../../data/people';
import type { WeaponDef, AbilityDef, PersonalityId } from '../types';
import type { BattleState, Unit, CombatForecast, Terrain } from './types';
import { clamp } from '../util';

export function tile(b: BattleState, x: number, y: number): Terrain {
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return 'wall';
  return b.tiles[y * b.width + x];
}
export function terrainDef(t: Terrain) { return B.terrain[t]; }
export function dist(a: { x: number; y: number }, c: { x: number; y: number }): number { return Math.abs(a.x - c.x) + Math.abs(a.y - c.y); }
export function unitAt(b: BattleState, x: number, y: number): Unit | undefined {
  return b.units.find((u) => !u.dead && u.x === x && u.y === y);
}
export function moveTypeOf(u: Unit) { return (CLASSES[u.classId] ?? CLASSES.novice).moveType; }
export function moveOf(b: BattleState, u: Unit): number {
  let m = (CLASSES[u.classId] ?? CLASSES.novice).move;
  if (b.weather === 'rain' && moveTypeOf(u) !== 'flying') m += B.battle.rainMove;
  return Math.max(1, m);
}
export function weaponOf(u: Unit): WeaponDef | null { return u.weaponId ? WEAPONS[u.weaponId] ?? null : null; }
export function isFriendly(a: Unit, c: Unit): boolean {
  const ally = (u: Unit) => u.side === 'player' || u.side === 'ally' || u.side === 'npc';
  return ally(a) === ally(c);
}
export function abilitiesOf(u: Unit): AbilityDef[] { return u.abilities.map((id) => ABILITIES[id]).filter(Boolean); }
function sumAb(u: Unit, key: keyof AbilityDef): number {
  // 12夜目：武器の種類を決めた心得は、その武器を持っているときだけ
  const wt = u.weaponId ? WEAPONS[u.weaponId]?.type : undefined;
  return abilitiesOf(u).reduce((s, a) => s + (a.wtype && (!wt || !a.wtype.includes(wt)) ? 0 : ((a[key] as number | undefined) ?? 0)), 0);
}
export function hasAb(u: Unit, key: keyof AbilityDef): boolean { return abilitiesOf(u).some((a) => !!a[key]); }

export function rangeOf(b: BattleState, w: WeaponDef): [number, number] {
  let max = w.maxRange;
  if (b.weather === 'fog' && (w.type === 'bow' || w.type === 'magic' || w.type === 'holy' || w.type === 'gun')) max += B.battle.fogRange;
  max = Math.max(1, max);
  return [Math.min(w.minRange, max), max];
}
export function canUseNow(b: BattleState, u: Unit, w: WeaponDef | null): boolean {
  if (!w || w.type === 'staff') return false;
  if (w.type === 'gun' && (b.weather === 'rain' || u.reloadTurn === b.turn)) return false;
  return true;
}
export function inRange(b: BattleState, w: WeaponDef, d: number): boolean {
  const [mn, mx] = rangeOf(b, w);
  return d >= mn && d <= mx;
}

function triangle(a: WeaponDef | null, d: WeaponDef | null): number {
  if (!a || !d) return 0;
  const beats: Record<string, string> = { sword: 'axe', axe: 'lance', lance: 'sword' };
  if (beats[a.type] === d.type) return 1;
  if (beats[d.type] === a.type) return -1;
  return 0;
}

export interface SupportBonus { hit: number; avo: number; crit: number; dmg: number }
/** 支援の戦闘効果（2マス以内の支援相手、最大2人） */
export function supportBonus(b: BattleState, u: Unit, getSupport: (a: string, c: string) => number): SupportBonus {
  const out = { hit: 0, avo: 0, crit: 0, dmg: 0 };
  if (!u.studentId || u.abilities.includes('lone_wolf')) return out;
  const partners: { v: number }[] = [];
  for (const o of b.units) {
    if (o === u || o.dead || !o.studentId || !isFriendly(u, o) || dist(u, o) > B.support.range) continue;
    const v = getSupport(u.studentId, o.studentId);
    if (v >= B.support.C) partners.push({ v });
  }
  partners.sort((a, c) => c.v - a.v);
  for (const p of partners.slice(0, B.support.maxPartners)) {
    const r = p.v >= B.support.A ? B.support.battle.A : p.v >= B.support.B ? B.support.battle.B : B.support.battle.C;
    out.hit += r.hit; out.avo += r.avo; out.crit += r.crit; out.dmg += r.dmg;
  }
  return out;
}

export type SupportFn = (a: string, c: string) => number;

interface Side { dmg: number; hit: number; crit: number; count: number; triangle: number; effective: boolean; canAttack: boolean }

function adjacentAllies(b: BattleState, u: Unit): Unit[] {
  return b.units.filter((o) => o !== u && !o.dead && isFriendly(u, o) && dist(u, o) === 1);
}
function adjacentEnemies(b: BattleState, u: Unit): Unit[] {
  return b.units.filter((o) => !o.dead && !isFriendly(u, o) && dist(u, o) === 1);
}

function sideStats(b: BattleState, a: Unit, d: Unit, ax: number, ay: number, sup: SupportFn, counter: boolean): Side {
  const w = weaponOf(a);
  const dw = weaponOf(d);
  const distance = Math.abs(ax - d.x) + Math.abs(ay - d.y);
  const canAttack = !!w && canUseNow(b, a, w) && inRange(b, w, distance) && !(counter && w.type === 'gun' && distance === 1);
  if (!w || !canAttack) return { dmg: 0, hit: 0, crit: 0, count: 0, triangle: 0, effective: false, canAttack: false };
  const tri = w.type === 'gun' ? 0 : triangle(w, dw && dw.type !== 'gun' ? dw : null);
  const dType = moveTypeOf(d);
  const effective = (w.effective ?? []).includes(dType) || abilitiesOf(a).some((ab) => (ab.effective ?? []).includes(dType));
  const magical = w.type === 'magic' || w.type === 'holy';
  const sa = supportBonus(b, a, sup), sd = supportBonus(b, d, sup);
  let might = w.might + tri * B.battle.triangleMight;
  if (effective) might *= B.battle.effectiveMul;
  // 敵将の弱点・強み（6夜目）
  let fHit = 0, fDmg = 0;
  for (const fm of d.foeMods ?? []) if ((!fm.types || fm.types.includes(w.type)) && (!fm.moveTypes || fm.moveTypes.includes(moveTypeOf(a)))) { fHit += fm.hit ?? 0; fDmg += fm.dmg ?? 0; }
  let atk = (magical ? a.stats.mag : a.stats.str) + might + sa.dmg + sumAb(a, 'dmg') + (a.mod?.dmg ?? 0) + fDmg;
  if (a.hp <= a.maxHp / 2) atk += sumAb(a, 'lowHpAtk');
  const dTile = terrainDef(tile(b, d.x, d.y));
  let defStat = magical ? d.stats.res : d.stats.def + dTile.def;
  defStat += adjacentAllies(b, d).reduce((s, o) => s + sumAb(o, 'adjAllyDef'), 0);
  defStat -= d.weaken > 0 ? B.battle.weakenAmount : 0;
  defStat += d.mod?.def ?? 0;
  if (magical && d.ward) defStat += d.ward;
  defStat -= sumAb(a, 'pierce');
  if (w.type === 'gun') defStat = Math.floor(defStat * B.battle.gunDefPierce);
  let dmg = atk - Math.max(0, defStat) - sumAb(d, 'prot') - adjacentAllies(b, d).reduce((s, o) => s + sumAb(o, 'adjAllyProt'), 0);
  dmg = Math.max(0, Math.round(dmg));
  const pa = a.personality ? PERSONALITIES[a.personality as PersonalityId] : null;
  const pd = d.personality ? PERSONALITIES[d.personality as PersonalityId] : null;
  let hit = w.hit + a.stats.skl * 2 + a.stats.lck / 2 + tri * B.battle.triangleHit + sa.hit + sumAb(a, 'hit') + (pa?.hit ?? 0) + (a.aimed ? B.battle.aimHit : 0) + (a.mod?.hit ?? 0) + fHit;
  if (b.real) hit += sumAb(a, 'realBattleHit');
  let avo = d.stats.spd * 2 + d.stats.lck + dTile.avo + sd.avo + sumAb(d, 'avo') + (pd?.avo ?? 0) + (d.mod?.avo ?? 0);
  if (adjacentEnemies(b, d).length >= 3) avo += sumAb(d, 'surroundedAvo');
  if (!b.units.some((o) => o !== d && !o.dead && isFriendly(o, d) && dist(o, d) <= 2)) avo += sumAb(d, 'aloneAvo');
  const crit = clamp(Math.round(w.crit + a.stats.skl / 2 + sa.crit + sumAb(a, 'crit') + (pa?.crit ?? 0) + (a.mod?.crit ?? 0) - d.stats.lck), 0, 100);
  const count = a.stats.spd - d.stats.spd >= B.battle.doubleSpeed - sumAb(a, 'followUp') && w.type !== 'gun' ? 2 : 1;
  return { dmg, hit: clamp(Math.round(hit - avo), 0, 100), crit, count, triangle: tri, effective, canAttack: true };
}

/** 攻撃側が (ax, ay) から攻撃したときの予測 */
export function forecast(b: BattleState, a: Unit, d: Unit, ax: number, ay: number, sup: SupportFn): CombatForecast {
  const ox = a.x, oy = a.y;
  a.x = ax; a.y = ay; // 位置による支援・地形の判定のため一時的に動かす
  try {
    const atk = sideStats(b, a, d, ax, ay, sup, false);
    const def = sideStats(b, d, a, d.x, d.y, sup, true);
    // 反撃側の追撃
    if (def.canAttack && d.stats.spd - a.stats.spd >= B.battle.doubleSpeed - sumAb(d, 'followUp') && weaponOf(d)?.type !== 'gun') def.count = 2; else if (def.canAttack) def.count = 1;
    return { attacker: a, defender: d, atk, def };
  } finally { a.x = ox; a.y = oy; }
}

export function staffsOf(u: Unit): WeaponDef[] {
  return u.weapons.map((id) => WEAPONS[id]).filter((w): w is WeaponDef => !!w && w.type === 'staff');
}
/** 回復の杖（いちばん遠くまで届くもの。範囲表示・AI用） */
export function staffOf(u: Unit): WeaponDef | null {
  const list = staffsOf(u);
  if (!list.length) return null;
  return [...list].sort((a, b) => b.maxRange - a.maxRange || b.might - a.might)[0];
}
export function healAmount(u: Unit, w: WeaponDef | null = staffOf(u)): number {
  if (!w) return 0;
  return w.might + Math.floor(u.stats.mag / 2);
}
/** 相手に一番合う回復（届くもののうち、毒なら治すもの→回復量が足りるもの） */
export function bestStaffFor(b: BattleState, u: Unit, t: Unit): WeaponDef | null {
  const d = dist(u, t);
  const list = staffsOf(u).filter((w) => inRange(b, w, d));
  if (!list.length) return null;
  const need = t.maxHp - t.hp;
  const score = (w: WeaponDef) => ((t.poison || t.weaken) && w.cure ? 50 : 0) + Math.min(need, healAmount(u, w)) - healAmount(u, w) * 0.01;
  return [...list].sort((a, b) => score(b) - score(a))[0];
}
/** 攻撃に使える武器・魔法の一覧 */
export function attackWeapons(b: BattleState, u: Unit): WeaponDef[] {
  const ids = [...new Set([...(u.weaponId ? [u.weaponId] : []), ...u.weapons])];
  return ids.map((id) => WEAPONS[id]).filter((w): w is WeaponDef => !!w && w.type !== 'staff' && canUseNow(b, u, w));
}
