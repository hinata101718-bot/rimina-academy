// 武器のレアリティ（14夜目）：ノーマル（灰）・レア（青）・ユニーク（紫・銘入り）・レジェンド（金・大陸に12振り）
import type { Rank, WeaponType } from '../core/types';

export type Rarity = 'normal' | 'rare' | 'unique' | 'legend';
export const RARITY_NAME: Record<Rarity, string> = { normal: 'ノーマル', rare: 'レア', unique: 'ユニーク', legend: 'レジェンド' };
export const RARITY_COLOR: Record<Rarity, string> = { normal: '#8c8a84', rare: '#3f74b8', unique: '#8a4fb0', legend: '#c9a032' };
export const RARITY_ORDER: Rarity[] = ['legend', 'unique', 'rare', 'normal'];

export interface WeaponMod { dmg?: number; hit?: number; crit?: number; avo?: number; def?: number }

/** 添え名：レアには1つつくことがあり、ユニーク（銘入り）には2つ。同じ「銀の槍」でも1本ずつ違う */
export const AFFIXES: Record<string, { name: string; mod: WeaponMod; text: string }> = {
  keen: { name: '鋭い', mod: { crit: 5 }, text: '急所に入りやすい' },
  light: { name: '軽い', mod: { avo: 5 }, text: '身をかわしやすい' },
  sure: { name: '確かな', mod: { hit: 10 }, text: '当たりやすい' },
  sturdy: { name: '頑丈な', mod: { def: 1 }, text: '受けた傷が少し浅くなる' },
  heavy: { name: '重い', mod: { dmg: 2, hit: -5 }, text: '一撃が重いが、少し当たりにくい' },
  swift: { name: '速い', mod: { avo: 3, hit: 5 }, text: '手数が出やすく、かわしやすい' },
};
export const AFFIX_IDS = Object.keys(AFFIXES);

/** 伝説の武器（大陸に12振り）。base＝もとの武器、cond＝持ち主を選ぶ条件 */
export interface LegendDef {
  id: string; name: string; type: WeaponType; base: string; mod: WeaponMod;
  /** 専用の心得（いつも効く力）の名前と、そのやさしい説明 */
  art: string; artText: string;
  /** 伝説の文（手に入ったとき1行ずつ） */
  lore: string[];
  cond: { rank: Rank; kind?: 'trust' | 'noble' | 'frontier' | 'kills' | 'grade3'; text: string };
}
export const LEGENDS: LegendDef[] = [
  { id: 'aurora', name: '暁剣アウロラ', type: 'sword', base: 'master_sword', mod: { dmg: 4, hit: 10, crit: 10 }, art: '夜明けの一閃', artText: '一撃が急所に入りやすく、よく当たる',
    lore: ['三国がまだ一つだった頃、最初の皇帝が佩いていた剣。', '夜明けの光を鍛えこんだと伝わり、刃は今も薄く朱をおびる。', '「この剣は、終わらせるために抜け」――柄にはそう刻まれている。'], cond: { rank: 'B', text: '剣の技能ランクB' } },
  { id: 'nivalis', name: '霜刃ニヴァリス', type: 'sword', base: 'master_sword', mod: { dmg: 3, hit: 15, avo: 10 }, art: '凍てつく見切り', artText: 'よく当たり、相手の刃をかわしやすい',
    lore: ['北の雪原で、名もない鍛冶師が三十年かけて打った剣。', '振るうたびに白い息のような霜が散る。', '持ち主が死ぬと、刃が曇って次の主を待つという。'], cond: { rank: 'B', kind: 'trust', text: '剣の技能ランクB・先生との信頼60' } },
  { id: 'regalia', name: '王統の剣レガリア', type: 'sword', base: 'master_sword', mod: { dmg: 4, hit: 10, crit: 5, def: 1 }, art: '王の構え', artText: '攻めも守りも、少しずつ上がる',
    lore: ['分かれる前の帝国で、即位の儀に使われた剣。', '三つの王家が、それぞれ「本物はこちらだ」と言い張ってきた。', '本物は、持つ者の血筋を確かめるように重くなる。'], cond: { rank: 'C', kind: 'noble', text: '剣の技能ランクC・貴族の生まれ' } },
  { id: 'keraunos', name: '天穿ちの槍ケラヴノス', type: 'lance', base: 'master_lance', mod: { dmg: 5, hit: 10, def: 2 }, art: '雷鳴の穂先', artText: '突きが重く、受けた傷も浅くなる',
    lore: ['雷の落ちた古木から削り出したと伝わる槍。', '嵐の夜には、穂先が青白く光る。', 'ある将軍はこの槍一本で、城門を三度破った。'], cond: { rank: 'B', text: '槍の技能ランクB' } },
  { id: 'eidos', name: '誓約の槍エイドス', type: 'lance', base: 'master_lance', mod: { dmg: 3, def: 3, avo: 5 }, art: '誓いの守り', artText: '傷を受けにくく、かわしやすい',
    lore: ['仲間を守ると誓った騎士団に、代々受け継がれた槍。', '最後の団長は、退く仲間の殿をつとめて、この槍と共に消えた。', '槍を持つ者は、誰か一人を守ると誓わねばならない。'], cond: { rank: 'C', kind: 'trust', text: '槍の技能ランクC・先生との信頼60' } },
  { id: 'peregrin', name: '旅人の槍ペレグリン', type: 'lance', base: 'master_lance', mod: { dmg: 3, hit: 10, avo: 10 }, art: '風の足', artText: 'よく当たり、身をかわしやすい',
    lore: ['どの国にも仕えなかった流れの槍使いが、生涯持ち歩いた槍。', '柄には、旅した土地の名が細かく刻まれている。', '国を持たない者の手にだけ、よくなじむという。'], cond: { rank: 'C', kind: 'frontier', text: '槍の技能ランクC・辺境の生まれ' } },
  { id: 'bergla', name: '山崩しの大斧ベルグラ', type: 'axe', base: 'master_axe', mod: { dmg: 6, crit: 10 }, art: '地鳴り', artText: '一撃がとても重く、急所にも入りやすい',
    lore: ['山の民の英雄が、崩れた峠を切り開いたという大斧。', '振り下ろすと、足もとの地面が鳴る。', '軽い気持ちで持ち上げた者は、三日寝込んだ。'], cond: { rank: 'B', text: '斧の技能ランクB' } },
  { id: 'fornax', name: '炉の斧フォルナクス', type: 'axe', base: 'master_axe', mod: { dmg: 5, hit: 5, def: 2 }, art: '燃える炉', artText: '一撃が重く、受けた傷も浅くなる',
    lore: ['火山のふもとの鍛冶村で、村ごと守るために打たれた斧。', '刃はいつも、ほのかに温かい。', '村が焼かれた夜、この斧だけが灰の中から見つかった。'], cond: { rank: 'C', kind: 'kills', text: '斧の技能ランクC・倒した敵10人' } },
  { id: 'carbo', name: '灰燼の斧カルボ', type: 'axe', base: 'master_axe', mod: { dmg: 5, hit: 10, crit: 5 }, art: '灰の一振り', artText: '一撃が重く、よく当たる',
    lore: ['ある傭兵団の団長が、敵の城を焼いたあとに拾った斧。', '刃の黒いすすは、何度磨いても落ちない。', '持ち主は、いつも最後まで戦場に立っていたという。'], cond: { rank: 'B', kind: 'grade3', text: '斧の技能ランクB・3年生か卒業生' } },
  { id: 'asteria', name: '星読みの弓アステリア', type: 'bow', base: 'master_bow', mod: { dmg: 3, hit: 20, crit: 5 }, art: '星の導き', artText: '矢がとても当たりやすい',
    lore: ['星を読んで嵐を当てた賢者が、弟子に遺した弓。', '夜に引くと、弦がかすかに歌う。', '矢は、射手が見ている星の方へ、まっすぐ飛ぶ。'], cond: { rank: 'B', text: '弓の技能ランクB' } },
  { id: 'sylphe', name: '風切りの弓シルフェ', type: 'bow', base: 'master_bow', mod: { dmg: 4, hit: 10, avo: 10 }, art: '風読み', artText: 'よく当たり、身をかわしやすい',
    lore: ['森の狩人たちが、風の精から借りたと語る弓。', '矢羽根は、どんな鳥のものとも違う。', '持ち主が森で迷うことは、決してない。'], cond: { rank: 'C', kind: 'trust', text: '弓の技能ランクC・先生との信頼60' } },
  { id: 'helge', name: '鉄鳴りの長銃ヘルゲ', type: 'gun', base: 'master_gun', mod: { dmg: 5, hit: 15 }, art: '鉄の声', artText: '一撃が重く、よく当たる',
    lore: ['銃が生まれた年、最初の名工が「これ以上は作れない」と言って筆を置いた長銃。', '撃つと、鐘のような音が遠くまで響く。', 'その音を聞いた敵は、戦う前に膝が震えたという。'], cond: { rank: 'C', text: '銃の技能ランクC' } },
];
export const LEGEND_BY_ID: Record<string, LegendDef> = Object.fromEntries(LEGENDS.map((l) => [l.id, l]));
