// 日ごとの授業カード（7夜目）。約30種類から毎日5種類＋休講が出る
import type { SkillId, StatId, PersonalityId } from '../core/types';

export type LessonGroup = 'weapon' | 'body' | 'mind' | 'social' | 'special' | 'rest';
export const LESSON_GROUP_NAMES: Record<LessonGroup, string> = { weapon: '武器', body: '体と馬', mind: '頭と心', social: '交流', special: '特別', rest: '休み' };
/** カードの上の帯の色 */
export const LESSON_GROUP_COLOR: Record<LessonGroup, string> = { weapon: '#3f6fb0', body: '#5f8a4a', mind: '#6a5a8e', social: '#c06a72', special: '#b0802a', rest: '#4f8796' };

/** 交流・休講などの特別な効果 */
export type LessonSpecial = 'tea' | 'dinner' | 'spar' | 'interview' | 'career' | 'rest' | 'field';

export interface LessonDef {
  id: string;
  name: string;
  /** カードの左上の1文字 */
  mark: string;
  group: LessonGroup;
  /** 伸びやすい技能（1＝↑↑、0.5＝↑） */
  skills?: Partial<Record<SkillId, number>>;
  /** 鍛錬ゲージがたまる能力（1＝↑↑、0.5＝↑） */
  stats?: Partial<Record<StatId, number>>;
  /** 経験値（1＝ふつうの授業の分） */
  exp?: number;
  /** 才能の判明（1＝ふつうの授業の分） */
  reveal?: number;
  /** 体力の増減（−は減る） */
  stamina: number;
  special?: LessonSpecial;
  /** 出やすさ */
  weight: number;
  /** 顔が出やすい性格 */
  likes?: PersonalityId[];
  /** 銃の登場後だけ */
  needGun?: boolean;
  /** 札に出す短い説明（伸びるもの以外） */
  note?: string;
  /** 札に出す伸びるもの（技能・能力以外） */
  extra?: { label: string; big?: boolean }[];
}

export const LESSONS: LessonDef[] = [
  // ---- 武器12 ----
  { id: 'sword', name: '剣術', mark: '剣', group: 'weapon', skills: { sword: 1 }, stats: { skl: 0.5 }, stamina: -9, weight: 10, likes: ['hot', 'serious'] },
  { id: 'sword_form', name: '剣の型', mark: '型', group: 'weapon', skills: { sword: 1 }, stats: { spd: 0.5 }, stamina: -8, weight: 8, likes: ['calm', 'serious'] },
  { id: 'lance', name: '槍術', mark: '槍', group: 'weapon', skills: { lance: 1 }, stats: { def: 0.5 }, stamina: -9, weight: 10, likes: ['serious', 'hot'] },
  { id: 'lance_thrust', name: '槍の突き', mark: '突', group: 'weapon', skills: { lance: 1 }, stats: { str: 0.5 }, stamina: -10, weight: 8, likes: ['competitive', 'hot'] },
  { id: 'axe', name: '斧術', mark: '斧', group: 'weapon', skills: { axe: 1 }, stats: { hp: 0.5 }, stamina: -10, weight: 10, likes: ['hot', 'cheerful'] },
  { id: 'axe_strike', name: '斧の打ち込み', mark: '打', group: 'weapon', skills: { axe: 1 }, stats: { str: 0.5 }, stamina: -11, weight: 8, likes: ['competitive'] },
  { id: 'bow', name: '弓術', mark: '弓', group: 'weapon', skills: { bow: 1 }, stats: { skl: 0.5 }, stamina: -8, weight: 10, likes: ['calm', 'shy'] },
  { id: 'bow_far', name: '遠射', mark: '遠', group: 'weapon', skills: { bow: 1 }, stats: { skl: 0.5 }, stamina: -8, weight: 8, likes: ['calm', 'cynic'] },
  { id: 'magic', name: '魔道', mark: '魔', group: 'weapon', skills: { magic: 1 }, stats: { mag: 0.5 }, stamina: -7, weight: 10, likes: ['calm', 'cynic', 'shy'] },
  { id: 'magic_theory', name: '魔道の理論', mark: '理', group: 'weapon', skills: { magic: 1 }, stats: { res: 0.5 }, reveal: 1.5, stamina: -5, weight: 7, likes: ['serious', 'shy', 'cynic'] },
  { id: 'faith', name: '信仰', mark: '信', group: 'weapon', skills: { faith: 1 }, stats: { res: 0.5 }, stamina: -6, weight: 10, likes: ['gentle', 'timid'] },
  { id: 'prayer', name: '祈りの作法', mark: '祈', group: 'weapon', skills: { faith: 1 }, stats: { mag: 0.5 }, stamina: -5, weight: 7, likes: ['gentle', 'serious'] },
  { id: 'gun', name: '砲術', mark: '砲', group: 'weapon', skills: { gun: 1 }, stats: { skl: 0.5 }, stamina: -9, weight: 9, likes: ['competitive', 'cynic'], needGun: true },
  // ---- 体と馬6 ----
  { id: 'riding', name: '騎乗', mark: '騎', group: 'body', skills: { riding: 1 }, stats: { spd: 0.5 }, stamina: -9, weight: 9, likes: ['hot', 'cheerful'] },
  { id: 'long_ride', name: '遠乗り', mark: '駆', group: 'body', skills: { riding: 1 }, stats: { hp: 0.5 }, stamina: -11, weight: 6, likes: ['whimsical', 'cheerful'] },
  { id: 'heavy', name: '重装訓練', mark: '鎧', group: 'body', skills: { heavy: 1 }, stats: { def: 0.5 }, stamina: -12, weight: 8, likes: ['serious', 'gentle'] },
  { id: 'flying', name: '飛行訓練', mark: '翼', group: 'body', skills: { flying: 1 }, stats: { spd: 0.5 }, stamina: -10, weight: 7, likes: ['whimsical', 'cheerful'] },
  { id: 'run', name: '走り込み', mark: '走', group: 'body', stats: { hp: 1, spd: 0.5 }, exp: 1.3, stamina: -12, weight: 6, likes: ['hot', 'competitive'] },
  { id: 'strength', name: '筋力づくり', mark: '筋', group: 'body', stats: { str: 1, def: 0.5 }, exp: 1.2, stamina: -11, weight: 6, likes: ['competitive', 'hot'] },
  // ---- 頭と心6 ----
  { id: 'tactics', name: '戦術論', mark: '策', group: 'mind', skills: { tactics: 1 }, stats: { skl: 0.5, cha: 0.5 }, exp: 2, reveal: 1.5, stamina: -4, weight: 8, likes: ['calm', 'cynic', 'serious'], extra: [{ label: '経験値', big: true }] },
  { id: 'history', name: '兵法の歴史', mark: '史', group: 'mind', skills: { tactics: 0.5 }, stats: { lck: 0.5 }, exp: 1.5, reveal: 2.5, stamina: -3, weight: 6, likes: ['shy', 'serious'], extra: [{ label: '経験値' }, { label: '芽の発見', big: true }] },
  // 10夜目：統率を伸ばす授業
  { id: 'command', name: '指揮の演習', mark: '指', group: 'mind', skills: { command: 1 }, stats: { cha: 0.5 }, exp: 1.5, stamina: -6, weight: 8, likes: ['serious', 'hot', 'competitive'] },
  { id: 'march', name: '行軍', mark: '行', group: 'body', skills: { command: 0.5 }, stats: { hp: 0.5, def: 0.5 }, exp: 1.5, stamina: -11, weight: 6, likes: ['hot', 'serious', 'cheerful'] },
  { id: 'letters', name: '読み書き', mark: '書', group: 'mind', stats: { cha: 0.5, mag: 0.5 }, exp: 1, reveal: 2, stamina: -2, weight: 6, likes: ['gentle', 'shy'], extra: [{ label: '芽の発見' }] },
  { id: 'manners', name: '礼法', mark: '礼', group: 'mind', stats: { cha: 1 }, exp: 1, stamina: -3, weight: 6, likes: ['serious', 'calm'] },
  { id: 'diplomacy', name: '外交の作法', mark: '外', group: 'mind', stats: { cha: 1, lck: 0.5 }, exp: 1, stamina: -3, weight: 5, likes: ['cheerful', 'gentle'] },
  { id: 'meditate', name: '瞑想', mark: '瞑', group: 'mind', stats: { res: 1, lck: 0.5 }, exp: 0.8, reveal: 1, stamina: 3, weight: 6, likes: ['calm', 'gentle', 'timid'], extra: [{ label: '体力' }] },
  // ---- 交流5 ----
  { id: 'tea', name: 'お茶会', mark: '茶', group: 'social', special: 'tea', stamina: 5, weight: 7, likes: ['gentle', 'cheerful', 'shy'], extra: [{ label: '支援', big: true }, { label: 'やる気' }], note: '顔の子どうしの支援が上がる' },
  { id: 'dinner', name: '食事会', mark: '食', group: 'social', special: 'dinner', stamina: 2, weight: 5, likes: ['cheerful', 'hot'], extra: [{ label: '全員のやる気', big: true }], note: '全員のやる気が上がる' },
  { id: 'spar', name: '紅白戦', mark: '戦', group: 'social', special: 'spar', exp: 4, stamina: -14, weight: 6, likes: ['competitive', 'hot'], extra: [{ label: '経験値', big: true }, { label: '全技能' }] },
  { id: 'interview', name: '面談', mark: '話', group: 'social', special: 'interview', stamina: 0, weight: 6, likes: ['timid', 'shy', 'serious'], extra: [{ label: '信頼', big: true }, { label: 'やる気' }], note: '顔の子から1人と話す' },
  { id: 'career', name: '進路指導', mark: '進', group: 'social', special: 'career', stamina: 0, weight: 3, extra: [{ label: '信頼', big: true }, { label: '進路' }], note: '3年生と進路の話をする' },
  // ---- 特別 ----
  { id: 'field', name: '野外演習', mark: '野', group: 'special', special: 'field', skills: {}, stats: { hp: 0.5 }, exp: 3, reveal: 2, stamina: -13, weight: 2, extra: [{ label: '経験値', big: true }, { label: '目標技能', big: true }, { label: '芽の発見' }], note: '雨の日だけの特別な演習' },
];
export const REST: LessonDef = { id: 'rest', name: '休講', mark: '休', group: 'rest', special: 'rest', stamina: 25, weight: 0, extra: [{ label: '体力回復', big: true }] };
export const LESSON_BY_ID: Record<string, LessonDef> = Object.fromEntries([...LESSONS, REST].map((l) => [l.id, l]));

/** 練習中の短い出来事（結果の画面）。{a}{b}＝顔の子、{t}＝先生、{l}＝授業 */
export const PRACTICE_EVENTS: Record<string, { narr: string; say: Partial<Record<PersonalityId, string>> & { default: string } }[]> = {
  tag: [
    { narr: '{a}と{b}の息がぴったり合った。{l}の動きが一段上がる。', say: { default: '今の、よかったね！', hot: 'よっしゃ、今のは決まったぜ！', calm: '……今の呼吸、覚えておこう。', shy: 'あ、合わせられた……！', cynic: 'ま、悪くない連携だったな。', cheerful: 'いえーい、ばっちり！' } },
    { narr: '{a}がつまずいたところを、{b}がさりげなく支えた。', say: { default: 'ありがとう、助かった。', timid: 'ご、ごめん……ありがとう。', competitive: '……礼は言っておく。次はわたしが支える番だ。', gentle: 'えへへ、ありがとう〜。' } },
  ],
  teacher: [
    { narr: '{t}が{a}の手元を見て、ひとこと助言した。', say: { default: 'なるほど……やってみます。', serious: 'はい！ 今の言葉、書き留めておきます。', whimsical: 'ふーん、そういうやり方もあるんだ。', cynic: '……言われなくても、気づいてましたけど。' } },
    { narr: '{t}が「いい筋だ」と{a}の肩をたたいた。', say: { default: '本当ですか？ もっと頑張ります！', shy: '……！（耳まで赤くなっている）', calm: 'ありがとうございます。続けます。', hot: 'うおお、燃えてきた！' } },
  ],
  extra: [
    { narr: '授業のあとも、{a}がひとり残って練習を続けていた。', say: { default: 'あと少しで、何かつかめそうなんです。', whimsical: 'たまには、ね。', competitive: '今日のうちに、もう一歩先へ行きたいんだ。', gentle: 'のんびりやってたら、日が暮れちゃった〜。' } },
  ],
  close: [
    { narr: '{a}が足をひねりかけた。大事には至らなかったが、ひやりとした。', say: { default: 'だ、大丈夫です。気をつけます。', hot: 'これくらい平気だって！', timid: 'こ、こわかった……。', cynic: '……今のは見なかったことにしてください。' } },
  ],
  spark: [
    { narr: '{a}の動きに、ふと光るものが見えた。（才能のヒント）', say: { default: '今の感覚……なんだろう。', whimsical: 'あれ？ なんか今、すごく楽しかった。', serious: '……もう一度、同じようにやってみます。', cheerful: 'ねえ先生、今の見た!?' } },
  ],
  rival: [
    { narr: '{a}と{b}が張り合って、どちらも一歩もゆずらない。', say: { default: '次は負けないから。', competitive: 'まだまだ！ もう一本だ！', hot: '望むところだ！', calm: '……いい勝負だった。次も頼む。', cynic: 'ふん、今日は引き分けにしといてやる。' } },
  ],
  love: [
    { narr: '{a}と{b}が目を合わせて、少し照れたように笑った。', say: { default: '……一緒だと、がんばれる気がする。', shy: '……となり、いいですか。', cheerful: 'えへへ、今日もよろしくね。', cynic: '……べつに、意識なんかしてない。' } },
  ],
};
