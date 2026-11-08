import type { MoveType, Stats, WeaponType } from '../types';

export type Terrain = 'plain' | 'forest' | 'mountain' | 'fort' | 'river' | 'bridge' | 'village' | 'wall' | 'road' | 'door';

export interface Unit {
  uid: string;
  side: 'player' | 'enemy' | 'ally' | 'npc';
  studentId?: string;      // 生徒・卒業生
  name: string;
  classId: string;
  level: number;
  stats: Stats;            // 兵種補正込み（戦闘用）
  maxHp: number;
  hp: number;
  x: number; y: number;
  weaponId: string | null;
  weapons: string[];       // 持っている武器（enemy用）
  armoryUid?: string;
  item: 'vulnerary' | 'elixir' | null;
  moved: boolean;
  acted: boolean;
  dead: boolean;
  boss?: boolean;
  ai?: 'charge' | 'ambush' | 'hold';
  aiActive?: boolean;
  poison: number;
  weaken: number;
  ward?: number;           // 守りの祈り：魔防+（次の自分の番まで）
  reloadTurn: number;      // 銃：このターンは撃てない
  aimed: boolean;
  abilities: string[];
  personality?: string;
  supportBonus?: unknown;
  escort?: boolean;        // 護衛対象
  captive?: boolean;       // 救出する捕虜（敵からは狙われない）
  persuadable?: boolean;   // 敵の卒業生
  expGain: number;
  kills: number;
  hits: number;
  dmgDealt: number;
  dmgTaken: number;
  usedWeapon: Record<string, number>;
  face?: unknown;
  /** 自動の戦闘：作戦・役割・やる気などによる補正 */
  mod?: { hit?: number; avo?: number; dmg?: number; def?: number; crit?: number };
  /** この敵を攻撃したときの補正（敵将の弱点・強み。6夜目） */
  foeMods?: { types?: string[]; moveTypes?: string[]; hit?: number; dmg?: number }[];
  /** この敵将が狙う相手（味方のuid。6夜目：執着） */
  grudge?: string;
  /** 陣形（9夜目）：前列は狙われやすく、後列は守られる */
  row?: 'front' | 'back';
}

export interface BattleLogEntry { text: string; kind?: 'crit' | 'kill' | 'miss' | 'hit' | 'heal' | 'info' | 'level' }

export interface Popup { x: number; y: number; text: string; kind: string; id: number }

export interface BattleState {
  rng: number;
  questId: string;
  title: string;
  real: boolean;
  objective: 'rout' | 'boss' | 'defend' | 'escort' | 'seize' | 'rescue' | 'escape';
  defendTurns: number;
  maxTurns: number;
  weather: 'clear' | 'rain' | 'fog';
  width: number;
  height: number;
  tiles: Terrain[];         // y*width+x
  goal: { x: number; y: number } | null;   // 護衛の目的地・制圧地点
  chests: { x: number; y: number; weaponId: string; opened: boolean }[];
  visited: number[];        // 訪問済みの村タイル
  units: Unit[];
  turn: number;
  phase: 'deploy' | 'player' | 'enemy' | 'done';
  result: 'win' | 'lose' | null;
  commandUsed: { again: boolean; retreat: boolean; turn: number };
  rewindsLeft: number;
  snapshots: string[];      // ターン開始時の状態（巻き戻し用）
  log: BattleLogEntry[];
  retreated: string[];
  fallen: { studentId: string; outcome: 'dead' | 'injured' | 'out'; by?: string }[];
  /** 敵uid→その敵が攻撃を当てた生徒id（6夜目：敵将とぶつかった子を数える） */
  struck?: Record<string, string[]>;
  /** 敵将（6夜目。手動の戦闘でも使う。自動の戦闘の古いセーブは auto.leader） */
  leader?: import('./auto').LeaderInfo | null;
  reinforcementsAt: number; // 援軍の卒業生が現れるターン
  reinforcement: string | null; // 援軍として現れる卒業生のid
  enemyAlumni: string | null;
  popupSeq: number;
  adjacencyPairs: Record<string, number>; // 隣接して戦った組
  moveType?: MoveType;
  lastAction: LastAction | null;
  hitBy: Record<string, string[]>; // 敵uid→攻撃した味方uid
  visitedChestLog?: string[];
  /** 救出：捕虜を助けた／突破：脱出した人数と必要な人数 */
  rescued?: boolean;
  escaped?: number;
  escapeNeed?: number;
  /** 自動の戦闘（5夜目）。ないときは手動の戦闘 */
  auto?: import('./auto').AutoState;
  /** 自動の戦闘：戦いの出来事の記録（場面の文に使う） */
  feed?: FeedEntry[];
  /** 味方が優先して狙う敵（敵将） */
  focus?: string;
  /** 戦いの記録（7夜目。自動の戦闘だけ。場面を作るときに場面へ移す） */
  blog?: BLog[];
  /** 攻撃のやりとりの番号 */
  xseq?: number;
}

/** 戦いの記録（7夜目）：1回の攻撃・回復・ターンの区切り。x＝同じ攻撃のやりとりの番号 */
export type BLog =
  | { k: 'turn'; turn: number; side: 'player' | 'enemy' }
  | { k: 'atk'; x: number; a: string; d: string; w: string | null; dmg: number; hit: boolean; crit: boolean; tri: number; eff: boolean; role: 'atk' | 'counter' | 'follow' | 'duel'; hp0: number; hp1: number; max: number; kill: boolean }
  | { k: 'heal'; x: number; a: string; d: string; w: string | null; amt: number; hp0: number; hp1: number; max: number };

export interface FeedEntry { t: 'kill' | 'crit' | 'heal' | 'miss' | 'fallen' | 'hit'; a: string; d: string; turn: number; dmg?: number }

export interface Strike { by: string; hit: boolean; crit: boolean; dmg: number }
export interface LastAction { attacker: string; defender: string; strikes: Strike[]; killed: string[]; heal?: number; seq: number }

export interface CombatForecast {
  attacker: Unit; defender: Unit;
  atk: { dmg: number; hit: number; crit: number; count: number; triangle: number; effective: boolean; canAttack: boolean };
  def: { dmg: number; hit: number; crit: number; count: number; triangle: number; effective: boolean; canAttack: boolean };
}

export type { WeaponType };
