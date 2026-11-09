// 19夜目：おまかせ（味方を同じ計算で自動に動かす）。運はないので、同じ盤面なら同じ結果
import { TB, TECH_BY_ID } from '../../data/tactics';
import type { TBattle, TUnit } from './types';
import { attack, heal, moveOnly, endTurn, insight, insightTargets, command, mine, foes, unit, reach, calc, bestSpot, attacksOf, healsOf, threatAt, isForest, boss, dist, usePotion, key, inRange, swapTargets, swapUnits, openables, openAt, ignitables, ignite } from './engine';

interface Plan { sc: number; run: () => void }

/** 1人ぶんのいちばんいい手 */
function bestFor(b: TBattle, u: TUnit, noDeath: boolean): Plan | null {
  let best: Plan | null = null;
  const consider = (sc: number, run: () => void) => { if (!best || sc > best.sc) best = { sc, run }; };
  if (u.teacher) {
    // 先生：見極め → 号令 → 下がる
    const ins = insightTargets(b).sort((p, q) => Number(!!q.boss) - Number(!!p.boss))[0];
    if (ins) consider(ins.boss ? 45 : 18, () => insight(b, ins.uid));
    if (b.command > 0) {
      const strong = mine(b).filter((m) => m.acted && !m.teacher).map((m) => ({ m, v: bestAttackScore(b, m) })).sort((p, q) => q.v - p.v)[0];
      if (strong && strong.v >= 40) consider(strong.v - 5, () => command(b, strong.m.uid));
    }
  }
  if (u.potion && u.hp < u.max * 0.4) consider(30, () => usePotion(b, u.uid));
  // 宿敵戦：深手の子は、宿敵の届かない場所へ下がる（命の危険を読んで避ける）
  // 20夜目：宿敵の一撃で倒れる子（命の危険）は、攻撃よりも先に下がる。届かない場所がなければ、なるべく遠く・仲間のかげへ
  const nem = b.nemesisId ? foes(b).find((f) => f.nemesis && f.broken <= 1 && !f.fleeing) : null;
  if (nem && !u.teacher && !u.raised && !u.helper) {
    const hit = calc(b, nem, u, null, { rage: true }).total;
    const danger = hit >= u.hp || u.hp <= u.max * 0.6;
    const reachN = nem.mov + nem.rmax;
    const now = Math.abs(nem.x - u.x) + Math.abs(nem.y - u.y);
    if (danger && now <= reachN + 1) {
      if (u.potion && hit >= u.hp && u.hp + TB.potionHeal > hit) consider(85, () => usePotion(b, u.uid));
      const R = reach(b, u);
      let safe: { x: number; y: number; sc: number; d: number } | null = null;
      for (const [k, st] of Object.entries(R)) {
        const [x, y] = k.split('-').map(Number);
        const d = Math.abs(nem.x - x) + Math.abs(nem.y - y);
        const guarded = mine(b).some((m) => m !== u && m.alive && (m.traits?.includes('guard') ?? false) && Math.abs(m.x - x) + Math.abs(m.y - y) === 1);
        const sc = (d > reachN ? 100 : d * 6) + (guarded ? 40 : 0) - threatAt(b, u, x, y) * 0.5 - st * 0.1;
        if (!safe || sc > safe.sc) safe = { x, y, sc, d };
      }
      if (safe) consider(hit >= u.hp ? (safe.d > reachN ? 95 : 70) : safe.d > reachN ? 60 : 26, () => moveOnly(b, u.uid, safe!.x, safe!.y));
    }
  }
  // 21夜目：入れ替え：命の危険のしるしがついた仲間を、自分のいる安全な場所と入れ替えて逃がす
  if (u.traits?.includes('swap')) {
    for (const o of swapTargets(b, u)) {
      if (o.side !== 'me' || o.teacher) continue;
      const lethal = foes(b).filter((f) => f.aim && 't' in f.aim && f.aim.t === o.uid && f.aim.lethal);
      if (!lethal.length) continue;
      // 入れ替えたあと：仲間は自分のいた場所（命の危険の敵の届かない所か）・自分は仲間の場所（自分は倒れないか）
      const safeFor = (who: TUnit, x: number, y: number) => lethal.every((f) => Math.abs(f.x - x) + Math.abs(f.y - y) > f.mov + f.rmax || calc(b, f, who, null, { rage: f.rage }).total < who.hp);
      if (safeFor(o, u.x, u.y) && lethal.every((f) => calc(b, f, u, null, { rage: f.rage }).total < u.hp)) consider(93, () => swapUnits(b, u.uid, o.uid));
    }
  }
  // 21夜目：宝箱・扉（盗賊の系統）。薬の宝箱 > 武器の宝箱 > 扉
  for (const it of openables(b, u)) {
    const c = it.kind === 'chest' ? b.chests?.find((x) => x.x === it.x && x.y === it.y) : null;
    consider(it.kind === 'door' ? 14 : c?.kind === 'potion' ? 24 : 20, () => openAt(b, u.uid, it.x, it.y));
  }
  // 21夜目：火矢で砦の木の門を焼く
  for (const it of ignitables(b, u)) if (it.gate) consider(b.nemesisId ? 34 : 22, () => ignite(b, u.uid, it.x, it.y));
  for (const h of healsOf(u)) {
    for (const o of mine(b)) {
      if (o === u || o.hp >= o.max * 0.6) continue;
      const R = reach(b, u);
      const ok = Object.keys(R).some((k) => { const [x, y] = k.split('-').map(Number); const dd = Math.abs(x - o.x) + Math.abs(y - o.y); return dd >= 1 && dd <= 2; });
      if (ok) consider(25 + (o.max - o.hp) + (o.teacher ? 20 : 0), () => heal(b, u.uid, o.uid, h));
    }
  }
  for (const f of foes(b)) {
    for (const t of attacksOf(u)) {
      const spot = bestSpot(b, u, f, t);
      if (!spot) continue;
      const sc = scoreAttack(b, u, f, t, spot);
      consider(sc, () => attack(b, u.uid, f.uid, t, spot, { noDeath, keepUndo: true }));
    }
  }
  if (!best || (best as Plan).sc < 0) {
    // 届かない：目指す場所へ近づく（先生は後ろに）
    const goal = goalFor(b, u);
    const R = reach(b, u);
    let mv: { x: number; y: number; sc: number } | null = null;
    for (const [k, steps] of Object.entries(R)) {
      const [x, y] = k.split('-').map(Number);
      const d = goal ? Math.abs(x - goal.x) + Math.abs(y - goal.y) : 0;
      const danger = threatAt(b, u, x, y);
      const sc = (u.teacher ? danger * 3 - Math.min(d, 6) : d * 4 + (danger > u.hp ? danger : danger / 3)) - (isForest(b, x, y) ? 4 : 0) + steps * 0.1;
      if (!mv || sc < mv.sc) mv = { x, y, sc };
    }
    if (mv) consider(-1, () => moveOnly(b, u.uid, mv!.x, mv!.y));
  }
  return best;
}

function goalFor(b: TBattle, u: TUnit): { x: number; y: number } | null {
  if (b.objective === 'escape' && u.teacher) return { x: u.x, y: b.exitRow ?? 0 };
  if (b.objective === 'rescue' && b.captive && !b.captive.freed) return b.captive;
  if (u.teacher) { const kids = mine(b).filter((m) => !m.teacher); if (!kids.length) return null; const cx = Math.round(kids.reduce((a, m) => a + m.x, 0) / kids.length); const cy = Math.max(...kids.map((m) => m.y)); return { x: cx, y: Math.min(b.h - 1, cy + 1) }; }
  const bs = boss(b);
  const fl = foes(b);
  if (bs?.alive && fl.length <= 2) return bs;
  return fl.sort((p, q) => dist(u, p) - dist(u, q))[0] ?? null;
}

function scoreAttack(b: TBattle, u: TUnit, f: TUnit, t: string | null, spot: { x: number; y: number }): number {
  const ox = u.x, oy = u.y;
  u.x = spot.x; u.y = spot.y;
  const c = calc(b, u, f, t);
  const dmg = Math.min(c.total, f.hp);
  let sc = dmg + c.shields * 10 + (c.brk ? 28 : 0) + (c.kill ? 30 + (f.boss ? 60 : 0) : 0) + (f.boss ? 6 : 0) + (f.broken > 0 ? 8 : 0);
  if (c.resisted) sc -= 12;
  if (t) { const d = TECH_BY_ID[t]; const useful = c.shields > 0 || c.kill || f.boss || f.broken > 0; sc -= useful ? 2 : 10; if (d && d.hits > 1 && f.broken > 0) sc += 6; }
  // 危ない場所に立つのはさける（命の危険がある宿敵戦では、とくに）
  const danger = threatAt(b, u, spot.x, spot.y);
  if (danger >= u.hp) sc -= b.nemesisId ? 40 : 15;
  // 宿敵戦：宿敵の一撃で倒れる場所は「命の危険」。とても避ける
  const nem = b.nemesisId ? foes(b).find((f) => f.nemesis && f.broken === 0) : null;
  if (nem && !u.teacher) { const dd = Math.abs(nem.x - spot.x) + Math.abs(nem.y - spot.y); const hit = Math.max(1, (nem.magic ? nem.mag : nem.str) + nem.might + (nem.rage ? TB.ragePow : 0) - (nem.magic ? (u.res ?? Math.floor(u.def * TB.magicDefRate)) : u.def)); if (dd <= nem.mov + nem.rmax && hit >= u.hp) sc -= 90; }
  if (u.teacher) sc -= 25 + (danger > 0 ? 30 : 0);
  u.x = ox; u.y = oy;
  return sc;
}
function bestAttackScore(b: TBattle, u: TUnit): number {
  let best = 0;
  for (const f of foes(b)) for (const t of attacksOf(u)) { const sp = bestSpot(b, u, f, t); if (sp) best = Math.max(best, scoreAttack(b, u, f, t, sp)); }
  return best;
}

/** おまかせで1ターン（味方の番）を進める */
export function autoTurn(b: TBattle, opt: { noDeath?: boolean } = {}): void {
  let guard = 0;
  const all: TBattle['fx'] = [];
  while (b.phase === 'player' && guard++ < 30) {
    const ready = mine(b).filter((m) => !m.acted);
    if (!ready.length) break;
    // いちばん得点の高い手から（先生は最後に回りやすい）
    let pick: { u: TUnit; p: Plan } | null = null;
    for (const u of ready) { const p = bestFor(b, u, !!opt.noDeath); if (p && (!pick || p.sc > pick.p.sc)) pick = { u, p }; }
    if (!pick) break;
    const before = pick.u.acted;
    b.fx = [];
    pick.p.run();
    all.push(...b.fx);
    if (!pick.u.acted && before === pick.u.acted && !(b.phase !== 'player')) { pick.u.acted = true; }
  }
  b.undo = null;
  if (b.phase === 'player') { endTurn(b, opt); all.push(...b.fx); }
  b.fx = all;
}

/** おまかせで最後まで */
export function autoFinish(b: TBattle, opt: { noDeath?: boolean } = {}): void {
  b.auto = true;
  let guard = 0;
  while (b.phase !== 'done' && guard++ < TB.autoGuard) autoTurn(b, opt);
  void unit; void key; void inRange;
}
