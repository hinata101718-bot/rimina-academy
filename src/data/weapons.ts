// 武器データ（耐久なし）。設計書 §8.6・§8.7 を参照。魔法（魔道・信仰）は spells.ts（技能ランクで覚える）。
// 威力/命中/必殺/射程/必要ランク/価格。price 0 は購入不可（依頼報酬・村でのみ入手）。
import type { WeaponDef } from '../core/types';
import { SPELL_LIST } from './spells';

const list: WeaponDef[] = [
  // ---------- 剣 ----------
  { id: 'iron_sword', name: '鉄の剣', type: 'sword', might: 5, hit: 90, crit: 0, minRange: 1, maxRange: 1, rank: 'E', price: 300, desc: '扱いやすい鉄の剣。' },
  { id: 'steel_sword', name: '鋼の剣', type: 'sword', might: 8, hit: 80, crit: 0, minRange: 1, maxRange: 1, rank: 'D', price: 700, desc: '重く鍛えた鋼の剣。' },
  { id: 'silver_sword', name: '銀の剣', type: 'sword', might: 12, hit: 75, crit: 0, minRange: 1, maxRange: 1, rank: 'B', price: 1800, desc: '銀で打たれた上等な剣。' },
  { id: 'killing_edge', name: 'キルソード', type: 'sword', might: 9, hit: 80, crit: 30, minRange: 1, maxRange: 1, rank: 'C', price: 0, desc: '急所を捉えやすい鋭い剣。' },
  { id: 'gale_blade', name: '疾風の剣', type: 'sword', might: 7, hit: 85, crit: 10, minRange: 1, maxRange: 2, rank: 'C', price: 0, desc: '振るうと風の刃が飛ぶ剣。' },

  // ---------- 槍 ----------
  { id: 'iron_lance', name: '鉄の槍', type: 'lance', might: 6, hit: 80, crit: 0, minRange: 1, maxRange: 1, rank: 'E', price: 320, desc: '兵士の基本となる鉄の槍。' },
  { id: 'steel_lance', name: '鋼の槍', type: 'lance', might: 9, hit: 70, crit: 0, minRange: 1, maxRange: 1, rank: 'D', price: 750, desc: '重く頑丈な鋼の槍。' },
  { id: 'silver_lance', name: '銀の槍', type: 'lance', might: 13, hit: 65, crit: 0, minRange: 1, maxRange: 1, rank: 'B', price: 1900, desc: '銀の穂先を持つ上等な槍。' },
  { id: 'javelin', name: '手槍', type: 'lance', might: 6, hit: 65, crit: 0, minRange: 1, maxRange: 2, rank: 'D', price: 0, desc: '投げても使える短い槍。' },
  { id: 'piercer', name: '穿ちの槍', type: 'lance', might: 10, hit: 70, crit: 25, minRange: 1, maxRange: 1, rank: 'C', price: 0, desc: '鎧の継ぎ目を貫く鋭い槍。' },

  // ---------- 斧 ----------
  { id: 'iron_axe', name: '鉄の斧', type: 'axe', might: 8, hit: 70, crit: 0, minRange: 1, maxRange: 1, rank: 'E', price: 300, desc: '重く力任せの鉄の斧。' },
  { id: 'steel_axe', name: '鋼の斧', type: 'axe', might: 11, hit: 60, crit: 0, minRange: 1, maxRange: 1, rank: 'D', price: 700, desc: '鋼で打った分厚い斧。' },
  { id: 'silver_axe', name: '銀の斧', type: 'axe', might: 15, hit: 55, crit: 0, minRange: 1, maxRange: 1, rank: 'B', price: 1800, desc: '銀の刃を持つ上等な斧。' },
  { id: 'hand_axe', name: '手斧', type: 'axe', might: 7, hit: 55, crit: 0, minRange: 1, maxRange: 2, rank: 'D', price: 0, desc: '投げても使える小ぶりな斧。' },
  { id: 'reaper_axe', name: '刈り取りの斧', type: 'axe', might: 11, hit: 65, crit: 25, minRange: 1, maxRange: 1, rank: 'C', price: 0, desc: '一撃で命を刈る禍々しい斧。' },

  // ---------- 弓（飛行特効） ----------
  { id: 'iron_bow', name: '鉄の弓', type: 'bow', might: 6, hit: 85, crit: 0, minRange: 2, maxRange: 2, rank: 'E', price: 300, effective: ['flying'], desc: '扱いやすい鉄芯の弓。' },
  { id: 'steel_bow', name: '鋼の弓', type: 'bow', might: 9, hit: 75, crit: 0, minRange: 2, maxRange: 2, rank: 'D', price: 700, effective: ['flying'], desc: '張りの強い鋼の弓。' },
  { id: 'silver_bow', name: '銀の弓', type: 'bow', might: 13, hit: 70, crit: 0, minRange: 2, maxRange: 2, rank: 'B', price: 1800, effective: ['flying'], desc: '銀細工の上等な弓。' },
  { id: 'longbow', name: 'ロングボウ', type: 'bow', might: 7, hit: 65, crit: 0, minRange: 2, maxRange: 3, rank: 'C', price: 0, effective: ['flying'], desc: '遠くまで届く長弓。' },
  { id: 'piercing_bow', name: '貫きの弓', type: 'bow', might: 9, hit: 75, crit: 25, minRange: 2, maxRange: 2, rank: 'C', price: 0, effective: ['flying'], desc: '急所を射抜く鋭い弓。' },

  // ---------- 銃（守備を半分無視） ----------
  { id: 'matchlock', name: '火縄銃', type: 'gun', might: 10, hit: 70, crit: 0, minRange: 2, maxRange: 4, rank: 'E', price: 500, desc: '火縄で撃つ初期の銃。' },
  { id: 'improved_gun', name: '改良銃', type: 'gun', might: 13, hit: 75, crit: 0, minRange: 2, maxRange: 4, rank: 'D', price: 1000, desc: '命中を高めた改良型の銃。' },
  { id: 'long_gun', name: '長銃', type: 'gun', might: 15, hit: 80, crit: 0, minRange: 2, maxRange: 4, rank: 'C', price: 2200, desc: '銃身を伸ばした精密な銃。' },
];

export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries([...list, ...SPELL_LIST].map((w) => [w.id, w]));
/** 武器庫に入る武器（魔法以外） */
export const ARMS = list;
/** 魔法かどうか（魔道書・杖を含む古い武器庫の品も） */
export function isSpellType(type: string): boolean { return type === 'magic' || type === 'holy' || type === 'staff'; }

/** 初期の武器庫（同じidの繰り返しで本数を表す） */
export const STARTING_ARMORY: string[] = [
  'iron_sword', 'iron_sword', 'iron_sword',
  'iron_lance', 'iron_lance',
  'iron_axe', 'iron_axe',
  'iron_bow', 'iron_bow',
];
