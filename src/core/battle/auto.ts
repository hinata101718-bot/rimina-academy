// 自動の戦闘（5夜目）：今の戦闘の計算を裏で手早く回し、その記録から場面と出来事を拾う。
import { legendOfOfficer, legendModOf } from '../rarity';
import { reunionLine } from '../senpai';
// 出撃前の作戦の方針・役割、ここぞの選択（1〜2回）、敵将の口上と因縁、結果の講評。
import { rollLoot } from '../loot';
import { officerArts } from '../arts';
import { KILL_REACT } from '../../data/aftermath_war';
import { PROSE_AFTER } from '../../data/warprose';
import { B } from '../../data/balance';
import { AUTO, TACTICS, TACTIC_OPTIONS, ROLES, LEADER_DUEL, LEADER_FLEE, BANDIT_EPITHETS, MONSTER_LEADERS, type TacticId, type RoleId, type UnitMod, type LeaderPersonality } from '../../data/autobattle';
import { OPEN_KIND, MAP_TEXT, WEATHER_TEXT, MATCHUP_TEXT, CLASH_TEXT, CLIMAX_TEXT, END_TEXT, SAY, EVENT_TEXT, LEADER_TEXT, CHOICE_TEXT, CHOICE_RESULT, RESULT_TEXT, REVIEW_TEXT } from '../../data/autobattle_text';
import { CLASSES } from '../../data/classes';
import { WEAPONS } from '../../data/weapons';
import { NAMES } from '../../data/names';
import { COUNTRY_SHORT, TRAITS } from '../../data/people';
import type { GameState, Quest, Student, FaceParts, EnemyOfficer } from '../state';
import type { BattleState, Unit, FeedEntry, BLog } from './types';
import type { PersonalityId } from '../types';
import { Rng } from '../rng';
import { createBattle, enemyUnit, type Deploy } from './setup';
import { fx } from '../mentor';
import { autoPlayerPhase, endPlayerPhase, startPlayerPhase, rewind, canRewind, commandRate, finish, checkEnd, enemyAct, type BattleCtx } from './engine';
import { forecast, weaponOf, staffOf, dist } from './calc';
import { generateFace } from '../student';
import { addProspect, takenNames, pickFace, parseEnemyFace, revealOne, survives, pickOfficerForQuest, officerById, officerName, officerLevel, applyOfficerTraits, memoryLine, rivalryOf, voice, headOf, headEffect, factionOfQuest, afterOfficerBattle, rankName, fullName, isScout, type TraitHit } from '../officers';
import { OFFICER, OFFICER_TRAITS, FACTION_NAMES } from '../../data/officers';
import { SCAR_TEXT, SCAR_RETURN, VOW_SAY, VOW_NARR, RIVAL_SAY, RIVAL_LEADER, SETTLE_TEXT, SETTLE_RESULT, SETTLE_LEADER, SETTLE_SAY, ALUMNI_LEADER, HEAD_TEXT, GRUDGE_CHOICE, GRUDGE_RESULT } from '../../data/officers_text';
import { unitFromStudent, defaultWeaponFor } from './setup';
import { bestFriend } from '../support';
import type { BattleFinding } from '../state';
import { getSupport, supportValue } from '../support';
import { enrolled, available, chronicle } from '../game';
import { STRATS, type StratId } from '../../data/stratagems';
import { initCards, resolveTurn, autoPick, afterChoice, checkCardsEnd, type CLine, type CardPolicy } from './cards';
import { guideAfterPlay } from './cardGuide';
import { fireStrat, stratReview, captainMod, defaultRow, formationMod, oddsLabel, stratOdds, defaultCaptain, defaultPlanner, knownStrats, stratSlots, type StratRec } from '../stratagems';

// ---------- 16夜目：札の戦い ----------
/** 札の戦いで戦うか（16夜目。切り替えるまでは、今までのマス目の戦い） */
let cardMode = true;
export function setCardMode(v: boolean): void { cardMode = v; }
/** おまかせで札を出すときの方針（シミュレーションの方針ごと：和平狙い＝守り厚め、統一狙い＝攻め厚め） */
let cardPolicy: CardPolicy = 'balanced';
export function setCardPolicy(p: CardPolicy): void { cardPolicy = p; }
export function isCardMode(): boolean { return cardMode; }

// ---------- 型 ----------
export interface AutoLine { by: string; text: string }
export interface AutoScene { title: string; lines: AutoLine[]; faces: string[]; momentum: number; hurt: string[]; down: string[]; /** 宿敵の決着：二人だけの場面（生徒id） */ duo?: string;
  /** 戦いの記録（7夜目）：この場面までの攻撃ごとの記録と、場面の終わりの両軍のHP・倒れた（退いた）者 */
  log?: BLog[]; hp?: Record<string, number>; gone?: string[] }
export interface AutoChoiceOpt { id: string; label: string; note: string; actor?: string }
export interface AutoChoice { kind: 'help' | 'push' | 'duel' | 'persuade' | 'route' | 'settle' | 'grudge' | 'wait'; prompt: string; actor?: string; options: AutoChoiceOpt[]; recommended: number; /** 二人だけの特別な場面（宿敵の決着） */ duo?: boolean }
export interface LeaderInfo {
  uid: string; name: string; personality: LeaderPersonality; face: FaceParts; classId: string; nemesisId?: string; again: boolean; fled?: boolean;
  /** 6夜目：名簿の敵将 */
  officerId?: string; faceImage?: string | null; alumniId?: string; scars?: number; rank?: string;
  /** 宿敵の決着（選んだもの）と、決着をつけた生徒 */
  settled?: 'persuade' | 'duel' | 'kill' | 'spare' | null; settleBy?: string; duelWon?: boolean;
  /** 隠れた特徴が表に出たか・突いたか */
  traitHits?: TraitHit[];
  /** 執着している生徒（味方のuid） */
  target?: string;
  /** 逃げない（討ち取る指示・仲間を見捨てない） */
  noFlee?: boolean;
}
/** 敵将（自動の戦闘は auto.leader、手動の戦闘は leader） */
export function leaderOf(b: BattleState): LeaderInfo | null { return b.auto?.leader ?? b.leader ?? null; }
export type AutoEffect =
  | { kind: 'support'; a: string; b: string; v: number }
  | { kind: 'trust'; id: string; v: number }
  | { kind: 'motivation'; id: string; v: number }
  | { kind: 'reveal'; id: string; v: number }
  | { kind: 'trait'; id: string; trait: string }
  | { kind: 'exp'; id: string; v: number }
  | { kind: 'spot'; id: string; v: number };
export interface AutoState {
  tactic: TacticId;
  roles: Record<string, RoleId>;   // 生徒id→役割
  scenes: AutoScene[];
  /** 画面で見終わった場面の数 */
  shown: number;
  choice: AutoChoice | null;
  choicesMade: { kind: string; id: string; label: string }[];
  /** 0=開戦のみ 1=ぶつかり合いまで 2=山場まで 3=決着 */
  seg: number;
  leader: LeaderInfo | null;
  events: string[];
  effects: AutoEffect[];
  /** 巻き戻しで守らない子（作戦を優先したとき、その場面だけ） */
  exposed: string[];
  careful: string[];
  startHp: { ally: number; enemy: number };
  /** その子が場面に出た回数（MVP・演武会に使う） */
  spot: Record<string, number>;
  retreatedAll?: boolean;
  review: string[];
  /** 戦いのはじめの両軍のHP（uid→[今, 最大]。7夜目） */
  hp0?: Record<string, [number, number]>;
  /** 9夜目：出撃前の計画（策・策を立てる子・部隊長・陣形） */
  plan?: { planner?: string; captain?: string; rows?: Record<string, 'front' | 'back'> };
  /** 切った策の記録、まだ切っていない策（ぶつかり合いのあと） */
  strats?: StratRec[]; held?: StratId[];
  /** 策の効き目：重傷で済む確率+、一騎打ちを申し込ませる、戦いのあと特徴が分かる */
  injury?: number; duelOffer?: boolean; reveal?: boolean;
  /** 戦いで目立った一般兵（9夜目：名前と顔を得て「見込みのある兵」に） */
  raised?: RaisedGrunt[];
  /** 勇士型の敵将が倒れて、兵が崩れた（10夜目） */
  collapsed?: boolean;
  /** 教官が同行しない部隊（10夜目）：部隊長が下した判断 */
  away?: { calls: AwayCall[] };
  /** 16夜目：札の戦い、山札に入れる先生の策 */
  cards?: import('./cards').CardState;
  planStrats?: StratId[];
}
/** 同行しない部隊の判断の記録 */
export interface AwayCall { kind: string; prompt: string; label: string; good: boolean; by?: string }
/** 戦いで目立った一般兵 */
export interface RaisedGrunt { uid: string; label: string; given: string; family: string; gender: 'm' | 'f'; face: FaceParts; faceImage: string | null; classId: string; level: number; deed: string; victim?: string; dead?: boolean; weapon?: string | null }

export interface AutoPlan {
  tactic: TacticId; roles: Record<string, RoleId>;
  /** 9夜目：策（1〜2枚）・策を立てる子・部隊長・前列／後列 */
  strats?: StratId[]; planner?: string; captain?: string; rows?: Record<string, 'front' | 'back'>;
}
/** 卒業生の思い出（口上に使う） */
function alumniLines(s: GameState, st: Student, r: Rng): string[] {
  const out: string[] = [];
  const country = st.career?.country ? COUNTRY_SHORT[st.career.country] : '';
  const t = st.career?.path ? (st.career.path === 'warrior' ? ['兵士', '小隊長', '部隊長', '将軍', '元帥'] : ['参謀見習い', '作戦参謀', '参謀長', '軍師'])[Math.min(st.career.rank, 4)] ?? '' : '';
  out.push(fill(r.pick(ALUMNI_LEADER.open), { country, rankName: t }));
  const fr = bestFriend(s, st);
  const pool: string[] = [];
  if (fr) pool.push(fill(r.pick(ALUMNI_LEADER.friend), { friend: fr.given }));
  if (st.farewell) pool.push(fill(r.pick(ALUMNI_LEADER.farewell), { farewell: st.farewell.replace(/^「|」$/g, '').slice(0, 40) }));
  if ((st.trustTalks ?? []).length) pool.push(ALUMNI_LEADER.interview[0]);
  if (pool.length) out.push(r.pick(pool));
  return out;
}

// ---------- 小さな道具 ----------
function rngOf(b: BattleState): Rng { return new Rng(b as unknown as { rng: number }); }
function hash(s: string): number { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function fill(t: string, v: Record<string, string>): string { return t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m); }
function addMod(u: Unit, m: UnitMod, k = 1): void {
  u.mod ??= {};
  for (const key of ['hit', 'avo', 'dmg', 'def', 'crit'] as const) if (m[key]) u.mod[key] = (u.mod[key] ?? 0) + (m[key] as number) * k;
}

/** 文を選ぶ。直近に使った文は出にくい */
function pickText(s: GameState, r: Rng, list: readonly string[] | undefined): string {
  if (!list || !list.length) return '';
  const mem = (s.autoMemory ??= { lines: [], events: [] });
  const salt = mem.n ?? 0;
  const t = r.weighted(list, (x) => (mem.lines.includes(String(hash(x))) ? AUTO.recentPenalty : 1) * jitter(x, salt));
  mem.lines.push(String(hash(t)));
  if (mem.lines.length > AUTO.recentLines) mem.lines.splice(0, mem.lines.length - AUTO.recentLines);
  return t;
}
/** 戦闘ごとに変わる小さなゆらぎ（同じ戦いの流れでも、文の選ばれ方が変わる） */
function jitter(x: string, salt: number): number { return 0.35 + (((hash(x) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0) % 1000) / 770; }
function say(s: GameState, r: Rng, key: string, st: Student, v: Record<string, string> = {}): AutoLine {
  return { by: st.id, text: fill(pickText(s, r, SAY[key]?.[st.personality]), { a: st.given, ...v }) };
}

// ---------- 役割 ----------
/** 兵種ごとの役割の向き不向き（0＝向かない 1＝ふつう 2＝向いている） */
export function roleFit(classId: string, role: RoleId): number {
  const c = CLASSES[classId] ?? CLASSES.novice;
  const w = c.weapons;
  const melee = w.some((x) => x === 'sword' || x === 'lance' || x === 'axe');
  const ranged = w.some((x) => x === 'bow' || x === 'magic' || x === 'gun');
  const staff = w.includes('staff');
  if (c.tier === 0) return role === 'heal' ? 0 : 1;
  switch (role) {
    case 'front': return c.moveType === 'armor' ? 2 : (w.includes('lance') || w.includes('axe')) && c.moveType !== 'flying' ? 2 : melee ? 1 : 0;
    case 'back': return ranged && !melee ? 2 : ranged ? 1 : 0;
    case 'flank': return c.moveType === 'flying' || c.moveType === 'cavalry' ? 2 : w.includes('sword') && c.moveType === 'infantry' ? 2 : melee ? 1 : 0;
    case 'heal': return staff ? 2 : 0;
  }
}
export function defaultRole(classId: string, st?: Student): RoleId {
  const c = CLASSES[classId] ?? CLASSES.novice;
  if (c.weapons.includes('staff') && (st ? (st.spells ?? []).some((id) => WEAPONS[id]?.type === 'staff') : true) && !c.weapons.some((x) => x === 'sword' || x === 'axe' || x === 'lance')) return 'heal';
  const order: RoleId[] = ['front', 'flank', 'back', 'heal'];
  let best: RoleId = 'front';
  for (const r of order) if (roleFit(classId, r) > roleFit(classId, best)) best = r;
  return best;
}
export function defaultPlan(s: GameState, q: Quest, deploys: Deploy[]): AutoPlan {
  const roles: Record<string, RoleId> = {};
  for (const d of deploys) { const st = s.students[d.studentId]; if (st) roles[st.id] = defaultRole(st.classId, st); }
  const ids = deploys.map((d) => d.studentId);
  const captain = defaultCaptain(s, ids);
  const planner = defaultPlanner(s, ids);
  return { tactic: TACTIC_OPTIONS[q.objective][0], roles, captain, planner, strats: recommendStrats(s, q, ids, planner, captain) };
}
/** おすすめの策：分かっている情報で見込みの高いものから（9夜目） */
export function recommendStrats(s: GameState, q: Quest, ids: string[], planner?: string, captain?: string, n = stratSlots(s)): StratId[] {
  const o = q.real ? officerForQuest(s, q) : null;
  const members = ids.map((id) => s.students[id]).filter(Boolean);
  const known = o?.knownTraits ?? [];
  const list = knownStrats(s).map((id) => ({ id, od: stratOdds(id, { q, planner: planner ? s.students[planner] : null, captain: captain ? s.students[captain] : null, members, traits: known, known }) }))
    .filter((x) => !x.od.dud && x.od.bad.length === 0)
    .sort((a, c) => c.od.rate + (c.od.weak ? 30 : 0) + c.od.good.length * 5 - a.od.rate - (a.od.weak ? 30 : 0) - a.od.good.length * 5);
  return list.slice(0, n).map((x) => x.id);
}
export function tacticFits(t: TacticId, q: Quest): boolean { return TACTICS[t].fits.includes(q.objective); }

/** 作戦・役割・やる気・疲労の補正を、戦闘の始めに付ける */
function applyPlan(s: GameState, b: BattleState, q: Quest, plan: AutoPlan): void {
  const t = TACTICS[plan.tactic];
  const fit = tacticFits(plan.tactic, q);
  for (const u of b.units) {
    if (u.side !== 'player' || !u.studentId) continue;
    const st = s.students[u.studentId];
    addMod(u, t.mod);
    if (fit) addMod(u, AUTO.tacticFit);
    const role = plan.roles[u.studentId] ?? defaultRole(u.classId, st);
    addMod(u, ROLES[role].mod);
    const f = roleFit(u.classId, role);
    if (f >= 2) addMod(u, AUTO.roleFit); else if (f === 0) addMod(u, AUTO.roleMisfit);
    if (st) {
      const m = (st.motivation - 2) * AUTO.motivationStep;
      addMod(u, { hit: m, avo: m });
    }
    // 陣形（9夜目）：前列は狙われやすく、後列は守られる
    const row = plan.rows?.[u.studentId] ?? defaultRow(role);
    u.row = row;
    addMod(u, formationMod(row));
    // 部隊長の腕前
    if (plan.captain) addMod(u, captainMod(s.students[plan.captain]));
  }
}

// ---------- 敵の情報 ----------
const TYPE_NAMES: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道', holy: '光魔法', gun: '銃', staff: '杖' };
const BEATS: Record<string, string> = { sword: 'axe', axe: 'lance', lance: 'sword' };
export interface EnemyIntel {
  count: number;
  types: { type: string; name: string; n: number }[];
  /** 三すくみ：こちらの得意（+）・苦手（−） */
  matchup: number;
  matchText: string;
  classes: { name: string; n: number }[];
  leader: { name: string; personality: LeaderPersonality; className: string; level: number; face: FaceParts; again: boolean } | null;
  alumni: string | null;
}
export function enemyIntel(s: GameState, b: BattleState): EnemyIntel {
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.dead);
  const types: Record<string, number> = {};
  const classes: Record<string, number> = {};
  for (const e of enemies) {
    const w = weaponOf(e);
    const t = w?.type ?? (staffOf(e) ? 'staff' : 'axe');
    types[t] = (types[t] ?? 0) + 1;
    const cn = (CLASSES[e.classId] ?? CLASSES.fighter).name;
    classes[cn] = (classes[cn] ?? 0) + 1;
  }
  // こちらの武器との相性
  let m = 0;
  for (const p of b.units.filter((u) => u.side === 'player')) {
    const w = weaponOf(p);
    if (!w) continue;
    for (const [t, n] of Object.entries(types)) { if (BEATS[w.type] === t) m += n; if (BEATS[t] === w.type) m -= n; }
  }
  const list = Object.entries(types).map(([type, n]) => ({ type, name: TYPE_NAMES[type] ?? type, n })).sort((a, c) => c.n - a.n);
  const top = list[0];
  const weakTo = top && BEATS[Object.keys(BEATS).find((k) => BEATS[k] === top.type) ?? ''] ? Object.keys(BEATS).find((k) => BEATS[k] === top.type) : null;
  const nP = Math.max(1, b.units.filter((u) => u.side === 'player').length);
  const mm = m / nP;
  const kind = mm >= 0.8 ? 'good' : mm <= -0.8 ? 'bad' : 'even';
  const foe = top ? `${top.name}${top.type === 'magic' || top.type === 'staff' ? 'の使い手' : '兵'}` : '';
  let matchText = kind === 'even' ? '敵の顔ぶれはさまざま。相性の有利・不利は少ない' : kind === 'good' ? `${foe}が多い。こちらの武器が有利` : `${foe}が多い。こちらの武器では少し不利`;
  if (top && weakTo && top.n >= 2) matchText += `（${top.name}は${TYPE_NAMES[weakTo]}に弱い）`;
  const L = b.auto?.leader;
  const lu = L ? b.units.find((u) => u.uid === L.uid) : null;
  return {
    count: enemies.length, types: list, matchup: Math.round(mm * 10) / 10, matchText,
    classes: Object.entries(classes).map(([name, n]) => ({ name, n })).sort((a, c) => c.n - a.n),
    leader: L && lu ? { name: L.name, personality: L.personality, className: (CLASSES[lu.classId] ?? CLASSES.fighter).name, level: lu.level, face: L.face, again: L.again } : null,
    alumni: b.enemyAlumni,
  };
}

// ---------- 敵将 ----------
function leaderKind(q: Quest): EnemyOfficer['kind'] { return q.kind === 'monster' ? 'monster' : q.enemyCountry ? 'army' : 'bandit'; }
function makeLeader(s: GameState, q: Quest, b: BattleState, r: Rng, tactic: string | null = null): LeaderInfo | null {
  if (q.kind === 'drill' || q.kind === 'exhibition') return null;
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.persuadable);
  if (!enemies.length) return null;
  let u = enemies.find((e) => e.boss) ?? [...enemies].sort((a, c) => c.level - a.level)[0];
  const kind = leaderKind(q);
  const deployIds = b.units.filter((x) => x.side === 'player' && x.studentId).map((x) => x.studentId!);
  const swap = (nu: Unit) => { nu.ai = u.ai; nu.boss = u.boss; b.units = b.units.map((x) => (x === u ? nu : x)); u = nu; };
  let info: LeaderInfo;
  if (kind === 'monster') {
    // 魔物の頭：名簿はないが、逃がした頭はまた現れる（今まで通り）
    const nem = (s.officers ?? []).filter((o) => o.status === 'active' && o.faction === 'monster');
    const again = q.real && nem.length && r.chance(AUTO.nemesisChance) ? r.pick(nem) : null;
    if (again) {
      swap(enemyUnit(r, u.uid, again.classId, Math.max(u.level, again.level + AUTO.nemesisLevelUp), u.x, u.y, s.world.gunUnlocked, true));
      info = { uid: u.uid, name: officerName(again), personality: 'beast', face: again.face, classId: u.classId, officerId: again.id, again: true, scars: again.scars };
    } else info = { uid: u.uid, name: r.pick(MONSTER_LEADERS), personality: 'beast', face: generateFace(r, 'frontier', 'm'), classId: u.classId, again: false };
  } else {
    // 依頼の敵将は、編成を変えても同じ（依頼ごとに決まった種で選ぶ。偵察で分かったことがむだにならない）
    const o = officerForQuest(s, q);
    if (o) {
      const alum = o.alumniId ? s.students[o.alumniId] : null;
      if (alum) {
        const nu = unitFromStudent(alum, 'enemy', u.uid, u.x, u.y, [defaultWeaponFor(alum)]);
        nu.name = `${alum.given}（卒業生）`; nu.persuadable = true;
        swap(nu);
        b.enemyAlumni ??= alum.id;
      } else swap(enemyUnit(r, u.uid, o.classId, officerLevel(o, u.level), u.x, u.y, s.world.gunUnlocked, u.boss));
      const hits = applyOfficerTraits(b, o, u, tactic);
      u.arts = officerArts(o, s); // 12夜目：敵将の戦技
      // 14夜目：伝説の武器を持つ敵将は、その力を振るう
      { const lg = legendOfOfficer(s, o.id); if (lg) addMod(u, legendModOf(lg)); }
      info = { uid: u.uid, name: officerName(o), personality: o.personality as LeaderPersonality, face: o.face, classId: u.classId, officerId: o.id, faceImage: o.faceImage, alumniId: o.alumniId, again: o.meets.length > 0, scars: o.scars, rank: rankName(o), traitHits: hits };
      if (o.traits.includes('loyal')) info.noFlee = true;
      // 執着：負けた相手の生徒を狙う
      const tgt = o.grudge ? b.units.find((x) => x.side === 'player' && x.studentId === o.grudge) : null;
      if (tgt) { u.grudge = tgt.uid; info.target = tgt.uid; if (b.objective !== 'boss' && b.objective !== 'seize') u.ai = 'charge'; }
      if (o.traits.includes('hothead') && b.objective !== 'seize') u.ai = 'charge';
      // 生徒側の因縁：仇討ちの誓い・宿敵
      for (const p of b.units) {
        if (p.side !== 'player' || !p.studentId) continue;
        const rv = rivalryOf(s, p.studentId, o.id);
        if (!rv || rv.settled) continue;
        if (rv.vow) addMod(p, OFFICER.vowMod);
        if (rv.stage >= 2) addMod(p, OFFICER.rivalMod);
      }
    } else {
      // 名簿が空のとき（ふつうは起きない）：名もない敵将
      const origin = q.enemyCountry ?? 'frontier';
      const g = r.chance(0.3) ? 'f' : 'm';
      const nl = NAMES[origin];
      const given = r.pick(g === 'f' ? nl.female : nl.male);
      info = { uid: u.uid, name: kind === 'bandit' ? `${r.pick(BANDIT_EPITHETS)}${given}` : `${given}・${r.pick(nl.family)}`, personality: r.pick(['arrogant', 'veteran', 'cunning', 'proud', 'young', 'cold'] as const), face: generateFace(r, origin, g), classId: u.classId, again: false };
    }
  }
  if (!info.alumniId) u.name = info.name;
  return info;
}

/** この依頼の敵将（名簿から。編成によらず同じ） */
export function officerForQuest(s: GameState, q: Quest): EnemyOfficer | null {
  if (q.small && ((questSeed(s, q) >>> 3) % 100) >= B.quests.smallOfficer * 100) return null;
  const ids = Object.values(s.students).filter((x) => x.status === 'enrolled').map((x) => x.id);
  return pickOfficerForQuest(s, q, new Rng({ rng: questSeed(s, q) ^ 0x2f6b5a }), ids);
}

/** 手動の戦闘でも敵将を立てる（口上・弱点・記憶が効く） */
/** 偵察：出撃前に一手使って、敵将の特徴を1つ知る（斥候の兵種の子が出撃するなら人数は減らない）。分かった特徴のidを返す */
export function scoutQuest(s: GameState, questId: string, free: boolean): string | null {
  const q = s.quests.find((x) => x.id === questId);
  if (!q || q.scouted) return null;
  const o = officerForQuest(s, q);
  if (!o) return null;
  q.scouted = true; q.scoutFree = free;
  return revealOne(o, new Rng({ rng: questSeed(s, q) ^ 0x5c0 }));
}

export function setupLeader(s: GameState, q: Quest, b: BattleState): void {
  const r = rngOf(b);
  b.leader = makeLeader(s, q, b, r, null);
  const L = b.leader;
  if (L) {
    const o = officerById(s, L.officerId);
    const ids = b.units.filter((x) => x.side === 'player' && x.studentId).map((x) => x.studentId!);
    const mem = o && !o.alumniId ? memoryLine(s, o, ids, r) : null;
    const text = mem?.text ?? pickText(s, r, LEADER_TEXT[L.personality][L.again ? 'again' : 'open']);
    if (text && L.personality !== 'beast') b.log.push({ text: `敵将 ${L.name}：「${fill(text, { leader: L.name })}」`, kind: 'info' });
    if (o?.knownTraits.length) b.log.push({ text: `分かっている特徴：${o.knownTraits.map((t) => OFFICER_TRAITS[t]?.name).join('・')}`, kind: 'info' });
  }
  b.rng = r.h.rng;
}

// ---------- 戦闘の組み立て ----------
export function questSeed(s: GameState, q: Quest): number { return hash(`${q.id}|${s.year}|${s.month}|${s.createdAt}`) ^ 0x5bd1e995; }

function newAuto(plan: AutoPlan): AutoState {
  return { tactic: plan.tactic, roles: { ...plan.roles }, scenes: [], shown: 0, choice: null, choicesMade: [], seg: 0, leader: null, events: [], effects: [], exposed: [], careful: [], startHp: { ally: 0, enemy: 0 }, spot: {}, review: [] };
}

/** 出撃前の画面用：戦闘を組み立てて敵の顔ぶれを見る（ゲームの状態は変えない） */
export function previewBattle(s: GameState, q: Quest, deploys: Deploy[], plan?: AutoPlan): BattleState {
  const mem = s.autoMemory ? { lines: [...s.autoMemory.lines], events: [...s.autoMemory.events] } : undefined;
  const nextId = s.nextId;
  const b = buildBattle(s, q, deploys, plan ?? defaultPlan(s, q, deploys), questSeed(s, q));
  s.autoMemory = mem; s.nextId = nextId;
  return b;
}

function buildBattle(s: GameState, q: Quest, deploys: Deploy[], plan: AutoPlan, seed: number): BattleState {
  const b = createBattle(s, q, deploys, seed);
  b.auto = newAuto(plan);
  b.feed = [];
  b.blog = [];
  const r = rngOf(b);
  b.auto.leader = makeLeader(s, q, b, r, plan.tactic);
  b.rng = r.h.rng;
  applyPlan(s, b, q, plan);
  if (TACTICS[plan.tactic].focusBoss && b.auto.leader) b.focus = b.auto.leader.uid;
  b.auto.hp0 = Object.fromEntries(b.units.map((u) => [u.uid, [u.hp, u.maxHp] as [number, number]]));
  // 策（9夜目）：開戦で切るものはここで、ぶつかり合いのあとのものは手元に残す
  b.auto.plan = { planner: plan.planner, captain: plan.captain, rows: plan.rows };
  b.auto.held = [];
  const o = officerById(s, b.auto.leader?.officerId);
  // 16夜目：札の戦いでは、策は山札に入る（先生の策の札）
  if (cardMode) b.auto.planStrats = [...(plan.strats ?? [])].filter((id) => STRATS[id]);
  else for (const id of plan.strats ?? []) {
    if (!STRATS[id]) continue;
    if (STRATS[id].when === 'open') fireStrat(s, b, q, id, o);
    else b.auto.held.push(id);
  }
  b.auto.startHp = {
    ally: b.units.filter((u) => u.side === 'player').reduce((a, u) => a + u.maxHp, 0) || 1,
    enemy: b.units.filter((u) => u.side === 'enemy').reduce((a, u) => a + u.maxHp, 0) || 1,
  };
  if (cardMode) {
    // 援軍の卒業生は、はじめから一緒に（札は出さず、自分で動く）
    if (b.reinforcement && reinforce) { const u = reinforce(b); if (u) { u.row = 'front'; b.units.push(u); b.reinforcement = null; } }
    initCards(s, b, b.auto.planStrats ?? []);
  }
  return b;
}
let reinforce: ((b: BattleState) => Unit | null) | null = null;
/** 援軍の卒業生を作る（flow から渡す） */
export function setCardReinforce(f: (b: BattleState) => Unit | null): void { reinforce = f; }

/** 自動の戦闘の計算に使う ctx（作戦の「重傷で済む」補正を足す） */
function autoCtx(base: BattleCtx, b: BattleState): BattleCtx {
  const inj = TACTICS[b.auto?.tactic ?? 'careful'].injury + (b.auto?.injury ?? 0);
  return { ...base, luckInjury: (id) => base.luckInjury(id) + inj };
}

/**
 * 決めたターンまで戦闘を進める。教え子が戦死したら、教官が戦況を読み直す（巻き戻し）。
 * 作戦を優先した子（exposed）は守らない。返り値は（巻き戻しで入れ替わることのある）戦闘の状態
 */
export function runUntil(b: BattleState, ctx0: BattleCtx, untilTurn: number, protect = true): BattleState {
  const ctx = b.auto ? autoCtx(ctx0, b) : ctx0;
  let guard = 0;
  const careful = new Set<string>(b.auto?.careful ?? []);
  const carefulUntil = new Map<string, number>();
  const t = TACTICS[b.auto?.tactic ?? 'careful'];
  const deaths = (x: BattleState) => x.fallen.filter((f) => f.outcome === 'dead' && !(x.auto?.exposed ?? []).includes(x.units.find((u) => u.studentId === f.studentId)?.uid ?? '')).length;
  while (b.phase !== 'done' && b.turn <= untilTurn && guard++ < 80) {
    const d0 = deaths(b);
    const turn = b.turn;
    for (const [k, until] of carefulUntil) if (b.turn > until) { careful.delete(k); carefulUntil.delete(k); }
    const opt = { weakHp: Math.max(0.25, t.carefulHp), goalHp: t.focusGoal ? 0.2 : 0.4 };
    autoPlayerPhase(b, ctx, careful, opt);
    if ((b.phase as string) !== 'done') endPlayerPhase(b, ctx);
    if (protect && deaths(b) > d0 && b.rewindsLeft > 0) {
      for (const f of b.fallen) if (f.outcome === 'dead') { const u = b.units.find((x) => x.studentId === f.studentId); if (u) { careful.add(u.uid); carefulUntil.set(u.uid, turn + 1); } }
      // 死んだターンの初めへ戻る（区切りの最初のターンの記録は、選択の効果を入れて取り直してある）
      const back = b.turn > turn ? 2 : 1;
      if (canRewind(b) >= back) { b = rewind(b, back); b.log.pop(); b.rng = (b.rng + 7919 * guard) | 0; continue; }
    }
  }
  return b;
}

/** 勝ち目の目安：裏で何度か試しに戦わせる（巻き戻しなし・選択なし） */
export function estimateWin(s: GameState, q: Quest, deploys: Deploy[], plan: AutoPlan, ctx: BattleCtx): { rate: number; label: '優勢' | '五分' | '苦しい' } {
  if (!deploys.length) return { rate: 0, label: '苦しい' };
  const mem = s.autoMemory ? { lines: [...s.autoMemory.lines], events: [...s.autoMemory.events] } : undefined;
  const nextId = s.nextId;
  let win = 0;
  for (let i = 0; i < AUTO.estimateRuns; i++) {
    let b = buildBattle(s, q, deploys, plan, questSeed(s, q) + i * 104729);
    if (cardMode) {
      let g = 0;
      while (b.phase !== 'done' && g++ < 12) { const p = autoPick(s, b, ctx, 'balanced'); b.auto!.cards!.target = p.target; resolveTurn(s, b, ctx, p.ids, { level: 'normal', deathMul: 1 }); }
      if (b.result === 'win') win++;
      continue;
    }
    b.rewindsLeft = 0;
    startPlayerPhase(b);
    b = runUntil(b, ctx, 99, false);
    if (b.result === 'win') win++;
  }
  s.autoMemory = mem; s.nextId = nextId;
  const rate = win / AUTO.estimateRuns;
  return { rate, label: rate >= AUTO.estimateGood ? '優勢' : rate >= AUTO.estimateBad ? '五分' : '苦しい' };
}

/** おすすめの編成：レベルと、敵の兵種との相性、回復役を考えて選ぶ */
export function recommendDeploy(s: GameState, q: Quest, limit: number, base: (ids: string[]) => Deploy[], exclude?: Set<string>): Deploy[] {
  const list = enrolled(s).filter(available).filter((x) => !exclude?.has(x.id));
  const pool = q.kind ? (q.kind === 'monster' ? ['axe'] : q.enemyCountry ? ['lance', 'sword', 'axe'] : ['axe', 'sword']) : [];
  const score = (st: Student) => {
    const c = CLASSES[st.classId] ?? CLASSES.novice;
    let v = st.level * 3 + (st.motivation - 2) * 2;
    for (const t of pool) if (c.weapons.some((w) => BEATS[w] === t)) v += 1.5;
    return v;
  };
  const sorted = [...list].sort((a, c) => score(c) - score(a));
  const pick = sorted.slice(0, limit);
  const healer = sorted.find((st) => defaultRole(st.classId, st) === 'heal');
  if (healer && !pick.some((x) => defaultRole(x.classId, x) === 'heal') && pick.length) { pick[pick.length - 1] = healer; }
  return base(pick.map((x) => x.id));
}

// ---------- 勢い ----------
export function momentum(b: BattleState): number {
  const a = b.auto;
  if (!a) return 0.5;
  const ally = b.units.filter((u) => u.side === 'player' && !u.dead).reduce((x, u) => x + u.hp, 0) + b.retreated.filter((id) => b.units.find((u) => u.uid === id)?.side === 'player').length * 4;
  const enemy = b.units.filter((u) => u.side === 'enemy' && !u.dead).reduce((x, u) => x + u.hp, 0);
  const pa = ally / a.startHp.ally, pe = enemy / a.startHp.enemy;
  let m = pa / Math.max(0.01, pa + pe);
  if (b.objective === 'rescue' && b.rescued) m = Math.max(m, 0.8);
  if (b.objective === 'escape') m = Math.min(1, m + (b.escaped ?? 0) * 0.08);
  if (b.result === 'win') m = Math.max(m, 0.7);
  if (b.result === 'lose') m = Math.min(m, 0.3);
  return Math.round(m * 100) / 100;
}

// ---------- 場面づくり ----------
function deployed(s: GameState, b: BattleState): { u: Unit; st: Student }[] {
  return b.units.filter((u) => u.side === 'player' && u.studentId && s.students[u.studentId]).map((u) => ({ u, st: s.students[u.studentId!] }));
}
function stOf(s: GameState, b: BattleState, uid: string): Student | null {
  const u = b.units.find((x) => x.uid === uid);
  return u?.studentId && s.students[u.studentId] ? s.students[u.studentId] : null;
}
function hurtList(b: BattleState): string[] { return b.units.filter((u) => u.side === 'player' && !u.dead && u.studentId && u.hp < u.maxHp / 2).map((u) => u.studentId!); }
function downList(b: BattleState): string[] { return b.fallen.map((f) => f.studentId); }
function spot(a: AutoState, id: string, v = 1) { a.spot[id] = (a.spot[id] ?? 0) + v; }

function sceneOf(b: BattleState, title: string, lines: AutoLine[], faces: string[], takeLog = true): AutoScene {
  const sc: AutoScene = { title, lines: lines.filter((l) => l.text).slice(0, 5), faces: [...new Set(faces)].slice(0, 6), momentum: momentum(b), hurt: hurtList(b), down: downList(b) };
  if (b.blog) {
    // 戦いの記録：この場面までの分を場面へ移す
    sc.log = takeLog ? b.blog.splice(0) : [];
    sc.hp = Object.fromEntries(b.units.map((u) => [u.uid, Math.max(0, u.hp)]));
    sc.gone = b.units.filter((u) => u.dead || b.retreated.includes(u.uid)).map((u) => u.uid);
  }
  return sc;
}

// 出来事：発生の条件と効果。条件を満たす候補から、直近に出たものを避けて選ぶ
interface EvCand { id: string; a: Student; bSt?: Student; u: Unit; weight: number; apply: () => void }
function eventCandidates(s: GameState, b: BattleState, phase: 'open' | 'mid'): EvCand[] {
  const a = b.auto!;
  const out: EvCand[] = [];
  const list = deployed(s, b).filter((x) => !x.u.dead);
  const E = AUTO.ev;
  const used = (id: string, st: Student) => a.events.includes(`${id}:${st.id}`) || a.events.some((x) => x.startsWith(id + ':'));
  for (const { u, st } of list) {
    if (phase === 'open') {
      if (st.battles === 0 && !used('first', st)) out.push({ id: 'first', a: st, u, weight: 3, apply: () => a.effects.push({ kind: 'exp', id: st.id, v: E.firstExp }) });
      if (st.grade === 3 && s.month >= 10 && b.real && !used('last', st)) out.push({ id: 'last', a: st, u, weight: 3, apply: () => a.effects.push({ kind: 'trust', id: st.id, v: E.lastTrust }) });
      if (st.birthday && st.birthday.month === s.month && !used('birthday', st)) out.push({ id: 'birthday', a: st, u, weight: 2.5, apply: () => a.effects.push({ kind: 'motivation', id: st.id, v: 1 }) });
      if (st.recent.some((r) => r.type === 'ev_injury' && s.absWeek - r.week <= 10) && !used('recovered', st)) out.push({ id: 'recovered', a: st, u, weight: 2, apply: () => addMod(u, E.recovered) });
      if (st.lastClassWeek !== undefined && s.absWeek - st.lastClassWeek <= 4 && !used('newClass', st)) out.push({ id: 'newClass', a: st, u, weight: 2, apply: () => addMod(u, E.newSkill) });
      if (st.lastSpellWeek !== undefined && s.absWeek - st.lastSpellWeek <= 4 && !used('newSpell', st)) out.push({ id: 'newSpell', a: st, u, weight: 2, apply: () => addMod(u, E.newSkill) });
      continue;
    }
    // 戦いの最中
    // 11夜目：伸び盛りの出来事は、戦いで当てた・倒したあとに（開戦には出さない）
    if ((st.traits.includes('early') && st.grade === 1 || st.traits.includes('late') && st.grade === 3) && (u.kills > 0 || u.hits >= 2) && !used('bloom', st)) out.push({ id: 'bloom', a: st, u, weight: 1, apply: () => { const tr = st.traits.includes('early') ? 'early' : 'late'; a.effects.push({ kind: 'trait', id: st.id, trait: tr }); } });
    if (u.hp <= u.maxHp / 2 && (st.traits.includes('loser_hate') || st.personality === 'competitive') && !used('loserHate', st)) out.push({ id: 'loserHate', a: st, u, weight: 4, apply: () => { addMod(u, E.loserHate); if (st.traits.includes('loser_hate')) a.effects.push({ kind: 'trait', id: st.id, trait: 'loser_hate' }); } });
    if ((st.traits.includes('coward') || st.personality === 'timid') && st.battles <= 4 && (u.kills > 0 || u.hits > 0) && !used('coward', st)) out.push({ id: 'coward', a: st, u, weight: 3, apply: () => { addMod(u, E.coward); a.effects.push({ kind: 'motivation', id: st.id, v: 1 }); } });
    if (st.traits.includes('clutch') && b.real && u.hits >= 2 && !used('clutch', st)) out.push({ id: 'clutch', a: st, u, weight: 2.5, apply: () => a.effects.push({ kind: 'trait', id: st.id, trait: 'clutch' }) });
    if (st.bud && !st.bud.done && st.bud.reveal < 100 && (u.kills > 0 || u.hits >= 2) && !used('talent', st)) {
      // 10夜目：眠った芽の兆し（芽のある技能の武器を使った・金の芽）
      const usedTypes = Object.keys(u.usedWeapon).map((w) => WEAPONS[w]?.type);
      const match = st.bud.gold || usedTypes.some((t) => (t === 'holy' || t === 'staff' ? 'faith' : t) === st.bud!.skill);
      if (match) out.push({ id: 'talent', a: st, u, weight: 3.5, apply: () => a.effects.push({ kind: 'reveal', id: st.id, v: E.talentReveal }) });
    }
    if (staffOf(u) && (b.feed ?? []).filter((f) => f.t === 'heal' && f.a === u.uid).length >= 2 && !used('healer', st)) out.push({ id: 'healer', a: st, u, weight: 2, apply: () => a.effects.push({ kind: 'trust', id: st.id, v: 1 }) });
    for (const o of list) {
      if (o.st.id <= st.id) continue;
      const sp = getSupport(s, st.id, o.st.id);
      const v = supportValue(s, st.id, o.st.id);
      if (sp.kind === 'love' && (u.hp < u.maxHp * 0.4 || o.u.hp < o.u.maxHp * 0.4) && !used('lovers', st)) {
        const [saver, saved] = u.hp < u.maxHp * 0.4 ? [o, { u, st }] : [{ u, st }, o];
        out.push({ id: 'lovers', a: saver.st, bSt: saved.st, u: saver.u, weight: 5, apply: () => { saved.u.hp = Math.min(saved.u.maxHp, saved.u.hp + Math.ceil(saved.u.maxHp * E.loverHealPct)); a.careful.push(saved.u.uid); a.effects.push({ kind: 'support', a: st.id, b: o.st.id, v: E.loverSupport }); } });
      } else if (sp.kind === 'rival' && !used('rival', st)) {
        out.push({ id: 'rival', a: st, bSt: o.st, u, weight: 2.5, apply: () => { addMod(u, E.rival); addMod(o.u, E.rival); a.effects.push({ kind: 'support', a: st.id, b: o.st.id, v: E.rivalSupport }); } });
      } else if (v >= B.support.B && dist(u, o.u) <= 2 && !used('combo', st)) {
        out.push({ id: 'combo', a: st, bSt: o.st, u, weight: 3, apply: () => { addMod(u, E.combo); addMod(o.u, E.combo); a.effects.push({ kind: 'support', a: st.id, b: o.st.id, v: E.comboSupport }); } });
      }
    }
  }
  return out;
}

function takeEvent(s: GameState, b: BattleState, r: Rng, phase: 'open' | 'mid'): AutoLine[] {
  const a = b.auto!;
  const cands = eventCandidates(s, b, phase);
  if (!cands.length) return [];
  const mem = (s.autoMemory ??= { lines: [], events: [] });
  const c = r.weighted(cands, (x) => x.weight * (mem.events.includes(x.id) ? AUTO.recentPenalty * 2 : 1) * jitter(x.id + x.a.id, mem.n ?? 0));
  c.apply();
  a.events.push(`${c.id}:${c.a.id}`);
  mem.events.push(c.id);
  if (mem.events.length > AUTO.recentEvents) mem.events.splice(0, mem.events.length - AUTO.recentEvents);
  spot(a, c.a.id, 2);
  if (c.bSt) spot(a, c.bSt.id, 1);
  const T = EVENT_TEXT[c.id];
  const v = { a: c.a.given, b: c.bSt?.given ?? '' };
  return [
    { by: 'narr', text: fill(pickText(s, r, T.narr), v) },
    { by: c.a.id, text: fill(T.say[c.a.personality as PersonalityId], v) },
  ];
}

/** 戦いの記録から目立った出来事を拾う */
function highlights(s: GameState, b: BattleState, r: Rng, n: number): { lines: AutoLine[]; faces: string[] } {
  const a = b.auto!;
  const feed = b.feed ?? [];
  const lines: AutoLine[] = []; const faces: string[] = [];
  const nameOf = (uid: string) => b.units.find((u) => u.uid === uid)?.name ?? '敵';
  const mine = (uid: string) => { const u = b.units.find((x) => x.uid === uid); return !!u && u.side === 'player' && !!u.studentId; };
  // 倒した数
  const kills: Record<string, number> = {};
  for (const f of feed) if (f.t === 'kill' && mine(f.a)) kills[f.a] = (kills[f.a] ?? 0) + 1;
  const cands: { w: number; make: () => void }[] = [];
  const top = Object.entries(kills).sort((x, y) => y[1] - x[1])[0];
  if (top && top[1] >= 2) cands.push({ w: 5, make: () => { const st = stOf(s, b, top[0])!; lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.multiKill), { a: st.given }) }); lines.push(say(s, r, 'kill', st)); faces.push(st.id); spot(a, st.id, 2); } });
  const crits = feed.filter((f) => f.t === 'crit' && mine(f.a));
  if (crits.length) { const f = r.pick(crits); cands.push({ w: 3, make: () => { const st = stOf(s, b, f.a)!; lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.crit), { a: st.given, d: nameOf(f.d) }) }); faces.push(st.id); spot(a, st.id); } }); }
  const ks = feed.filter((f) => f.t === 'kill' && mine(f.a) && (!top || f.a !== top[0] || top[1] < 2));
  if (ks.length) { const f = r.pick(ks); cands.push({ w: 3, make: () => { const st = stOf(s, b, f.a)!; lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.kill), { a: st.given, d: nameOf(f.d) }) }); if (r.chance(0.5)) lines.push(say(s, r, 'kill', st)); faces.push(st.id); spot(a, st.id); } }); }
  const heals = feed.filter((f) => f.t === 'heal' && mine(f.a) && f.a !== f.d);
  if (heals.length) { const f = r.pick(heals); const tgt = stOf(s, b, f.d); cands.push({ w: 2, make: () => { const st = stOf(s, b, f.a)!; lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.heal), { a: st.given, b: tgt?.given ?? '仲間' }) }); faces.push(st.id); spot(a, st.id); } }); }
  const misses: Record<string, number> = {};
  for (const f of feed) if (f.t === 'miss' && mine(f.d)) misses[f.d] = (misses[f.d] ?? 0) + 1;
  const dodge = Object.entries(misses).sort((x, y) => y[1] - x[1])[0];
  if (dodge && dodge[1] >= 2) cands.push({ w: 2, make: () => { const st = stOf(s, b, dodge[0])!; lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.dodge), { a: st.given }) }); faces.push(st.id); spot(a, st.id); } });
  const hurt = b.units.filter((u) => u.side === 'player' && !u.dead && u.studentId && u.hp < u.maxHp * 0.4);
  if (hurt.length) { const u = r.pick(hurt); cands.push({ w: 2, make: () => { const st = s.students[u.studentId!]; lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.hurt), { a: st.given }) }); lines.push(say(s, r, 'hurt', st)); faces.push(st.id); } }); }
  for (let i = 0; i < n && cands.length; i++) { const c = r.weighted(cands, (x) => x.w); cands.splice(cands.indexOf(c), 1); c.make(); }
  // 倒れた子・援軍・目的
  for (const f of feed.filter((x) => x.t === 'fallen')) { const st = stOf(s, b, f.a); if (st && st.status === 'enrolled') { lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.fallen), { a: st.given }) }); faces.push(st.id); } }
  return { lines, faces };
}

function momentumLine(s: GameState, b: BattleState, r: Rng): AutoLine {
  const m = momentum(b);
  return { by: 'narr', text: pickText(s, r, m >= 0.58 ? CLASH_TEXT.push : m <= 0.42 ? CLASH_TEXT.pressed : CLASH_TEXT.even) };
}
function leaderLine(s: GameState, b: BattleState, r: Rng, key: keyof (typeof LEADER_TEXT)['arrogant']): AutoLine | null {
  const L = b.auto?.leader;
  if (!L) return null;
  const t = pickText(s, r, LEADER_TEXT[L.personality][key]);
  if (!t) return null;
  return { by: L.personality === 'beast' ? 'narr' : 'leader', text: voice(fill(t, { leader: L.name }), officerById(s, L.officerId)) };
}

/** 開戦の場面 */
function openingScene(s: GameState, b: BattleState, q: Quest): AutoScene {
  const r = rngOf(b);
  const lines: AutoLine[] = [];
  const intel = enemyIntel(s, b);
  lines.push({ by: 'narr', text: fill(pickText(s, r, OPEN_KIND[q.kind] ?? OPEN_KIND.bandit), { enemy: q.enemyCountry ? COUNTRY_SHORT[q.enemyCountry] : '敵' }) });
  const mapT = pickText(s, r, MAP_TEXT[q.template] ?? MAP_TEXT.training);
  const wT = q.weather !== 'clear' || r.chance(0.3) ? pickText(s, r, WEATHER_TEXT[q.weather]) : '';
  lines.push({ by: 'narr', text: [mapT, wT].filter(Boolean).join('') });
  const top = intel.types[0];
  const mk = intel.matchup >= 0.8 ? 'good' : intel.matchup <= -0.8 ? 'bad' : 'even';
  const L = b.auto!.leader;
  const o = L ? officerById(s, L.officerId) : null;
  const faces: string[] = deployed(s, b).map((x) => x.st.id);
  const special: AutoLine[] = [];
  if (L) {
    const ids = deployed(s, b).map((x) => x.st.id);
    const alum = o?.alumniId ? s.students[o.alumniId] : null;
    if (alum) {
      const al = alumniLines(s, alum, r);
      lines.push({ by: 'leader', text: al[0] });
      // 14夜目：敵として向かい合った先輩が、後輩の名前を呼ぶ
      const ru = reunionLine(s, r, alum, ids, 'foe');
      if (ru) { special.push({ by: 'leader', text: ru.text }); faces.unshift(ru.kohai); }
      else if (al[1]) special.push({ by: 'leader', text: al[1] });
    } else if (o && o.meets.length && o.kind !== 'monster') {
      if (o.scars) lines.push({ by: 'narr', text: fill(r.pick(SCAR_RETURN), { leader: L.name, scar: SCAR_TEXT[Math.min(4, o.scars)] }) });
      const mem = memoryLine(s, o, ids, r);
      if (mem) { lines.push({ by: 'leader', text: mem.text }); if (mem.target) faces.unshift(mem.target); }
      else { const l = leaderLine(s, b, r, 'again'); if (l) lines.push(l); }
    } else { const l = leaderLine(s, b, r, L.again ? 'again' : 'open'); if (l) lines.push(l); }
    // 生徒側の因縁：仇討ちの誓い／宿敵との再会
    if (o) {
      const vow = deployed(s, b).map((x) => ({ x, rv: rivalryOf(s, x.st.id, o.id) })).find((v) => v.rv?.vow && !v.rv.settled && s.students[v.rv.vow]);
      const rival = deployed(s, b).map((x) => ({ x, rv: rivalryOf(s, x.st.id, o.id) })).filter((v) => (v.rv?.stage ?? 0) >= 2 && !v.rv!.settled).sort((p, c) => c.rv!.stage - p.rv!.stage)[0];
      if (vow) {
        const v = { a: vow.x.st.given, v: s.students[vow.rv!.vow!].given, leader: L.name };
        special.push({ by: 'narr', text: fill(r.pick(VOW_NARR), v) }, { by: vow.x.st.id, text: fill(VOW_SAY[vow.x.st.personality], v) });
        faces.unshift(vow.x.st.id); spot(b.auto!, vow.x.st.id, 2);
        b.auto!.effects.push({ kind: 'motivation', id: vow.x.st.id, v: 1 });
      } else if (rival) {
        const v = { a: rival.x.st.given, leader: L.name };
        special.push({ by: rival.x.st.id, text: fill(RIVAL_SAY[rival.x.st.personality], v) }, { by: 'leader', text: voice(fill(r.pick(RIVAL_LEADER), v), o) });
        faces.unshift(rival.x.st.id); spot(b.auto!, rival.x.st.id, 1);
      }
      // 陣営の頭の性格（たまに）
      const f = factionOfQuest(q);
      const head = f ? headOf(s, f) : null;
      if (!special.length && head && head.id !== o.id && r.chance(0.25)) {
        const ht = r.pick(HEAD_TEXT[head.personality as LeaderPersonality] ?? ['']);
        if (ht) special.push({ by: 'narr', text: fill(ht, { faction: FACTION_NAMES[head.faction], head: officerName(head) }) });
      }
    }
  }
  if (b.enemyAlumni && s.students[b.enemyAlumni] && b.enemyAlumni !== L?.alumniId) lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.alumniFoe), { a: s.students[b.enemyAlumni].given }) });
  let ev: AutoLine[] = [];
  if (special.length) lines.push(...special.slice(0, 2));
  else {
    ev = takeEvent(s, b, r, 'open');
    if (ev.length) lines.push(...ev);
    else { const d = deployed(s, b); if (d.length) { const x = r.pick(d); lines.push(say(s, r, 'open', x.st)); } }
  }
  // 相性の一言は、場面が長くなりすぎないときだけ（5行まで）
  if (top && mk !== 'even' && lines.length < 5) lines.splice(2, 0, { by: 'narr', text: fill(pickText(s, r, MATCHUP_TEXT[mk]), { foe: `${top.name}${top.type === 'magic' ? 'の使い手' : '兵'}` }) });
  // 長すぎるときは、地形の文 → 依頼の文の順に削る
  if (lines.length > 5) lines.splice(1, 1);
  while (lines.length > 5) lines.splice(lines[0].by === 'narr' && lines.length > 5 ? 0 : 2, 1);
  b.rng = r.h.rng;
  const sc = sceneOf(b, '開戦', lines, ev.length ? [ev[1].by, ...faces] : faces, false);
  // 策の黄色い帯（9夜目）
  for (const x of b.auto!.strats ?? []) sc.lines.push({ by: x.ok ? 'strat' : 'stratng', text: `策「${STRATS[x.id].name}」：${x.text}` });
  return sc;
}

function midScene(s: GameState, b: BattleState, title: string, q: Quest): AutoScene {
  const r = rngOf(b);
  const lines: AutoLine[] = [];
  if (title === '山場') lines.push({ by: 'narr', text: pickText(s, r, CLIMAX_TEXT[q.objective] ?? CLIMAX_TEXT.rout) });
  const h = highlights(s, b, r, title === '山場' ? 1 : 2);
  // 戦いの記録があるときは、誰が何をしたかはカードで見せるので、場面の文には入れない（7夜目）
  if (!b.blog) lines.push(...h.lines.slice(0, 3));
  const ev = takeEvent(s, b, r, 'mid');
  lines.push(...ev);
  // 援軍
  const ally = b.units.find((u) => u.side === 'ally' && u.studentId && !(b.auto!.events.includes('reinforce')));
  if (ally && s.students[ally.studentId!]) {
    lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.reinforce), { a: s.students[ally.studentId!].given }) }); b.auto!.events.push('reinforce');
    // 14夜目：援軍に来た先輩が、後輩の名前を呼ぶ
    const ru = reunionLine(s, r, s.students[ally.studentId!], deployed(s, b).map((x) => x.st.id), 'ally');
    if (ru) lines.push({ by: ally.studentId!, text: ru.text });
  }
  if (title === '山場' && momentum(b) >= 0.62) { const l = leaderLine(s, b, r, 'cornered'); if (l && b.units.some((u) => u.uid === b.auto!.leader?.uid && !u.dead)) lines.push(l); }
  if (lines.length < 3) lines.push(momentumLine(s, b, r));
  const raise = raiseGrunts(s, b, r, q, false);
  b.feed = [];
  b.rng = r.h.rng;
  const sc = sceneOf(b, title, lines, [...h.faces, ...(ev[1] ? [ev[1].by] : [])]);
  sc.lines.push(...raise);
  return sc;
}

/**
 * 戦いで目立った一般兵が、その場で名前と顔を得る（9夜目）：生徒を倒した・重傷にした、必殺を出した、
 * 敵将が倒れたあとも最後まで粘った、撤退を生き延びた。戦いのあと「見込みのある兵」として名簿に入る
 */
function raiseGrunts(s: GameState, b: BattleState, r: Rng, q: Quest, end: boolean): AutoLine[] {
  const a = b.auto!;
  const f = factionOfQuest(q);
  if (!b.real || !f || f === 'monster' || (a.raised ?? []).length >= 1) return [];
  const L = a.leader;
  const grunt = (uid: string) => { const u = b.units.find((x) => x.uid === uid); return u && u.side === 'enemy' && !u.boss && u.uid !== L?.uid && !u.studentId && !(a.raised ?? []).some((g) => g.uid === uid) ? u : null; };
  const cands: { u: Unit; deed: string; victim?: string; dead?: boolean; p: number }[] = [];
  for (const e of b.feed ?? []) {
    if (e.t === 'fallen') {
      const u = grunt(e.d); const st = stOf(s, b, e.a);
      const fl = b.fallen.find((x) => x.studentId === st?.id);
      if (u && st && fl && fl.outcome !== 'out') cands.push({ u, deed: `${st.given}を${fl.outcome === 'dead' ? '討った' : '重傷にした'}`, victim: st.id, dead: fl.outcome === 'dead', p: OFFICER.raiseOdds.victim });
    } else if (e.t === 'crit') {
      const u = grunt(e.a); const st = stOf(s, b, e.d);
      if (u && st) cands.push({ u, deed: `${st.given}に必殺の一撃を放った`, p: OFFICER.raiseOdds.crit });
    }
  }
  if (end) {
    const lu = L ? b.units.find((x) => x.uid === L.uid) : null;
    for (const u of b.units) {
      if (!grunt(u.uid)) continue;
      if (lu?.dead && !L!.fled && !u.dead) cands.push({ u, deed: '敵将が倒れたあとも最後まで粘った', p: OFFICER.raiseOdds.last });
      else if (b.result === 'win' && b.retreated.includes(u.uid)) cands.push({ u, deed: '撤退を生き延びた', p: OFFICER.raiseOdds.retreat });
    }
  }
  const out: AutoLine[] = [];
  for (const c of cands) {
    if ((a.raised ?? []).length >= 1 || !r.chance(c.p)) continue;
    const origin = f === 'bandit' ? 'frontier' : f;
    const nl = NAMES[origin as keyof typeof NAMES];
    const gender: 'm' | 'f' = r.chance(0.25) ? 'f' : 'm';
    const faceImage = pickFace(s, f, gender, 'young', r, c.u.uid + s.nextId);
    const pf = faceImage ? parseEnemyFace(faceImage) : null;
    const g2 = pf?.gender ?? gender;
    // 10夜目：生徒・卒業生・敵将（今いない者も）・この戦いでもう名を得た兵と重ならない名前を
    const taken = takenNames(s); for (const x of a.raised ?? []) taken.add(x.given);
    const pool = (g2 === 'f' ? nl.female : nl.male).filter((n) => !taken.has(n));
    const other = Object.values(NAMES).flatMap((x) => (g2 === 'f' ? x.female : x.male)).filter((n) => !taken.has(n));
    const given = pool.length ? r.pick(pool) : other.length ? r.pick(other) : r.pick(g2 === 'f' ? nl.female : nl.male);
    const label = gruntLabel(s, b, q, c.u.uid);
    const w = weaponOf(c.u);
    const kind = w ? (TYPE_NAMES[w.type] ?? '') + (w.type === 'magic' || w.type === 'holy' ? 'の使い手' : '兵') : '兵';
    const i = (a.raised ??= []).length;
    a.raised.push({ uid: c.u.uid, label, given, family: r.pick(nl.family), gender: g2, face: generateFace(r, origin as 'frontier', g2), faceImage, classId: c.u.classId, level: c.u.level, deed: c.deed, victim: c.victim, dead: c.dead, weapon: w?.type ?? null });
    out.push({ by: `raise:${i}`, text: `${label}……あの${kind}、名は？　――「${given}」。${c.deed}` });
  }
  return out;
}
/** 雑兵の呼び名（戦いの記録と同じ「盗賊A」） */
function gruntLabel(s: GameState, b: BattleState, q: Quest, uid: string): string {
  const L = b.auto?.leader;
  const foe = q.kind === 'monster' ? '魔物' : q.enemyCountry ? `${COUNTRY_SHORT[q.enemyCountry]}兵` : q && !q.real ? '演習の相手' : '盗賊';
  const grunts = b.units.filter((x) => x.side === 'enemy' && !x.boss && x.uid !== L?.uid && !x.studentId);
  const i = grunts.findIndex((x) => x.uid === uid);
  return i >= 0 ? `${foe}${String.fromCharCode(65 + (i % 26))}` : '敵兵';
}

function endScene(s: GameState, b: BattleState): AutoScene {
  const r = rngOf(b);
  const a = b.auto!;
  const lines: AutoLine[] = [];
  const h = highlights(s, b, r, 1);
  if (!b.blog) lines.push(...h.lines.slice(0, 2));
  const win = b.result === 'win';
  if (a.retreatedAll) lines.push({ by: 'narr', text: pickText(s, r, END_TEXT.retreat) });
  const L = a.leader;
  const fledBoss = win && !!L?.fled && (b.objective === 'boss' || b.objective === 'seize');
  if (!a.retreatedAll) lines.push({ by: 'narr', text: pickText(s, r, win ? (fledBoss ? END_TEXT.bossFled : END_TEXT.win[b.objective] ?? END_TEXT.win.rout) : END_TEXT.lose) });
  const lu = L ? b.units.find((u) => u.uid === L.uid) : null;
  if (L && lu && L.settled && L.settled !== 'kill') { /* 決着の場面で語り終えている */ }
  else if (L && lu) {
    if (lu.dead && !L.fled && !b.retreated.includes(lu.uid)) {
      const l = leaderLine(s, b, r, 'fall'); if (l) lines.push(l);
      // 11夜目：敵将を討った子の受け止め方（性格ごと）
      const hb = b.hitBy?.[lu.uid] ?? [];
      const killer = hb.length ? stOf(s, b, hb[hb.length - 1]) : null;
      if (killer && (s.settings.battleProse ?? 'dense') !== 'normal') {
        const kr = r.pick(KILL_REACT[killer.personality] ?? KILL_REACT.serious);
        const fl = (t: string) => t.replace(/\{a\}/g, killer.given).replace(/\{l\}/g, L.name);
        lines.push({ by: 'narr', text: fl(kr.n) }, { by: killer.id, text: fl(kr.say) });
      }
    }
    else if (win || L.fled) { L.fled = true; const l = leaderLine(s, b, r, 'flee'); if (l) lines.push(l); }
    else { const l = leaderLine(s, b, r, 'duelWin'); if (l) lines.push(l); }
  }
  const alive = deployed(s, b).filter((x) => !b.fallen.some((f) => f.studentId === x.st.id));
  if (alive.length) { const x = alive.sort((p, q2) => (a.spot[q2.st.id] ?? 0) - (a.spot[p.st.id] ?? 0))[0]; lines.push(say(s, r, win ? 'win' : 'lose', x.st)); h.faces.push(x.st.id); }
  const q = s.quests.find((x) => x.id === b.questId);
  if (s.settings.battleProse === 'brutal' && b.real) lines.push({ by: 'narr', text: r.pick(PROSE_AFTER) });
  const raise = q ? raiseGrunts(s, b, r, q, true) : [];
  // 10夜目：戦利品（雑兵の落とし物・敵将の銘入りの武器・依頼の報酬）
  const loot = rollLoot(s, b, q, (uid) => (q ? gruntLabel(s, b, q, uid) : '敵兵'));
  for (const x of loot) raise.push({ by: 'loot', text: `戦利品：${x.named?.name ?? WEAPONS[x.weaponId]?.name ?? ''}（${x.from}）` });
  b.feed = [];
  b.rng = r.h.rng;
  const sc = sceneOf(b, '決着', lines, h.faces);
  sc.lines.push(...raise);
  return sc;
}

// ---------- ここぞの選択 ----------
function makeChoice(s: GameState, b: BattleState, ctx: BattleCtx, second: boolean): AutoChoice | null {
  const a = b.auto!;
  const r = rngOf(b);
  const cands: { w: number; c: AutoChoice }[] = [];
  const mine = deployed(s, b).filter((x) => !x.u.dead);
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.dead);
  const done = (k: string) => a.choicesMade.some((x) => x.kind === k);
  // 囲まれた子
  const danger = mine.filter((x) => x.u.hp < x.u.maxHp * 0.55 && enemies.filter((e) => dist(e, x.u) <= 3).length >= 2).sort((p, q) => p.u.hp / p.u.maxHp - q.u.hp / q.u.maxHp)[0];
  if (danger && !done('help')) {
    const T = CHOICE_TEXT.help;
    const v = { a: danger.st.given, rate: String(Math.round(commandRate(ctx, danger.u))) };
    cands.push({ w: 6, c: { kind: 'help', actor: danger.st.id, prompt: fill(T.prompt, v), recommended: 0, options: [
      { id: 'go', label: fill(T.go, v), note: T.goNote },
      { id: 'plan', label: fill(T.plan, v), note: fill(T.planNote, v) },
      { id: 'order', label: fill(T.order, v), note: fill(T.orderNote, v) },
    ] } });
  }
  // 敵将の一騎打ち
  const L = a.leader;
  const lu = L ? b.units.find((u) => u.uid === L.uid && !u.dead) : null;
  const o = L ? officerById(s, L.officerId) : null;
  // 宿敵の決着（二人だけの特別な場面）
  if (L && lu && o && o.kind !== 'monster' && !done('settle')) {
    const riv = mine.map((x) => ({ x, rv: rivalryOf(s, x.st.id, o.id) })).filter((v) => v.rv && !v.rv.settled && (v.rv.stage >= 2 || !!v.rv.vow) && v.x.u.hp > v.x.u.maxHp * 0.3).sort((p, c) => c.rv!.stage - p.rv!.stage || Number(!!c.rv!.vow) - Number(!!p.rv!.vow))[0];
    if (riv) {
      const T = SETTLE_TEXT;
      const st = riv.x.st;
      const pc = persuadeChance(s, o, st, riv.rv!.stage);
      const od = duelOdds(b, ctx, riv.x.u, lu);
      const lab = (p: number) => (p >= 0.62 ? '優勢' : p >= 0.4 ? '五分' : '苦しい');
      const v = { a: st.given, leader: L.name };
      const say0 = voice(fill(r.pick(SETTLE_LEADER[L.personality] ?? SETTLE_LEADER.proud), v), o);
      const opts: AutoChoiceOpt[] = [];
      if (L.personality !== 'beast') opts.push({ id: 'persuade', actor: st.id, label: fill(T.persuade, v), note: fill(T.persuadeNote, { chance: lab(pc) }) });
      if (weaponOf(riv.x.u)) opts.push({ id: `duel:${riv.x.u.uid}`, actor: st.id, label: T.duel, note: fill(T.duelNote, { ...v, chance: lab(od) }) });
      opts.push({ id: 'kill', label: T.kill, note: fill(T.killNote, v) });
      opts.push({ id: 'spare', label: T.spare, note: fill(T.spareNote, v) });
      const best = od >= 0.55 && weaponOf(riv.x.u) ? opts.findIndex((x) => x.id.startsWith('duel')) : pc >= 0.5 ? 0 : opts.findIndex((x) => x.id === 'kill');
      cands.push({ w: 12, c: { kind: 'settle', actor: st.id, duo: true, prompt: `${fill(T.prompt, v)}\n${L.name}「${say0}」`, recommended: Math.max(0, best), options: opts } });
    }
  }
  // 執着：敵将が負けた相手の子を狙っている
  const tu = L?.target ? b.units.find((u) => u.uid === L.target && !u.dead) : null;
  if (L && lu && tu?.studentId && !done('grudge') && s.students[tu.studentId]) {
    const T = GRUDGE_CHOICE;
    const v = { a: s.students[tu.studentId].given, leader: L.name };
    cands.push({ w: 6, c: { kind: 'grudge', actor: tu.studentId, prompt: fill(T.prompt, v), recommended: tu.hp < tu.maxHp * 0.6 ? 0 : 1, options: [
      { id: 'guard', label: fill(T.guard, v), note: fill(T.guardNote, v) },
      { id: 'face', label: fill(T.face, v), note: fill(T.faceNote, v), actor: tu.studentId },
      { id: 'bait', label: fill(T.bait, v), note: fill(T.baitNote, v) },
    ] } });
  }
  const duelP = !L ? 0 : o?.traits.includes('duel_bound') || a.duelOffer ? 1 : LEADER_DUEL[L.personality] + (L.personality === 'beast' ? 0 : headEffect(s, o?.faction ?? null).duel);
  if (L && lu && !done('duel') && !done('settle') && L.personality !== 'beast' && r.chance(duelP) && mine.length) {
    const T = CHOICE_TEXT.duel;
    const champs = mine.filter((x) => weaponOf(x.u) && x.u.hp > x.u.maxHp * 0.5).map((x) => ({ ...x, p: duelOdds(b, ctx, x.u, lu) })).sort((p, q) => q.p - p.p).slice(0, 2);
    if (champs.length) {
      const opts: AutoChoiceOpt[] = champs.map((x) => ({ id: `duel:${x.u.uid}`, actor: x.st.id, label: fill(T.accept, { a: x.st.given }), note: fill(T.acceptNote, { chance: x.p >= 0.62 ? '優勢' : x.p >= 0.4 ? '五分' : '苦しい' }) }));
      opts.push({ id: 'refuse', label: T.refuse, note: T.refuseNote });
      const line = leaderLine(s, b, r, 'duel');
      cands.push({ w: 5, c: { kind: 'duel', prompt: `${fill(T.prompt, { leader: L.name })}${line ? `\n「${line.text}」` : ''}`, recommended: champs[0].p >= 0.55 ? 0 : opts.length - 1, options: opts } });
    }
  }
  // 敵の卒業生
  const alum = b.units.find((u) => u.persuadable && !u.dead && u.studentId);
  if (alum && !done('persuade')) {
    const st = s.students[alum.studentId!];
    const T = CHOICE_TEXT.persuade;
    cands.push({ w: 7, c: { kind: 'persuade', actor: st.id, prompt: fill(T.prompt, { a: st.given }), recommended: 0, options: [
      { id: 'talk', label: T.talk, note: fill(T.talkNote, { trust: String(st.trust) }) },
      { id: 'fight', label: T.fight, note: T.fightNote },
    ] } });
  }
  // 押されている
  const m = momentum(b);
  if (m < 0.45 && !done('push')) {
    const T = CHOICE_TEXT.push;
    const best = [...mine].sort((p, q) => q.u.stats.skl - p.u.stats.skl)[0];
    const v = { a: best?.st.given ?? '' };
    const opts: AutoChoiceOpt[] = [
      { id: 'push', label: T.push, note: T.pushNote },
      { id: 'retreat', label: T.retreat, note: T.retreatNote },
    ];
    if (best) opts.push({ id: `aim:${best.u.uid}`, actor: best.st.id, label: fill(T.aim, v), note: T.aimNote });
    const strong = [...mine].filter((x) => weaponOf(x.u) && x.u !== best?.u).sort((p, q) => q.u.stats.str + q.u.stats.mag - p.u.stats.str - p.u.stats.mag)[0];
    if (strong) opts.push({ id: `again:${strong.u.uid}`, actor: strong.st.id, label: fill(T.again, { a: strong.st.given }), note: T.againNote });
    cands.push({ w: 6 + (0.45 - m) * 20, c: { kind: 'push', prompt: T.prompt, recommended: m < 0.3 ? 1 : 0, options: opts } });
  }
  // 伏兵の気配（どの戦いでも出せる予備の選択）
  if (!second && !done('route') && b.real !== undefined) {
    const T = CHOICE_TEXT.route;
    const best = [...mine].filter((x) => weaponOf(x.u)).sort((p, q) => q.u.stats.skl - p.u.stats.skl)[0];
    const v = { a: best?.st.given ?? '' };
    const opts: AutoChoiceOpt[] = [
      { id: 'detour', label: T.detour, note: T.detourNote },
      { id: 'frontal', label: T.frontal, note: T.frontalNote },
    ];
    if (best) opts.push({ id: `aim:${best.u.uid}`, actor: best.st.id, label: fill(T.aim, v), note: T.aimNote });
    cands.push({ w: 1.5, c: { kind: 'route', prompt: T.prompt, recommended: a.tactic === 'attack' || a.tactic === 'boss' ? 1 : 0, options: opts } });
  }
  b.rng = r.h.rng;
  // 手元の策（9夜目）：ここぞの判断で早めに切れる
  const held = (a.held ?? []).filter((id) => STRATS[id]);
  const q = s.quests.find((x) => x.id === b.questId) ?? ({ template: 'training', weather: b.weather, objective: b.objective } as Quest);
  const members = mine.map((x) => x.st);
  const plan = a.plan ?? {};
  const stratOpts: AutoChoiceOpt[] = held.slice(0, 2).map((id) => {
    const od = stratOdds(id, { q, planner: plan.planner ? s.students[plan.planner] : null, captain: plan.captain ? s.students[plan.captain] : null, members, traits: o?.traits ?? [], known: o?.knownTraits ?? [], early: true });
    return { id: `strat:${id}`, actor: plan.planner, label: `策「${STRATS[id].name}」を今切る`, note: `成功の見込み：${oddsLabel(od.rate)}（${od.rate}%）。切らなければ山場の前に切る` };
  });
  if (!cands.length) {
    if (!stratOpts.length) return null;
    return { kind: 'wait', prompt: '敵の陣が揺れている。手元の策を切る好機だ', recommended: 0, options: [...stratOpts, { id: 'wait', label: '様子を見る', note: '策は山場の前に切る' }] };
  }
  const c = r.weighted(cands, (x) => x.w).c;
  if (stratOpts.length && !c.duo) c.options.push(...stratOpts);
  return c;
}

/** 一騎打ちの勝ち目（期待値で） */
function duelOdds(b: BattleState, ctx: BattleCtx, u: Unit, e: Unit): number {
  const f = forecast(b, u, e, e.x, e.y + 1, ctx.support);
  const g = forecast(b, e, u, u.x, u.y, ctx.support);
  const mine = f.atk.dmg * f.atk.count * (f.atk.hit / 100) * (1 + f.atk.crit / 50) + 0.01;
  const his = g.atk.dmg * g.atk.count * (g.atk.hit / 100) * (1 + g.atk.crit / 50) + 0.01;
  const tMe = e.hp / mine, tHim = u.hp / his;
  return Math.max(0.05, Math.min(0.95, tHim / (tMe + tHim)));
}

/** 一騎打ち：交互に打ち合い、HPが尽きそうになった方が膝をつく（ここでは死なない） */
function duel(b: BattleState, ctx: BattleCtx, u: Unit, e: Unit): 'win' | 'lose' | 'draw' {
  const r = rngOf(b);
  const ox = u.x, oy = u.y;
  const swing = (a: Unit, d: Unit, ax: number, ay: number): boolean => {
    const f = forecast(b, a, d, ax, ay, ctx.support).atk;
    if (!f.canAttack) return false;
    for (let i = 0; i < f.count; i++) {
      if (((r.next() + r.next()) / 2) * 100 >= f.hit) continue;
      const crit = r.next() * 100 < f.crit;
      const dmg = crit ? f.dmg * B.battle.critMul : f.dmg;
      if (a.side === 'player') { a.hits++; a.dmgDealt += dmg; a.expGain += B.battle.exp.hit; }
      const hp0 = d.hp;
      const w = weaponOf(a);
      if (d.hp - dmg <= 0) { d.hp = 1; b.blog?.push({ k: 'atk', x: b.xseq ?? 0, a: a.uid, d: d.uid, w: w?.id ?? null, dmg: hp0 - 1, hit: true, crit, tri: f.triangle, eff: f.effective, role: 'duel', hp0, hp1: 1, max: d.maxHp, kill: false }); return true; }
      d.hp -= dmg;
      b.blog?.push({ k: 'atk', x: b.xseq ?? 0, a: a.uid, d: d.uid, w: w?.id ?? null, dmg, hit: true, crit, tri: f.triangle, eff: f.effective, role: 'duel', hp0, hp1: d.hp, max: d.maxHp, kill: false });
    }
    return false;
  };
  // 一騎打ちの間合い（敵将の隣）
  const ux = e.x, uy = Math.min(b.height - 1, e.y + 1);
  if (b.blog) b.xseq = (b.xseq ?? 0) + 1;
  let res: 'win' | 'lose' | 'draw' = 'draw';
  for (let i = 0; i < AUTO.duelRounds; i++) {
    if (swing(u, e, ux, uy)) { res = 'win'; break; }
    u.x = ux; u.y = uy;
    const lost = swing(e, u, e.x, e.y);
    u.x = ox; u.y = oy;
    if (lost) { res = 'lose'; break; }
  }
  const w = weaponOf(u);
  if (w) u.usedWeapon[w.id] = (u.usedWeapon[w.id] ?? 0) + AUTO.duelRounds;
  b.rng = r.h.rng;
  return res;
}

export function chooseAuto(s: GameState, idx: number, ctx: BattleCtx): void {
  const b = s.battle;
  const a = b?.auto;
  if (!b || !a || !a.choice) return;
  const c = a.choice;
  const o = c.options[Math.max(0, Math.min(c.options.length - 1, idx))];
  const r = rngOf(b);
  const lines: AutoLine[] = [];
  const faces: string[] = [];
  const actorSt = c.actor ? s.students[c.actor] : null;
  const actorU = actorSt ? b.units.find((u) => u.studentId === actorSt.id && u.side !== 'enemy') : null;
  const mine = deployed(s, b).filter((x) => !x.u.dead);
  const E = AUTO.ev;
  a.choicesMade.push({ kind: c.kind, id: o.id, label: o.label });
  if (o.id.startsWith('strat:')) {
    // 策を今切る（9夜目）：成功しやすくなる
    const q = s.quests.find((x) => x.id === b.questId) ?? ({ template: 'training', weather: b.weather, objective: b.objective } as Quest);
    for (const x of fireHeld(s, b, q, o.id.slice(6) as StratId, true)) lines.push({ by: x.ok ? 'strat' : 'stratng', text: `策「${STRATS[x.id].name}」：${x.text}` });
    if (c.actor && s.students[c.actor]) faces.push(c.actor);
  } else if (c.kind === 'wait') {
    lines.push({ by: 'narr', text: '策は山場の前に切ることにした。まずは様子を見る' });
  } else if (c.kind === 'help' && actorSt && actorU) {
    faces.push(actorSt.id);
    if (o.id === 'go') {
      const helper = mine.filter((x) => x.u !== actorU).sort((p, q) => supportValue(s, actorSt.id, q.st.id) - supportValue(s, actorSt.id, p.st.id) || dist(p.u, actorU) - dist(q.u, actorU))[0];
      actorU.hp = Math.min(actorU.maxHp, actorU.hp + Math.ceil(actorU.maxHp * AUTO.helpHealPct));
      a.careful.push(actorU.uid);
      for (const x of mine) addMod(x.u, AUTO.helpCostMod);
      if (helper) {
        lines.push({ by: 'narr', text: fill(pickText(s, r, CHOICE_RESULT.helpGo), { a: actorSt.given, b: helper.st.given }) });
        lines.push(say(s, r, 'helped', actorSt));
        a.effects.push({ kind: 'support', a: actorSt.id, b: helper.st.id, v: E.choiceSupport });
        faces.push(helper.st.id); spot(a, helper.st.id, 2);
      }
      a.effects.push({ kind: 'trust', id: actorSt.id, v: E.choiceTrust });
    } else if (o.id === 'plan') {
      for (const x of mine) if (x.u !== actorU) addMod(x.u, AUTO.planFirstMod);
      a.exposed.push(actorU.uid);
      lines.push({ by: 'narr', text: fill(pickText(s, r, CHOICE_RESULT.helpPlan), { a: actorSt.given }) });
      lines.push(say(s, r, 'hurt', actorSt));
      a.effects.push({ kind: 'trust', id: actorSt.id, v: -1 });
    } else {
      const ok = r.next() * 100 < commandRate(ctx, actorU);
      if (ok) { actorU.dead = true; b.retreated.push(actorU.uid); lines.push({ by: 'narr', text: fill(CHOICE_RESULT.orderOk[0], { a: actorSt.given }) }); lines.push(say(s, r, 'retreatOrder', actorSt)); a.effects.push({ kind: 'trust', id: actorSt.id, v: 1 }); checkEnd(b); }
      else { lines.push({ by: 'narr', text: fill(CHOICE_RESULT.orderNg[0], { a: actorSt.given }) }); lines.push(say(s, r, 'hurt', actorSt)); }
    }
  } else if (c.kind === 'push') {
    if (o.id === 'retreat') {
      lines.push({ by: 'narr', text: pickText(s, r, CHOICE_RESULT.retreat) });
      a.retreatedAll = true;
      finish(b, 'lose');
    } else if (o.id === 'push') {
      for (const x of mine) addMod(x.u, AUTO.pushMod);
      a.careful = [];
      lines.push({ by: 'narr', text: pickText(s, r, CHOICE_RESULT.push) });
      if (mine.length) lines.push(say(s, r, 'open', r.pick(mine).st));
    } else if (o.id.startsWith('again:')) againLines(s, b, r, ctx, o.id.slice(6), lines, faces);
    else aimLines(s, b, r, ctx, o.id.slice(4), lines, faces);
  } else if (c.kind === 'route') {
    if (o.id === 'detour') { for (const x of mine) addMod(x.u, AUTO.detourMod); lines.push({ by: 'narr', text: pickText(s, r, CHOICE_RESULT.detour) }); }
    else if (o.id === 'frontal') { for (const x of mine) addMod(x.u, AUTO.frontalMod); lines.push({ by: 'narr', text: pickText(s, r, CHOICE_RESULT.frontal) }); if (mine.length) lines.push(say(s, r, 'open', r.pick(mine).st)); }
    else aimLines(s, b, r, ctx, o.id.slice(4), lines, faces);
  } else if (c.kind === 'duel') {
    const L = a.leader!;
    const lu = b.units.find((u) => u.uid === L.uid)!;
    if (o.id === 'refuse') {
      lines.push({ by: 'narr', text: pickText(s, r, CHOICE_RESULT.duelRefuse) });
      addMod(lu, { hit: 5 });
    } else {
      const u = b.units.find((x) => x.uid === o.id.slice(5))!;
      const st = s.students[u.studentId!];
      faces.push(st.id);
      lines.push(say(s, r, 'duel', st));
      const res = duel(b, ctx, u, lu);
      const v = { a: st.given, leader: L.name };
      if (res === 'win') {
        lu.hp = 0; lu.dead = true; u.kills += 1; u.expGain += B.battle.exp.kill + 10;
        lines.push({ by: 'narr', text: fill(CHOICE_RESULT.duelWin[0], v) });
        lines.push(say(s, r, 'duelWin', st));
        // 敵の一部が逃げ出す
        const rest = b.units.filter((e) => e.side === 'enemy' && !e.dead && !e.persuadable);
        for (const e of rest.slice(0, Math.floor(rest.length * AUTO.duelRout))) { e.dead = true; b.retreated.push(e.uid); }
        spot(a, st.id, 4);
        a.events.push(`duelwin:${st.id}`);
        a.effects.push({ kind: 'trust', id: st.id, v: 2 }, { kind: 'motivation', id: st.id, v: 1 });
        checkEnd(b);
      } else if (res === 'lose') {
        lines.push({ by: 'narr', text: fill(CHOICE_RESULT.duelLose[0], v) });
        lines.push(say(s, r, 'duelLose', st));
        const l = leaderLine(s, b, r, 'duelWin'); if (l) lines.push(l);
        a.careful.push(u.uid);
        for (const x of mine) addMod(x.u, { hit: -3 });
        spot(a, st.id, 1);
      } else { lines.push({ by: 'narr', text: CHOICE_RESULT.duelDraw[0] }); spot(a, st.id, 2); }
    }
  } else if (c.kind === 'settle' && actorSt && a.leader) {
    settleChoice(s, b, r, ctx, o.id, actorSt, lines, faces);
  } else if (c.kind === 'grudge' && actorSt && actorU && a.leader) {
    const v = { a: actorSt.given, leader: a.leader.name };
    faces.push(actorSt.id);
    if (o.id === 'guard') { addMod(actorU, OFFICER.grudgeGuardMod); a.careful.push(actorU.uid); for (const x of mine) if (x.u !== actorU) addMod(x.u, { hit: -2 }); lines.push({ by: 'narr', text: fill(GRUDGE_RESULT.guard[0], v) }); }
    else if (o.id === 'face') { addMod(actorU, OFFICER.grudgeFaceMod); lines.push({ by: 'narr', text: fill(GRUDGE_RESULT.face[0], v) }); lines.push(say(s, r, 'duel', actorSt)); a.effects.push({ kind: 'motivation', id: actorSt.id, v: 1 }); spot(a, actorSt.id, 2); }
    else { for (const x of mine) if (x.u !== actorU) addMod(x.u, OFFICER.grudgeBaitMod); lines.push({ by: 'narr', text: fill(GRUDGE_RESULT.bait[0], v) }); spot(a, actorSt.id, 1); }
  } else if (c.kind === 'persuade' && actorSt) {
    const u = b.units.find((x) => x.studentId === actorSt.id && x.persuadable);
    faces.push(actorSt.id);
    if (o.id === 'talk' && u) {
      const v = { a: actorSt.given };
      const isLeader = a.leader?.uid === u.uid;
      if (actorSt.trust >= 80 && r.chance(0.6)) { u.side = 'ally'; u.persuadable = false; lines.push({ by: 'narr', text: fill(CHOICE_RESULT.persuadeAlly[0], v) }); if (isLeader) { a.leader!.settled = 'persuade'; lines.push({ by: 'leader', text: ALUMNI_LEADER.persuadeOk[0] }); } }
      else if (actorSt.trust >= 60) { u.dead = true; u.hp = 0; u.persuadable = false; b.retreated.push(u.uid); lines.push({ by: 'narr', text: fill(CHOICE_RESULT.persuadeLeave[0], v) }); if (isLeader) { a.leader!.settled = 'persuade'; lines.push({ by: 'leader', text: ALUMNI_LEADER.persuadeOk[0] }); } }
      else { lines.push({ by: 'narr', text: fill(CHOICE_RESULT.persuadeFail[0], v) }); if (isLeader) lines.push({ by: 'leader', text: ALUMNI_LEADER.persuadeNg[0] }); }
      checkEnd(b);
    } else lines.push({ by: 'narr', text: CHOICE_RESULT.fight[0] });
  }
  a.choice = null;
  // 選択の結果も1つの場面として見せる（宿敵の決着は二人だけの特別な場面）
  const sc = sceneOf(b, c.kind === 'settle' ? SETTLE_TEXT.title : '指示', lines, faces);
  if (c.kind === 'settle') { sc.duo = c.actor; sc.lines = lines.filter((l) => l.text).slice(0, 6); }
  a.scenes.push(sc);
  b.rng = r.h.rng;
  // 16夜目：札の戦いは、判断のあと予告を作り直して、次のターンへ
  if (a.cards) { afterChoice(s, b); if (b.phase === 'done') cardsFinish(s, b); return; }
  // 選択の効果が巻き戻しで消えないよう、今のターンの記録を取り直す
  if (b.snapshots.length) b.snapshots[b.snapshots.length - 1] = JSON.stringify({ ...b, snapshots: [] });
  advanceAuto(s, ctx);
}

/** 指示「もう一度動け」：その子がすぐにもう一度攻撃する（このターンの行動は別に残る） */
function againLines(s: GameState, b: BattleState, r: Rng, ctx: BattleCtx, uid: string, lines: AutoLine[], faces: string[]) {
  const u = b.units.find((x) => x.uid === uid);
  const st = u?.studentId ? s.students[u.studentId] : null;
  if (!u || !st) return;
  faces.push(st.id);
  b.rng = r.h.rng;
  const ok = r.next() * 100 < commandRate(ctx, u);
  if (!ok) { lines.push({ by: 'narr', text: fill(CHOICE_RESULT.againNg[0], { a: st.given }) }); return; }
  const kills = u.kills;
  b.rng = r.h.rng;
  u.acted = false; u.moved = false;
  const ox = u.x, oy = u.y;
  enemyAct(b, autoCtx(ctx, b), u, true);
  const acted = u.acted;
  u.acted = false; u.moved = false;
  r.h.rng = b.rng;
  lines.push({ by: 'narr', text: fill(pickText(s, r, acted ? CHOICE_RESULT.againOk : CHOICE_RESULT.againMiss), { a: st.given }) });
  if (u.kills > kills) lines.push(say(s, r, 'kill', st));
  if (!acted) { u.x = ox; u.y = oy; }
  spot(b.auto!, st.id, 1);
  checkEnd(b);
}

function aimLines(s: GameState, b: BattleState, r: Rng, ctx: BattleCtx, uid: string, lines: AutoLine[], faces: string[]) {
  const u = b.units.find((x) => x.uid === uid);
  const st = u?.studentId ? s.students[u.studentId] : null;
  if (!u || !st) return;
  faces.push(st.id);
  const ok = r.next() * 100 < commandRate(ctx, u);
  if (ok) { addMod(u, { hit: B.battle.aimHit, crit: 5 }); lines.push({ by: 'narr', text: fill(CHOICE_RESULT.aimOk[0], { a: st.given }) }); spot(b.auto!, st.id, 1); }
  else lines.push({ by: 'narr', text: fill(CHOICE_RESULT.aimNg[0], { a: st.given }) });
}

/** 倒れた敵将が、深手を負いながら逃げのびる（名簿の敵将。決着の「討ち取る」・一騎打ちのあとは逃げられない） */
export function leaderEscape(s: GameState, b: BattleState): void {
  const L = leaderOf(b);
  if (!L || L.fled || L.settled || L.noFlee) return;
  const lu = b.units.find((u) => u.uid === L.uid);
  const o = officerById(s, L.officerId);
  if (!lu || !o || !lu.dead || b.retreated.includes(lu.uid) || !b.real) return;
  const r = rngOf(b);
  if (survives(o, b.objective, r)) { L.fled = true; b.retreated.push(lu.uid); }
}
/** 逃げる確率：性格・特徴（逃げ足が速い／仲間を見捨てない）・陣営の頭・方針「速攻で敵将を」 */
function fleeChance(s: GameState, b: BattleState, L: LeaderInfo): number {
  const o = officerById(s, L.officerId);
  let p = LEADER_FLEE[L.personality] * 0.5;
  if (o) {
    for (const t of o.traits) { const f = OFFICER_TRAITS[t]?.flee; if (f !== undefined) p *= f; }
    p += headEffect(s, o.faction).flee * 0.5;
    if (o.traits.includes('cautious') && b.auto?.tactic === 'boss') p = 0;
  }
  return Math.max(0, Math.min(0.9, p));
}
/** 宿敵を説き伏せられる見込み */
export function persuadeChance(s: GameState, o: { personality: string; alumniId?: string }, st: Student, stage: number): number {
  let p = (OFFICER.persuadeBase[o.personality as LeaderPersonality] ?? 0.2) + stage * OFFICER.persuadePerStage;
  if (o.alumniId) { const al = s.students[o.alumniId]; if (al) p += al.trust / 200; }
  p += (st.stats.cha ?? 0) / 100;
  return Math.max(0.05, Math.min(0.9, p));
}
/** 宿敵の決着の選択 */
function settleChoice(s: GameState, b: BattleState, r: Rng, ctx: BattleCtx, id: string, st: Student, lines: AutoLine[], faces: string[]) {
  const a = b.auto!;
  const L = a.leader!;
  const lu = b.units.find((u) => u.uid === L.uid)!;
  const su = b.units.find((u) => u.studentId === st.id && u.side === 'player');
  const o = officerById(s, L.officerId);
  const v = { a: st.given, leader: L.name };
  const mine = deployed(s, b).filter((x) => !x.u.dead);
  faces.push(st.id);
  lines.push({ by: 'narr', text: fill(r.pick(SETTLE_TEXT.narr), v) });
  lines.push({ by: L.personality === 'beast' ? 'narr' : 'leader', text: voice(fill(r.pick(SETTLE_LEADER[L.personality] ?? SETTLE_LEADER.proud), v), o) });
  L.settleBy = st.id;
  const rout = () => { const rest = b.units.filter((e) => e.side === 'enemy' && !e.dead && !e.persuadable); for (const e of rest.slice(0, Math.floor(rest.length * AUTO.duelRout))) { e.dead = true; b.retreated.push(e.uid); } };
  if (id === 'persuade') {
    const rv = o ? rivalryOf(s, st.id, o.id) : null;
    const ok = r.next() < persuadeChance(s, o ?? { personality: L.personality }, st, rv?.stage ?? 2);
    lines.push(say(s, r, 'helped', st));
    if (ok) {
      lines.push({ by: 'narr', text: fill(r.pick(SETTLE_RESULT.persuadeOk), v) });
      if (o?.alumniId) lines.push({ by: 'leader', text: ALUMNI_LEADER.persuadeOk[0] });
      lu.dead = true; lu.persuadable = false; b.retreated.push(lu.uid); L.settled = 'persuade';
      lines.push({ by: st.id, text: r.pick(SETTLE_SAY.persuade) });
      rout(); spot(a, st.id, 4);
      a.effects.push({ kind: 'trust', id: st.id, v: 3 }, { kind: 'motivation', id: st.id, v: 1 });
      checkEnd(b);
    } else { lines.push({ by: 'narr', text: fill(SETTLE_RESULT.persuadeNg[0], v) }); addMod(lu, { hit: 5 }); spot(a, st.id, 1); }
  } else if (id.startsWith('duel:') && su) {
    const res = duel(b, ctx, su, lu);
    if (res === 'win') {
      lines.push({ by: 'narr', text: fill(SETTLE_RESULT.duelWin[0], v) });
      lines.push({ by: st.id, text: r.pick(SETTLE_SAY.duel) });
      lu.dead = true; b.retreated.push(lu.uid); L.settled = 'duel'; L.duelWon = true; su.expGain += B.battle.exp.kill + 10; su.kills += 1;
      rout(); spot(a, st.id, 5);
      a.effects.push({ kind: 'trust', id: st.id, v: 2 }, { kind: 'motivation', id: st.id, v: 1 });
      checkEnd(b);
    } else if (res === 'lose') {
      lines.push({ by: 'narr', text: fill(SETTLE_RESULT.duelLose[0], v) });
      a.careful.push(su.uid); spot(a, st.id, 1);
    } else { lines.push({ by: 'narr', text: SETTLE_RESULT.duelDraw[0] }); spot(a, st.id, 2); }
  } else if (id === 'kill') {
    lines.push({ by: 'narr', text: fill(SETTLE_RESULT.kill[0], v) });
    b.focus = lu.uid; L.noFlee = true; L.settled = 'kill';
    for (const x of mine) addMod(x.u, OFFICER.killMod);
    if (su) addMod(su, OFFICER.killSelfMod);
    spot(a, st.id, 2);
  } else {
    lines.push({ by: 'narr', text: fill(SETTLE_RESULT.spare[0], v) });
    lines.push({ by: st.id, text: r.pick(SETTLE_SAY.spare) });
    lu.dead = true; b.retreated.push(lu.uid); L.settled = 'spare';
    a.effects.push({ kind: 'trust', id: st.id, v: 2 });
    spot(a, st.id, 3);
    checkEnd(b);
  }
  void mine;
}

// ---------- 進め方 ----------
/** 自動の戦闘を始める（開戦の場面まで作って止まる） */
export function startAutoBattle(s: GameState, q: Quest, deploys: Deploy[], plan: AutoPlan, ctx: BattleCtx, seed = questSeed(s, q)): void {
  const b = buildBattle(s, q, deploys, plan, seed);
  startPlayerPhase(b);
  s.battle = b;
  const mem = (s.autoMemory ??= { lines: [], events: [] });
  mem.n = ((mem.n ?? 0) + 1) % 100000;
  b.auto!.scenes.push(openingScene(s, b, q));
  if (b.auto!.cards) return; // 16夜目：札の戦いは、ここから札を選ぶ
  // 開戦の場面が巻き戻しで消えないよう、最初のターンの記録を取り直す
  if (b.snapshots.length) b.snapshots[b.snapshots.length - 1] = JSON.stringify({ ...b, snapshots: [] });
  advanceAuto(s, ctx);
}

/**
 * 16夜目：札を出して1ターン進める。結果の文は cards.turns に、目立った兵・戦利品・決着の場面もつなぐ。
 * 2ターン目と4ターン目のあとに、ここぞの判断（宿命の対決・一騎打ち・説得・執着）が出ることがある
 */
export function playCardTurn(s: GameState, ids: string[], target: string | undefined, ctx: BattleCtx): void {
  const b = s.battle;
  const a = b?.auto;
  const cs = a?.cards;
  if (!b || !a || !cs || cs.phase === 'done' || a.choice) return;
  const q = s.quests.find((x) => x.id === b.questId) ?? ({ kind: 'drill', objective: b.objective, template: 'training', weather: b.weather } as Quest);
  cs.target = target;
  const rec = resolveTurn(s, b, autoCtx(ctx, b), ids, { level: s.settings.battleProse ?? 'dense', deathMul: B.cards.deathMul });
  if (cs.guide) guideAfterPlay(b); // 17夜目：案内の1ターン目が終わった
  const r = rngOf(b);
  // 10夜目：勇士型の敵将が倒れると、兵が崩れる
  {
    const Lc = a.leader; const luc = Lc ? b.units.find((u) => u.uid === Lc.uid) : null; const oc = officerById(s, Lc?.officerId);
    const col = OFFICER_TRAITS.valor.collapse!;
    if (Lc && luc?.dead && !Lc.fled && oc?.traits.includes('valor') && !a.collapsed && b.phase !== 'done') {
      a.collapsed = true;
      for (const e of b.units) if (e.side === 'enemy' && !e.dead) addMod(e, { hit: col.hit, avo: col.avo });
      rec.lines.push({ cls: 'strat', text: `${Lc.name}が倒れ、敵の兵が崩れ出した！` });
    }
  }
  // 戦いの最中の出来事（伸び盛り・負けん気・芽の兆し・恋人・好敵手・息の合った連携など）：1ターン目と3ターン目のあと
  b.rng = r.h.rng;
  if ((rec.turn === 1 || rec.turn === 3) && b.phase !== 'done') {
    for (const l of takeEvent(s, b, r, 'mid')) {
      const st = s.students[l.by];
      rec.lines.push(st ? { cls: 'say', text: `${st.given}「${l.text}」`, a: b.units.find((u) => u.studentId === st.id)?.uid } : { cls: 'event', text: l.text });
    }
  }
  // 戦いで目立った一般兵が名を得る
  for (const l of raiseGrunts(s, b, r, q, false)) rec.lines.push({ cls: 'raise', text: l.text });
  b.feed = (b.feed ?? []).filter((f) => f.t === 'heal');
  b.rng = r.h.rng;
  if (b.phase === 'done') { cardsFinish(s, b); return; }
  // ここぞの判断（ターン2・4のあと）
  const done = rec.turn;
  if ((done === 2 || done === 4) && a.choicesMade.length < (q.tutorial ? 1 : 2)) {
    const second = a.choicesMade.length > 0;
    if (!second || fx(s, 'judgments') > 0 || r.chance(AUTO.secondChoice)) {
      b.rng = r.h.rng;
      const c = makeChoice(s, b, ctx, second);
      if (c && ['settle', 'duel', 'persuade', 'grudge'].includes(c.kind)) { c.options = c.options.filter((o) => !o.id.startsWith('strat:')); a.choice = c; }
    }
  }
}
/** 札の戦いの決着：決着の場面（敵将の最期・口上・戦利品・名を得た兵） */
function cardsFinish(s: GameState, b: BattleState): void {
  const a = b.auto!;
  if (a.seg >= 3) return;
  a.seg = 3;
  if (a.cards) a.cards.phase = 'done';
  a.scenes.push(endScene(s, b));
}
/** 札の戦いを、おまかせで最後まで（小さな依頼・同行しない部隊・シミュレーション・「結果へ」） */
export function skipCards(s: GameState, ctx: BattleCtx, pick?: (c: AutoChoice) => number, policy: CardPolicy = cardPolicy, markShown = true): void {
  let guard = 0;
  while (s.battle?.auto?.cards && s.battle.auto.seg < 3 && guard++ < 30) {
    const b = s.battle;
    const a = b.auto!;
    if (a.choice) { chooseAuto(s, pick ? pick(a.choice) : a.choice.recommended, ctx); continue; }
    if (b.phase === 'done') { cardsFinish(s, b); break; }
    const p = autoPick(s, b, ctx, policy);
    playCardTurn(s, p.ids, p.target, ctx);
  }
  if (s.battle?.auto && markShown) s.battle.auto.shown = s.battle.auto.scenes.length;
}
export type { CLine };

/** 次の区切りまで戦闘を進め、場面と選択を作る（選択が出たら止まる） */
export function advanceAuto(s: GameState, ctx: BattleCtx): void {
  let b = s.battle;
  if (!b?.auto || b.auto.cards) return;
  const q = s.quests.find((x) => x.id === b!.questId) ?? ({ kind: 'drill', objective: b.objective, template: 'training', weather: b.weather } as Quest);
  let guard = 0;
  while (b.auto && !b.auto.choice && b.auto.seg < 3 && guard++ < 6) {
    const a: AutoState = b.auto;
    if (b.phase === 'done') {
      a.seg = 3;
      leaderEscape(s, b);
      a.scenes.push(endScene(s, b));
      break;
    }
    if (a.seg >= 1 && (a.held ?? []).length) fireHeld(s, b, q);
    const until = a.seg === 0 ? AUTO.segmentTurns[0] : a.seg === 1 ? AUTO.segmentTurns[1] : 99;
    b = runUntil(b, ctx, until);
    s.battle = b;
    const a2 = b.auto!;
    a2.exposed = [];
    // 10夜目：勇士型の敵将が倒れると、兵が崩れる
    {
      const Lc = a2.leader; const luc = Lc ? b.units.find((u) => u.uid === Lc.uid) : null; const oc = officerById(s, Lc?.officerId);
      const col = OFFICER_TRAITS.valor.collapse!;
      if (Lc && luc?.dead && !Lc.fled && oc?.traits.includes('valor') && !a2.collapsed && b.phase !== 'done') {
        a2.collapsed = true;
        for (const e of b.units) if (e.side === 'enemy' && !e.dead) addMod(e, { hit: col.hit, avo: col.avo });
        a2.scenes.push(sceneOf(b, '策', [{ by: 'strat', text: `${Lc.name}が倒れ、敵の兵が崩れ出した！` }], [], false));
      }
    }
    if (b.phase !== 'done' && b.turn > b.maxTurns) finish(b, 'lose');
    if (b.phase === 'done' || a2.seg === 2) {
      leaderEscape(s, b);
      // 早く決着しても「ぶつかり合い」は見せる（場面は3つ以上）
      if (a2.seg === 0 && (b.feed ?? []).length) a2.scenes.push(midScene(s, b, 'ぶつかり合い', q));
      a2.seg = 3;
      a2.scenes.push(endScene(s, b));
      break;
    }
    a2.scenes.push(midScene(s, b, a2.seg === 0 ? 'ぶつかり合い' : '山場', q));
    a2.seg += 1;
    // 敵将が逃げる（山場で追いつめたとき）
    const L = a2.leader;
    const lu = L ? b.units.find((u) => u.uid === L.uid && !u.dead) : null;
    const r = rngOf(b);
    if (a2.seg === 2 && L && lu && !L.noFlee && !L.settled && momentum(b) >= 0.65 && b.real && r.chance(fleeChance(s, b, L))) {
      lu.dead = true; b.retreated.push(lu.uid); L.fled = true;
      checkEnd(b);
    }
    const second = a2.choicesMade.length > 0;
    // 14夜目：最初の依頼は、ここぞの判断は1回だけ
    if ((b.phase as string) !== 'done' && (!second || fx(s, 'judgments') > 0 || r.chance(AUTO.secondChoice)) && a2.choicesMade.length < (q.tutorial ? 1 : 2)) {
      b.rng = r.h.rng;
      a2.choice = makeChoice(s, b, ctx, second);
    } else b.rng = r.h.rng;
  }
}

/** 手元に残した策を切る（ぶつかり合いのあと）。帯だけの場面にする */
function fireHeld(s: GameState, b: BattleState, q: Quest, only?: StratId, early = false): StratRec[] {
  const a = b.auto!;
  const o = officerById(s, a.leader?.officerId);
  const out: StratRec[] = [];
  for (const id of [...(a.held ?? [])]) {
    if (only && id !== only) continue;
    const rec = fireStrat(s, b, q, id, o, early);
    if (rec) out.push(rec);
  }
  if (out.length && !only) {
    const sc = sceneOf(b, '策', out.map((x) => ({ by: x.ok ? 'strat' : 'stratng', text: `策「${STRATS[x.id].name}」：${x.text}` })), [], false);
    a.scenes.push(sc);
    if (b.snapshots.length) b.snapshots[b.snapshots.length - 1] = JSON.stringify({ ...b, snapshots: [] });
  }
  return out;
}

/** 「結果だけ見る」：残りの選択はおすすめのものを選んで最後まで */
export function skipAuto(s: GameState, ctx: BattleCtx, pick?: (c: AutoChoice) => number): void {
  if (s.battle?.auto?.cards) { skipCards(s, ctx, pick); return; }
  let guard = 0;
  while (s.battle?.auto && s.battle.auto.seg < 3 && guard++ < 10) {
    const c = s.battle.auto.choice;
    if (c) chooseAuto(s, pick ? pick(c) : c.recommended, ctx);
    else advanceAuto(s, ctx);
  }
  if (s.battle?.auto) s.battle.auto.shown = s.battle.auto.scenes.length;
}

// ---------- 結果 ----------
/** MVP：活躍（倒した数・与えたダメージ・場面に出た回数）がいちばんの子 */
export function mvpOf(s: GameState, b: BattleState): string | null {
  const a = b.auto;
  let best: { id: string; v: number } | null = null;
  for (const u of b.units) {
    if (u.side !== 'player' || !u.studentId || s.students[u.studentId]?.status !== 'enrolled') continue;
    if (b.fallen.some((f) => f.studentId === u.studentId && f.outcome === 'dead')) continue;
    const v = u.kills * 3 + u.hits + u.dmgDealt / 12 + (a?.spot[u.studentId] ?? 0) * 1.5 + (b.feed ?? []).filter((f) => f.t === 'heal' && f.a === u.uid).length;
    if (!best || v > best.v) best = { id: u.studentId, v };
  }
  return best?.id ?? null;
}

/** 戦闘のあと：出来事・選択の効果、因縁の敵将、講評（finishBattle から呼ぶ） */
export function applyAutoResults(s: GameState, b: BattleState, r: Rng, lines: string[], helpers: {
  addSupport: (a: string, c: string, v: number) => void; reveal: (st: Student, v: number) => void; motivation: (st: Student, d: number) => void;
}): { mvp: string | null; review: string[]; stratReview: string[] } {
  const a = b.auto;
  if (!a) return { mvp: null, review: [], stratReview: [] };
  const q = s.quests.find((x) => x.id === b.questId);
  for (const e of a.effects) {
    if (e.kind === 'support') { if (s.students[e.a]?.status === 'enrolled' && s.students[e.b]?.status === 'enrolled') helpers.addSupport(e.a, e.b, e.v); continue; }
    const st = s.students[e.id];
    if (!st || st.status !== 'enrolled') continue;
    if (e.kind === 'trust') st.trust = Math.max(0, Math.min(B.trust.max, st.trust + e.v));
    if (e.kind === 'motivation') helpers.motivation(st, e.v);
    if (e.kind === 'reveal') { helpers.reveal(st, e.v); lines.push(`戦場で${st.given}の隠れた才能が目を覚ました`); }
    if (e.kind === 'trait' && !st.knownTraits.includes(e.trait)) { st.knownTraits.push(e.trait); lines.push(`${st.given}の特徴「${traitName(e.trait)}」が分かった`); }
  }
  // 演武会：場面で目立った子は点が上がる
  if (q?.kind === 'exhibition') for (const [id, v] of Object.entries(a.spot)) { const st = s.students[id]; if (st?.status === 'enrolled') st.exhibitionScore += v * AUTO.exhibitionBonus; }
  const mvp = mvpOf(s, b);
  if (mvp) { const st = s.students[mvp]; st.history.push({ year: s.year, text: `「${b.title}」でMVP` }); }
  // 講評
  const review: string[] = [];
  const pk = (l: string[]) => r.pick(l);
  if (q) { if (tacticFits(a.tactic, q)) review.push(pk(REVIEW_TEXT.fitGood)); else if (TACTICS[a.tactic].fits.length && !tacticFits(a.tactic, q)) review.push(pk(REVIEW_TEXT.fitBad)); }
  const dep = deployed(s, b);
  if (dep.some((x) => roleFit(x.u.classId, a.roles[x.st.id] ?? defaultRole(x.u.classId, x.st)) === 0)) review.push(REVIEW_TEXT.roleBad[0]);
  const intel = enemyIntel(s, { ...b, units: b.units.map((u) => ({ ...u, dead: false })) });
  if (intel.matchup >= 0.8) review.push(pk(REVIEW_TEXT.triangleGood)); else if (intel.matchup <= -0.8) review.push(pk(REVIEW_TEXT.triangleBad));
  if (a.events.some((x) => x.startsWith('combo') || x.startsWith('lovers'))) review.push(REVIEW_TEXT.support[0]);
  if (dep.some((x) => x.st.motivation <= 0)) review.push(REVIEW_TEXT.lowMotivation[0]);
  return { mvp, review: review.slice(0, 3), stratReview: stratReview(a.strats ?? []) };
}

function traitName(t: string): string { return TRAITS[t]?.name ?? t; }

/** 戦いのあと：敵将の記録（名簿の敵将は記憶・昇進・二つ名・傷・宿敵、名もない敵将は逃げたら因縁として残す）。手動の戦闘でも呼ぶ */
export function officerAfterBattle(s: GameState, b: BattleState, r: Rng, lines: string[]): BattleFinding[] {
  const L = leaderOf(b);
  const q = s.quests.find((x) => x.id === b.questId);
  // 戦いで名を得た一般兵を「見込みのある兵」に（9夜目）
  const raisedOut: BattleFinding[] = [];
  const f = q ? factionOfQuest(q) : null;
  if (q?.real && f && f !== 'monster') for (const g of b.auto?.raised ?? []) {
    const o = addProspect(s, f, g, b.title);
    const t = `${FACTION_NAMES[f]}の一兵卒「${officerName(o)}」が見込みのある兵として名を上げた（${g.deed}）`;
    lines.push(t); raisedOut.push({ id: g.victim, icon: 'skull', text: t });
  }
  if (!L || !q?.real) return raisedOut;
  return [...raisedOut, ...officerAfterBattleMain(s, b, r, lines, L, q)];
}
function officerAfterBattleMain(s: GameState, b: BattleState, r: Rng, lines: string[], L: LeaderInfo, q: Quest): BattleFinding[] {
  if (!b.auto) leaderEscape(s, b);
  const lu = b.units.find((u) => u.uid === L.uid);
  if (!lu) return [];
  const fell = !!lu.dead && !L.fled && !b.retreated.includes(lu.uid);
  let o = officerById(s, L.officerId ?? L.nemesisId);
  if (!o) {
    // 名もない敵将・魔物の頭：取り逃がしたら因縁の敵将として残す（5夜目と同じ。小さな依頼の名もない敵将は残さない）
    if (fell || q.small) return [];
    const kind = leaderKind(q);
    const faction = kind === 'monster' ? 'monster' : kind === 'bandit' ? 'bandit' : (q.enemyCountry ?? 'kingdom');
    let given = L.name, family = '';
    if (kind === 'army' && L.name.includes('・')) [given, family] = L.name.split('・');
    o = { id: `of${s.nextId++}`, given, family, faction, kind, country: q.enemyCountry, rank: 2, gender: 'm', age: 35, personality: L.personality, face: L.face, faceImage: null, classId: lu.classId, level: lu.level, scars: 0, traits: [], knownTraits: [], meets: [], status: 'active', grudge: null, victims: [], joined: s.year, title: kind === 'monster' ? L.name : undefined };
    (s.officers ??= []).push(o);
    L.officerId = o.id;
    chronicle(s, `「${b.title}」で敵将${L.name}を取り逃がした`, 'school');
  }
  const had = o.meets.length;
  if (o.kind === 'monster') {
    o.meets.push({ year: s.year, month: s.month, title: b.title, result: fell ? 'fell' : b.result === 'win' ? 'fled' : 'lose' });
    o.level = lu.level;
    if (fell) { o.status = 'dead'; o.endYear = s.year; if (had) { lines.push(fill(RESULT_TEXT.nemesisEnd[0], { leader: L.name })); chronicle(s, `因縁の敵将「${L.name}」を討ち取った`, 'school'); } }
    else { o.scars = Math.min(4, o.scars + 1); lines.push(fill(RESULT_TEXT.nemesisNew[0], { leader: L.name })); if (o.meets.length >= AUTO.nemesisMax) o.status = 'defeated'; }
    return [];
  }
  const out = afterOfficerBattle(s, b, o, L, r, lines);
  // 策「物見」：特徴が1つ分かる（9夜目）
  if (b.auto?.reveal && (o.status === 'active' || o.status === 'dead')) {
    const id = revealOne(o, r);
    if (id) out.push({ icon: 'scout', text: `物見の報告：${officerName(o)}の特徴「${OFFICER_TRAITS[id].name}」が分かった` });
  }
  if (fell && had) lines.push(fill(RESULT_TEXT.nemesisEnd[0], { leader: L.name }));
  else if (!fell && o.status === 'active' && (b.result === 'win' || L.fled)) lines.push(fill(RESULT_TEXT.nemesisNew[0], { leader: officerName(o) }));
  return out;
}

export type { FeedEntry };
