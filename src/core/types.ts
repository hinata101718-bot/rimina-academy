// ゲーム全体で使う型。DOMに依存しない。

export type CountryId = 'kingdom' | 'empire' | 'alliance';
export type Origin = CountryId | 'frontier';
export type House = 'noble' | 'commoner' | 'orphan';
export type Gender = 'm' | 'f';

export type PersonalityId =
  | 'hot' | 'calm' | 'timid' | 'cynic' | 'gentle'
  | 'serious' | 'cheerful' | 'shy' | 'competitive' | 'whimsical';

export type SkillId = 'sword' | 'lance' | 'axe' | 'bow' | 'magic' | 'faith' | 'riding' | 'heavy' | 'flying' | 'gun' | 'tactics' | 'command';
export type Rank = 'E' | 'E+' | 'D' | 'D+' | 'C' | 'C+' | 'B' | 'B+' | 'A' | 'A+' | 'S';

/** 19夜目：体の6つ（体力・力・魔力・技・速さ・守り）。幸運・魔防・魅力はなくした */
export type StatId = 'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'def';
/** 19夜目：心の3つ（0〜100）。闘志＝燃えると強い・高すぎると無茶、平静＝恐れや怒りに飲まれない、執念＝仇の前で力が出る */
export interface Mind { fight: number; calm: number; grudge: number }
/** 19夜目：教訓（戦いの経験から身につく力。出来事つき） */
export interface Lesson { id: string; text: string; why: string; year: number; /** 効く相手（兵種のid・攻撃の種類・宿敵のid） */ vs?: string }
export type Stats = Record<StatId, number>;

/** 武器の種類。magic=魔道書（魔道技能）、staff=杖（信仰技能・回復）、holy=白魔法の攻撃書（信仰技能） */
export type WeaponType = 'sword' | 'lance' | 'axe' | 'bow' | 'magic' | 'holy' | 'staff' | 'gun';
export type MoveType = 'infantry' | 'cavalry' | 'armor' | 'flying';

export type Path = 'warrior' | 'strategist' | 'civil' | 'champion'; // 将（武官）・参謀・文官・勇士（10夜目）

// ---------- データ定義 ----------

export interface AbilityDef {
  id: string;
  /** 12夜目：この武器の種類を持っているときだけ効く（心得） */
  wtype?: WeaponType[];
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
  pierce?: number;       // 相手の守備・魔防をN低いものとして攻撃
  followUp?: number;     // 追撃に必要な速さの差がN少なくてよい
}

export interface ClassDef {
  id: string;
  name: string;
  /** 0=見習い 1=初級 2=中級 3=上級 */
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
  /** 魔法（技能ランクで覚える。武器庫・購入なし） */
  spell?: boolean;
  /** 15夜目：魔法の属性（最期の文などを、とどめの攻撃に合わせる）。なければ属性を言わない */
  element?: 'fire' | 'wind' | 'thunder' | 'ice' | 'dark' | 'light';
  /** 才能のある子だけが覚える珍しい魔法 */
  rare?: boolean;
  /** 古いセーブを変換するときの元の値段 */
  value?: number;
  poison?: boolean;   // 命中時に毒
  weaken?: boolean;   // 命中時に弱体
  cure?: boolean;     // 回復のとき毒・弱体を治す
  ward?: number;      // 回復のとき魔防+（次の自分の番まで）
}

// ---------- 会話 ----------

export type TalkTopic =
  | 'dream' | 'origin' | 'house' | 'trait'
  | 'ev_cover' | 'ev_samekill' | 'ev_exam' | 'ev_loss' | 'ev_homewar' | 'ev_festival' | 'ev_spar' | 'ev_injury'
  | 'rel_friend' | 'rel_rival' | 'rel_love' | 'rel_senpai' | 'daily'
  | 'food' | 'study' | 'teacher' | 'family' | 'hobby' | 'war' | 'future' | 'fear'
  /** 21夜目：呪いの子の蘇りの記憶・宿敵との手紙 */
  | 'memory';

/** 会話の片方（a または b）にかける条件 */
export interface TalkSideCond {
  hasDream?: boolean;
  house?: House;
  personality?: PersonalityId;
  /** 性格のどれか */
  personalities?: PersonalityId[];
  /** 性格のまとまり（にぎやか・静か・しっかり） */
  group?: 'loud' | 'quiet' | 'steady';
  trait?: string;
  origin?: Origin;
  /** 夢のどれか（DreamDef.id） */
  dream?: string[];
  /** 最近の出来事（RecentEvent.type）がある */
  recent?: string;
  /** 才能のヒントが出ている */
  talent?: boolean;
  /** 上の学年 */
  senior?: boolean;
  /** 疲れている（疲労50以上） */
  tired?: boolean;
  /** やる気が低い／高い */
  lowMood?: boolean;
  highMood?: boolean;
  /** 支援C以上の仲間がいる */
  hasFriend?: boolean;
  grade?: number;
  /** 平和な時代に入学した（戦争を知らない。7夜目） */
  peaceBorn?: boolean;
  /** 21夜目：呪いで蘇った子 */
  revived?: boolean;
}
/** 二人の組にかける条件 */
export interface TalkCond {
  a?: TalkSideCond;
  b?: TalkSideCond;
  sameCountry?: boolean;
  sameHouse?: boolean;
  sameGrade?: boolean;
  kind?: 'friend' | 'rival' | 'love' | 'senpai';
  /** 戦況（平和期・緊張期・激戦期） */
  stage?: 'peace' | 'tension' | 'war';
  /** 会話を組み立てるときに渡される目印（面談の結果など） */
  flag?: string;
  notFlag?: string;
}
export type TalkSay = string | { if: TalkCond; then: TalkSay; else: TalkSay };
/** by：a・b＝話す人、n＝地の文（場面の説明）、t＝先生（面談） */
export interface TalkLine { by: 'a' | 'b' | 'n' | 't'; say: TalkSay }
export interface TalkDef {
  id: string;
  topic: TalkTopic;
  rank: 'C' | 'B' | 'A';
  when?: TalkCond;
  lines: TalkLine[];
}
/** 意味ID → 性格 → 文面（配列ならランダムに1つ） */
export type PhraseTable = Record<string, Partial<Record<PersonalityId, string | string[]>> & { default?: string | string[] }>;

/** 覚える魔法の一覧の1枠（技能ランクがここに届いたら覚える） */
export interface SpellSlot { id: string; rank: Rank; skill: 'magic' | 'faith' }
