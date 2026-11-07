// 固有スキル・特徴スキル（自動発動のみ）。兵種の ability と特徴タグから参照される。
import type { AbilityDef } from '../core/types';

const list: AbilityDef[] = [
  // ---------- 特徴タグ用 ----------
  { id: 'loser_hate', name: '負けず嫌い', desc: 'HPが半分以下のとき攻撃+3。', lowHpAtk: 3 },
  { id: 'clutch', name: '本番に強い', desc: '実戦では命中+10。', realBattleHit: 10 },
  { id: 'coward', name: '臆病', desc: '敵3体以上に隣接されると回避−15。', surroundedAvo: -15 },
  { id: 'lone_wolf', name: '一匹狼', desc: '2マス以内に味方がいないと回避+10。', aloneAvo: 10 },

  // ---------- 初級 ----------
  { id: 'blade_sense', name: '剣の心得', desc: '命中+5。', hit: 5 },
  { id: 'steady_guard', name: '踏ん張り', desc: '受けるダメージ−1。', prot: 1 },
  { id: 'brute', name: '腕っぷし', desc: '与えるダメージ+1。', dmg: 1 },
  { id: 'keen_aim', name: '狙い澄まし', desc: '命中+5。', hit: 5 },
  { id: 'mana_flow', name: '魔力循環', desc: '与えるダメージ+1。', dmg: 1 },
  { id: 'kindness', name: '慈しみ', desc: 'ターン開始時、周囲2マスの味方のHP+2。', auraHeal: 2 },
  { id: 'steady_hands', name: '据え撃ち', desc: '命中+5。', hit: 5 },

  // ---------- 剣士系 ----------
  { id: 'quick_step', name: '足さばき', desc: '回避+10。', avo: 10 },
  { id: 'meteor', name: '流星', desc: '必殺+15。', crit: 15 },
  { id: 'sword_mind', name: '剣心一如', desc: '必殺+15、命中+10。', crit: 15, hit: 10 },
  { id: 'magic_blade', name: '魔刃', desc: '与えるダメージ+2、命中+5。', dmg: 2, hit: 5 },
  { id: 'rune_ward', name: '刻印の守り', desc: '与えるダメージ+2、受けるダメージ−2。', dmg: 2, prot: 2 },
  { id: 'lockpick', name: '鍵開け', desc: '宝箱と扉を鍵なしで開けられる。回避+5。', unlock: true, avo: 5 },
  { id: 'shadow_step', name: '忍び足', desc: '宝箱と扉を開けられる。回避+10、必殺+5。速さの差が2少なくても追撃できる。', unlock: true, avo: 10, crit: 5, followUp: 2 },
  { id: 'vanish', name: '影隠れ', desc: '宝箱と扉を開けられる。回避+15、必殺+10。', unlock: true, avo: 15, crit: 10 },

  // ---------- 槍兵系 ----------
  { id: 'charge', name: '突撃', desc: '与えるダメージ+1。', dmg: 1 },
  { id: 'chivalry', name: '騎士道', desc: '隣接する味方の守備+2。', adjAllyDef: 2 },
  { id: 'iron_rampart', name: '鉄城', desc: '受けるダメージ−3。', prot: 3 },
  { id: 'magic_lance', name: '魔騎突', desc: '相手の守備・魔防を4低いものとして攻撃する。', pierce: 4 },
  { id: 'dark_aura', name: '闇纏い', desc: '与えるダメージ+2、受けるダメージ−1。', dmg: 2, prot: 1 },
  { id: 'wind_ride', name: '風乗り', desc: '回避+10。', avo: 10 },
  { id: 'sky_dance', name: '天舞', desc: '回避+15、受けるダメージ−1。', avo: 15, prot: 1 },
  { id: 'gale', name: '疾風', desc: '回避+15、命中+5。', avo: 15, hit: 5 },

  // ---------- 戦士系 ----------
  { id: 'iron_wall', name: '鉄壁', desc: '受けるダメージ−2。', prot: 2 },
  { id: 'guardian', name: '守護', desc: '隣接する味方の受けるダメージ−3。', adjAllyProt: 3 },
  { id: 'citadel', name: '不落', desc: '隣接する味方の受けるダメージ−3、自分の受けるダメージ−2。', adjAllyProt: 3, prot: 2 },
  { id: 'war_cry', name: '雄叫び', desc: '与えるダメージ+2。', dmg: 2 },
  { id: 'frenzy', name: '狂奔', desc: 'HPが半分以下のとき攻撃+5。必殺+5。', lowHpAtk: 5, crit: 5 },
  { id: 'conqueror', name: '覇気', desc: '与えるダメージ+3、必殺+5。', dmg: 3, crit: 5 },
  { id: 'courage', name: '勇猛', desc: '命中+10、与えるダメージ+1、必殺+5。', hit: 10, dmg: 1, crit: 5 },
  { id: 'indomitable', name: '不屈の闘志', desc: 'HPが半分以下のとき攻撃+4。与えるダメージ+2。', lowHpAtk: 4, dmg: 2 },

  // ---------- アーチャー系 ----------
  { id: 'tracker', name: '追跡', desc: '命中+10。', hit: 10 },
  { id: 'hawk_eye', name: '鷹の目', desc: '命中+20。', hit: 20 },
  { id: 'farsight', name: '千里眼', desc: '命中+20、必殺+10。', hit: 20, crit: 10 },
  { id: 'mounted_shot', name: '騎射', desc: '命中+5、与えるダメージ+1。', hit: 5, dmg: 1 },
  { id: 'running_shot', name: '駆け射ち', desc: '命中+10。速さの差が2少なくても追撃できる。', hit: 10, followUp: 2 },
  { id: 'sky_arrow', name: '天弓', desc: '命中+10、与えるダメージ+2、必殺+5。', hit: 10, dmg: 2, crit: 5 },

  // ---------- 魔道士系 ----------
  { id: 'focus', name: '精神統一', desc: '命中+10。', hit: 10 },
  { id: 'wisdom', name: '叡智', desc: '与えるダメージ+1、相手の魔防を2低いものとして攻撃する。命中+5。', dmg: 1, pierce: 2, hit: 5 },
  { id: 'arcane', name: '深淵の理', desc: '与えるダメージ+3、命中+10。', dmg: 3, hit: 10 },
  { id: 'venom', name: '毒呪', desc: '攻撃が命中した相手を毒にする。', poison: true },
  { id: 'hex', name: '弱体の呪', desc: '攻撃が命中した相手の守備・魔防を下げる。', weaken: true },
  { id: 'death_curse', name: '死の呪縛', desc: '命中した相手を弱体にする。与えるダメージ+2。', weaken: true, dmg: 2 },

  // ---------- 修道士系 ----------
  { id: 'mercy', name: '慈悲', desc: 'ターン開始時、周囲2マスの味方のHP+3。', auraHeal: 3 },
  { id: 'prayer', name: '祈り', desc: 'ターン開始時、周囲2マスの味方のHP+5。', auraHeal: 5 },
  { id: 'grace', name: '恩寵', desc: 'ターン開始時、周囲2マスの味方のHP+6。受けるダメージ−1。', auraHeal: 6, prot: 1 },
  { id: 'holy_light', name: '聖光', desc: '与えるダメージ+2。周囲2マスの味方のHP+2。', dmg: 2, auraHeal: 2 },
  { id: 'revelation', name: '天啓', desc: '命中+10、回避+10。', hit: 10, avo: 10 },
  { id: 'iron_fist', name: '鉄拳', desc: '与えるダメージ+1、受けるダメージ−1。', dmg: 1, prot: 1 },
  { id: 'sacred_vow', name: '聖誓', desc: '与えるダメージ+2、隣接する味方の守備+1。', dmg: 2, adjAllyDef: 1 },
  { id: 'holy_war', name: '聖戦', desc: '与えるダメージ+3、受けるダメージ−1。', dmg: 3, prot: 1 },

  // ---------- 銃兵系 ----------
  { id: 'marksman', name: '狙撃', desc: '命中+5、必殺+5。', hit: 5, crit: 5 },
  { id: 'deadly_aim', name: '一点集中', desc: '命中+5、必殺+10。', hit: 5, crit: 10 },
  { id: 'one_shot', name: '一撃必殺', desc: '必殺+20。', crit: 20 },

  // ---------- 国専用 ----------
  { id: 'holy_shield', name: '聖盾', desc: '隣接する味方の守備+3、自分の受けるダメージ−1。', adjAllyDef: 3, prot: 1 },
  { id: 'bastion', name: '城塞', desc: '隣接する味方の受けるダメージ−3、自分の受けるダメージ−3。', adjAllyProt: 3, prot: 3 },
  { id: 'royal_blade', name: '王剣', desc: '必殺+10、隣接する味方の守備+2。', crit: 10, adjAllyDef: 2 },
  { id: 'white_feather', name: '白翼', desc: '回避+15、隣接する味方の守備+1。', avo: 15, adjAllyDef: 1 },
  { id: 'thunder_charge', name: '雷鳴突撃', desc: '与えるダメージ+3。', dmg: 3 },
  { id: 'mage_command', name: '魔導指揮', desc: '与えるダメージ+2、隣接する味方の守備+1。', dmg: 2, adjAllyDef: 1 },
  { id: 'tyranny', name: '圧制', desc: '与えるダメージ+3、必殺+5。', dmg: 3, crit: 5 },
  { id: 'imperial_wall', name: '皇帝の盾', desc: '隣接する味方の受けるダメージ−2、自分の受けるダメージ−3。', adjAllyProt: 2, prot: 3 },
  { id: 'grand_magic', name: '大魔導', desc: '与えるダメージ+3、命中+5。', dmg: 3, hit: 5 },
  { id: 'dragon_scale', name: '竜鱗', desc: '与えるダメージ+2、受けるダメージ−2。', dmg: 2, prot: 2 },
  { id: 'arrow_rain', name: '矢の雨', desc: '命中+15、与えるダメージ+1。', hit: 15, dmg: 1 },
  { id: 'benediction', name: '大いなる祝福', desc: 'ターン開始時、周囲2マスの味方のHP+6。命中+5。', auraHeal: 6, hit: 5 },

  // ---------- 隠し ----------
  { id: 'heroic_soul', name: '英雄の魂', desc: '命中+10、回避+10、必殺+10、与えるダメージ+2。', hit: 10, avo: 10, crit: 10, dmg: 2 },
];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(list.map((a) => [a.id, a]));
