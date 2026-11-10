// 19夜目：新しい戦いの型（DOMに依存しない。セーブに入る）
import type { AtkType } from '../../data/tactics';

/** 出撃する子（武器庫の武器を持たせる） */
export interface Deploy { studentId: string; armoryUid?: string | null; item?: 'vulnerary' | 'elixir' | null }

export interface TTech { id: string; left: number }

export interface TUnit {
  uid: string;
  side: 'me' | 'foe';
  name: string;
  /** 生徒・卒業生のid（顔もここから） */
  studentId?: string;
  /** 敵将のid（名簿） */
  officerId?: string;
  /** 先生 */
  teacher?: boolean;
  /** 持たせた武器庫の武器 */
  armoryUid?: string | null;
  /** 敵の顔（public/enemies/ のファイル名） */
  faceImage?: string | null;
  /** 雑兵のしるし（槍・斧など） */
  mark?: string;
  classId: string;
  x: number; y: number;
  hp: number; max: number;
  str: number; mag: number; skl: number; spd: number; def: number;
  /** 22夜目：魔防（炎・雷・氷・光・闇を受けるとき）。古い戦いの記録にはない */
  res?: number;
  mov: number; rmin: number; rmax: number;
  /** ふつうの攻撃の種類と、魔力で戦うか */
  type: AtkType; magic: boolean;
  /** ふつうの攻撃の威力（武器） */
  might: number;
  /** 19夜目：兵種の特技・ふつうの攻撃で選べる種類・同時に当てる2つ目の種類 */
  traits?: string[]; atks?: import('../../data/tactics').AtkType[]; dual?: import('../../data/tactics').AtkType;
  /** 蘇った者（裁きの光）・呪縛で守りが下がった */
  revived?: boolean; cursed?: boolean;
  /** 仲間をかばった回数 */
  guarded?: number;
  /** 討たれたが、深手を負って逃げのびた */
  escapedWounded?: boolean;
  techs: TTech[];
  /** 盾（敵だけ） */
  sh: number; shMax: number;
  weak: AtkType[];
  /** 効かない種類（前に覚えられた弱点など） */
  resist: AtkType[];
  /** こちらに分かっている弱点 */
  known: AtkType[];
  /** ブレイク中（のこりの敵の番の数） */
  broken: number;
  acted: boolean;
  alive: boolean;
  /** 倒れたときのようす（dead=戦死・injured=重傷・out=気を失った・fled=逃げた） */
  down?: 'dead' | 'injured' | 'out' | 'fled';
  /** 敵将 */
  boss?: boolean;
  /** 宿敵（名前のある将） */
  nemesis?: boolean;
  /** 執念で一度だけ持ちこたえた */
  clung?: boolean;
  /** 逃げようとしている／北の端に着いた */
  fleeing?: boolean; edge?: boolean;
  /** 次の敵の番に大技 */
  rage?: boolean;
  /** 次に狙う相手（前もって見せる） */
  aim?: { t: string; dmg: number; lethal: boolean; approach?: boolean; rage?: boolean } | { flee: true } | null;
  /** 真っ先に狙う子（前に自分をやった子） */
  grudge?: string;
  /** 心と教訓から来る補正 */
  bonus?: { fight?: number; dmg?: number; prot?: number; vsOfficer?: number; vsClass?: Record<string, number>; protFrom?: Record<string, number>; note?: string[] };
  /** 傷薬 */
  potion?: number;
  /** 成績 */
  kills: number; dealt: number; taken: number; weakHits: number; breaks: number;
  /** この戦いでブレイクを割られた（宿敵の記憶） */
  brokenBy?: string[];
  /** 割られた弱点 */
  weakHitBy?: AtkType[];
  /** 最後に攻撃してきた相手の uid（倒れたとき：倒した相手） */
  lastHitBy?: string;
  /** 教え子ごとに与えられた傷（生徒id→ダメージ） */
  hitBy?: Record<string, number>;
  /** 受けた攻撃の種類（最後の一撃） */
  lastType?: import('../../data/tactics').AtkType;
  /** 20夜目：この番に動いた（不動）・見切りを使った（戦い／番）・戦神で踏みとどまっている（この番の終わりに倒れる） */
  moved?: boolean; mikiriUsed?: boolean; mikiriTurn?: number; lastStand?: number; lastStandUsed?: boolean;
  /** 20夜目：死霊術士に起こされた敵兵（味方として動く。学校には残らない） */
  raised?: boolean;
  /** 20夜目④：味方になった宿敵（援軍。学校には残らない） */
  helper?: boolean;
  /** 20夜目：前に逃げのびたことのある宿敵（狩りの王の条件） */
  fledBefore?: boolean;
  /** 20夜目：最上級の条件になる出来事（この戦いでの数）。戦いのあと Student.deeds に足す */
  deeds?: Record<string, number>;
  /** 20夜目：炎を当てた（砦を焼く） */
  usedFire?: boolean;
  /** 21夜目：2手先の狙い（千里眼・天眼のいる戦いだけ。薄い色で見せる） */
  aim2?: { t: string; dmg: number } | null;
}

export type Objective = 'boss' | 'rout' | 'defend' | 'rescue' | 'escape';

/** 画面の演出（1回の行動ごとに出る） */
export type TFx =
  | { k: 'move'; uid: string; x: number; y: number }
  | { k: 'hit'; a: string; d: string; dmg: number; weak: boolean; resisted: boolean; shield: boolean; brk: boolean; kill: boolean; tech?: string; broken: boolean }
  | { k: 'heal'; a: string; d: string; amt: number; tech?: string }
  | { k: 'say'; by: string; text: string; tone?: 'nemesis' | 'me' | 'narr' }
  | { k: 'cutin'; by: string; title: string; sub: string }
  | { k: 'reveal'; d: string; type: AtkType }
  | { k: 'flee'; uid: string }
  | { k: 'phase'; side: 'me' | 'foe'; turn: number };

export interface TLog { turn: number; text: string; big?: boolean }

export interface TBattle {
  v: 19;
  questId: string;
  title: string;
  field: string;
  w: number; h: number;
  forest: string[]; rock: string[];
  units: TUnit[];
  turn: number;
  phase: 'player' | 'enemy' | 'done';
  result: 'win' | 'lose' | null;
  objective: Objective;
  /** 守り抜く：このターンを終えれば勝ち。逃げきる：この行に着けば抜けられる */
  holdTurns?: number;
  exitRow?: number;
  /** 救い出す：捕らわれた人のマス */
  captive?: { x: number; y: number; name: string; freed: boolean };
  teacherUid: string | null;
  command: number; insight: number;
  /** 「ひとつ戻す」：最後の行動の前の状態 */
  undo: string | null;
  log: TLog[];
  /** 名場面（おまかせでも残す） */
  scenes: TLog[];
  /** 最後の行動の演出 */
  fx: TFx[];
  /** おまかせで進めた */
  auto?: boolean;
  /** 最初の戦い（説明つき） */
  tutorial?: boolean;
  /** 宿敵戦（宿敵の officerId） */
  nemesisId?: string;
  /** 宿敵などのせりふ（鍵→文。uid:鍵 か 鍵）。戦いを作るときに決める */
  lines?: Record<string, string>;
  /** 宿敵が言ったせりふの鍵（同じ戦いで同じことを言わない） */
  said: string[];
  /** 敵の数（はじめ） */
  foes0: number;
  /** 本物の戦い（演習でない） */
  real: boolean;
  /** 出撃しない子の支え（薬・罠・調べもの） */
  support?: { kind: 'potion' | 'trap' | 'study'; by: string; text: string }[];
  /** 生徒のid→心の揺れ（暴走・すくむ） */
  mood?: Record<string, string>;
  /** 20夜目：結界の光の壁（敵は通れない）と、のこりのターン */
  walls?: string[]; wallTurns?: number;
  /** 20夜目：燃えているマス（のこりの敵の番の数） */
  burn?: Record<string, number>;
  /** 20夜目：戦いで一度だけの特技を使った印（奇跡・劫火・起こす など） */
  once?: string[];
  /** 20夜目：禁呪の番人のいる戦で宿敵を討った（二度と蘇らない） */
  forbidden?: boolean;
  /** 20夜目：先生の兵種の段階（0=教官〜3=名将） */
  teacherRank?: number;
  /** 21夜目：宝箱（盗賊の系統だけ開けられる。開けるまでは通れない） */
  chests?: { x: number; y: number; kind: 'potion' | 'weapon'; weaponId?: string; opened?: boolean }[];
  /** 21夜目：扉（盗賊の系統だけ開けられる。閉じているあいだは通れない） */
  doors?: string[];
  /** 21夜目：砦の木の門（火矢で焼ける。焼けるまでは通れない） */
  gate?: string | null;
  /** 21夜目：火矢で燃えている森（味方も敵も、通ると傷を負う） */
  wild?: string[];
  /** 21夜目：宝箱・扉の奥で見つけたもの（戦いのあと学校に） */
  found?: { weaponId?: string; money?: number; by: string }[];
  /** 23夜目③：斥候の罠（置いたマス）と、置ける残りの数（uid→数）。踏んだ敵は傷を負って止まる */
  traps?: { x: number; y: number; by: string }[]; trapLeft?: Record<string, number>;
  /** 23夜目⑦：進軍の何番目の戦場か（0から）・戦場の数・名前。最後の戦場でない敵将は、倒れても次の戦場へ退く */
  march?: { idx: number; total: number; names: string[]; cleared?: number };
  /** 23夜目⑦：近道・回り道（次の戦場の作り方） */
  route?: 'short' | 'detour';
  /** 23夜目②：負けそうになり、おまかせが兵をまとめて退いた */
  retreated?: boolean;
  /** 21夜目：2手先を読むための、試しの計算中（保存しない） */
  peek?: boolean;
}
