// 23夜目⑦：進軍（1つの依頼で、戦場を1〜5つ続けて攻め込む）。DOMに依存しない
// 体力は次の戦場へ持ち越し（少しだけ戻る）、技の回数は戦場ごとに全部戻る。
// 戦場と戦場のあいだに「小休止」を1つと、次の「道」を選ぶ。最後の戦場でない敵将は、追いつめると次の戦場へ退く。
import { B } from '../data/balance';
import { TB, type AtkType } from '../data/tactics';
import { MARCH_STAGES, MARCH_TEXT, type RestKind } from '../data/march';
import type { GameState, Quest } from './state';
import type { TBattle, TUnit, Deploy, Objective } from './tactics/types';
import { Rng } from './rng';
import { enrolled, available } from './game';
import { fieldFor, questSeed } from './tactics/setup';
import { intents } from './tactics/engine';
import { officerForQuest } from './flow';
import { scoutWeak } from './nemesis';

export interface MarchState {
  questId: string;
  total: number;
  idx: number;
  names: string[];
  fields: string[];
  objectives: Objective[];
  /** 依頼全体をおまかせで進めている */
  auto: boolean;
  /** いま出ている子（武器・薬つき） */
  deploy: Deploy[];
  /** 持ち越しの体力（生徒id／'teacher'）と最大・薬 */
  carry: Record<string, { hp: number; max: number; potion?: number }>;
  /** 倒れて次の戦場に出られない子 */
  out: string[];
  /** 終わった戦場（あとでまとめて結果にする） */
  stages: TBattle[];
  /** 次の戦場へ退いた敵将（体力・盾・覚えた弱点を持ち越す） */
  foe?: { officerId: string; hp: number; max: number; sh: number; known: AtkType[]; fled: boolean } | null;
  /** 戦場と戦場のあいだ（画面で選ぶのを待っている） */
  between?: boolean;
  /** 次の戦場の作り方 */
  route?: 'short' | 'detour';
  /** 小休止で偵察した（次の戦場の敵将の弱点を1つ明かす） */
  scout?: boolean;
  /** 戦場と戦場のあいだの出来事（結果の画面に並べる） */
  log: string[];
}

/** その依頼の戦場の数（古い依頼は1） */
export function questStages(q: Pick<Quest, 'stages'>): number { return Math.max(1, Math.min(5, q.stages ?? 1)); }

/** 今月の依頼に、戦場の数と名前をつける（まだついていないものだけ）。大きめの依頼（3〜5）は、月に1つまで */
export function ensureStages(s: GameState): void {
  const M = B.march;
  const todo = s.quests.filter((q) => q.stages === undefined);
  if (!todo.length) return;
  const one = (q: Quest) => !q.real || q.small || q.tutorial || q.opening || q.kind === 'schoolDefense' || q.kind === 'exhibition' || q.kind === 'drill';
  // 大きめの依頼の候補：宿敵の依頼 → 危険の高い依頼
  const cand = s.quests.filter((q) => !one(q)).sort((a, c) => Number(!!c.nemesisId) - Number(!!a.nemesisId) || c.danger - a.danger)[0];
  const mr = new Rng({ rng: (s.year * 131 + s.month * 17 + (s.createdAt ?? 0)) ^ 0x6d1 });
  const bigId = cand && cand.stages === undefined && mr.chance(M.bigChance + (cand.nemesisId ? M.bigNemesis : 0)) ? cand.id : null;
  for (const q of todo) {
    const r = new Rng({ rng: questSeed(s, q) ^ 0x7a3 });
    let n = 1;
    if (!one(q)) n = q.id === bigId ? 3 + r.weighted([0, 1, 2], (i) => M.bigWeights[i]) : r.chance(M.twoChance) ? 2 : 1;
    q.stages = n;
    q.stageNames = stageNames(q, n);
    if (n > 1) q.reward = Math.round((q.reward * (1 + M.rewardPerStage * (n - 1))) / 10) * 10;
  }
}

function stageKind(q: Pick<Quest, 'kind' | 'enemyCountry'>): keyof typeof MARCH_STAGES {
  if (q.kind === 'monster') return 'monster';
  if (q.kind === 'bandit') return 'bandit';
  if (q.kind === 'defend' || q.kind === 'refugee' || q.kind === 'escort') return 'defend';
  if (q.kind === 'rescue' || q.kind === 'breakout') return 'rescue';
  return 'army';
}
const PICK: Record<number, number[]> = { 1: [4], 2: [1, 4], 3: [1, 2, 4], 4: [0, 1, 2, 4], 5: [0, 1, 2, 3, 4] };
export function stageNames(q: Pick<Quest, 'kind' | 'enemyCountry'>, n: number): string[] { const L = MARCH_STAGES[stageKind(q)]; return PICK[n].map((i) => L.names[i]); }
function stageFields(s: GameState, q: Quest, n: number): string[] {
  const L = MARCH_STAGES[stageKind(q)];
  const last = fieldFor(q, officerForQuest(s, q));
  return PICK[n].map((i, k) => (k === n - 1 ? last : L.fields[i]));
}
/** 途中の戦場の勝ち方（最後の戦場は依頼の目的） */
function stageObjectives(s: GameState, q: Quest, n: number, last: Objective): Objective[] {
  const r = new Rng({ rng: questSeed(s, q) ^ 0x0b7 });
  const out: Objective[] = [];
  for (let i = 0; i < n - 1; i++) out.push(r.weighted(['rout', 'boss', 'defend', 'rescue', 'escape'] as Objective[], (o) => ({ rout: 4, boss: 3, defend: 2, rescue: 1, escape: 1 } as Record<string, number>)[o]));
  out.push(last);
  return out;
}

/** 進軍を始める（1つ目の戦場の前） */
export function initMarch(s: GameState, q: Quest, deploy: Deploy[], auto: boolean, lastObjective: Objective): MarchState {
  const n = questStages(q);
  return {
    questId: q.id, total: n, idx: 0, names: q.stageNames?.length === n ? q.stageNames : stageNames(q, n), fields: stageFields(s, q, n), objectives: stageObjectives(s, q, n, lastObjective),
    auto, deploy: deploy.map((d) => ({ ...d })), carry: {}, out: [], stages: [], foe: null, log: [],
  };
}
/** 名前のある敵将・宿敵が出てくる戦場か（最後の戦場と、その1つ前から） */
export function officerHere(m: Pick<MarchState, 'idx' | 'total'>): boolean { return m.idx >= Math.max(0, m.total - 2); }

/** 戦場を作ったあと：持ち越しの体力・退いた敵将・回り道・偵察を盤に入れる */
export function applyCarry(s: GameState, b: TBattle, m: MarchState): void {
  const M = B.march;
  b.march = { idx: m.idx, total: m.total, names: m.names };
  b.route = m.route;
  if (m.idx === 0) return;
  for (const u of b.units) {
    if (u.side !== 'me' || u.raised || u.helper) continue;
    const c = m.carry[u.teacher ? 'teacher' : u.studentId ?? ''];
    if (!c) continue;
    u.hp = Math.max(1, Math.min(u.max, c.hp));
    if (c.potion !== undefined) u.potion = c.potion;
  }
  const bu = b.units.find((u) => u.boss);
  if (bu && m.foe && bu.officerId === m.foe.officerId) {
    bu.hp = Math.max(1, Math.min(bu.max, Math.round(m.foe.hp + bu.max * M.foeHeal)));
    bu.sh = Math.max(1, Math.min(bu.shMax, m.foe.sh));
    for (const k of m.foe.known) if (bu.weak.includes(k) && !bu.known.includes(k)) bu.known.push(k);
    if (m.foe.fled && b.lines) {
      const r = new Rng({ rng: questSeed(s, { id: `${m.questId}:${m.idx}` }) });
      const line = r.pick(MARCH_TEXT.regroup);
      b.lines['boss:intro'] = line;
      b.log.push({ turn: 1, text: `${bu.name}は、傷を負ったまま待ち構えていた（体力 ${bu.hp}/${bu.max}）`, big: true });
    } else if (m.foe.fled) b.log.push({ turn: 1, text: `${bu.name}は、傷を負ったまま待ち構えていた（体力 ${bu.hp}/${bu.max}）`, big: true });
  }
  // 回り道：遅れたぶん、敵が守りを固めている（盾+1）。そのかわり宝箱がある
  if (m.route === 'detour') {
    for (const f of b.units) if (f.side === 'foe' && f.shMax > 0) { f.shMax += M.detourShield; f.sh += M.detourShield; }
    if (!b.chests?.length) {
      const free = (x: number, y: number) => !b.rock.includes(`${x}-${y}`) && !b.forest.includes(`${x}-${y}`) && !b.units.some((u) => u.x === x && u.y === y) && b.gate !== `${x}-${y}`;
      for (const [x, y] of [[1, 5], [6, 5], [0, 6], [7, 6], [3, 6], [4, 5]]) if (x < b.w && y < b.h && free(x, y)) { b.chests = [{ x, y, kind: 'potion' }]; break; }
    }
    b.log.push({ turn: 1, text: '回り道：宝箱がある。遅れたぶん、敵は守りを固めている（盾+1）' });
  } else if (m.route === 'short') b.log.push({ turn: 1, text: '近道：敵の数が多い' });
  // 偵察：敵将の隠れた弱点を1つ明かす
  if (m.scout && bu) {
    const h = bu.weak.find((w) => !bu.known.includes(w) && !bu.resist.includes(w));
    if (h) { bu.known.push(h); b.log.push({ turn: 1, text: `偵察の成果：${bu.name}の弱点がひとつ分かった` }); }
    const o = bu.officerId ? (s.officers ?? []).find((x) => x.id === bu.officerId) : null;
    if (o && h && !(o.knownWeak ?? []).includes(h)) (o.knownWeak ??= []).push(h);
    m.scout = false;
  }
  intents(b);
}

/** 戦場が終わったとき（勝って、まだ次がある）：持ち越しを決めて、戦場と戦場のあいだへ */
export function stageCleared(s: GameState, b: TBattle, m: MarchState): void {
  const M = B.march;
  m.stages.push(pruneStage(b));
  m.carry = {};
  for (const u of b.units) {
    if (u.side !== 'me' || u.raised || u.helper) continue;
    const id = u.teacher ? 'teacher' : u.studentId;
    if (!id) continue;
    if (!u.alive) { if (!u.teacher) m.out.push(id); continue; }
    m.carry[id] = { hp: Math.min(u.max, Math.round(u.hp + u.max * M.carryHeal)), max: u.max, potion: u.potion };
  }
  m.deploy = m.deploy.filter((d) => !m.out.includes(d.studentId));
  const bu = b.units.find((u) => u.boss && u.officerId);
  m.foe = bu ? { officerId: bu.officerId!, hp: Math.max(1, bu.hp), max: bu.max, sh: bu.sh, known: [...bu.known], fled: bu.down === 'fled' || !bu.alive } : m.foe ?? null;
  m.between = true;
  m.log.push(`${m.names[m.idx]}：勝った`);
}

/** 後ろにいる子（入れ替えの候補） */
export function benchOf(s: GameState, m: MarchState): string[] {
  const ids = new Set(m.deploy.map((d) => d.studentId));
  return enrolled(s).filter((st) => available(st) && !ids.has(st.id) && !m.out.includes(st.id)).sort((a, c) => c.level - a.level).map((st) => st.id);
}

export interface BreakChoice { rest: RestKind; route: 'short' | 'detour'; swapOut?: string | null; swapIn?: string | null }
/** 小休止と道を決めて、次の戦場へ進む準備をする */
export function chooseBreak(s: GameState, m: MarchState, c: BreakChoice): string[] {
  const M = B.march;
  const out: string[] = [];
  if (c.rest === 'heal') {
    for (const v of Object.values(m.carry)) v.hp = Math.min(v.max, Math.round(v.hp + v.max * M.restHeal));
    out.push('手当て：みなの傷を手当てした');
  } else if (c.rest === 'swap' && c.swapIn && s.students[c.swapIn]) {
    const outId = c.swapOut && m.deploy.some((d) => d.studentId === c.swapOut) ? c.swapOut : null;
    if (outId) { m.deploy = m.deploy.filter((d) => d.studentId !== outId); delete m.carry[outId]; }
    if (m.deploy.length < B.sortie.members) m.deploy.push({ studentId: c.swapIn, armoryUid: null, item: null });
    out.push(`入れ替え：${s.students[c.swapIn].given}が${outId ? `${s.students[outId]?.given}にかわって` : ''}加わった`);
  } else if (c.rest === 'equip') {
    out.push('武器の付け替え：持っていく武器を見直した');
  } else if (c.rest === 'scout') {
    m.scout = true;
    out.push('偵察：次の戦場の敵将を探った');
  }
  m.route = c.route;
  out.push(c.route === 'short' ? '近道を進んだ（敵が多い）' : '回り道を進んだ（宝箱があり、敵は守りを固める）');
  m.log.push(...out);
  m.idx += 1;
  m.between = false;
  return out;
}

/** おまかせの小休止と道（体力が少なければ手当て、倒れた子がいれば入れ替え、ほかは偵察） */
export function autoBreak(s: GameState, m: MarchState): BreakChoice {
  const vals = Object.entries(m.carry).filter(([k]) => k !== 'teacher').map(([, v]) => v.hp / Math.max(1, v.max));
  const avg = vals.length ? vals.reduce((a, x) => a + x, 0) / vals.length : 1;
  const bench = benchOf(s, m);
  const t = m.carry.teacher;
  let rest: RestKind = 'scout';
  if (avg < 0.6 || (t && t.hp < t.max * 0.5)) rest = 'heal';
  else if (m.deploy.length < B.sortie.members && bench.length) rest = 'swap';
  // いちばん傷の深い子を、後ろの元気な子と入れ替える
  let swapOut: string | null = null;
  if (rest === 'swap' && m.deploy.length >= B.sortie.members) swapOut = Object.entries(m.carry).filter(([k]) => k !== 'teacher').sort((a, c) => a[1].hp / a[1].max - c[1].hp / c[1].max)[0]?.[0] ?? null;
  return { rest, route: avg >= 0.65 ? 'short' : 'detour', swapOut, swapIn: rest === 'swap' ? bench[0] ?? null : null };
}

/** 終わった戦場を、結果のために軽くして残す（画面の演出などは捨てる） */
function pruneStage(b: TBattle): TBattle {
  const c: TBattle = JSON.parse(JSON.stringify(b));
  c.fx = []; c.undo = null;
  return c;
}

/** すべての戦場を、結果の計算のために1つにまとめる（成績は足す。最後の戦場の盤を土台に） */
export function mergeStages(m: MarchState, last: TBattle): TBattle {
  const all = [...m.stages, pruneStage(last)];
  if (all.length === 1) return last;
  const base: TBattle = JSON.parse(JSON.stringify(last));
  base.fx = [];
  const add = (dst: TUnit, src: TUnit) => {
    dst.kills += src.kills; dst.dealt += src.dealt; dst.taken += src.taken; dst.weakHits += src.weakHits; dst.breaks += src.breaks;
    if (src.guarded) dst.guarded = (dst.guarded ?? 0) + src.guarded;
    for (const [k, n] of Object.entries(src.deeds ?? {})) (dst.deeds ??= {})[k] = (dst.deeds?.[k] ?? 0) + n;
    if (src.usedFire) dst.usedFire = true;
  };
  const scenes: TBattle['scenes'] = [];
  const log: TBattle['log'] = [];
  const found: NonNullable<TBattle['found']> = [];
  let foes0 = 0;
  all.forEach((st, i) => {
    log.push({ turn: 0, text: `― ${m.names[i] ?? `戦場${i + 1}`} ―`, big: true });
    log.push(...st.log);
    scenes.push(...st.scenes);
    found.push(...(st.found ?? []));
    foes0 += st.foes0;
    if (i === all.length - 1) return;
    for (const u of st.units) {
      if (u.side !== 'me' || !u.studentId || u.raised || u.helper) continue;
      const d = base.units.find((x) => x.side === 'me' && x.studentId === u.studentId && !!x.teacher === !!u.teacher);
      if (d) add(d, u);
      else base.units.push({ ...JSON.parse(JSON.stringify(u)), uid: `m${i}_${u.uid}` });
    }
    // 同じ敵将が前の戦場にもいたときは、だれが傷を負わせたかを足す
    const bu0 = st.units.find((u) => u.boss && u.officerId);
    const bu1 = base.units.find((u) => u.boss && u.officerId && u.officerId === bu0?.officerId);
    if (bu0 && bu1) {
      for (const [k, n] of Object.entries(bu0.hitBy ?? {})) (bu1.hitBy ??= {})[k] = (bu1.hitBy?.[k] ?? 0) + n;
      bu1.brokenBy = [...new Set([...(bu0.brokenBy ?? []), ...(bu1.brokenBy ?? [])])];
      if (bu0.down === 'fled' || bu0.fleeing) bu1.fledBefore = true;
    }
  });
  base.scenes = scenes; base.log = log; base.found = found; base.foes0 = foes0;
  const q = m.questId;
  base.questId = q;
  base.march = { idx: m.idx, total: m.total, names: m.names, cleared: m.stages.length + (last.result === 'win' ? 1 : 0) };
  return base;
}

/** 依頼の札の「戦場 3つ（砦の前 → 城門 → 本陣）」 */
export function stageLabel(q: Quest): string {
  const n = questStages(q);
  if (n <= 1) return '';
  return `戦場 ${n}つ（${(q.stageNames ?? []).join(' → ')}）`;
}
void TB;
