// ゲームの状態（セーブされるもの）の型
import type { CountryId, Origin, House, Gender, PersonalityId, SkillId, Stats, Path, SpellSlot } from './types';
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
}

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
}

export interface Mail { id: string; year: number; month: number; from: string; title: string; body: string; read: boolean; studentId?: string }

export interface NewsPaper { id: string; year: number; month: number; headline: string; body: string[]; alumni: { id: string; text: string }[]; tension: number }

export interface ChronicleEntry { year: number; month: number; text: string; kind: 'school' | 'world' | 'student' }

export interface Photo { cohort: number; year: number; ids: string[]; empty: string[] }

/** 因縁の敵将 */
export interface Nemesis {
  id: string; name: string; personality: string; face: FaceParts; classId: string; level: number;
  kind: 'army' | 'bandit' | 'monster'; country: CountryId | null;
  meets: { year: number; month: number; title: string; result: 'win' | 'lose' | 'fled' | 'fell' }[];
  status: 'active' | 'defeated';
}

export type EndingKind = 'peace' | 'unify' | 'ceasefire' | 'neutral';

/** 画面に出す「処理待ち」 */
export type Pending =
  | { type: 'weekSummary'; lines: string[]; talks: TalkLog[]; growth?: GrowthEntry[] }
  | { type: 'questBoard' }
  | { type: 'battleResult'; lines: string[]; grades: { id: string; grade: string; note: string }[]; win: boolean; growth?: GrowthEntry[]; mvp?: string; review?: string[]; title?: string }
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
  | { type: 'ending'; kind: EndingKind; country?: CountryId };

/** 成長の記録（ゲージの演出用）。前と後の値だけを持つ */
export interface GrowthEntry {
  id: string;
  exp0: number; lv0: number; exp1: number; lv1: number;
  ups: { level: number; gains: Partial<Stats> }[];
  stats0: Stats;
  skills: { k: SkillId; p0: number; p1: number }[];
  spells: string[];
  why?: string;
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
  absWeek: number;
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
  endings?: { kind: EndingKind; year: number; country?: CountryId }[];
  /** 後継の打診を断った卒業生（その年度の間） */
  declinedSuccessors?: string[];
  /** 因縁の敵将（逃した敵将。5夜目） */
  nemeses?: Nemesis[];
  /** 自動の戦闘で直近に使った文・出来事（同じ並びを避ける） */
  autoMemory?: { lines: string[]; events: string[]; n?: number };
  nextId: number;
  settings: Settings;
  guideStep: number;
  stats: { battlesWon: number; battlesLost: number; deaths: number; graduates: number };
  gameOver: boolean;
  log: string[];
}
