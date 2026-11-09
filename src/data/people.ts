// 性格・夢・特徴タグ・才能・出身・教官の経歴などのデータ。
import type { CountryId, Origin, House, PersonalityId, SkillId, StatId, Path, Stats } from '../core/types';

export const COUNTRY_NAMES: Record<Origin, string> = {
  kingdom: 'ヴィンターガルト王国',
  empire: 'ソラリウス帝国',
  alliance: 'フィオレンツァ同盟',
  frontier: '辺境の村',
};
export const COUNTRY_SHORT: Record<Origin, string> = {
  kingdom: '王国', empire: '帝国', alliance: '同盟', frontier: '辺境',
};
export const COUNTRIES: CountryId[] = ['kingdom', 'empire', 'alliance'];
export const COUNTRY_COLOR: Record<Origin, string> = {
  kingdom: '#3f6fb0', empire: '#b5483a', alliance: '#4f8f4a', frontier: '#8a6f4e', // 王国＝青・帝国＝赤・同盟＝緑・辺境＝茶
};
/** 国ごとの得意技能（夢・進路・声かけの判定に使う） */
export const COUNTRY_FAVOR_SKILLS: Record<CountryId, SkillId[]> = {
  kingdom: ['riding', 'heavy', 'lance', 'sword'],
  empire: ['axe', 'sword', 'magic', 'gun'],
  alliance: ['bow', 'flying', 'faith', 'magic'],
};
export const COUNTRY_FAVOR_HOUSE: Record<CountryId, House | null> = { kingdom: 'noble', empire: 'orphan', alliance: null };

export const ORIGIN_WEIGHTS: Record<Origin, number> = { kingdom: 32, empire: 32, alliance: 32, frontier: 8 };
export const HOUSE_WEIGHTS: Record<House, number> = { noble: 20, commoner: 60, orphan: 20 };
export const HOUSE_NAMES: Record<House, string> = { noble: '貴族', commoner: '平民', orphan: '孤児' };

export interface PersonalityDef {
  id: PersonalityId; name: string; desc: string;
  // 小さな戦闘補正
  hit?: number; avo?: number; crit?: number;
  // お茶会での好み（同じ性格グループと仲良くなりやすい）
  group: 'loud' | 'quiet' | 'steady';
  likes: PersonalityId[]; // 友情になりやすい相手
  rivals: PersonalityId[]; // ライバルになりやすい相手
}
export const PERSONALITIES: Record<PersonalityId, PersonalityDef> = {
  hot: { id: 'hot', name: '熱血', desc: 'まっすぐで声が大きい。', crit: 3, group: 'loud', likes: ['cheerful', 'serious'], rivals: ['competitive', 'calm'] },
  calm: { id: 'calm', name: '冷静', desc: 'いつも落ち着いている。', hit: 3, group: 'quiet', likes: ['serious', 'gentle'], rivals: ['hot', 'cynic'] },
  timid: { id: 'timid', name: '臆病', desc: '怖がりだが慎重。', avo: 3, group: 'quiet', likes: ['gentle', 'shy'], rivals: ['competitive'] },
  cynic: { id: 'cynic', name: '皮肉屋', desc: '素直になれない。', crit: 2, group: 'steady', likes: ['whimsical', 'calm'], rivals: ['serious', 'hot'] },
  gentle: { id: 'gentle', name: 'おっとり', desc: 'のんびり屋で優しい。', avo: 2, group: 'quiet', likes: ['timid', 'cheerful'], rivals: ['cynic'] },
  serious: { id: 'serious', name: '真面目', desc: '規律を重んじる努力家。', hit: 2, group: 'steady', likes: ['calm', 'hot'], rivals: ['whimsical', 'cynic'] },
  cheerful: { id: 'cheerful', name: '陽気', desc: '場を明るくする。', group: 'loud', likes: ['hot', 'gentle', 'whimsical'], rivals: ['shy'] },
  shy: { id: 'shy', name: '内気', desc: '人見知りだが芯は強い。', hit: 2, group: 'quiet', likes: ['timid', 'calm'], rivals: ['cheerful'] },
  competitive: { id: 'competitive', name: '負けず嫌い', desc: '誰にも負けたくない。', crit: 2, hit: 1, group: 'loud', likes: ['hot'], rivals: ['hot', 'competitive', 'calm'] },
  whimsical: { id: 'whimsical', name: '気まぐれ', desc: 'その日の気分で動く。', avo: 2, group: 'steady', likes: ['cheerful', 'cynic'], rivals: ['serious'] },
};
export const PERSONALITY_IDS = Object.keys(PERSONALITIES) as PersonalityId[];

export interface DreamDef {
  id: string; name: string; text: string; // text は「〜こと」
  skills: SkillId[]; // 沿う技能
  country: CountryId | 'home' | null; // 行きたい国（homeなら出身国）
  path: Path | null;
  career?: 'stay' | 'home' | 'merc';
  weight: number;
}
export const DREAMS: DreamDef[] = [
  { id: 'kingdom_knight', name: '王国の騎士になりたい', text: '王国の騎士になること', skills: ['riding', 'lance', 'sword'], country: 'kingdom', path: 'warrior', weight: 10 },
  { id: 'feed_family', name: '家族を養いたい', text: '家族を養うこと', skills: ['axe', 'sword'], country: 'empire', path: 'warrior', weight: 10 },
  { id: 'scholar', name: '学者になりたい', text: '学者になること', skills: ['magic', 'faith'], country: 'alliance', path: 'strategist', weight: 8 },
  { id: 'fame', name: '名を上げたい', text: '大陸に名を上げること', skills: ['sword', 'axe', 'bow'], country: 'empire', path: 'warrior', weight: 9 },
  { id: 'protect_home', name: '故郷を守りたい', text: '故郷を守ること', skills: ['lance', 'heavy', 'bow'], country: 'home', path: 'warrior', career: 'home', weight: 10 },
  { id: 'peace', name: '平和な世界にしたい', text: '平和な世界にすること', skills: ['faith', 'magic'], country: 'alliance', path: 'civil', weight: 8 },
  { id: 'healer', name: '人を癒やしたい', text: '傷ついた人を癒やすこと', skills: ['faith'], country: 'alliance', path: 'civil', weight: 6 },
  { id: 'sky', name: '空を飛びたい', text: '天馬で空を駆けること', skills: ['flying', 'lance'], country: 'alliance', path: 'warrior', weight: 5 },
  { id: 'strategist', name: '軍師になりたい', text: '名軍師になること', skills: ['magic', 'bow'], country: null, path: 'strategist', weight: 6 },
  { id: 'statesman', name: '国を動かしたい', text: '国を動かす人間になること', skills: ['faith', 'sword'], country: 'home', path: 'civil', weight: 5 },
  { id: 'teacher', name: '先生のようになりたい', text: '誰かを導く先生になること', skills: ['sword', 'faith'], country: null, path: null, career: 'stay', weight: 3 },
  { id: 'free', name: '自由に生きたい', text: '何にも縛られずに生きること', skills: ['bow', 'sword'], country: null, path: null, career: 'merc', weight: 4 },
  { id: 'none', name: '特になし', text: '', skills: [], country: null, path: null, weight: 12 },
];

export interface TraitDef {
  id: string; name: string; desc: string;
  visible: boolean; // 志願書で見える（false=入学後しばらくして判明）
  growthByYear?: [number, number, number]; // 学年ごとの成長率補正
  lessonMul?: number; tutorMul?: number; supportMul?: number;
  ability?: string; // 戦闘スキル
  injuryBonus?: number; // 重傷になる確率+
  noSupportBonus?: boolean;
  weight: number;
}
export const TRAITS: Record<string, TraitDef> = {
  early: { id: 'early', name: '早熟', desc: '1年目の成長率+10%、3年目−10%', visible: false, growthByYear: [10, 0, -10], weight: 6 },
  late: { id: 'late', name: '遅咲き', desc: '1年目の成長率−10%、3年目+15%', visible: false, growthByYear: [-10, 0, 15], weight: 6 },
  loser_hate: { id: 'loser_hate', name: '負けず嫌い', desc: 'HP半分以下で攻撃+3', visible: true, ability: 'loser_hate', weight: 6 },
  clutch: { id: 'clutch', name: '本番に強い', desc: '実戦で命中+10', visible: false, ability: 'clutch', weight: 6 },
  coward: { id: 'coward', name: '臆病', desc: '敵3体以上に隣接されると回避−15', visible: true, ability: 'coward', weight: 5 },
  diligent: { id: 'diligent', name: '努力家', desc: '授業の伸び×1.1', visible: true, lessonMul: 1.1, weight: 8 },
  lazy: { id: 'lazy', name: '怠け者', desc: '授業の伸び×0.9、個人指導は×1.2', visible: true, lessonMul: 0.9, tutorMul: 1.2, weight: 5 },
  friendly: { id: 'friendly', name: '人懐っこい', desc: '支援値の上がり方×1.3', visible: true, supportMul: 1.3, weight: 7 },
  lone_wolf: { id: 'lone_wolf', name: '一匹狼', desc: '支援補正を受けないが、単独で回避+10', visible: true, ability: 'lone_wolf', noSupportBonus: true, supportMul: 0.7, weight: 4 },
  lucky_star: { id: 'lucky_star', name: '幸運の星', desc: '戦死しそうなとき重傷で済む確率+20%', visible: false, injuryBonus: 20, weight: 4 },
};

export interface TalentDef {
  id: string; name: string; hint1: string; hint2: string;
  skill?: SkillId; skillMul?: number;
  stats: Partial<Stats>; // 成長率+
  hero?: boolean;
  weight: number;
}
const genius = (skill: SkillId, label: string, stats: Partial<Record<StatId, number>>): TalentDef => ({
  id: `genius_${skill}`, name: `${label}の天才`,
  hint1: `${label}が伸びやすい気がする`, hint2: `${label}の才能があるかもしれない`,
  skill, skillMul: 1.5, stats, weight: 10,
});
export const TALENTS: Record<string, TalentDef> = {
  genius_sword: genius('sword', '剣', { str: 15, spd: 15 }),
  genius_lance: genius('lance', '槍', { str: 15, def: 15 }),
  genius_axe: genius('axe', '斧', { str: 15, hp: 15 }),
  genius_bow: genius('bow', '弓', { skl: 15, spd: 15 }),
  genius_magic: genius('magic', '魔道', { mag: 15, def: 15 }),
  genius_faith: genius('faith', '信仰', { mag: 15, def: 15 }),
  genius_riding: genius('riding', '騎乗', { spd: 15, def: 15 }),
  genius_heavy: genius('heavy', '重装', { def: 15, hp: 15 }),
  genius_flying: genius('flying', '飛行', { spd: 15, def: 15 }),
  /** 9夜目：策を立てるのがうまい（策の成功率+、軍略がたまりやすい） */
  strategist: { id: 'strategist', name: '軍師の才', hint1: '物事の先を読むのがうまい気がする', hint2: '戦の駆け引きに向いているかもしれない', stats: { skl: 10}, weight: 6 },
  leader: { id: 'leader', name: '隠れた統率者', hint1: '人を惹きつけるところがある気がする', hint2: '人の上に立つ才能があるかもしれない', stats: {}, weight: 8 },
  hero: { id: 'hero', name: '英雄の器', hint1: '何をやらせても伸びる気がする', hint2: 'とてつもない器かもしれない', hero: true, stats: { hp: 10, str: 10, mag: 10, skl: 10, spd: 10, def: 10}, weight: 0 },
};

export interface BackgroundDef {
  id: string; name: string; desc: string; age: number;
  skills: Partial<Record<SkillId, string>>; // ランク
  defaultRank: string;
  friendship: Record<CountryId, number>;
  realRewardMul: number;
  cha: number;
}
export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'knight', name: '元王国騎士', desc: '剣・槍・騎乗が得意。王国と縁がある。', age: 39,
    skills: { sword: 'B', lance: 'B', riding: 'B' }, defaultRank: 'D',
    friendship: { kingdom: 15, empire: -5, alliance: 0 }, realRewardMul: 1, cha: 8 },
  { id: 'merc', name: '元帝国の傭兵', desc: '斧と実戦に強い。実戦の報酬+20%。', age: 37,
    skills: { axe: 'B', sword: 'C', bow: 'C', heavy: 'C' }, defaultRank: 'D',
    friendship: { kingdom: -5, empire: 15, alliance: 0 }, realRewardMul: 1.2, cha: 6 },
  { id: 'mage', name: '元同盟の宮廷魔道士', desc: '魔道と信仰が得意。人望が厚い。', age: 42,
    skills: { magic: 'B', faith: 'C' }, defaultRank: 'D',
    friendship: { kingdom: 0, empire: 0, alliance: 15 }, realRewardMul: 1, cha: 14 },
  { id: 'wanderer', name: '流れの旅人', desc: 'なんでもそこそこ。どの国とも縁がない。', age: 35,
    skills: {}, defaultRank: 'C',
    friendship: { kingdom: 0, empire: 0, alliance: 0 }, realRewardMul: 1, cha: 10 },
];

export const SKILL_NAMES: Record<SkillId, string> = {
  sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道', faith: '信仰',
  riding: '騎乗', heavy: '重装', flying: '飛行', gun: '銃', tactics: '軍略', command: '統率',
};
export const STAT_NAMES: Record<StatId, string> = {
  hp: '体力', str: '力', mag: '魔力', skl: '技', spd: '速さ', def: '守り',
};
/** 19夜目：心の3つ */
export const MIND_NAMES: Record<keyof import('../core/types').Mind, string> = { fight: '闘志', calm: '平静', grudge: '執念' };
export const MIND_DESC: Record<keyof import('../core/types').Mind, string> = {
  fight: '燃えると強い。高すぎると無茶をする',
  calm: '恐れや怒りに飲まれない',
  grudge: '恨みや誓いの強さ。仇の前で力が出る',
};
export const PATH_NAMES: Record<Path, string> = { warrior: '将', strategist: '参謀', civil: '文官', champion: '勇士' };
/** 10夜目：その子の向き（個人ページの記録・卒業式） */
export const PATH_SAY: Record<Path, string> = {
  warrior: '兵をまとめ、率いて戦う将の器だ',
  strategist: '戦の先を読み、策で勝ちを引き寄せる',
  civil: '剣よりも言葉で、国と国をつなぐ',
  champion: '兵を率いるより、自分で道を切り開く',
};
/** 10夜目：卒業後の道のひとこと（個人ページ・卒業式） */
export const PATH_LINES: Record<Path, string> = {
  warrior: '兵を率いて戦う。統率の高い子ほど、上の位へ上りやすい',
  strategist: '後ろから策を立てる。軍略の高い子ほど、無駄な戦を避けさせる',
  civil: '国と国のあいだを取り持つ。魅力の高い子ほど、和平に近づける',
  champion: '兵を率いるより、自分で道を切り開く。武勲で名を上げる',
};
export const RANK_TITLES: Record<Path, string[]> = {
  warrior: ['兵士', '小隊長', '部隊長', '将軍', '元帥'],
  strategist: ['参謀見習い', '作戦参謀', '参謀長', '軍師'],
  civil: ['書記官', '外交官', '大使', '宰相'],
  champion: ['兵士', '先鋒', '近衛', '名高い勇士'],
};
/** 出身ごとの髪色の傾向（髪色id: 重み） */
export const HAIR_COLORS = ['#2b2320', '#5a3a24', '#8a5a2e', '#c99a4f', '#e6d08a', '#b8462f', '#7a7f8c', '#3e4f7a'];
export const HAIR_NAMES = ['black', 'brown', 'chestnut', 'gold', 'blond', 'red', 'silver', 'blue'];
export const HAIR_TENDENCY: Record<Origin, number[]> = {
  kingdom: [1, 2, 2, 3, 5, 2, 4, 3],
  empire: [5, 5, 4, 2, 1, 3, 1, 1],
  alliance: [2, 4, 5, 3, 2, 3, 1, 2],
  frontier: [3, 5, 4, 2, 1, 2, 1, 1],
};
export const SKIN_COLORS = ['#f6dcc4', '#eac3a0', '#d2a079', '#a8754f'];
export const SKIN_TENDENCY: Record<Origin, number[]> = {
  kingdom: [6, 3, 1, 0], empire: [1, 3, 4, 2], alliance: [2, 5, 3, 1], frontier: [2, 4, 3, 2],
};
export const CLOTH_COLORS: Record<Origin, string[]> = {
  kingdom: ['#3d6fa3', '#5b7f9e', '#2f4f75'],
  empire: ['#b8862b', '#a2452f', '#7a3b2a'],
  alliance: ['#4f8f4a', '#6f9e5a', '#3c6e60'],
  frontier: ['#8a7a66', '#6e6253', '#9c8b70'],
};
