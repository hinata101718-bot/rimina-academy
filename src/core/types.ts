// ゲーム全体で使う型。DOMに依存しない。

export type CountryId = 'kingdom' | 'empire' | 'alliance';
export type Origin = CountryId | 'frontier';
export type House = 'noble' | 'commoner' | 'orphan';
export type Gender = 'm' | 'f';

export type PersonalityId =
  | 'hot' | 'calm' | 'timid' | 'cynic' | 'gentle'
  | 'serious' | 'cheerful' | 'shy' | 'competitive' | 'whimsical';

export type SkillId = 'sword' | 'lance' | 'axe' | 'bow' | 'magic' | 'faith' | 'riding' | 'heavy' | 'flying' | 'gun';
export type Rank = 'E' | 'E+' | 'D' | 'D+' | 'C' | 'C+' | 'B' | 'B+' | 'A' | 'A+' | 'S';

export type StatId = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res' | 'cha';
export type Stats = Record<StatId, number>;

/** 武器の種類。magic=魔道書（魔道技能）、staff=杖（信仰技能・回復）、holy=白魔法の攻撃書（信仰技能） */
export type WeaponType = 'sword' | 'lance' | 'axe' | 'bow' | 'magic' | 'holy' | 'staff' | 'gun';
export type MoveType = 'infantry' | 'cavalry' | 'armor' | 'flying';

export type Path = 'warrior' | 'strategist' | 'civil'; // 武官・参謀・文官

// ---------- データ定義 ----------

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  hit?: number;       // 命中+
  avo?: number;       // 回避+
  crit?: number;      // 必殺+
  dmg?: number;       // 与ダメージ+
  prot?: number;      // 被ダメージ−
  adjAllyDef?: number;   // 隣接する味方の守備+
  adjAllyProt?: number;  // 隣接する味方の被ダメージ−
  auraHeal?: number;     // ターン開始時、周囲2マスの味方のHP回復
  poison?: boolean;      // 命中時に毒
  weaken?: boolean;      // 命中時に弱体
  lowHpAtk?: number;     // HP半分以下で攻撃+
  realBattleHit?: number;// 実戦で命中+
  surroundedAvo?: number;// 敵3体以上に隣接されると回避+（負なら−）
  aloneAvo?: number;     // 2マス以内に味方がいないと回避+
  unlock?: boolean;      // 宝箱・扉を開けられる
  effective?: MoveType[];// 特効（威力×3）
}

export interface ClassDef {
  id: string;
  name: string;
  /** 0=見習い 1=初級 2=中級 3=上級 4=最上級（卒業後） */
  tier: 0 | 1 | 2 | 3 | 4;
  prereq: string[];                       // 前提兵種のid（どれか1つ）
  req: Partial<Record<SkillId, Rank>>;    // 必要技能ランク
  move: number;
  moveType: MoveType;
  weapons: WeaponType[];
  bonus: Partial<Stats>;                  // 能力補正（その兵種でいる間）
  growth: Partial<Stats>;                 // 成長率補正（%）
  ability?: string;                       // 固有スキル（AbilityDef.id）
  nation?: CountryId;                     // 国専用
  needGun?: boolean;                      // 銃の登場後のみ
  needStable?: boolean;                   // 厩舎段階1以上が必要（試験）
  hidden?: boolean;                       // 隠し（英雄）
  desc: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  type: WeaponType;
  might: number;      // 威力（杖は回復量）
  hit: number;
  crit: number;
  minRange: number;
  maxRange: number;
  rank: Rank;         // 必要ランク
  price: number;      // 0=購入不可（特殊）
  effective?: MoveType[];
  desc?: string;
}

// ---------- 会話 ----------

export type TalkTopic =
  | 'dream' | 'origin' | 'house' | 'trait'
  | 'ev_cover' | 'ev_samekill' | 'ev_exam' | 'ev_loss' | 'ev_homewar' | 'ev_festival' | 'ev_spar' | 'ev_injury'
  | 'rel_friend' | 'rel_rival' | 'rel_love' | 'daily';

/** 会話の片方（a または b）にかける条件 */
export interface TalkSideCond {
  hasDream?: boolean;
  house?: House;
  personality?: PersonalityId;
  trait?: string;
}
/** 二人の組にかける条件 */
export interface TalkCond {
  a?: TalkSideCond;
  b?: TalkSideCond;
  sameCountry?: boolean;
  kind?: 'friend' | 'rival' | 'love';
}
export type TalkSay = string | { if: TalkCond; then: string; else: string };
export interface TalkLine { by: 'a' | 'b'; say: TalkSay }
export interface TalkDef {
  id: string;
  topic: TalkTopic;
  rank: 'C' | 'B' | 'A';
  when?: TalkCond;
  lines: TalkLine[];
}
/** 意味ID → 性格 → 文面（配列ならランダムに1つ） */
export type PhraseTable = Record<string, Partial<Record<PersonalityId, string | string[]>> & { default?: string | string[] }>;
