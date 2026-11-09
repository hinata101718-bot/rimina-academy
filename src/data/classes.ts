// 兵種データ（19夜目：68種 → 14種に小さくした。あとのアップデートで増やす）
import type { ClassDef, MoveType } from '../core/types';

/** マス目の戦い（6×8）での移動の目安：歩兵3・騎兵4・重騎2・飛兵4（上の段は+1） */
const BASE_MOVE: Record<MoveType, number> = { infantry: 3, cavalry: 4, armor: 2, flying: 4 };

type Def = Omit<ClassDef, 'move'>;
function cls(d: Def): ClassDef { return { ...d, move: BASE_MOVE[d.moveType] + (d.tier >= 3 ? 1 : 0) }; }

const list: Def[] = [
  { id: 'novice', name: '見習い', tier: 0, prereq: [], req: {}, moveType: 'infantry', weapons: ['sword', 'lance', 'axe', 'bow', 'magic', 'staff'], bonus: {}, growth: {}, desc: '入学したばかりの生徒。何にでもなれる。' },
  // ---- 初級 ----
  { id: 'swordsman', name: '剣士', tier: 1, prereq: ['novice'], req: { sword: 'D' }, moveType: 'infantry', weapons: ['sword'], bonus: { hp: 1, str: 1, skl: 1, spd: 2 }, growth: { skl: 5, spd: 10 }, desc: '剣で斬る身軽な兵。' },
  { id: 'lancer', name: '槍兵', tier: 1, prereq: ['novice'], req: { lance: 'D' }, moveType: 'infantry', weapons: ['lance'], bonus: { hp: 1, str: 1, skl: 1, def: 2 }, growth: { hp: 5, def: 10 }, desc: '槍で突く、隊列の要。' },
  { id: 'fighter', name: '斧兵', tier: 1, prereq: ['novice'], req: { axe: 'D' }, moveType: 'infantry', weapons: ['axe'], bonus: { hp: 2, str: 2, def: 1 }, growth: { hp: 10, str: 10, spd: -5 }, desc: '斧で打ち砕く力自慢。' },
  { id: 'archer', name: '弓兵', tier: 1, prereq: ['novice'], req: { bow: 'D' }, moveType: 'infantry', weapons: ['bow'], bonus: { str: 1, skl: 3, spd: 1 }, growth: { skl: 10, def: -5 }, desc: '離れたところから射る。' },
  { id: 'mage', name: '魔道士', tier: 1, prereq: ['novice'], req: { magic: 'D' }, moveType: 'infantry', weapons: ['magic'], bonus: { mag: 3, def: 1 }, growth: { mag: 10, def: -5 }, desc: '炎と雷の魔法を使う。' },
  { id: 'cleric', name: '癒し手', tier: 1, prereq: ['novice'], req: { faith: 'D' }, moveType: 'infantry', weapons: ['holy', 'staff'], bonus: { mag: 2, def: 1 }, growth: { mag: 5, hp: 5 }, desc: '仲間の傷を癒し、光で戦う。' },
  // ---- 中級 ----
  { id: 'thief', name: '密偵', tier: 2, prereq: ['swordsman', 'archer'], req: { sword: 'C' }, moveType: 'infantry', weapons: ['sword', 'bow'], bonus: { skl: 2, spd: 4 }, growth: { spd: 15, str: -5 }, desc: '身軽で目ざとい。敵将のようすを探るのが得意。' },
  { id: 'cavalier', name: '騎兵', tier: 2, prereq: ['lancer', 'swordsman'], req: { lance: 'C', riding: 'D' }, moveType: 'cavalry', weapons: ['lance', 'sword'], bonus: { hp: 2, str: 2, spd: 1, def: 2 }, growth: { hp: 5, str: 5, def: 5 }, desc: '馬で戦場を駆け抜ける。' },
  { id: 'pegasus_rider', name: '飛兵', tier: 2, prereq: ['lancer', 'swordsman'], req: { lance: 'C', flying: 'D' }, moveType: 'flying', weapons: ['lance'], bonus: { str: 1, skl: 2, spd: 3, def: 1 }, growth: { spd: 10, def: -5 }, desc: '天馬で空を行く。岩も越えられる。' },
  { id: 'armor_knight', name: '重騎', tier: 2, prereq: ['fighter', 'lancer'], req: { axe: 'C', heavy: 'D' }, moveType: 'armor', weapons: ['axe', 'lance'], bonus: { hp: 3, str: 2, def: 5, spd: -1 }, growth: { def: 15, spd: -10 }, desc: '分厚い鎧で仲間の盾になる。' },
  { id: 'warrior', name: '勇者', tier: 2, prereq: ['fighter', 'swordsman'], req: { axe: 'C', sword: 'D' }, moveType: 'infantry', weapons: ['axe', 'sword'], bonus: { hp: 3, str: 3, skl: 1 }, growth: { hp: 10, str: 10 }, desc: '斧も剣も振るう荒武者。' },
  // ---- 上級 ----
  { id: 'swordmaster', name: '剣聖', tier: 3, prereq: ['swordsman', 'thief', 'warrior'], req: { sword: 'B' }, moveType: 'infantry', weapons: ['sword'], bonus: { hp: 2, str: 3, skl: 4, spd: 4 }, growth: { skl: 15, spd: 15 }, desc: '剣の道を極めた者。' },
  { id: 'sage', name: '賢者', tier: 3, prereq: ['mage', 'cleric'], req: { magic: 'B', faith: 'D' }, moveType: 'infantry', weapons: ['magic', 'holy', 'staff'], bonus: { hp: 2, mag: 5, skl: 2, def: 2 }, growth: { mag: 15 }, desc: '魔法と癒しを兼ねる学者。' },
];

export const CLASSES: Record<string, ClassDef> = Object.fromEntries(list.map((d) => [d.id, cls(d)]));
export const CLASS_LIST: ClassDef[] = Object.values(CLASSES);

/** 19夜目：古い兵種（68種）→ 新しい兵種 */
const OLD_MAP: Record<string, string> = {
  monk: 'cleric', gunner: 'archer', fencer: 'swordsman', hunter: 'archer', bow_rider: 'archer', sorcerer: 'mage', hexer: 'mage',
  battle_monk: 'cleric', musketeer: 'archer', spellblade: 'swordmaster', assassin: 'thief', paladin: 'cavalier', mage_knight: 'cavalier',
  pegasus_knight: 'pegasus_rider', general: 'armor_knight', berserker: 'warrior', brave: 'warrior', sniper: 'archer', bow_knight: 'archer',
  dark_mage: 'mage', bishop: 'sage', saint: 'cleric', templar: 'cleric', sharpshooter: 'archer', sword_saint: 'swordmaster', rune_knight: 'swordmaster',
  shadow: 'thief', great_knight: 'cavalier', dark_knight: 'cavalier', falcon_knight: 'pegasus_rider', great_general: 'armor_knight', warlord: 'warrior',
  champion: 'warrior', hawkeye: 'archer', bow_lord: 'archer', archsage: 'sage', necromancer: 'sage', archbishop: 'sage', oracle: 'sage',
  crusader: 'cavalier', deadeye: 'archer', holy_knight: 'cavalier', fortress: 'armor_knight', royal_guard: 'armor_knight', white_wing: 'pegasus_rider',
  gun_cavalry: 'cavalier', magic_general: 'armor_knight', dominator: 'warrior', imperial_guard: 'armor_knight', high_wizard: 'sage', dragon_knight: 'pegasus_rider',
  bow_master: 'archer', high_priest: 'sage', hero: 'swordmaster',
};
export function newClassId(old: string | null | undefined): string {
  if (!old) return 'novice';
  if (CLASSES[old]) return old;
  return OLD_MAP[old] ?? 'novice';
}
