// ゲームの状態（セーブされるもの）の型
import type { CountryId, Origin, House, Gender, PersonalityId, SkillId, Stats, StatId, Path, SpellSlot } from './types';
import type { Difficulty, DifficultyMods } from '../data/balance';
import type { BattleState } from './battle/types';

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
export interface LessonDay { key: number; cards: LessonCard[]; rain?: boolean }
/** 授業の結果で伸びた子の1行 */
export interface LessonRow { id: string; face: boolean; tag?: boolean; target?: boolean; skills: { k: SkillId; p0: number; p1: number }[]; train: { k: StatId; g0: number; g1: number; up: number }[] }
export interface LessonEvent { kind: string; ids: string[]; lines: TalkLineLog[] }

export interface Support { a: string; b: string; value: number; kind: 'none' | 'friend' | 'rival' | 'love'; seen: string[]; lastRank: '' | 'C' | 'B' | 'A' }

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

export interface ArmoryItem { uid: string; weaponId: string; engraved?: string }

export interface Instructor {
  name: string;
  background: string;
  age: number;
  experience: number;
  skills: Record<SkillId, number>;
  cha: number;
  generation: number;
  /** 技能の上限（ポイント）。得意科目はS、それ以外はB */
  caps?: Record<SkillId, number>;
  /** 卒業生が教官になったとき、その生徒のid */
  studentId?: string;
  /** 着任した年 */
  since?: number;
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
  /** エンディングのあと「この学校を続ける」を選んだ平和な時代 */
  era?: 'peace' | null;
  /** 次の戦争の火種（7夜目）。くすぶり0〜100、100で次の戦争 */
  seed?: { kind: EndingKind; country?: CountryId | null; since: number; due: number; smolder: number; omens: number; help: number } | null;
  /** 何度目の戦争か（1＝最初の戦争）。今の戦争が始まった年 */
  warNo?: number;
  warStart?: number;
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
  /** 偵察を出した（6夜目）。scoutFree は斥候がいて出撃の人数が減らないとき */
  scouted?: boolean; scoutFree?: boolean;
}

export interface Mail { id: string; year: number; month: number; from: string; title: string; body: string; read: boolean; studentId?: string }

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
}
/** 生徒と敵将の因縁（宿敵）。段階：1=因縁 2=宿敵 3=生涯の宿敵 */
export interface Rivalry {
  sid: string; oid: string;
  battles: number;
  stage: number;
  /** 仇討ちの誓い（殺された・重傷にされた仲間のid） */
  vow?: string | null;
  log: { year: number; month: number; text: string }[];
  settled?: 'persuade' | 'duel' | 'kill' | 'spare' | null;
  settledYear?: number;
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
  | { type: 'battleResult'; lines: string[]; grades: { id: string; grade: string; note: string }[]; win: boolean; growth?: GrowthEntry[]; mvp?: string; review?: string[]; title?: string; findings?: BattleFinding[]; officerId?: string }
  | { type: 'event'; title: string; lines: string[] }
  | { type: 'entrance' }
  | { type: 'career' }
  | { type: 'graduation'; cohort: number; lines: { id: string; text: string }[] }
  | { type: 'newspaper'; id: string }
  | { type: 'teacherHire' }
  | { type: 'talk'; talk: TalkLog }
  | { type: 'retire'; forced: boolean }
  | { type: 'successor' }
  | { type: 'scene'; title: string; lines: SceneLine[]; after?: 'ending' }
  | { type: 'ending'; kind: EndingKind; country?: CountryId }
  /** 手応えの演出（教官の腕前・施設・評判・卒業生の昇進など） */
  | { type: 'rankup'; items: RankUpItem[] }
  /** 発見の演出（隠れた才能のヒント1→ヒント2→判明、意外な一面） */
  | { type: 'discovery'; studentId: string; stage: 1 | 2 | 3 | 4; title: string; text: string; name?: string };

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
  rewind: boolean;
  guide: boolean;
  sound: boolean;
  volume: number;
}

export interface Applicant { student: Student }

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
  spotlight: { id: string; text: string; done: boolean }[];
  notices: { id: string; text: string; studentId?: string }[];
  pending: Pending[];
  quests: Quest[];
  battle: BattleState | null;
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
  /** 自動の戦闘で直近に使った文・出来事（同じ並びを避ける） */
  autoMemory?: { lines: string[]; events: string[]; n?: number };
  nextId: number;
  settings: Settings;
  guideStep: number;
  stats: { battlesWon: number; battlesLost: number; deaths: number; graduates: number };
  gameOver: boolean;
  log: string[];
}
