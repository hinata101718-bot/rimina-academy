// 自動の戦闘（5夜目）：今の戦闘の計算を裏で手早く回し、その記録から場面と出来事を拾う。
// 出撃前の作戦の方針・役割、ここぞの選択（1〜2回）、敵将の口上と因縁、結果の講評。
import { B } from '../../data/balance';
import { AUTO, TACTICS, TACTIC_OPTIONS, ROLES, LEADER_DUEL, LEADER_FLEE, BANDIT_EPITHETS, MONSTER_LEADERS, type TacticId, type RoleId, type UnitMod, type LeaderPersonality } from '../../data/autobattle';
import { OPEN_KIND, MAP_TEXT, WEATHER_TEXT, MATCHUP_TEXT, CLASH_TEXT, CLIMAX_TEXT, END_TEXT, SAY, EVENT_TEXT, LEADER_TEXT, CHOICE_TEXT, CHOICE_RESULT, RESULT_TEXT, REVIEW_TEXT } from '../../data/autobattle_text';
import { CLASSES } from '../../data/classes';
import { WEAPONS } from '../../data/weapons';
import { NAMES } from '../../data/names';
import { COUNTRY_SHORT, TRAITS } from '../../data/people';
import type { GameState, Quest, Student, FaceParts, Nemesis } from '../state';
import type { BattleState, Unit, FeedEntry } from './types';
import type { PersonalityId } from '../types';
import { Rng } from '../rng';
import { createBattle, enemyUnit, type Deploy } from './setup';
import { autoPlayerPhase, endPlayerPhase, startPlayerPhase, rewind, canRewind, commandRate, finish, checkEnd, enemyAct, type BattleCtx } from './engine';
import { forecast, weaponOf, staffOf, dist } from './calc';
import { generateFace } from '../student';
import { getSupport, supportValue } from '../support';
import { enrolled, available, chronicle } from '../game';

// ---------- 型 ----------
export interface AutoLine { by: string; text: string }
export interface AutoScene { title: string; lines: AutoLine[]; faces: string[]; momentum: number; hurt: string[]; down: string[] }
export interface AutoChoiceOpt { id: string; label: string; note: string; actor?: string }
export interface AutoChoice { kind: 'help' | 'push' | 'duel' | 'persuade' | 'route'; prompt: string; actor?: string; options: AutoChoiceOpt[]; recommended: number }
export interface LeaderInfo { uid: string; name: string; personality: LeaderPersonality; face: FaceParts; classId: string; nemesisId?: string; again: boolean; fled?: boolean }
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
}

export interface AutoPlan { tactic: TacticId; roles: Record<string, RoleId> }

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
  return { tactic: TACTIC_OPTIONS[q.objective][0], roles };
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
      if (st.fatigue >= AUTO.fatigueFrom) addMod(u, AUTO.fatigueMod);
    }
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
function leaderKind(q: Quest): Nemesis['kind'] { return q.kind === 'monster' ? 'monster' : q.enemyCountry ? 'army' : 'bandit'; }
function makeLeader(s: GameState, q: Quest, b: BattleState, r: Rng): void {
  if (!b.auto || q.kind === 'drill' || q.kind === 'exhibition') return;
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.persuadable);
  if (!enemies.length) return;
  let u = enemies.find((e) => e.boss) ?? [...enemies].sort((a, c) => c.level - a.level)[0];
  const kind = leaderKind(q);
  // 因縁の敵将の再登場
  const nem = (s.nemeses ?? []).filter((n) => n.status === 'active' && n.kind === kind && (kind !== 'army' || n.country === q.enemyCountry));
  let again: Nemesis | null = null;
  if (q.real && nem.length && r.chance(AUTO.nemesisChance)) again = r.pick(nem);
  let name: string; let pers: LeaderPersonality; let face: FaceParts;
  if (again) {
    name = again.name; pers = again.personality as LeaderPersonality; face = again.face;
    const lv = Math.max(u.level, again.level + AUTO.nemesisLevelUp);
    const nu = enemyUnit(r, u.uid, again.classId, lv, u.x, u.y, s.world.gunUnlocked, true);
    nu.ai = u.ai; nu.boss = u.boss || true;
    b.units = b.units.map((x) => (x === u ? nu : x));
    u = nu;
  } else if (kind === 'monster') {
    name = r.pick(MONSTER_LEADERS); pers = 'beast'; face = generateFace(r, 'frontier', 'm');
  } else {
    const origin = q.enemyCountry ?? 'frontier';
    const g = r.chance(0.3) ? 'f' : 'm';
    const nl = NAMES[origin];
    // 生徒・卒業生と同じ名前は避ける
    const taken = new Set(Object.values(s.students).map((x) => x.given));
    let given = r.pick(g === 'f' ? nl.female : nl.male);
    for (let k = 0; k < 8 && taken.has(given); k++) given = r.pick(g === 'f' ? nl.female : nl.male);
    name = kind === 'bandit' ? `${r.pick(BANDIT_EPITHETS)}${given}` : `${given}・${r.pick(nl.family)}`;
    pers = r.pick(kind === 'bandit' ? ['arrogant', 'cunning', 'young', 'veteran'] as const : ['arrogant', 'veteran', 'cunning', 'proud', 'young', 'cold'] as const);
    face = generateFace(r, origin, g);
  }
  u.name = name;
  b.auto.leader = { uid: u.uid, name, personality: pers, face, classId: u.classId, nemesisId: again?.id, again: !!again };
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
  const r = rngOf(b);
  makeLeader(s, q, b, r);
  applyPlan(s, b, q, plan);
  if (TACTICS[plan.tactic].focusBoss && b.auto.leader) b.focus = b.auto.leader.uid;
  b.auto.startHp = {
    ally: b.units.filter((u) => u.side === 'player').reduce((a, u) => a + u.maxHp, 0) || 1,
    enemy: b.units.filter((u) => u.side === 'enemy').reduce((a, u) => a + u.maxHp, 0) || 1,
  };
  return b;
}

/** 自動の戦闘の計算に使う ctx（作戦の「重傷で済む」補正を足す） */
function autoCtx(base: BattleCtx, b: BattleState): BattleCtx {
  const inj = TACTICS[b.auto?.tactic ?? 'careful'].injury;
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
export function recommendDeploy(s: GameState, q: Quest, limit: number, base: (ids: string[]) => Deploy[]): Deploy[] {
  const list = enrolled(s).filter(available);
  const pool = q.kind ? (q.kind === 'monster' ? ['axe'] : q.enemyCountry ? ['lance', 'sword', 'axe'] : ['axe', 'sword']) : [];
  const score = (st: Student) => {
    const c = CLASSES[st.classId] ?? CLASSES.novice;
    let v = st.level * 3 + (st.motivation - 2) * 2 - (st.fatigue >= AUTO.fatigueFrom ? 4 : 0);
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

function sceneOf(b: BattleState, title: string, lines: AutoLine[], faces: string[]): AutoScene {
  return { title, lines: lines.filter((l) => l.text).slice(0, 6), faces: [...new Set(faces)].slice(0, 6), momentum: momentum(b), hurt: hurtList(b), down: downList(b) };
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
      if ((st.traits.includes('early') && st.grade === 1 || st.traits.includes('late') && st.grade === 3) && !used('bloom', st)) out.push({ id: 'bloom', a: st, u, weight: 1, apply: () => { const tr = st.traits.includes('early') ? 'early' : 'late'; a.effects.push({ kind: 'trait', id: st.id, trait: tr }); } });
      continue;
    }
    // 戦いの最中
    if (u.hp <= u.maxHp / 2 && (st.traits.includes('loser_hate') || st.personality === 'competitive') && !used('loserHate', st)) out.push({ id: 'loserHate', a: st, u, weight: 4, apply: () => { addMod(u, E.loserHate); if (st.traits.includes('loser_hate')) a.effects.push({ kind: 'trait', id: st.id, trait: 'loser_hate' }); } });
    if ((st.traits.includes('coward') || st.personality === 'timid') && st.battles <= 4 && (u.kills > 0 || u.hits > 0) && !used('coward', st)) out.push({ id: 'coward', a: st, u, weight: 3, apply: () => { addMod(u, E.coward); a.effects.push({ kind: 'motivation', id: st.id, v: 1 }); } });
    if (st.traits.includes('clutch') && b.real && u.hits >= 2 && !used('clutch', st)) out.push({ id: 'clutch', a: st, u, weight: 2.5, apply: () => a.effects.push({ kind: 'trait', id: st.id, trait: 'clutch' }) });
    if (st.talent && st.talentReveal < 100 && (u.kills > 0 || u.hits >= 2) && !used('talent', st)) {
      const tal = st.talent;
      const usedTypes = Object.keys(u.usedWeapon).map((w) => WEAPONS[w]?.type);
      const match = tal.startsWith('genius_') ? usedTypes.some((t) => (t === 'holy' || t === 'staff' ? 'faith' : t) === tal.slice(7)) : tal === 'leader' || tal === 'hero';
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
  return { by: L.personality === 'beast' ? 'narr' : 'leader', text: fill(t, { leader: L.name }) };
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
  if (top && mk !== 'even') lines.push({ by: 'narr', text: fill(pickText(s, r, MATCHUP_TEXT[mk]), { foe: `${top.name}${top.type === 'magic' ? 'の使い手' : '兵'}` }) });
  const L = b.auto!.leader;
  if (L) { const l = leaderLine(s, b, r, L.again ? 'again' : 'open'); if (l) lines.push(l); }
  if (b.enemyAlumni && s.students[b.enemyAlumni]) lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.alumniFoe), { a: s.students[b.enemyAlumni].given }) });
  const ev = takeEvent(s, b, r, 'open');
  const faces = deployed(s, b).map((x) => x.st.id);
  if (ev.length) lines.push(...ev);
  else { const d = deployed(s, b); if (d.length) { const x = r.pick(d); lines.push(say(s, r, 'open', x.st)); } }
  b.rng = r.h.rng;
  return sceneOf(b, '開戦', lines, ev.length ? [ev[1].by, ...faces] : faces);
}

function midScene(s: GameState, b: BattleState, title: string, q: Quest): AutoScene {
  const r = rngOf(b);
  const lines: AutoLine[] = [];
  if (title === '山場') lines.push({ by: 'narr', text: pickText(s, r, CLIMAX_TEXT[q.objective] ?? CLIMAX_TEXT.rout) });
  const h = highlights(s, b, r, title === '山場' ? 1 : 2);
  lines.push(...h.lines.slice(0, 3));
  const ev = takeEvent(s, b, r, 'mid');
  lines.push(...ev);
  // 援軍
  const ally = b.units.find((u) => u.side === 'ally' && u.studentId && !(b.auto!.events.includes('reinforce')));
  if (ally && s.students[ally.studentId!]) { lines.push({ by: 'narr', text: fill(pickText(s, r, CLASH_TEXT.reinforce), { a: s.students[ally.studentId!].given }) }); b.auto!.events.push('reinforce'); }
  if (title === '山場' && momentum(b) >= 0.62) { const l = leaderLine(s, b, r, 'cornered'); if (l && b.units.some((u) => u.uid === b.auto!.leader?.uid && !u.dead)) lines.push(l); }
  if (lines.length < 3) lines.push(momentumLine(s, b, r));
  b.feed = [];
  b.rng = r.h.rng;
  return sceneOf(b, title, lines, [...h.faces, ...(ev[1] ? [ev[1].by] : [])]);
}

function endScene(s: GameState, b: BattleState): AutoScene {
  const r = rngOf(b);
  const a = b.auto!;
  const lines: AutoLine[] = [];
  const h = highlights(s, b, r, 1);
  lines.push(...h.lines.slice(0, 2));
  const win = b.result === 'win';
  if (a.retreatedAll) lines.push({ by: 'narr', text: pickText(s, r, END_TEXT.retreat) });
  const L = a.leader;
  const fledBoss = win && !!L?.fled && (b.objective === 'boss' || b.objective === 'seize');
  if (!a.retreatedAll) lines.push({ by: 'narr', text: pickText(s, r, win ? (fledBoss ? END_TEXT.bossFled : END_TEXT.win[b.objective] ?? END_TEXT.win.rout) : END_TEXT.lose) });
  const lu = L ? b.units.find((u) => u.uid === L.uid) : null;
  if (L && lu) {
    if (lu.dead && !L.fled && !b.retreated.includes(lu.uid)) { const l = leaderLine(s, b, r, 'fall'); if (l) lines.push(l); }
    else if (win || L.fled) { L.fled = true; const l = leaderLine(s, b, r, 'flee'); if (l) lines.push(l); }
    else { const l = leaderLine(s, b, r, 'duelWin'); if (l) lines.push(l); }
  }
  const alive = deployed(s, b).filter((x) => !b.fallen.some((f) => f.studentId === x.st.id));
  if (alive.length) { const x = alive.sort((p, q2) => (a.spot[q2.st.id] ?? 0) - (a.spot[p.st.id] ?? 0))[0]; lines.push(say(s, r, win ? 'win' : 'lose', x.st)); h.faces.push(x.st.id); }
  b.feed = [];
  b.rng = r.h.rng;
  return sceneOf(b, '決着', lines, h.faces);
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
  if (L && lu && !done('duel') && r.chance(LEADER_DUEL[L.personality]) && mine.length) {
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
  if (!cands.length) return null;
  return r.weighted(cands, (x) => x.w).c;
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
      if (d.hp - dmg <= 0) { d.hp = 1; return true; }
      d.hp -= dmg;
    }
    return false;
  };
  // 一騎打ちの間合い（敵将の隣）
  const ux = e.x, uy = Math.min(b.height - 1, e.y + 1);
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
  if (c.kind === 'help' && actorSt && actorU) {
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
  } else if (c.kind === 'persuade' && actorSt) {
    const u = b.units.find((x) => x.studentId === actorSt.id && x.persuadable);
    faces.push(actorSt.id);
    if (o.id === 'talk' && u) {
      const v = { a: actorSt.given };
      if (actorSt.trust >= 80 && r.chance(0.6)) { u.side = 'ally'; u.persuadable = false; lines.push({ by: 'narr', text: fill(CHOICE_RESULT.persuadeAlly[0], v) }); }
      else if (actorSt.trust >= 60) { u.dead = true; u.hp = 0; u.persuadable = false; b.retreated.push(u.uid); lines.push({ by: 'narr', text: fill(CHOICE_RESULT.persuadeLeave[0], v) }); }
      else lines.push({ by: 'narr', text: fill(CHOICE_RESULT.persuadeFail[0], v) });
      checkEnd(b);
    } else lines.push({ by: 'narr', text: CHOICE_RESULT.fight[0] });
  }
  a.choice = null;
  // 選択の結果も1つの場面として見せる
  a.scenes.push(sceneOf(b, '指示', lines, faces));
  // 選択の効果が巻き戻しで消えないよう、今のターンの記録を取り直す
  if (b.snapshots.length) b.snapshots[b.snapshots.length - 1] = JSON.stringify({ ...b, snapshots: [] });
  b.rng = r.h.rng;
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

// ---------- 進め方 ----------
/** 自動の戦闘を始める（開戦の場面まで作って止まる） */
export function startAutoBattle(s: GameState, q: Quest, deploys: Deploy[], plan: AutoPlan, ctx: BattleCtx, seed = questSeed(s, q)): void {
  const b = buildBattle(s, q, deploys, plan, seed);
  startPlayerPhase(b);
  s.battle = b;
  const mem = (s.autoMemory ??= { lines: [], events: [] });
  mem.n = ((mem.n ?? 0) + 1) % 100000;
  b.auto!.scenes.push(openingScene(s, b, q));
  advanceAuto(s, ctx);
}

/** 次の区切りまで戦闘を進め、場面と選択を作る（選択が出たら止まる） */
export function advanceAuto(s: GameState, ctx: BattleCtx): void {
  let b = s.battle;
  if (!b?.auto) return;
  const q = s.quests.find((x) => x.id === b!.questId) ?? ({ kind: 'drill', objective: b.objective, template: 'training', weather: b.weather } as Quest);
  let guard = 0;
  while (b.auto && !b.auto.choice && b.auto.seg < 3 && guard++ < 6) {
    const a: AutoState = b.auto;
    if (b.phase === 'done') {
      a.seg = 3;
      a.scenes.push(endScene(s, b));
      break;
    }
    const until = a.seg === 0 ? AUTO.segmentTurns[0] : a.seg === 1 ? AUTO.segmentTurns[1] : 99;
    b = runUntil(b, ctx, until);
    s.battle = b;
    const a2 = b.auto!;
    a2.exposed = [];
    if (b.phase !== 'done' && b.turn > b.maxTurns) finish(b, 'lose');
    if (b.phase === 'done' || a2.seg === 2) {
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
    if (a2.seg === 2 && L && lu && momentum(b) >= 0.65 && b.real && r.chance(LEADER_FLEE[L.personality] * 0.5)) {
      lu.dead = true; b.retreated.push(lu.uid); L.fled = true;
      checkEnd(b);
    }
    const second = a2.choicesMade.length > 0;
    if ((b.phase as string) !== 'done' && (!second || r.chance(AUTO.secondChoice)) && a2.choicesMade.length < 2) {
      b.rng = r.h.rng;
      a2.choice = makeChoice(s, b, ctx, second);
    } else b.rng = r.h.rng;
  }
}

/** 「結果だけ見る」：残りの選択はおすすめのものを選んで最後まで */
export function skipAuto(s: GameState, ctx: BattleCtx, pick?: (c: AutoChoice) => number): void {
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
}): { mvp: string | null; review: string[] } {
  const a = b.auto;
  if (!a) return { mvp: null, review: [] };
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
  if (mvp) { const st = s.students[mvp]; lines.unshift(`MVP：${st.given}`); st.history.push({ year: s.year, text: `「${b.title}」でMVP` }); }
  // 因縁の敵将
  const L = a.leader;
  if (L && q?.real) {
    const lu = b.units.find((u) => u.uid === L!.uid);
    const fell = !!lu?.dead && !L!.fled && !b.retreated.includes(lu.uid);
    s.nemeses ??= [];
    let n = L!.nemesisId ? s.nemeses.find((x) => x.id === L!.nemesisId) : undefined;
    const meet = { year: s.year, month: s.month, title: b.title, result: fell ? 'fell' as const : b.result === 'win' ? 'win' as const : 'lose' as const };
    if (fell) {
      if (n) { n.status = 'defeated'; n.meets.push(meet); lines.push(fill(RESULT_TEXT.nemesisEnd[0], { leader: L!.name })); chronicle(s, `因縁の敵将「${L!.name}」を討ち取った`, 'school'); }
    } else if (q) {
      if (!n) {
        n = { id: `nm${s.nextId++}`, name: L!.name, personality: L!.personality, face: L!.face, classId: lu?.classId ?? L!.classId, level: lu?.level ?? q.level, kind: leaderKind(q), country: q.enemyCountry, meets: [], status: 'active' };
        s.nemeses.push(n);
        chronicle(s, `「${b.title}」で敵将${L!.name}を取り逃がした`, 'school');
      }
      n.meets.push({ ...meet, result: 'fled' });
      n.level = lu?.level ?? n.level;
      if (n.meets.length >= AUTO.nemesisMax) n.status = 'defeated';
      lines.push(fill(RESULT_TEXT.nemesisNew[0], { leader: L!.name }));
    }
    if (s.nemeses.length > 30) s.nemeses = s.nemeses.filter((x) => x.status === 'active').slice(-20).concat(s.nemeses.filter((x) => x.status !== 'active').slice(-10));
  }
  // 講評
  const review: string[] = [];
  const pk = (l: string[]) => r.pick(l);
  if (q) { if (tacticFits(a.tactic, q)) review.push(pk(REVIEW_TEXT.fitGood)); else if (TACTICS[a.tactic].fits.length && !tacticFits(a.tactic, q)) review.push(pk(REVIEW_TEXT.fitBad)); }
  const dep = deployed(s, b);
  if (dep.some((x) => roleFit(x.u.classId, a.roles[x.st.id] ?? defaultRole(x.u.classId, x.st)) === 0)) review.push(REVIEW_TEXT.roleBad[0]);
  const intel = enemyIntel(s, { ...b, units: b.units.map((u) => ({ ...u, dead: false })) });
  if (intel.matchup >= 0.8) review.push(pk(REVIEW_TEXT.triangleGood)); else if (intel.matchup <= -0.8) review.push(pk(REVIEW_TEXT.triangleBad));
  if (a.events.some((x) => x.startsWith('combo') || x.startsWith('lovers'))) review.push(REVIEW_TEXT.support[0]);
  if (dep.filter((x) => x.st.fatigue >= AUTO.fatigueFrom).length >= 2) review.push(REVIEW_TEXT.tired[0]);
  if (dep.some((x) => x.st.motivation <= 0)) review.push(REVIEW_TEXT.lowMotivation[0]);
  return { mvp, review: review.slice(0, 3) };
}

function traitName(t: string): string { return TRAITS[t]?.name ?? t; }

export type { FeedEntry };
