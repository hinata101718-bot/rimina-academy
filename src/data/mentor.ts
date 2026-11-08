// 先生の特殊能力（8夜目）。ヒナタさんと確定した最初の20種。
// ここにデータを1つ足すだけで、教官の画面・効き目・後継の受け継ぎに自動で出る。
// 効き目（effect）は下の「効き目の種類」の名前を使う（同じ名前の数字は足し算される）。

/** 効き目の種類（数字の意味） */
export interface MentorEffect {
  /** 顔が出ている子の伸び（0.15＝+15%） */
  faceMul?: number;
  /** 全員の伸び（0.05＝+5%） */
  allMul?: number;
  /** 授業で使う先生の体力（+0.15＝15%多く減る／−0.2＝20%少なく減る） */
  staminaCost?: number;
  /** 授業カードの顔の人数+ */
  faces?: number;
  /** 毎日並ぶ授業の種類+ */
  cards?: number;
  /** 才能のヒントの出やすさ（0.5＝×1.5） */
  reveal?: number;
  /** 友情タッグになる支援の値が下がる（10＝支援30→20で組める） */
  tagEase?: number;
  /** 友情タッグの効き目（0.15＝×1.3→×1.5） */
  tagMul?: number;
  /** 面談で上がる信頼（0.5＝×1.5） */
  interviewTrust?: number;
  /** お茶会で必ず会話が起きる（1＝起きる） */
  teaTalk?: number;
  /** お茶会の支援（0.5＝×1.5） */
  teaSupport?: number;
  /** 推薦が通りやすい（%） */
  careerAccept?: number;
  /** 退学の予兆を面談1回で解く（1＝解く） */
  retainOne?: number;
  /** 出撃前に敵将の特徴が見える数 */
  scout?: number;
  /** 自動の戦闘の2回目の「ここぞの判断」が必ず来る（1＝来る） */
  judgments?: number;
  /** 出撃前に選べる策の数+（9夜目） */
  stratSlots?: number;
  /** 教官の指示の成功率（%） */
  command?: number;
  /** 倒れた子が重傷で済む確率（%） */
  injury?: number;
  /** 紅白戦の経験値（0.5＝×1.5） */
  sparExp?: number;
  /** 先生の最大体力+ */
  maxStamina?: number;
  /** 年による最大体力の低下をゆるやかに（0.5＝半分） */
  ageSlow?: number;
  /** 休講の回復（0.5＝×1.5） */
  restMul?: number;
  /** 入学の志願者（0.2＝+20%） */
  applicants?: number;
  /** 評判の上がり方（0.2＝+20%） */
  repMul?: number;
  /** 三国の友好度の上がり方（0.25＝+25%） */
  friendMul?: number;
  /** 三国からの援助金（0.15＝+15%） */
  aidMul?: number;
}
export type MentorEffectKey = keyof MentorEffect;

export type MentorBranch = 'lesson' | 'bond' | 'battle' | 'school';
export const MENTOR_BRANCH_NAMES: Record<MentorBranch, string> = { lesson: '授業', bond: '絆', battle: '戦い', school: '学校と体' };
export type MentorCost = 'S' | 'M' | 'L';
export const MENTOR_COST_NAMES: Record<MentorCost, string> = { S: '小', M: '中', L: '大' };

export interface MentorAbility {
  id: string;
  name: string;
  /** 1文字の印（木の丸に出す） */
  mark: string;
  branch: MentorBranch;
  cost: MentorCost;
  /** 先に覚えておく能力 */
  pre?: string;
  desc: string;
  effect: MentorEffect;
  /** 経歴ごとの値引き（0.6＝4割引き）。knight・merc・mage・wanderer */
  cheap?: Partial<Record<string, number>>;
}

const K = 0.7; // 経歴で安くなるもの（3割引き）
const KK = 0.5; // とくに安いもの（半額）

export const MENTOR_ABILITIES: MentorAbility[] = [
  // ---- 授業 ----
  { id: 'lecture', name: '名講義', mark: '講', branch: 'lesson', cost: 'M', desc: '顔が出ている子の伸び+15%', effect: { faceMul: 0.15 } },
  { id: 'passion', name: '熱血指導', mark: '熱', branch: 'lesson', cost: 'L', pre: 'lecture', desc: '全員の伸び+5%（授業で体力が少し多く減る）', effect: { allMul: 0.05, staminaCost: 0.15 } },
  { id: 'eyes', name: '目配り', mark: '目', branch: 'lesson', cost: 'M', desc: '授業カードの顔が1人増える', effect: { faces: 1 }, cheap: { wanderer: K } },
  { id: 'drawer', name: '授業の引き出し', mark: '引', branch: 'lesson', cost: 'L', desc: '毎日並ぶ授業が5種類→6種類', effect: { cards: 1 }, cheap: { wanderer: K } },
  { id: 'economy', name: '省エネ授業', mark: '省', branch: 'lesson', cost: 'S', desc: '授業で使う体力−20%', effect: { staminaCost: -0.2 }, cheap: { merc: K } },
  { id: 'spark', name: 'ひらめきの種', mark: '閃', branch: 'lesson', cost: 'M', desc: '才能のヒントが出やすい（×1.5）', effect: { reveal: 0.5 } },
  // ---- 絆 ----
  { id: 'matchmaker', name: '仲人の勘', mark: '縁', branch: 'bond', cost: 'M', desc: '友情タッグが起きやすく、効き目も上がる', effect: { tagEase: 10, tagMul: 0.15 }, cheap: { mage: K } },
  { id: 'listener', name: '聞き上手', mark: '聴', branch: 'bond', cost: 'S', desc: '面談で上がる信頼×1.5', effect: { interviewTrust: 0.5 }, cheap: { mage: K } },
  { id: 'teaparty', name: '茶会の名手', mark: '茶', branch: 'bond', cost: 'M', desc: 'お茶会で必ず会話が起き、支援×1.5', effect: { teaTalk: 1, teaSupport: 0.5 }, cheap: { mage: K } },
  { id: 'career', name: '進路の目利き', mark: '路', branch: 'bond', cost: 'M', desc: '卒業のときの推薦が通りやすい（+15%）', effect: { careerAccept: 15 }, cheap: { mage: K } },
  { id: 'keeper', name: '引き止め上手', mark: '留', branch: 'bond', cost: 'S', pre: 'listener', desc: '退学の予兆を面談1回で解ける', effect: { retainOne: 1 }, cheap: { mage: K } },
  // ---- 戦い ----
  { id: 'scout', name: '斥候の心得', mark: '斥', branch: 'battle', cost: 'S', desc: '出撃前に敵将の特徴が1つ見える', effect: { scout: 1 }, cheap: { knight: K } },
  { id: 'tactician', name: '軍師の眼', mark: '軍', branch: 'battle', cost: 'L', pre: 'scout', desc: '出撃前に選べる策（作戦カード）が1枚多くなる', effect: { stratSlots: 1 }, cheap: { knight: K } },
  { id: 'voice', name: '声が届く', mark: '声', branch: 'battle', cost: 'M', desc: '教官の指示の成功率+15%', effect: { command: 15 }, cheap: { knight: KK } },
  { id: 'retreat', name: '退き際の判断', mark: '退', branch: 'battle', cost: 'M', desc: '倒れた子が重傷で済みやすい（+10%）', effect: { injury: 10 }, cheap: { knight: K, merc: K } },
  { id: 'sparring', name: '紅白戦の鬼', mark: '紅', branch: 'battle', cost: 'S', desc: '紅白戦の経験値×1.5', effect: { sparExp: 0.5 }, cheap: { knight: K, merc: K } },
  // ---- 学校と体 ----
  { id: 'sturdy', name: '頑健', mark: '健', branch: 'school', cost: 'M', desc: '先生の最大体力+20、年による低下がゆるやか', effect: { maxStamina: 20, ageSlow: 0.5 } },
  { id: 'earlybird', name: '早起き', mark: '朝', branch: 'school', cost: 'S', desc: '休講の回復×1.5', effect: { restMul: 0.5 } },
  { id: 'fame', name: '名声', mark: '名', branch: 'school', cost: 'L', desc: '入学の志願者が増え、評判が上がりやすい', effect: { applicants: 0.2, repMul: 0.2 }, cheap: { mage: K } },
  { id: 'network', name: '顔が広い', mark: '交', branch: 'school', cost: 'L', desc: '三国の友好度が上がりやすく、援助金も増える', effect: { friendMul: 0.25, aidMul: 0.15 }, cheap: { mage: K } },
];

export const MENTOR_BY_ID: Record<string, MentorAbility> = Object.fromEntries(MENTOR_ABILITIES.map((a) => [a.id, a]));
