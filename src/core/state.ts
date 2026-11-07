// ゲームの状態（セーブされるもの）の型
import type { CountryId, Origin, House, Gender, PersonalityId, SkillId, Stats, Path } from './types';
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
}

export interface Student {
  id: string;
  given: string;
  family: string;
  gender: Gender;
  age: number;
  birthYear: number;   // 年（ゲーム内年）
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
}

export interface Support { a: string; b: string; value: number; kind: 'none' | 'friend' | 'rival' | 'love'; seen: string[]; lastRank: '' | 'C' | 'B' | 'A' }

export interface Teacher { id: string; name: string; skill: SkillId; points: number; salary: number; alumniId?: string }

export interface ArmoryItem { uid: string; weaponId: string; engraved?: string }

export interface Instructor {
  name: string;
  background: string;
  age: number;
  experience: number;
  skills: Record<SkillId, number>;
  cha: number;
  generation: number;
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
  schoolDefensePending: boolean;
  eventCooldown: Record<string, number>; // 大事件ごとの再発までの月数
  history: { year: number; tension: number; power: Record<CountryId, number> }[];
}

export interface Quest {
  id: string;
  kind: 'drill' | 'bandit' | 'monster' | 'escort' | 'defend' | 'border' | 'fort' | 'refugee' | 'exhibition' | 'schoolDefense';
  title: string;
  client: string;
  clientCountry: CountryId | null;
  enemyCountry: CountryId | null;
  objective: 'rout' | 'boss' | 'defend' | 'escort' | 'seize';
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

/** 画面に出す「処理待ち」 */
export type Pending =
  | { type: 'weekSummary'; lines: string[]; talks: TalkLog[] }
  | { type: 'questBoard' }
  | { type: 'battleResult'; lines: string[]; grades: { id: string; grade: string; note: string }[]; win: boolean }
  | { type: 'event'; title: string; lines: string[] }
  | { type: 'entrance' }
  | { type: 'career' }
  | { type: 'graduation'; cohort: number; lines: { id: string; text: string }[] }
  | { type: 'newspaper'; id: string }
  | { type: 'teacherHire' }
  | { type: 'talk'; talk: TalkLog };

export interface TalkLog { a: string; b: string; rank: string; title: string; lines: { by: string; text: string }[] }

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
  nextId: number;
  settings: Settings;
  guideStep: number;
  stats: { battlesWon: number; battlesLost: number; deaths: number; graduates: number };
  gameOver: boolean;
  log: string[];
}
