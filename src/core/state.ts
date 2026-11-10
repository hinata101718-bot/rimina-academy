// ゲームの状態（セーブされるもの）の型
import type { CountryId, Origin, House, Gender, PersonalityId, SkillId, Stats, StatId, Path, SpellSlot, Mind, Lesson } from './types';
import type { Difficulty, DifficultyMods } from '../data/balance';
import type { TBattle, Deploy } from './tactics/types';

export interface FaceParts {
  hair: number;      // 髪色 index
  hairStyle: number; // 髪型 0..11
  skin: number;
  eyes: number;      // 0..4
  cloth: string;
  mouth: number;
  brows: number;
  accessory: number; // 0=なし
}

export interface RecentEvent { type: string; week: number; detail: string; with?: string }

export interface DropoutSign { reason: 'motivation' | 'family' | 'poach' | 'homewar'; weeksLeft: number; talksNeeded: number }

export interface CareerInfo {
  kind: 'army' | 'stay' | 'home' | 'merc';
  country: CountryId | null;
  path: Path;
  rank: number;          // 役職の段階 0..
  rankYears: number;
  growthMul: number;     // 卒業後の成長補正
  front: boolean;        // 前線配属
  alive: boolean;
  retired: boolean;
  injuredYears: number;
  /** 学校の教官になった */
  instructor?: boolean;
}

export interface Student {
  id: string;
  given: string;
  family: string;
  gender: Gender;
  age: number;
  birthYear: number;   // 年（ゲーム内年）
  /** 誕生日（月 0=4月、週 1..4） */
  birthday?: { month: number; week: number };
  origin: Origin;
  house: House;
  personality: PersonalityId;
  dream: string;
  traits: string[];
  knownTraits: string[];
  talent: string | null;
  talentReveal: number;
  stats: Stats;          // 素の能力（兵種補正なし）
  growth: Stats;         // 成長率（%）
  growthKnown: boolean;
  level: number;
  exp: number;
  skills: Record<SkillId, number>;
  /** 覚える魔法の一覧（入学時に決まる）と、覚えた魔法 */
  spellPlan?: SpellSlot[];
  spells: string[];
  /** 会話の記録（GameState.archive の id、新しいものが後ろ） */
  archive?: string[];
  /** 22夜目：装備している武器（武器庫の uid。1つの武器は1人だけ。なければ出撃のたびに自動） */
  equip?: string;
  /** 19夜目：心の3つ（闘志・平静・執念）・教訓・二つ名・傷跡 */
  mind?: Mind;
  lessons?: Lesson[];
  /** 23夜目⑤'：二つ名が変わった年・変わった数 */
  epithetYear?: number; epithetCount?: number;
  epithet?: string;
  scars?: { year: number; text: string }[];
  /** 19夜目：使える技（技能のランクで覚える。技のid） */
  techs?: string[];
  /** 19夜目：宿敵戦に出た回数・討った宿敵の数・仲間をかばった回数・蘇った（呪い）・双星の縁 */
  nemBattles?: number; nemKills?: number; guards?: number; revivedBy?: string; twinStar?: string;
  /** 20夜目：最上級の条件になる出来事の記録（鍵→回数。data/classes の deed） */
  deeds?: Record<string, number>;
  /** 19夜目：戦死したと思われたが、捕らわれて生きている（この年に戻る）・裏切りの兆し */
  secretAlive?: { year: number; by: string };
  betraySign?: number;
  /** 12夜目：覚えた戦技・心得、付けているもの（おまかせ。手で選んだら artsManual） */
  arts?: string[]; artsOn?: string[]; artsManual?: boolean;
  /** 14夜目：卒業生の講師に手ほどきを受けた技（1つ前のランクで覚える） */
  taught?: string[];
  /** 16夜目：最近覚えた技・魔法（出撃前の山札の ✦新） */
  recentLearn?: { id: string; week: number }[];
  /** 16夜目：覚える表（「技能:節目」→ 技のid。入学のときに決まる） */
  artPlan?: Record<string, string>;
  /** 18夜目：技の熟練（使った回数など。技の id → 数）と、選んだ進化の道（技の id → 道の順）。evoLog は年鑑・評価のための記録 */
  mastery?: Record<string, number>;
  evo?: unknown;
  evoLog?: unknown;
  /** 10夜目：この子と見た面談・相談の題（同じ会話を二度出さない） */
  seenTalks?: string[];
  /** 信頼40・70・90の特別な面談のうち、済んだもの */
  trustTalks?: number[];
  targets: [SkillId, SkillId];
  targetsAuto: boolean;
  classId: string;
  motivation: number;    // 0..4
  fatigue: number;
  sickWeeks: number;
  injuredWeeks: number;
  trust: number;
  grade: number;         // 1..3 在学中、卒業後は 0
  cohort: number;        // 何期生か
  enrollYear: number;
  status: 'enrolled' | 'graduated' | 'dead' | 'dropped';
  lowMotivWeeks: number;
  dropoutSign: DropoutSign | null;
  lastAttention: number; // 最後に注目された絶対週
  spotlightCount: number;
  examMonth: number;     // 最後に試験を受けた絶対月（-1=なし）
  face: FaceParts;
  faceImage: string | null;
  recent: RecentEvent[];
  // 記録
  kills: number;
  battles: number;
  weaponUse: Record<string, number>;
  bestGrade: string | null;
  memories: string[];
  offers: CountryId[];    // 声かけのあった国
  exhibitionScore: number;
  // 卒業後
  career: CareerInfo | null;
  history: { year: number; text: string }[];
  farewell: string | null;
  keepsake: string | null; // 持っていった武器（名前）
  parents: string[];
  children: string[];
  spouse: string | null;
  diedYear: number | null;
  deathNote: string | null;
  /** 最後に魔法を覚えた週・兵種が変わった週（自動の戦闘の出来事に使う） */
  lastSpellWeek?: number;
  lastClassWeek?: number;
  /** 23夜目④：初級どうしで兵種を変えた絶対月（月に1回まで） */
  sideMonth?: number;
  /** 個人ページで最後に見た肩書き・兵種（卒業生の昇進の演出に使う。6夜目） */
  seenTitle?: string;
  seenClass?: string;
  /** 会話や面談で分かった「意外な一面」（6夜目） */
  sides?: string[];
  /** 鍛錬ゲージ（能力ごと、0〜100。満タンで+1。7夜目） */
  train?: Partial<Stats>;
  /** 鍛錬ゲージで上がった能力の合計（個人ページ・シミュレーション用） */
  trainGain?: Partial<Stats>;
  /** 成長率が分かったあと、個人ページで「埋まる演出」を見た（8夜目） */
  growthSeen?: boolean;
  /** 体調を崩して休む残りの日数（7夜目。週単位の sickWeeks は古いセーブ用） */
  sickDays?: number;
  /** 軍略（9夜目）：戦術論・兵法の歴史の授業でたまる。策の成功率・部隊長の腕前に効く（0〜100） */
  strat?: number;
  /** これまでにもらった称号の数と、最近の評価（9夜目：個人ページの記録） */
  honors?: Record<string, number>;
  evalLog?: { year: number; month: number; title: string; grade: string; badges: string[]; scene?: string | null }[];
  /** 重傷を負った回数 */
  wounds?: number;
  /** 10夜目：得意技能（伸び×1.5）・苦手技能（×0.5）。入学時から見える */
  apt?: { good: SkillId[]; bad: SkillId[] };
  /** 10夜目：眠った芽（苦手の1つに。gold＝金の芽・英雄への道）。reveal＝芽の判明度、done＝開花した */
  bud?: { skill?: SkillId; gold?: boolean; reveal: number; done?: boolean; year?: number; ability?: string };
  /** 前の戦いの戦績（9夜目：評価の「前より伸びた」に使う） */
  lastRec?: { hitRate: number; dealt: number; kills: number };
}

/** 日ごとの授業カード（7夜目） */
export interface LessonCard {
  /** LessonDef.id */
  id: string;
  /** 顔が出ている生徒 */
  faces: string[];
  /** 友情タッグの組（支援C以上・恋人・ライバル） */
  tags: [string, string][];
  /** 相談したい子（面談のカード） */
  consult?: string[];
}
export interface LessonDay { key: number; cards: LessonCard[]; rain?: boolean; /** 19夜目：交流の札 */ social?: LessonCard[] }
/** 授業の結果で伸びた子の1行 */
export interface LessonRow { id: string; face: boolean; tag?: boolean; target?: boolean; skills: { k: SkillId; p0: number; p1: number }[]; train: { k: StatId; g0: number; g1: number; up: number }[] }
export interface LessonEvent { kind: string; ids: string[]; lines: TalkLineLog[] }

export interface Support { a: string; b: string; value: number; kind: 'none' | 'friend' | 'rival' | 'love' | 'senpai'; seen: string[]; lastRank: '' | 'C' | 'B' | 'A' }

export interface Teacher { id: string; name: string; skill: SkillId; points: number; salary: number; alumniId?: string; baseSalary?: number; /** 学校に来た年 */ since?: number }

/** 副教官（学年の担任）の方針 */
export type VicePolicy = 'balance' | 'talent' | 'dream' | 'combat';
export interface ViceInstructor { teacherId: string; grade: number; policy: VicePolicy }

/** 歴代の教官 */
export interface PastInstructor { name: string; background: string; generation: number; from: number; to: number; age: number; studentId?: string; taught: number }

/** 場面（代替わり・エンディング）の1ページ */
export interface SceneLine {
  /** 話す人：生徒id・'teacher'（今の教官）・'narr'（地の文） */
  by: string;
  text: string;
  /** 見出し（大きく出す） */
  title?: string;
  /** 顔を並べる（生徒id） */
  faces?: string[];
  /** 卒業写真（期） */
  photo?: number;
  /** 1枚絵の名前（public/art） */
  art?: string;
  /** エンドロール（名前を流す） */
  roll?: { name: string; dead?: boolean }[];
}

export interface ArmoryItem { uid: string; weaponId: string; engraved?: string;
  /** 銘入りの武器（10夜目：討ち取った敵将の武器）：名前・由来・少し強い */
  named?: { name: string; story: string; officerId?: string; by?: string; year: number; might: number; hit: number; crit: number };
  /** 手に入れたわけ（雑兵の落とし物・依頼の報酬・国から） */
  got?: { kind: LootItem['kind']; year: number; text: string };
  /** 14夜目：添え名（data/rarity.ts の AFFIXES）・伝説の武器の id・使った子ごとの回数（愛用の武器） */
  affix?: string[]; legend?: string; uses?: Record<string, number>;
}

export interface Instructor {
  name: string;
  background: string;
  age: number;
  experience: number;
  skills: Record<SkillId, number>;
  /** 22夜目：魅力（使っていなかった）ははずした。古いセーブの値は読み込みのときに消す */
  cha?: number;
  generation: number;
  /** 技能の上限（ポイント）。得意科目はS、それ以外はB */
  caps?: Record<SkillId, number>;
  /** 卒業生が教官になったとき、その生徒のid */
  studentId?: string;
  /** 着任した年 */
  since?: number;
  /** 20夜目：この先生が勝った宿敵戦の数（先生の兵種が上がる） */
  nemWins?: number; rankShown?: number;
  /** 21夜目：「引退を考える」場面を見た */
  thought?: boolean;
  /** 先生の体力（7夜目）と、寝込んでいる残りの日数 */
  stamina?: number;
  sickDays?: number;
  /** 先生の経験ポイント（8夜目）：今持っている分と、これまでの合計 */
  xp?: number;
  xpTotal?: number;
  /** 覚えた特殊能力（data/mentor.ts の id）と、そのうち先代から受け継いだもの */
  abilities?: string[];
  inherited?: string[];
}

export interface WorldState {
  power: Record<CountryId, number>;
  relations: { ke: number; ea: number; ak: number };
  tension: number;
  friendship: Record<CountryId, number>;
  gunYear: number;     // 銃が現れる予定の年
  gunUnlocked: boolean;
  kingDied: boolean;
  warYears: number;    // 激戦期が続いた年数
  pairWarYears?: Record<string, number>; // 国の組ごとの戦争の年数
  epidemic: boolean;
  famine: boolean;
  vassal: CountryId | null;
  peaceTalksHeld: number;
  /** 和平の円卓（三国それぞれに大使以上の教え子がいる和平会議）が開かれた年。エンディングは3夜目 */
  peaceRoundYear?: number | null;
  schoolDefensePending: boolean;
  /** 一国の国力が他の二国の合計を上回った年数（続けて） */
  unifyYears?: Partial<Record<CountryId, number>>;
  /** 戦いの疲れ（激戦期1年=1、緊張期1年=0.5、平和期は−1） */
  exhaustion?: number;
  /** 学校防衛戦に勝った年 */
  defenseWonYear?: number;
  /** 24夜目②：この年に、その国の依頼を断った数・受けた数（年度末に評判へ） */
  declined?: Partial<Record<CountryId, { off: number; took: number }>>;
  /** エンディングのあと「この学校を続ける」を選んだ平和な時代 */
  era?: 'peace' | null;
  /** 次の戦争の火種（7夜目）。くすぶり0〜100、100で次の戦争 */
  seed?: { kind: EndingKind; country?: CountryId | null; since: number; due: number; smolder: number; omens: number; help: number } | null;
  /** 何度目の戦争か（1＝最初の戦争）。今の戦争が始まった年 */
  warNo?: number;
  warStart?: number;
  /** 13夜目：勢力図（地域 id → 持ち主）と、持ち主が変わった記録 */
  regions?: Record<string, import('../data/regions').RegionHome>;
  regionLog?: { year: number; month: number; id: string; from: string; to: string }[];
  /** 19夜目：地域を治める人・守る人（宿敵・教え子） */
  rulers?: Record<string, import('./regions').Ruler>;
  eventCooldown: Record<string, number>; // 大事件ごとの再発までの月数
  history: { year: number; tension: number; power: Record<CountryId, number> }[];
}

export interface Quest {
  id: string;
  kind: 'drill' | 'bandit' | 'monster' | 'escort' | 'defend' | 'border' | 'fort' | 'refugee' | 'exhibition' | 'schoolDefense' | 'rescue' | 'breakout';
  title: string;
  client: string;
  clientCountry: CountryId | null;
  enemyCountry: CountryId | null;
  objective: 'rout' | 'boss' | 'defend' | 'escort' | 'seize' | 'rescue' | 'escape';
  template: string;
  level: number;
  reward: number;
  danger: number;
  weather: 'clear' | 'rain' | 'fog';
  real: boolean;
  defendTurns?: number;
  /** 依頼の場所（13夜目：勢力図の地域 id） */
  region?: string;
  /** 依頼の報酬の武器（10夜目） */
  rewardWeapon?: string;
  /** 14夜目：争いの地の依頼（危険度が1つ上がっている） */
  hot?: boolean;
  /** 14夜目：最初の1時間の案内の、負けない小さな依頼（戦死なし・策は1枚・判断は1回） */
  tutorial?: boolean;
  /** 19夜目：この依頼の先にいる宿敵（宿敵戦）。challenge＝宿敵から挑んできた（断れない）、rush＝教え子が勝手に向かった */
  nemesisId?: string; nemesisKind?: 'quest' | 'challenge' | 'rush'; mustGo?: boolean; rushBy?: string;
  /** 20夜目④：捕らわれた密偵（生徒id）を救い出す戦い */
  spyRescue?: string;
  /** 19夜目：決まった敵将（着任の道中など）・着任の道中の戦い */
  officerId?: string; opening?: boolean;
  /** 2つ目・3つ目の部隊向けの小さな依頼（9夜目）：報酬・評判は少なめ、戦況は動かない */
  small?: boolean;
  /** 偵察を出した（6夜目）。scoutFree は斥候がいて出撃の人数が減らないとき */
  scouted?: boolean; scoutFree?: boolean;
  /** 23夜目⑦：戦場の数（1〜5。古い依頼は1）と、戦場の名前 */
  stages?: number; stageNames?: string[];
}

export interface Mail {
  id: string; year: number; month: number; from: string; title: string; body: string; read: boolean; studentId?: string;
  /** 15夜目：大事な知らせ（急報・宿敵・卒業生の大事など）。学校のタブの赤い数字は、これの未読だけ */
  important?: boolean;
  /** 15夜目：まとめた書状（「今月の誕生日 3人」）の中身。1人ずつの差出人と文 */
  parts?: { studentId?: string; from: string; body: string }[];
}

export interface NewsPaper {
  id: string; year: number; month: number; headline: string; body: string[]; alumni: { id: string; text: string }[]; tension: number;
  /** 8夜目：前期号（9月の終わり）・後期号（3月）・号外（大事件の月、1面だけ）。古い新聞は undefined */
  kind?: 'first' | 'second' | 'extra';
  /** 一面：見出し（2行目は sub）・記事・挿絵の差し込み口の名前（public/art） */
  front?: { head: string; sub?: string; text: string; art?: string };
  /** 各組織の移り変わり（昇進・討死・争い・二つ名・抜擢・引退）。officerId で組織図へ */
  orgs?: { tag: string; text: string; name?: string; officerId?: string }[];
  /** 政治の動き：三国の方針と出来事 */
  politics?: { country: string; stance: string; text: string }[];
  /** 緊張度と和平のゲージ（0〜100）と、その言葉 */
  gauges?: { tension: number; tensionLabel: string; peace: number; peaceLabel: string };
  /** 学校の話題 */
  school?: string[];
  /** 次号の案内 */
  next?: string;
}
/** 次の号に載せるための控え（前の号を出したときの世の中のようす）。8夜目 */
export interface NewsDesk {
  year: number; month: number;
  power: Record<CountryId, number>;
  relations: { ke: number; ea: number; ak: number };
  tension: number; reputation: number;
  officers: Record<string, { st: string; rk: number; ep: string }>;
}

export interface ChronicleEntry { year: number; month: number; text: string; kind: 'school' | 'world' | 'student' }

export interface Photo { cohort: number; year: number; ids: string[]; empty: string[] }

/** 因縁の敵将 */
export interface Nemesis {
  id: string; name: string; personality: string; face: FaceParts; classId: string; level: number;
  kind: 'army' | 'bandit' | 'monster'; country: CountryId | null;
  meets: { year: number; month: number; title: string; result: 'win' | 'lose' | 'fled' | 'fell' }[];
  status: 'active' | 'defeated';
}

/** 敵将（6夜目：名簿・記憶・因縁）。5夜目の因縁の敵将（Nemesis）は、読み込むときにこの形に変換する */
export interface OfficerMeet {
  year: number; month: number; title: string;
  result: 'win' | 'lose' | 'fled' | 'fell' | 'spared' | 'persuaded' | 'yielded';
  /** 直接ぶつかった生徒 */
  foes?: string[];
  /** 記憶に残った出来事（口上で触れる） */
  note?: string;
}
export interface EnemyOfficer {
  id: string;
  given: string;
  family: string;
  /** 二つ名（「ハンナ殺しの」など） */
  epithet?: string;
  faction: 'kingdom' | 'empire' | 'alliance' | 'bandit' | 'monster';
  kind: 'army' | 'bandit' | 'monster';
  country: CountryId | null;
  /** 階級：0=将軍・頭目 1=幹部 2=隊長 */
  rank: number;
  gender: Gender;
  age: number;
  personality: string;
  face: FaceParts;
  /** public/enemies/ の顔画像（卒業生のときは生徒の顔を使うので null） */
  faceImage: string | null;
  classId: string;
  level: number;
  /** 逃げて傷を負った回数（顔に重ねる傷跡・包帯・眼帯） */
  scars: number;
  traits: string[];
  knownTraits: string[];
  meets: OfficerMeet[];
  status: 'active' | 'dead' | 'retired' | 'defeated';
  /** 執着している生徒（負けた相手） */
  grudge?: string | null;
  /** 倒した生徒 */
  victims: { id: string; name: string; year: number; dead: boolean }[];
  /** 卒業生が敵将になったとき、その生徒のid */
  alumniId?: string;
  /** 名簿に入った年 */
  joined: number;
  /** 去った年・理由（年鑑用） */
  endYear?: number; endNote?: string;
  /** 魔物の頭（名簿の外） */
  title?: string;
  /** 組織図の上の人（9夜目：隊長→幹部、幹部→将軍） */
  parent?: string;
  /** 見込みのある兵（9夜目：戦いで目立った一般兵。隊長の席が空くと抜擢される） */
  prospect?: boolean;
  /** 見込みのある兵になったわけ（「イヴを重傷にした」など）と、抜擢された年 */
  deed?: string; raisedYear?: number;
  /** 見込みのある兵が使っていた武器の種類（二つ名に使う） */
  raiseWeapon?: string;
  /** 権力争い中（9夜目：組織図の⚔） */
  contest?: number;
  /** 19夜目：戦い方（弱点・効かない種類＝前に割られて覚えた種類・こちらに分かっている弱点）・自分の戦場 */
  weak?: import('../data/tactics').AtkType[]; resist?: import('../data/tactics').AtkType[]; knownWeak?: import('../data/tactics').AtkType[]; field?: string;
  /** 19夜目：覚えていること（負けた・傷つけられた相手、恩、屈辱、奪われた大切な人） */
  memory?: OfficerMemory;
  /** 19夜目：体に残った傷 */
  wounds?: { text: string; year: number; by?: string }[];
  /** 19夜目：心の変わり方（慎重になる・狂う・丸くなる・落ちぶれる） */
  heart?: 'steady' | 'careful' | 'mad' | 'mellow' | 'fallen';
  /** 19夜目：蘇った回数と理由（一度蘇った者は、次に討てば本当に死ぬ） */
  revived?: number; reviveNote?: string;
  /** 20夜目：禁呪で封じられた（二度と蘇らない） */
  noRevive?: boolean;
  /** 20夜目：学校の味方になった（恩返し・国に裏切られた） */
  allied?: { year: number; why: 'debt' | 'betrayed' | 'heart' };
  /** 20夜目：密偵が調べたこと（弱点・性格・次の動き）と、捕らわれた教え子 */
  spied?: { year: number; month: number; weak?: string; trait?: string; plan?: string }[];
  /** 19夜目：呪いで蘇った（光に弱い・闇の者） */
  cursed?: boolean;
  /** 19夜目：分かっていること（0＝顔と名前だけ … 4＝恨みの中身まで） */
  intel?: number;
  /** 19夜目：前に会ったときの札（再会で今の札と並べる） */
  lastCard?: OfficerCard;
  /** 19夜目：死んだと思われている（とどめを刺したが、蘇るかもしれない） */
  presumed?: 'dead' | 'fled' | null;
  /** 19夜目：二つ名のもとになった出来事 */
  epithetWhy?: string;
  /** 23夜目⑤'：二つ名が変わった年・そのときの出来事の大きさ・変わった数 */
  epithetYear?: number; epithetLevel?: number; epithetCount?: number; epithetNews?: number;
  epithetLog?: { year: number; level: number; word: string }[];
  /** 19夜目：最後に会った年・月 */
  lastMet?: { year: number; month: number };
  /** 19夜目：治める領地（勢力図の地域 id） */
  holds?: string[];
  /** 19夜目：二代目（親の id） */
  heirOf?: string;
  /** 19夜目：相手ごとに言った台詞（同じ相手に二度言わない） */
  lineLog?: string[];
}
export interface OfficerMemory {
  beatenBy: string[];
  woundedBy: { id: string; text: string; year: number }[];
  debts: { id: string; text: string; year: number }[];
  shame: { text: string; year: number }[];
  lost: { name: string; by: string; year: number }[];
}
/** 敵将の札（ある時点の見た目） */
export interface OfficerCard { year: number; month: number; name: string; rank: string; level: number; wounds: number; heart?: string; ep?: string }
/** 組織図の印（前に見たときのようす） */
export interface OrgMark { rank: number; status: string; ep?: string; parent?: string; prospect?: boolean }
/** 生徒と敵将の因縁（宿敵）。段階：1=因縁 2=宿敵 3=生涯の宿敵 */
export interface Rivalry {
  sid: string; oid: string;
  battles: number;
  stage: number;
  /** 仇討ちの誓い（殺された・重傷にされた仲間のid） */
  vow?: string | null;
  log: { year: number; month: number; text: string }[];
  settled?: 'persuade' | 'duel' | 'kill' | 'spare' | 'ally' | null;
  settledYear?: number;
  /** 20夜目：好敵手（たがいに名を呼び合い、決着を約束した年） */
  oath?: { year: number; month: number };
  /** 21夜目②：宿敵との友情・恋（芽生えた年・きっかけ・届いた手紙の数・気持ちを確かめ合った・どちらかが討たれて場面を出した） */
  heart?: { kind: 'friend' | 'love'; year: number; why: 'meet' | 'debt' | 'oath'; letters: number; confessed?: boolean; mourned?: boolean };
}

/** 手応えの演出（ゲージが伸びて「ランクアップ！」）。6夜目 */
export interface RankUpItem { icon: string; title: string; from: string; to: string; p0: number; p1: number; studentId?: string; note?: string }

export type EndingKind = 'peace' | 'unify' | 'ceasefire' | 'neutral';

/** 画面に出す「処理待ち」 */
export type Pending =
  | { type: 'weekSummary'; lines: string[]; talks: TalkLog[]; growth?: GrowthEntry[] }
  /** 授業の結果（7夜目）。others＝顔が出ていない子の人数 */
  | { type: 'lessonResult'; lesson: string; day: number; faces: string[]; tags: [string, string][]; rows: LessonRow[]; events: LessonEvent[]; growth: GrowthEntry[]; lines: string[]; talks: TalkLog[]; others: number; /** 先生の経験ポイント（8夜目） */ xp?: number }
  | { type: 'questBoard' }
  | ({ type: 'battleResult' } & BattleReport)
  /** 月末に2部隊以上を出したときの、まとめた結果（9夜目） */
  | { type: 'sortieResult'; reports: BattleReport[] }
  /** 新しい策を覚えた（9夜目：発見の演出） */
  | { type: 'newStrat'; id: string; by?: string; why: string }
  | { type: 'event'; title: string; lines: string[] }
  /** 14夜目：案内役（管理人）の短い説明。はじめて出たときだけ */
  | { type: 'guide'; key: string; title: string; lines: string[] }
  /** 14夜目：伝説の武器が手に入った（大きな演出） */
  | { type: 'legend'; id: string; uid: string }
  /** 14夜目：1年の振り返り（年度末、卒業式のあと） */
  | { type: 'yearReview'; year: number }
  | { type: 'entrance' }
  | { type: 'career' }
  | { type: 'graduation'; cohort: number; lines: { id: string; text: string }[] }
  | { type: 'newspaper'; id: string }
  /** 傘下への誘い（8夜目：受けるか断るかを選ぶ） */
  | { type: 'vassalOffer'; country: CountryId }
  | { type: 'teacherHire' }
  | { type: 'talk'; talk: TalkLog }
  | { type: 'retire'; forced: boolean }
  | { type: 'successor' }
  | { type: 'scene'; title: string; lines: SceneLine[]; after?: 'ending' }
  | { type: 'ending'; kind: EndingKind; country?: CountryId }
  /** 手応えの演出（教官の腕前・施設・評判・卒業生の昇進など） */
  | { type: 'rankup'; items: RankUpItem[] }
  /** 発見の演出（隠れた才能のヒント1→ヒント2→判明、意外な一面） */
  | { type: 'discovery'; studentId: string; stage: 1 | 2 | 3 | 4; title: string; text: string; name?: string }
  /** 19夜目：新しい技を覚えた */
  | { type: 'art'; studentId: string; ids: string[] }
  /** 19夜目：月末の戦いを、自分で遊ぶか、おまかせにするか */
  | { type: 'sortieChoice' }
  /** 19夜目：宿敵との再会（昔の札と今の札） */
  | { type: 'nemesis'; officerId: string; studentIds: string[]; kind: 'reunion' | 'rumor' | 'first' | 'revived' | 'letter' | 'ally' | 'rival' | 'spy' | 'heart'; text: string[] }
  /** 19夜目：新入生を選ぶ（10人ほどの希望者から6〜8人） */
  | { type: 'admission' }
  /** 才能開花（10夜目：大きな演出） */
  | { type: 'bloom'; studentId: string; skill?: SkillId; gold?: boolean };

/** 戦闘の結果（1つの戦い）。9夜目：部隊の番号・部隊長・生徒ごとの評価・策の講評 */
export interface BattleReport {
  lines: string[]; grades: { id: string; grade: string; note: string }[]; win: boolean; growth?: GrowthEntry[]; mvp?: string; review?: string[]; title?: string; findings?: BattleFinding[]; officerId?: string;
  /** 9夜目 */
  squad?: number; captain?: string; evals?: StudentEval[]; stratReview?: string[]; fallen?: { id: string; outcome: 'dead' | 'injured' }[];
  /** 10夜目：教官が同行しなかった部隊。部隊長の判断と、大事な出来事の短い場面 */
  away?: boolean; moments?: { by: string; text: string }[];
  /** 19夜目：名場面（おまかせでも残す）・宿敵戦だったか */
  scenes?: { turn: number; text: string; big?: boolean }[]; nemesisId?: string; auto?: boolean;
  /** 10夜目：この戦いで手に入れた武器（戦利品） */
  loot?: LootItem[];
}
/** 戦利品（10夜目） */
export interface LootItem { uid?: string; weaponId: string; from: string; kind: 'drop' | 'named' | 'reward' | 'gift' | 'legend'; affix?: string[]; legend?: string; named?: ArmoryItem['named'] }
/** 戦闘後の生徒ごとの評価（9夜目） */
export interface StudentEval {
  id: string; grade: string;
  /** 称号（StratBadge の id）1〜2個 */
  badges: string[];
  /** 名場面（戦いの記録から1行） */
  scene: string | null;
  /** 本人のひとこと */
  say: string;
  /** 戦績 */
  rec: { kills: number; dealt: number; taken: number; healed: number; hits: number; swings: number };
  /** 前の戦いからの伸び（文） */
  growth: string[];
  /** 宿敵・誓いの進み具合 */
  rivals: string[];
  outcome?: 'dead' | 'injured';
}
/** 月末の出撃（9夜目：最大3部隊）。部隊の順番に1つずつ戦う */
export interface SquadPlan {
  questId: string;
  deploy: Deploy[];
  /** 自分で遊ぶ（false＝おまかせ） */
  manual?: boolean;
  /** 教官が同行しない（10夜目：2つ目・3つ目の部隊ははじめ同行しない。false で同行する） */
  away?: boolean;
}
export interface Sortie { squads: SquadPlan[]; idx: number; reports: BattleReport[]; pendFrom: number }

/** 戦闘で伸びた・分かったこと（結果の画面にまとめて出す） */
export interface BattleFinding { id?: string; icon: string; text: string }

/** 成長の記録（ゲージの演出用）。前と後の値だけを持つ */
export interface GrowthEntry {
  id: string;
  exp0: number; lv0: number; exp1: number; lv1: number;
  ups: { level: number; gains: Partial<Stats> }[];
  stats0: Stats;
  skills: { k: SkillId; p0: number; p1: number }[];
  spells: string[];
  why?: string;
  /** 鍛錬ゲージで+1になった能力（7夜目） */
  train?: StatId[];
}

/** 会話の1行。by は生徒のid、'teacher'（先生）、'narr'（地の文） */
export interface TalkLineLog { by: string; text: string }
export interface TalkChoiceOption { label: string; lines: TalkLineLog[]; effect: { trust?: number; motivation?: number; fatigue?: number } }
export interface TalkLog {
  id?: string;
  a: string; b: string; rank: string; title: string; lines: TalkLineLog[];
  /** support＝支援会話、interview＝面談、special＝信頼が深まったときの特別な面談 */
  kind?: 'support' | 'interview' | 'special';
  /** 先生の返事を選ぶ（面談の一部） */
  choice?: { prompt: string; options: TalkChoiceOption[] };
  chosen?: number;
  year?: number; month?: number;
  /** 10夜目：もとの会話の id と、くり返してよい会話か（出来事のあと・引き止め） */
  def?: string; again?: boolean;
}

export interface WeekPlan {
  /** 個人指導の枠：生徒id と 内容 */
  tutoring: { studentId: string; kind: 'skill' | 'talk' | 'consult'; skill?: SkillId }[];
  weekend: WeekendAction[];
}
export type WeekendAction =
  | { kind: 'rest' }
  | { kind: 'tea'; ids: string[] }
  | { kind: 'spar'; ids: [string, string]; skill: SkillId }
  | { kind: 'dinner'; grade: number };

export interface Settings {
  /** 18夜目：技の進化。'pick'＝自分で選ぶ（ふつう）、'auto'＝おまかせ（その子の性格に合う方を自動で選び、結果だけ見せる） */
  evoMode?: 'pick' | 'auto';
  difficulty: Difficulty;
  mods: DifficultyMods;
  portrait: 'face' | 'dot';
  cutin: 'all' | 'important' | 'off';
  enemySpeed: 1 | 2 | 3;
  /** 演出の速さ（HPゲージ・レベルアップ・会話の文字送りなど） */
  animSpeed: 1 | 2 | 3;
  /** 週が進むときの日めくりの演出 */
  flip: boolean;
  /** 名簿の表示：カード／簡易（1行） */
  rosterView: 'card' | 'compact';
  /** 戦闘を自分で指揮する（オフなら自動の戦闘。5夜目） */
  manualBattle: boolean;
  /** 個人ページで最後に開いたタブ（9夜目） */
  detailTab?: 'stats' | 'skills' | 'person' | 'bonds' | 'record';
  /** 戦いの記録の進め方（8夜目：はじめは「タップで進む」） */
  battleLog?: 'tap' | 'normal' | 'fast';
  /** 戦闘の演出（9夜目）：派手／ふつう／控えめ */
  battleFx?: 'big' | 'normal' | 'low';
  /** 戦の描写（11夜目）：ふつう／濃い（はじめ）／凄惨（一度だけ確かめる） */
  battleProse?: 'normal' | 'dense' | 'brutal';
  proseAsked?: boolean;
  rewind: boolean;
  guide: boolean;
  sound: boolean;
  volume: number;
  /** 19夜目：生徒が死なない（大けがと傷跡は残る） */
  noDeath?: boolean;
  /** 19夜目：攻撃のたびの1対1の場面（full＝ふつう・short＝短く・off＝切る） */
  duel?: 'full' | 'short' | 'off';
  /** 22夜目⑦：台詞とカットインの進め方（tap＝タップするまで止まる・はじめ／auto＝自動で進む）・敵の番の速さ */
  sayMode?: 'tap' | 'auto';
  foeSpeed?: 'normal' | 'fast';
  /** 19夜目：効果音 */
  sfx?: boolean;
}

export interface Applicant { student: Student }

/** 伝説の武器の行方（14夜目）。none＝行方知れず、officer＝敵将が持つ、school＝武器庫、alumni＝卒業生が持っていった */
export interface LegendState { holder: 'none' | 'officer' | 'school' | 'alumni'; officerId?: string; studentId?: string; uid?: string; log: { year: number; text: string }[] }

/** 1年の振り返り（14夜目）。年鑑に残る。rebuilt＝古いセーブで年表から作った（数字の一部がない） */
export interface YearReview {
  year: number; title: string;
  nums: { enrolled: number; graduated: number; blooms: number; deaths: number; newClass: number; battles?: number; won?: number; lost?: number };
  scenes: { text: string; by?: string; kind: string }[];
  grew?: { id: string; lv0: number; lv1: number };
  mvp?: { id: string; honors: number };
  grads: string[]; dead: { id: string; note: string }[]; alumniDead: string[];
  world: string[]; closing: string; rebuilt?: boolean;
}
/** 年のはじめの控え（振り返りの数字の比べに使う） */
export interface YearMark { year: number; won: number; lost: number; deaths: number; levels: Record<string, number>; honors: Record<string, number>; classes: number }

/** 最初の1時間の案内（14夜目）。tour＝机の案内の進み、seen＝見た説明、off＝案内を飛ばした */
export interface TutorialState { tour: number; seen: string[]; off?: boolean; talked?: boolean; /** 設定の「案内を見なおす」を押した（机の案内はいつでも） */ replay?: boolean }

export interface GameState {
  version: number;
  slot: number;
  rng: number;
  createdAt: number;
  lastExport: number;
  year: number;   // 1..
  month: number;  // 0=4月 ... 11=3月
  week: number;   // 1..4
  /** 曜日 1..5（月〜金。7夜目） */
  day?: number;
  absWeek: number;
  /** 今日の授業カード（7夜目） */
  today?: LessonDay | null;
  /** 19夜目：先週選んだ札（「先週と同じ」） */
  lastPick?: { lesson: string; social: string } | null;
  /** 古いセーブの重点科目・週末の予定（最初の日のカードに出す。7夜目） */
  carry?: { skills: SkillId[]; social: string[] } | null;
  money: number;
  reputation: number;
  facilities: Record<string, number>;
  teachers: Teacher[];
  teacherCandidates: Teacher[];
  armory: ArmoryItem[];
  items: { vulnerary: number; elixir: number };
  instructor: Instructor;
  students: Record<string, Student>;
  supports: Record<string, Support>;
  /** 会話の記録（読み返し用）。id→会話。生徒ごとの id の一覧は Student.archive */
  archive: Record<string, TalkLog>;
  focus: Record<number, [SkillId, SkillId]>; // 学年→重点科目
  plan: WeekPlan;
  consults: string[];      // 相談に来ている生徒
  pinned: string[];
  /** 今月の主役。15夜目：月のはじめに先生が自動で声をかける（res はそのときの様子） */
  spotlight: { id: string; text: string; done: boolean; res?: string }[];
  notices: { id: string; text: string; studentId?: string }[];
  pending: Pending[];
  quests: Quest[];
  battle: TBattle | null;
  /** 23夜目⑦：進軍の途中（戦場と戦場のあいだ・終わった戦場） */
  march?: import('./march').MarchState | null;
  applicants: Student[];
  world: WorldState;
  mail: Mail[];
  news: NewsPaper[];
  /** 新聞の控え（8夜目） */
  newsDesk?: NewsDesk;
  chronicle: ChronicleEntry[];
  photos: Photo[];
  cohortCount: number;
  heirs: { a: string; b: string; year: number }[];
  /** 歴代の教官（今の教官は含まない） */
  pastInstructors?: PastInstructor[];
  /** 副教官（学年の担任） */
  vice?: ViceInstructor[];
  /** 「ふつう」「名門」スタート：廃校の期限なし */
  noDeadline?: boolean;
  /** 到達したエンディング */
  endings?: { kind: EndingKind; year: number; country?: CountryId; /** 何度目の戦争を終わらせたか（7夜目） */ n?: number }[];
  /** 後継の打診を断った卒業生（その年度の間） */
  declinedSuccessors?: string[];
  /** 因縁の敵将（逃した敵将。5夜目） */
  nemeses?: Nemesis[];
  /** 兵種図鑑：生徒か卒業生が一度でもなった兵種（8夜目） */
  classSeen?: string[];
  /** 敵将の名簿（6夜目。因縁の敵将もここに入る） */
  officers?: EnemyOfficer[];
  /** 生徒と敵将の因縁（キーは 生徒id|敵将id） */
  rivalries?: Record<string, Rivalry>;
  /** 月末の出撃（9夜目：最大3部隊） */
  sortie?: Sortie | null;
  /** 学校で使える策（9夜目。data/stratagems.ts の id） */
  strats?: string[];
  /** 14夜目：伝説の武器の行方（id → いまの持ち主）と、武器の図鑑（手に入れたことのある武器・伝説の武器の id） */
  legends?: Record<string, LegendState>;
  weaponSeen?: string[];
  /** 14夜目：年ごとの振り返りと、年のはじめの控え */
  reviews?: YearReview[];
  yearMark?: YearMark;
  /** 14夜目：最初の1時間の案内（新しく始めたときだけ。古いセーブにはない） */
  tutorial?: TutorialState;
  /** 17夜目：札の戦いの案内。pending＝次の札の戦いで出す（最初の依頼なら案内つき、ほかは「戦い方が新しくなりました」）、done＝もう出した */
  cardGuide?: 'pending' | 'done';
  /** 18夜目：札の戦いの案内（お知らせ）に一度でも答えた・案内を見た */
  cardGuideSeen?: boolean;
  /** 18夜目：連携技（支援B以上の2人。組の鍵 → 記録。戦死で失われたものも残す） */
  combos?: unknown;
  /** 勢力図を前に見たときのようす（13夜目） */
  mapSeen?: { at: number; o: Record<string, string> };
  /** 組織図を前に見たときのようす（9夜目：陣営→敵将id→階級・状態・二つ名・上の人） */
  orgSeen?: Record<string, { at: number; o: Record<string, OrgMark> }>;
  /** 自動の戦闘で直近に使った文・出来事（同じ並びを避ける） */
  autoMemory?: { lines: string[]; events: string[]; n?: number };
  /** 19夜目：最初の宿敵（着任の道中の敵将）と、着任の道中の戦いをまだ始めていない印 */
  openingOfficer?: string; openingPending?: boolean;
  /** 21夜目②：最後に宿敵との縁（友情・恋）が芽生えた年 */
  heartYear?: number;
  /** 19夜目：次の月末に結びつける宿敵（蘇った・敵として戻った）・さらわれた先代 */
  nextNemesis?: string;
  /** 20夜目④：密偵を送った月（絶対月）・捕らわれた密偵（救い出す戦いになる） */
  spyMonth?: number; spyCaptive?: { sid: string; oid: string };
  capturedTeacher?: { name: string; by: string; year: number; returnYear: number; done?: boolean };
  /** 19夜目：古い版（この版の番号）から変換したセーブ（タイトルで「新しく始めるのがおすすめ」） */
  oldSave?: number;
  /** 19夜目：記録枠（自動セーブ＝0、手動＝1〜3）。slot と同じ */
  nextId: number;
  settings: Settings;
  guideStep: number;
  stats: { battlesWon: number; battlesLost: number; deaths: number; graduates: number; /** 20夜目：送った密偵の数 */ spies?: number };
  gameOver: boolean;
  log: string[];
}
