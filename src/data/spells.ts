// 魔法（魔道）と信仰（攻撃の白魔法・回復の杖）。買うものではなく、技能ランクが上がると覚える。
// 戦闘では武器と同じ形（WeaponDef）で扱う。回数制限なし。
// rank：覚えられる目安のランク。rare：隠れた才能「魔道の天才」「信仰の天才」の子だけが覚える珍しい魔法。
// value：古いセーブの魔道書・杖を売るときの値段の元（購入価格）。
import type { WeaponDef } from '../core/types';

export const SPELL_LIST: WeaponDef[] = [
  // ---------- 魔道（魔力で攻撃・魔防で受ける） ----------
  { id: 'fire', element: 'fire', name: 'ファイアー', type: 'magic', might: 5, hit: 90, crit: 0, minRange: 1, maxRange: 2, rank: 'E', price: 0, value: 350, spell: true, desc: '炎を放つ、魔道の基本。' },
  { id: 'wind', element: 'wind', name: 'ウインド', type: 'magic', might: 4, hit: 95, crit: 5, minRange: 1, maxRange: 2, rank: 'E', price: 0, value: 350, spell: true, effective: ['flying'], desc: '風の刃。空を飛ぶ相手によく効く。' },
  { id: 'thunder', element: 'thunder', name: 'サンダー', type: 'magic', might: 7, hit: 75, crit: 5, minRange: 1, maxRange: 2, rank: 'D', price: 0, value: 800, spell: true, desc: '雷を落とす。' },
  { id: 'blizzard', element: 'ice', name: 'ブリザード', type: 'magic', might: 6, hit: 85, crit: 0, minRange: 1, maxRange: 2, rank: 'D', price: 0, value: 800, spell: true, weaken: true, desc: '吹雪で包み、相手の守りを弱める。' },
  { id: 'miasma', element: 'dark', name: 'ミアズマ', type: 'magic', might: 8, hit: 70, crit: 0, minRange: 1, maxRange: 2, rank: 'C', price: 0, value: 1200, spell: true, poison: true, desc: '瘴気で包み、毒にする。' },
  { id: 'flame_lance', element: 'fire', name: 'フレイムランス', type: 'magic', might: 9, hit: 80, crit: 5, minRange: 1, maxRange: 2, rank: 'C', price: 0, value: 1200, spell: true, desc: '炎を槍の形にして撃ち出す。' },
  { id: 'thoron', element: 'thunder', name: 'トロン', type: 'magic', might: 11, hit: 70, crit: 10, minRange: 1, maxRange: 2, rank: 'B', price: 0, value: 2000, spell: true, desc: '強烈な雷光を放つ。' },
  { id: 'curse_brand', element: 'dark', name: 'カースブランド', type: 'magic', might: 12, hit: 65, crit: 5, minRange: 1, maxRange: 2, rank: 'B', price: 0, value: 1200, spell: true, weaken: true, desc: '呪いの烙印を刻む闇の魔法。' },
  { id: 'starfall', name: 'スターフォール', type: 'magic', might: 10, hit: 65, crit: 0, minRange: 2, maxRange: 4, rank: 'A', price: 0, value: 2500, spell: true, desc: '遠くの敵に星のかけらを降らせる。' },
  { id: 'gale_crown', element: 'wind', name: '風王の刃', type: 'magic', might: 13, hit: 85, crit: 10, minRange: 1, maxRange: 2, rank: 'A', price: 0, value: 2500, spell: true, effective: ['flying'], desc: '嵐をまとった刃。空の敵をたやすく落とす。' },
  { id: 'abyss_flame', element: 'fire', name: '深淵の炎', type: 'magic', might: 15, hit: 75, crit: 5, minRange: 1, maxRange: 2, rank: 'A', price: 0, value: 3000, spell: true, rare: true, desc: '底の見えない黒い炎。魔道の天才だけが扱える。' },
  { id: 'aurora', element: 'light', name: 'オーロラ', type: 'magic', might: 16, hit: 85, crit: 10, minRange: 1, maxRange: 3, rank: 'S', price: 0, value: 3000, spell: true, rare: true, desc: '夜空の光を束ねる大魔法。魔道の天才だけが扱える。' },

  // ---------- 信仰：攻撃（魔力で攻撃・魔防で受ける） ----------
  { id: 'lumina', element: 'light', name: 'ルミナ', type: 'holy', might: 4, hit: 95, crit: 0, minRange: 1, maxRange: 2, rank: 'E', price: 0, value: 350, spell: true, desc: '小さな聖なる光を放つ。' },
  { id: 'celesta', element: 'light', name: 'セレスタ', type: 'holy', might: 8, hit: 80, crit: 5, minRange: 1, maxRange: 2, rank: 'C', price: 0, value: 1000, spell: true, desc: '天からの光で敵を討つ。' },
  { id: 'sanctus', element: 'light', name: 'サンクトゥス', type: 'holy', might: 12, hit: 75, crit: 5, minRange: 1, maxRange: 2, rank: 'A', price: 0, value: 1200, spell: true, desc: '大いなる聖光で邪を払う。' },
  { id: 'seraphim', element: 'light', name: 'セラフィム', type: 'holy', might: 15, hit: 85, crit: 10, minRange: 1, maxRange: 2, rank: 'S', price: 0, value: 3000, spell: true, rare: true, desc: '天の御使いの光。信仰の天才だけが扱える。' },

  // ---------- 信仰：回復・補助（might＝回復量） ----------
  { id: 'heal', name: 'ライブ', type: 'staff', might: 10, hit: 100, crit: 0, minRange: 1, maxRange: 1, rank: 'E', price: 0, value: 300, spell: true, desc: '隣の味方のHPを回復する。' },
  { id: 'mend', name: 'リライブ', type: 'staff', might: 20, hit: 100, crit: 0, minRange: 1, maxRange: 1, rank: 'D', price: 0, value: 800, spell: true, desc: '隣の味方のHPを大きく回復する。' },
  { id: 'restore', name: 'リストア', type: 'staff', might: 8, hit: 100, crit: 0, minRange: 1, maxRange: 1, rank: 'C', price: 0, value: 800, spell: true, cure: true, desc: '毒や弱体を治し、HPを少し回復する。' },
  { id: 'ward', name: '守りの祈り', type: 'staff', might: 5, hit: 100, crit: 0, minRange: 1, maxRange: 2, rank: 'C', price: 0, value: 800, spell: true, ward: 6, desc: '味方の魔防を次の自分の番まで+6し、少し回復する。' },
  { id: 'far_heal', name: 'ウィンドヒール', type: 'staff', might: 10, hit: 100, crit: 0, minRange: 1, maxRange: 3, rank: 'B', price: 0, value: 1800, spell: true, desc: '離れた味方のHPを回復する。' },
  { id: 'recover', name: 'リカバー', type: 'staff', might: 40, hit: 100, crit: 0, minRange: 1, maxRange: 1, rank: 'A', price: 0, value: 2000, spell: true, desc: '隣の味方のHPをほぼ全快させる。' },
  { id: 'grace', name: '聖女の恵み', type: 'staff', might: 25, hit: 100, crit: 0, minRange: 1, maxRange: 3, rank: 'A', price: 0, value: 3000, spell: true, rare: true, cure: true, desc: '離れた味方を大きく癒やし、毒も払う。信仰の天才だけが扱える。' },
];

/** 一人あたりの覚える魔法の数 */
export const SPELL_PLAN = {
  count: [4, 5] as [number, number],
  ranks: ['E', 'D', 'C', 'B', 'A', 'S'] as const,
  /** 天才の子は A・S の枠に珍しい魔法が入る */
  geniusRare: true,
  /** E の枠が入る確率（はじめから魔法を1つ使える子） */
  firstSlotChance: 0.35,
};
