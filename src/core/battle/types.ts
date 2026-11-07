import type { MoveType, Stats, WeaponType } from '../types';

export type Terrain = 'plain' | 'forest' | 'mountain' | 'fort' | 'river' | 'bridge' | 'village' | 'wall' | 'road';

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
  persuadable?: boolean;   // 敵の卒業生
  expGain: number;
  kills: number;
  hits: number;
  dmgDealt: number;
  dmgTaken: number;
  usedWeapon: Record<string, number>;
  face?: unknown;
}

export interface BattleLogEntry { text: string; kind?: 'crit' | 'kill' | 'miss' | 'hit' | 'heal' | 'info' | 'level' }

export interface Popup { x: number; y: number; text: string; kind: string; id: number }

export interface BattleState {
  rng: number;
  questId: string;
  title: string;
  real: boolean;
  objective: 'rout' | 'boss' | 'defend' | 'escort' | 'seize';
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
  fallen: { studentId: string; outcome: 'dead' | 'injured' | 'out' }[];
  reinforcementsAt: number; // 援軍の卒業生が現れるターン
  reinforcement: string | null; // 援軍として現れる卒業生のid
  enemyAlumni: string | null;
  popupSeq: number;
  adjacencyPairs: Record<string, number>; // 隣接して戦った組
  moveType?: MoveType;
  lastAction: LastAction | null;
  hitBy: Record<string, string[]>; // 敵uid→攻撃した味方uid
  visitedChestLog?: string[];
}

export interface Strike { by: string; hit: boolean; crit: boolean; dmg: number }
export interface LastAction { attacker: string; defender: string; strikes: Strike[]; killed: string[]; heal?: number; seq: number }

export interface CombatForecast {
  attacker: Unit; defender: Unit;
  atk: { dmg: number; hit: number; crit: number; count: number; triangle: number; effective: boolean; canAttack: boolean };
  def: { dmg: number; hit: number; crit: number; count: number; triangle: number; effective: boolean; canAttack: boolean };
}

export type { WeaponType };
