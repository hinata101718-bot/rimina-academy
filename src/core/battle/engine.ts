// 戦闘の進行：移動・攻撃・回復・待機・指示・敵AI・勝敗・巻き戻し
import { B } from '../../data/balance';
import { WEAPONS } from '../../data/weapons';
import type { BattleState, Unit, Strike, Terrain } from './types';
import { Rng } from '../rng';
import {
  tile, terrainDef, dist, unitAt, moveOf, moveTypeOf, weaponOf, isFriendly, canUseNow, inRange, rangeOf,
  forecast, healAmount, staffOf, hasAb, abilitiesOf, type SupportFn,
} from './calc';
import { clamp } from '../util';

export interface BattleCtx {
  support: SupportFn;
  trust: (studentId: string) => number;
  luckInjury: (studentId: string) => number; // 特徴タグによる重傷率+
  deathMul: number;
}

function rngOf(b: BattleState): Rng { return new Rng(b as unknown as { rng: number }); }
const idx = (b: BattleState, x: number, y: number) => y * b.width + x;

export function moveCost(b: BattleState, u: Unit, t: Terrain): number {
  return (terrainDef(t).cost as Record<string, number>)[moveTypeOf(u)] ?? 1;
}

/** 移動できるマス（到達コスト） */
export function reachable(b: BattleState, u: Unit): Map<number, number> {
  const best = new Map<number, number>();
  const mv = moveOf(b, u);
  const q: [number, number, number][] = [[u.x, u.y, 0]];
  best.set(idx(b, u.x, u.y), 0);
  while (q.length) {
    q.sort((a, c) => a[2] - c[2]);
    const [x, y, c] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= b.width || ny >= b.height) continue;
      const cost = moveCost(b, u, tile(b, nx, ny));
      const nc = c + cost;
      if (nc > mv) continue;
      const o = unitAt(b, nx, ny);
      if (o && !isFriendly(u, o)) continue;
      const k = idx(b, nx, ny);
      if ((best.get(k) ?? Infinity) <= nc) continue;
      best.set(k, nc);
      q.push([nx, ny, nc]);
    }
  }
  // 他の味方がいるマスには止まれない
  for (const k of [...best.keys()]) {
    const x = k % b.width, y = Math.floor(k / b.width);
    const o = unitAt(b, x, y);
    if (o && o !== u) best.delete(k);
  }
  return best;
}

/** 移動先のマス群から攻撃できるマス */
export function threatTiles(b: BattleState, u: Unit, from: Iterable<number>, staff = false): Set<number> {
  const out = new Set<number>();
  const ws = staff ? [staffOf(u)].filter(Boolean) : u.weapons.map((w) => WEAPONS[w]).filter((w) => w && w.type !== 'staff' && canUseNow(b, u, w));
  if (!staff && u.weaponId && !ws.length) { const w = weaponOf(u); if (w && canUseNow(b, u, w)) ws.push(w); }
  for (const k of from) {
    const x = k % b.width, y = Math.floor(k / b.width);
    for (const w of ws) {
      if (!w) continue;
      const [mn, mx] = rangeOf(b, w);
      for (let dy = -mx; dy <= mx; dy++) for (let dx = -mx; dx <= mx; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < mn || d > mx) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= b.width || ny >= b.height) continue;
        out.add(idx(b, nx, ny));
      }
    }
  }
  return out;
}

export function enemyThreat(b: BattleState, u: Unit): Set<number> {
  return threatTiles(b, u, reachable(b, u).keys());
}

function log(b: BattleState, text: string, kind?: BattleState['log'][number]['kind']) {
  b.log.push({ text, kind });
  if (b.log.length > 80) b.log.shift();
}

export function snapshot(b: BattleState): void {
  const copy = { ...b, snapshots: [] };
  b.snapshots.push(JSON.stringify(copy));
  if (b.snapshots.length > B.battle.rewindTurns + 1) b.snapshots.shift();
}

export function canRewind(b: BattleState): number {
  return b.rewindsLeft > 0 ? Math.min(B.battle.rewindTurns, b.snapshots.length) : 0;
}
/** n ターン分戻す（1 = このターンの最初へ） */
export function rewind(b: BattleState, n: number): BattleState {
  const can = canRewind(b);
  if (!can) return b;
  const k = clamp(n, 1, can);
  const target = b.snapshots[b.snapshots.length - k];
  const restored = JSON.parse(target) as BattleState;
  restored.snapshots = b.snapshots.slice(0, b.snapshots.length - k + 1);
  restored.rewindsLeft = b.rewindsLeft - 1;
  restored.log.push({ text: `教官が戦況を読み直し、指揮をやり直した（残り${restored.rewindsLeft}回）`, kind: 'info' });
  return restored;
}

// ---------- 行動 ----------

export function moveUnit(b: BattleState, u: Unit, x: number, y: number): boolean {
  if (u.moved || u.acted || b.phase === 'done') return false;
  if (u.x === x && u.y === y) { u.moved = true; return true; }
  const r = reachable(b, u);
  if (!r.has(idx(b, x, y))) return false;
  u.x = x; u.y = y; u.moved = true;
  return true;
}

function weaponSkillId(type: string): string { return type === 'holy' || type === 'staff' ? 'faith' : type; }

function strike(b: BattleState, ctx: BattleCtx, a: Unit, d: Unit, out: Strike[]): void {
  if (a.dead || d.dead) return;
  const f = forecast(b, a, d, a.x, a.y, ctx.support);
  const s = f.atk;
  if (!s.canAttack) return;
  const r = rngOf(b);
  const roll = ((r.next() + r.next()) / 2) * 100;
  const w = weaponOf(a)!;
  a.usedWeapon[w.id] = (a.usedWeapon[w.id] ?? 0) + 1;
  if (w.type === 'gun') a.reloadTurn = b.turn + 1;
  if (roll >= s.hit) { out.push({ by: a.uid, hit: false, crit: false, dmg: 0 }); log(b, `${a.name}の攻撃は外れた`, 'miss'); return; }
  const crit = r.next() * 100 < s.crit;
  const dmg = Math.min(d.hp, crit ? s.dmg * B.battle.critMul : s.dmg);
  d.hp -= dmg; a.dmgDealt += dmg; d.dmgTaken += dmg; a.hits += 1;
  if (a.side !== 'enemy') a.expGain += B.battle.exp.hit;
  if (a.side !== 'enemy' && !isFriendly(a, d)) (b.hitBy[d.uid] ??= []).includes(a.uid) || b.hitBy[d.uid].push(a.uid);
  out.push({ by: a.uid, hit: true, crit, dmg });
  log(b, `${a.name}→${d.name} ${crit ? '必殺！' : ''}${dmg}ダメージ`, crit ? 'crit' : 'hit');
  if (abilitiesOf(a).some((x) => x.poison)) d.poison = B.battle.poisonTurns;
  if (abilitiesOf(a).some((x) => x.weaken)) d.weaken = B.battle.weakenTurns;
  if (d.hp <= 0) defeat(b, ctx, d, a);
}

function defeat(b: BattleState, ctx: BattleCtx, d: Unit, by: Unit | null): void {
  d.hp = 0; d.dead = true;
  if (by) {
    by.kills += 1;
    if (by.side !== 'enemy') {
      const diff = d.level - by.level;
      by.expGain += Math.max(B.battle.exp.minKill, Math.min(B.battle.exp.levelDiffMax + B.battle.exp.kill, B.battle.exp.kill + diff * B.battle.exp.levelDiffPer));
    }
  }
  log(b, `${d.name}を倒した`, 'kill');
  if (d.studentId && (d.side === 'player' || d.side === 'ally' || d.persuadable)) {
    let outcome: 'dead' | 'injured' | 'out' = 'out';
    if (b.real) {
      let inj = B.battle.injuryBase + d.stats.lck * B.battle.injuryPerLck + ctx.luckInjury(d.studentId);
      for (const o of b.units) {
        if (o === d || o.dead || !o.studentId || !isFriendly(o, d) || dist(o, d) > 2) continue;
        const v = ctx.support(d.studentId, o.studentId);
        if (v >= B.support.A) inj += B.battle.injurySupportA; else if (v >= B.support.B) inj += B.battle.injurySupportB;
      }
      inj = Math.min(B.battle.injuryMax, inj);
      const deathP = (100 - inj) * ctx.deathMul;
      outcome = rngOf(b).next() * 100 < deathP ? 'dead' : 'injured';
    }
    b.fallen.push({ studentId: d.studentId, outcome });
    log(b, outcome === 'dead' ? `${d.name}が戦死した……` : outcome === 'injured' ? `${d.name}が重傷を負い、運ばれていった` : `${d.name}は戦闘から外れた`, 'info');
  }
}

export function attack(b: BattleState, ctx: BattleCtx, a: Unit, d: Unit): boolean {
  if (a.acted || b.phase === 'done') return false;
  const w = weaponOf(a);
  if (!w || !canUseNow(b, a, w) || !inRange(b, w, dist(a, d)) || isFriendly(a, d)) return false;
  const f = forecast(b, a, d, a.x, a.y, ctx.support);
  const strikes: Strike[] = [];
  strike(b, ctx, a, d, strikes);
  if (f.def.canAttack) strike(b, ctx, d, a, strikes);
  if (f.atk.count > 1) strike(b, ctx, a, d, strikes);
  else if (f.def.canAttack && f.def.count > 1) strike(b, ctx, d, a, strikes);
  a.moved = true; a.acted = true; a.aimed = false;
  b.lastAction = { attacker: a.uid, defender: d.uid, strikes, killed: [a, d].filter((u) => u.dead).map((u) => u.uid), seq: ++b.popupSeq };
  recordAdjacency(b, a);
  checkEnd(b);
  return true;
}

function recordAdjacency(b: BattleState, a: Unit) {
  if (!a.studentId) return;
  for (const o of b.units) if (o !== a && !o.dead && o.studentId && isFriendly(a, o) && dist(a, o) === 1) {
    const k = [a.studentId, o.studentId].sort().join('|');
    b.adjacencyPairs[k] = (b.adjacencyPairs[k] ?? 0) + 1;
  }
}

export function heal(b: BattleState, a: Unit, t: Unit): boolean {
  if (a.acted || b.phase === 'done' || !isFriendly(a, t) || t.dead || t.hp >= t.maxHp) return false;
  const w = staffOf(a);
  if (!w || !inRange(b, w, dist(a, t))) return false;
  const amt = Math.min(t.maxHp - t.hp, healAmount(a));
  t.hp += amt;
  a.usedWeapon[w.id] = (a.usedWeapon[w.id] ?? 0) + 1;
  if (a.side !== 'enemy') a.expGain += B.battle.exp.heal;
  a.moved = true; a.acted = true;
  b.lastAction = { attacker: a.uid, defender: t.uid, strikes: [], killed: [], heal: amt, seq: ++b.popupSeq };
  log(b, `${a.name}が${t.name}のHPを${amt}回復`, 'heal');
  return true;
}

export function useItem(b: BattleState, u: Unit): boolean {
  if (u.acted || !u.item || u.hp >= u.maxHp) return false;
  const amt = u.item === 'elixir' ? u.maxHp - u.hp : Math.min(u.maxHp - u.hp, B.battle.vulnerary);
  u.hp += amt;
  log(b, `${u.name}は${u.item === 'elixir' ? '特効薬' : '傷薬'}を使った（+${amt}）`, 'heal');
  u.item = null; u.moved = true; u.acted = true;
  b.lastAction = { attacker: u.uid, defender: u.uid, strikes: [], killed: [], heal: amt, seq: ++b.popupSeq };
  return true;
}

export function wait(b: BattleState, u: Unit): void {
  u.moved = true; u.acted = true;
  checkEnd(b);
}

/** 村を訪問 */
export function canVisit(b: BattleState, u: Unit): boolean {
  return tile(b, u.x, u.y) === 'village' && !b.visited.includes(idx(b, u.x, u.y)) && (u.side === 'player' || u.side === 'ally');
}
export function visit(b: BattleState, u: Unit): string {
  if (!canVisit(b, u)) return '';
  b.visited.push(idx(b, u.x, u.y));
  const r = rngOf(b);
  u.acted = true; u.moved = true;
  const roll = r.next();
  let text: string;
  if (roll < 0.4) { u.item = u.item ?? 'vulnerary'; text = '村人から傷薬をもらった'; }
  else if (roll < 0.7) { text = '村人が「この先に気をつけて」と教えてくれた（全員の命中+5、このターン）'; for (const o of b.units) if (o.side === 'player') o.aimed = o.aimed || r.chance(0.5); }
  else { const specials = Object.values(WEAPONS).filter((w) => w.price === 0 && w.type !== 'gun'); const w = r.pick(specials); (b.visitedChestLog ??= []).push(w.id); text = `村人から「${w.name}」を託された（戦闘後に武器庫へ）`; }
  log(b, `${u.name}：${text}`, 'info');
  return text;
}
export function canOpenChest(b: BattleState, u: Unit) {
  return hasAb(u, 'unlock') ? b.chests.find((c) => !c.opened && dist(c, u) <= 1) ?? null : null;
}
export function openChest(b: BattleState, u: Unit): string {
  const c = canOpenChest(b, u);
  if (!c) return '';
  c.opened = true; u.acted = true; u.moved = true;
  (b.visitedChestLog ??= []).push(c.weaponId);
  const text = `宝箱から「${WEAPONS[c.weaponId].name}」を手に入れた`;
  log(b, `${u.name}：${text}`, 'info');
  return text;
}

/** 説得（敵の卒業生） */
export function canPersuade(b: BattleState, u: Unit): Unit | null {
  if (u.side !== 'player') return null;
  return b.units.find((o) => !o.dead && o.persuadable && dist(o, u) === 1) ?? null;
}
export function persuade(b: BattleState, ctx: BattleCtx, u: Unit): string {
  const t = canPersuade(b, u);
  if (!t || !t.studentId) return '';
  const trust = ctx.trust(t.studentId);
  const r = rngOf(b);
  u.acted = true; u.moved = true;
  let text: string;
  if (trust >= 80 && r.chance(0.6)) { t.side = 'ally'; t.persuadable = false; t.moved = true; t.acted = true; text = `${t.name}「……先生の教え子として、こちらにつきます」（味方になった）`; }
  else if (trust >= 60) { t.dead = true; t.hp = 0; t.persuadable = false; b.retreated.push(t.uid); text = `${t.name}「先生とは戦えません」（戦場から退いた）`; }
  else text = `${t.name}「今の私には、守るべきものがあります」（説得は届かなかった）`;
  log(b, text, 'info');
  checkEnd(b);
  return text;
}

// ---------- 教官の指示 ----------

export function commandRate(ctx: BattleCtx, u: Unit): number {
  const t = u.studentId ? ctx.trust(u.studentId) : 0;
  return Math.min(100, B.battle.commandBase + t * B.battle.commandPerTrust);
}
export function canCommand(b: BattleState): boolean { return b.phase === 'player' && b.commandUsed.turn !== b.turn; }
export function command(b: BattleState, ctx: BattleCtx, kind: 'again' | 'aim' | 'retreat', u: Unit): string {
  if (!canCommand(b) || u.side !== 'player' || u.dead) return '';
  if (kind === 'again' && (b.commandUsed.again || !u.acted)) return '';
  if (kind === 'retreat' && (b.commandUsed.retreat || u.hp > u.maxHp / 3)) return '';
  b.commandUsed.turn = b.turn;
  const ok = rngOf(b).next() * 100 < commandRate(ctx, u);
  let text = '';
  if (kind === 'again') { b.commandUsed.again = true; if (ok) { u.acted = false; u.moved = false; text = `指示「もう一度動け」：${u.name}がもう一度動ける`; } }
  if (kind === 'aim') { if (ok) { u.aimed = true; text = `指示「狙え」：${u.name}の命中+${B.battle.aimHit}`; } }
  if (kind === 'retreat') { b.commandUsed.retreat = true; if (ok) { u.dead = true; b.retreated.push(u.uid); text = `指示「下がれ」：${u.name}は安全に撤退した`; } }
  if (!ok) text = `指示は${u.name}に届かなかった……`;
  log(b, text, 'info');
  checkEnd(b);
  return text;
}

// ---------- ターン ----------

function phaseStart(b: BattleState, side: 'player' | 'enemy'): void {
  const mine = (u: Unit) => !u.dead && (side === 'player' ? u.side !== 'enemy' : u.side === 'enemy');
  for (const u of b.units.filter(mine)) {
    u.moved = false; u.acted = false;
    if (tile(b, u.x, u.y) === 'fort' && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + Math.ceil(u.maxHp * B.battle.fortHealPct));
    if (u.poison > 0) { u.hp = Math.max(1, u.hp - Math.ceil(u.maxHp * B.battle.poisonPct)); u.poison -= 1; }
    if (u.weaken > 0) u.weaken -= 1;
    for (const a of abilitiesOf(u)) if (a.auraHeal) for (const o of b.units.filter(mine)) if (o !== u && dist(o, u) <= 2) o.hp = Math.min(o.maxHp, o.hp + a.auraHeal);
  }
}

export function startPlayerPhase(b: BattleState): void {
  b.phase = 'player';
  phaseStart(b, 'player');
  snapshot(b);
}

/** 味方フェーズ終了→敵フェーズを一気に処理して次の味方フェーズへ。敵の行動の列を返す（演出用） */
export function endPlayerPhase(b: BattleState, ctx: BattleCtx): { uid: string; action: BattleState['lastAction']; from: [number, number] }[] {
  const steps: { uid: string; action: BattleState['lastAction']; from: [number, number] }[] = [];
  if (b.phase !== 'player') return steps;
  for (const u of b.units) if (u.side !== 'enemy') { u.aimed = false; }
  b.phase = 'enemy';
  phaseStart(b, 'enemy');
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.dead);
  for (const e of enemies) {
    if ((b.phase as string) === 'done' || e.dead) continue;
    const from: [number, number] = [e.x, e.y];
    b.lastAction = null;
    enemyAct(b, ctx, e);
    steps.push({ uid: e.uid, action: b.lastAction, from });
  }
  if ((b.phase as string) === 'done') return steps;
  checkEnd(b);
  if ((b.phase as string) === 'done') return steps;
  if (b.objective === 'defend' && b.turn >= b.defendTurns) { finish(b, 'win'); return steps; }
  b.turn += 1;
  // 援軍の卒業生
  if (b.reinforcement && b.turn === b.reinforcementsAt) spawnReinforcement(b);
  if (b.turn > b.maxTurns) { finish(b, 'lose'); return steps; }
  startPlayerPhase(b);
  return steps;
}

export let reinforcementFactory: ((b: BattleState) => Unit | null) | null = null;
export function setReinforcementFactory(f: (b: BattleState) => Unit | null) { reinforcementFactory = f; }
function spawnReinforcement(b: BattleState) {
  const u = reinforcementFactory?.(b);
  if (!u) return;
  // 空いている出撃位置の近くへ
  for (let y = b.height - 1; y >= 0; y--) for (let x = 0; x < b.width; x++) {
    if (!unitAt(b, x, y) && moveCost(b, u, tile(b, x, y)) < 99) { u.x = x; u.y = y; b.units.push(u); log(b, `援軍！ 卒業生の${u.name}が駆けつけた`, 'info'); return; }
  }
}

// ---------- 敵AI ----------

export function enemyAct(b: BattleState, ctx: BattleCtx, e: Unit): void {
  const foe = (u: Unit) => (e.side === 'enemy' ? u.side !== 'enemy' : u.side === 'enemy');
  const friend = (u: Unit) => !foe(u) && u.side !== 'npc';
  const targets = b.units.filter((u) => !u.dead && foe(u));
  if (!targets.length) { e.moved = true; e.acted = true; return; }
  // 回復役
  const staff = staffOf(e);
  if (staff) {
    const hurt = b.units.filter((u) => friend(u) && !u.dead && u !== e && u.hp < u.maxHp * 0.6);
    if (hurt.length) {
      const reach = e.ai === 'hold' ? new Map([[idx(b, e.x, e.y), 0]]) : reachable(b, e);
      for (const k of reach.keys()) {
        const x = k % b.width, y = Math.floor(k / b.width);
        const t = hurt.find((h) => inRange(b, staff, Math.abs(h.x - x) + Math.abs(h.y - y)));
        if (t) { e.x = x; e.y = y; heal(b, e, t); return; }
      }
    }
  }
  const w = weaponOf(e);
  if (e.ai === 'ambush' && !e.aiActive) {
    const threat = enemyThreat(b, e);
    if (targets.some((t) => threat.has(idx(b, t.x, t.y)))) e.aiActive = true;
    else return;
  }
  const reach = e.ai === 'hold' ? new Map([[idx(b, e.x, e.y), 0]]) : reachable(b, e);
  let best: { score: number; x: number; y: number; t: Unit } | null = null;
  if (w && canUseNow(b, e, w)) {
    for (const k of reach.keys()) {
      const x = k % b.width, y = Math.floor(k / b.width);
      for (const t of targets) {
        const d = Math.abs(t.x - x) + Math.abs(t.y - y);
        if (!inRange(b, w, d)) continue;
        const f = forecast(b, e, t, x, y, ctx.support);
        if (!f.atk.canAttack) continue;
        const exp = f.atk.dmg * f.atk.count * (f.atk.hit / 100);
        const kill = f.atk.dmg * f.atk.count >= t.hp && f.atk.hit > 0;
        let score = exp * 3 + (kill ? 1000 + f.atk.hit * 2 : 0) + (staffOf(t) ? 40 : 0) + (100 - (t.hp / t.maxHp) * 100) * 0.3;
        if (t.escort) score += 60;
        score -= f.def.canAttack ? f.def.dmg * f.def.count * (f.def.hit / 100) * 0.8 : 0;
        score += terrainDef(tile(b, x, y)).avo * 0.2;
        if (!best || score > best.score) best = { score, x, y, t };
      }
    }
  }
  if (best) { e.x = best.x; e.y = best.y; attack(b, ctx, e, best.t); return; }
  if (e.ai === 'hold') return;
  // 近づく：一番近い相手へ向かう（移動コストを考えた距離）
  const goal = nearestTarget(b, e, targets);
  if (!goal) return;
  let pick: { k: number; d: number } | null = null;
  for (const k of reach.keys()) {
    const d = goal.get(k) ?? Infinity;
    if (!pick || d < pick.d) pick = { k, d };
  }
  if (pick) { e.x = pick.k % b.width; e.y = Math.floor(pick.k / b.width); }
  e.moved = true; e.acted = true;
}

/** オートプレイ用：味方フェーズを自動で行う */
export function autoPlayerPhase(b: BattleState, ctx: BattleCtx): void {
  for (const u of b.units.filter((x) => (x.side === 'player' || x.side === 'ally') && !x.dead && !x.acted)) {
    if (b.phase !== 'player') return;
    if (u.hp <= u.maxHp * 0.35 && u.item && !u.acted) { useItem(b, u); continue; }
    if (b.objective === 'seize' && b.goal && !b.units.some((x) => x.boss && !x.dead)) {
      const r = reachable(b, u);
      const gk = b.goal.y * b.width + b.goal.x;
      if (r.has(gk)) { u.x = b.goal.x; u.y = b.goal.y; wait(b, u); continue; }
    }
    enemyAct(b, ctx, u);
    u.moved = true; u.acted = true;
    if (canVisit(b, u)) visit(b, u);
  }
  const npc = b.units.find((x) => x.escort && !x.dead);
  if (npc && b.objective === 'escort' && b.goal && b.phase === 'player') {
    const r = reachable(b, npc);
    let best: { k: number; d: number } | null = null;
    for (const k of r.keys()) {
      const x = k % b.width, y = Math.floor(k / b.width);
      const danger = b.units.filter((e) => e.side === 'enemy' && !e.dead && Math.abs(e.x - x) + Math.abs(e.y - y) <= 3).length;
      const d = Math.abs(x - b.goal.x) + Math.abs(y - b.goal.y) + danger * 3;
      if (!best || d < best.d) best = { k, d };
    }
    if (best) { npc.x = best.k % b.width; npc.y = Math.floor(best.k / b.width); }
    npc.acted = true; npc.moved = true;
    checkEnd(b);
  }
}

/** すべての相手からの距離マップ（敵の移動タイプで） */
function nearestTarget(b: BattleState, e: Unit, targets: Unit[]): Map<number, number> | null {
  const dist = new Map<number, number>();
  const q: [number, number][] = [];
  for (const t of targets) { const k = idx(b, t.x, t.y); dist.set(k, 0); q.push([k, 0]); }
  while (q.length) {
    q.sort((a, c) => a[1] - c[1]);
    const [k, c] = q.shift()!;
    const x = k % b.width, y = Math.floor(k / b.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= b.width || ny >= b.height) continue;
      const cost = moveCost(b, e, tile(b, nx, ny));
      if (cost >= 99) continue;
      const nk = idx(b, nx, ny);
      const nc = c + cost;
      if ((dist.get(nk) ?? Infinity) <= nc) continue;
      dist.set(nk, nc); q.push([nk, nc]);
    }
  }
  return dist;
}

// ---------- 勝敗 ----------

export function checkEnd(b: BattleState): void {
  if (b.phase === 'done') return;
  const players = b.units.filter((u) => (u.side === 'player') && !u.dead);
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.dead);
  const npc = b.units.find((u) => u.escort);
  if (!players.length) return finish(b, 'lose');
  if (npc && npc.dead) return finish(b, 'lose');
  if (b.objective === 'rout' && !enemies.length) return finish(b, 'win');
  if (b.objective === 'boss' && !b.units.some((u) => u.boss && !u.dead)) return finish(b, 'win');
  if (b.objective === 'defend' && !enemies.length) return finish(b, 'win');
  if (b.objective === 'escort' && npc && b.goal && npc.x === b.goal.x && npc.y === b.goal.y) return finish(b, 'win');
  if (b.objective === 'escort' && !enemies.length && !npc) return finish(b, 'win');
  if (b.objective === 'seize' && b.goal && players.some((u) => u.x === b.goal!.x && u.y === b.goal!.y)) return finish(b, 'win');
  if (b.objective === 'seize' && !enemies.length) return finish(b, 'win');
}

export function finish(b: BattleState, result: 'win' | 'lose'): void {
  b.phase = 'done'; b.result = result;
  log(b, result === 'win' ? '勝利！' : '敗北……', 'info');
  for (const u of b.units) if (!u.dead && (u.side === 'player') && u.studentId) u.expGain += B.battle.exp.survive;
}

export function allActed(b: BattleState): boolean {
  return b.units.filter((u) => u.side !== 'enemy' && !u.dead && u.side !== 'npc').every((u) => u.acted);
}

export { weaponSkillId };
