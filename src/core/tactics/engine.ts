// 19夜目：新しい戦いの計算（運なし。必ず当たり、決まった計算）。DOMに依存しない
import { TB, TECH_BY_ID, MAGIC_TYPES, ATK_NAME, type AtkType, type TechDef } from '../../data/tactics';
import type { TBattle, TUnit, TFx } from './types';

export const key = (x: number, y: number) => `${x}-${y}`;
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function unit(b: TBattle, uid: string | null | undefined): TUnit | null { return uid ? b.units.find((u) => u.uid === uid) ?? null : null; }
export function at(b: TBattle, x: number, y: number): TUnit | null { return b.units.find((u) => u.alive && u.x === x && u.y === y) ?? null; }
export function mine(b: TBattle): TUnit[] { return b.units.filter((u) => u.side === 'me' && u.alive); }
export function foes(b: TBattle): TUnit[] { return b.units.filter((u) => u.side === 'foe' && u.alive); }
export function boss(b: TBattle): TUnit | null { return b.units.find((u) => u.side === 'foe' && u.boss) ?? null; }
export function isForest(b: TBattle, x: number, y: number): boolean { return b.forest.includes(key(x, y)); }
export function blocked(b: TBattle, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return true;
  if (b.rock.includes(key(x, y))) return true;
  if (b.captive && !b.captive.freed && b.captive.x === x && b.captive.y === y) return true;
  return false;
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** 動ける範囲（仲間の上は通れるが止まれない。敵の上は通れない）。key→歩数 */
export function reach(b: TBattle, u: TUnit, mov = u.mov): Record<string, number> {
  const seen: Record<string, number> = { [key(u.x, u.y)]: 0 };
  const q: [number, number][] = [[u.x, u.y]];
  while (q.length) {
    const [x, y] = q.shift()!;
    const d = seen[key(x, y)];
    if (d >= mov) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (blocked(b, nx, ny) || k in seen) continue;
      const o = at(b, nx, ny);
      if (o && o.side !== u.side) continue;
      seen[k] = d + 1;
      q.push([nx, ny]);
    }
  }
  // 仲間のいるマスには止まれない
  for (const k of Object.keys(seen)) { const [x, y] = k.split('-').map(Number); const o = at(b, x, y); if (o && o !== u) delete seen[k]; }
  return seen;
}
/** 道のり（敵が近づくときの目安） */
export function pathDist(b: TBattle, u: TUnit, tx: number, ty: number): number {
  const seen: Record<string, number> = { [key(u.x, u.y)]: 0 };
  const q: [number, number][] = [[u.x, u.y]];
  while (q.length) {
    const [x, y] = q.shift()!;
    const d = seen[key(x, y)];
    if (x === tx && y === ty) return d;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (blocked(b, nx, ny) || k in seen) continue;
      const o = at(b, nx, ny);
      if (o && o.side !== u.side && !(nx === tx && ny === ty)) continue;
      seen[k] = d + 1;
      q.push([nx, ny]);
    }
  }
  return 99;
}

export function techOf(id: string | null | undefined): TechDef | null { return id ? TECH_BY_ID[id] ?? null : null; }
export function rangeOf(u: TUnit, tech: TechDef | null): [number, number] { return tech?.range ?? [u.rmin, u.rmax]; }
export function defOf(b: TBattle, u: TUnit): number {
  return u.def + (isForest(b, u.x, u.y) ? TB.forestDef : 0) - (u.bonus?.note?.includes('reckless') ? TB.recklessDef : 0);
}

export interface Calc { per: number; hits: number; total: number; weak: boolean; resisted: boolean; broken: boolean; type: AtkType; shields: number; brk: boolean; kill: boolean; lethal: boolean }

/** 攻撃の見込み（必ず当たる）。pos を渡すと、そのマスから攻撃したときの守り（森）を使う */
export function calc(b: TBattle, a: TUnit, d: TUnit, techId?: string | null, opt: { rage?: boolean } = {}): Calc {
  const tech = techOf(techId);
  const type: AtkType = tech?.type ?? a.type;
  const magic = MAGIC_TYPES.includes(type) || (!tech && a.magic);
  const base = magic ? a.mag : a.str;
  let atk = base + a.might + (tech ? tech.pow + Math.floor(a.skl / TB.sklDiv) : 0) + (opt.rage ? TB.ragePow : 0);
  atk += a.bonus?.dmg ?? 0;
  if (d.officerId && a.bonus?.vsOfficer && d.nemesis) atk += a.bonus.vsOfficer;
  if (a.bonus?.vsClass?.[d.classId]) atk += a.bonus.vsClass[d.classId];
  if (a.teacher) atk = Math.round(atk * TB.teacherAtk);
  let df = defOf(b, d);
  if (magic) df = Math.floor(df * TB.magicDefRate);
  df += d.bonus?.prot ?? 0;
  if (d.bonus?.protFrom?.[a.classId]) df += d.bonus.protFrom[a.classId];
  if (d.bonus?.protFrom?.[type]) df += d.bonus.protFrom[type];
  const resisted = d.resist.includes(type);
  let per = Math.max(1, atk - df);
  if (resisted) per = Math.max(1, Math.floor(per / TB.resistDiv));
  const broken = d.broken > 0;
  if (broken) per *= TB.breakMul;
  const hits = tech ? tech.hits : a.spd >= d.spd + TB.doubleSpd ? 2 : 1;
  const weak = d.side === 'foe' && d.weak.includes(type) && !resisted;
  const shields = weak && !broken ? Math.min(d.sh, hits) : 0;
  const total = per * hits;
  const brk = !broken && shields > 0 && d.sh - shields <= 0 && d.hp - total > 0;
  const kill = total >= d.hp && !(d.nemesis && !d.clung && !broken);
  const lethal = a.side === 'foe' && total >= d.hp && !!(b.nemesisId && (a.nemesis || a.boss)) && !d.teacher;
  return { per, hits, total, weak, resisted, broken, type, shields, brk, kill, lethal };
}

/** その子の使える攻撃（ふつうの攻撃＝null と、のこりのある技） */
export function attacksOf(u: TUnit): (string | null)[] {
  const out: (string | null)[] = [null];
  for (const t of u.techs) { const d = TECH_BY_ID[t.id]; if (d && !d.heal && t.left > 0) out.push(t.id); }
  return u.teacher ? [null] : out;
}
export function healsOf(u: TUnit): string[] { return u.techs.filter((t) => TECH_BY_ID[t.id]?.heal && t.left > 0).map((t) => t.id); }

/** そのマスから届く敵 */
export function inRange(b: TBattle, u: TUnit, x: number, y: number, d: TUnit, techId: string | null): boolean {
  const [mn, mx] = rangeOf(u, techOf(techId));
  const dd = Math.abs(x - d.x) + Math.abs(y - d.y);
  return dd >= mn && dd <= mx;
}

/** 選んだ子が攻撃できる敵（青い範囲のどこかから、どれかの攻撃が届く） */
export function attackable(b: TBattle, u: TUnit): TUnit[] {
  const R = reach(b, u);
  const atks = attacksOf(u);
  return foes(b).filter((f) => Object.keys(R).some((k) => { const [x, y] = k.split('-').map(Number); return atks.some((t) => inRange(b, u, x, y, f, t)); }));
}
/** 回復できる仲間 */
export function healable(b: TBattle, u: TUnit): TUnit[] {
  if (!healsOf(u).length) return [];
  const R = reach(b, u);
  return mine(b).filter((o) => o !== u && o.hp < o.max && Object.keys(R).some((k) => { const [x, y] = k.split('-').map(Number); const dd = Math.abs(x - o.x) + Math.abs(y - o.y); return dd >= 1 && dd <= 2; }));
}

/** 敵がそのマスの子を狙える数（危なさ。自動で動く場所を選ぶときに使う） */
export function threatAt(b: TBattle, me: TUnit, x: number, y: number): number {
  let n = 0;
  for (const f of foes(b)) {
    if (f.broken > 0) continue;
    const dd = Math.abs(f.x - x) + Math.abs(f.y - y);
    if (dd <= f.mov + f.rmax) n += Math.max(1, f.str + f.might - me.def);
  }
  return n;
}

/** いちばんいい場所：届くマスのうち、森＞危なくない＞動きが少ない */
export function bestSpot(b: TBattle, u: TUnit, d: TUnit, techId: string | null): { x: number; y: number } | null {
  const R = reach(b, u);
  let best: { x: number; y: number; sc: number } | null = null;
  for (const [k, steps] of Object.entries(R)) {
    const [x, y] = k.split('-').map(Number);
    if (!inRange(b, u, x, y, d, techId)) continue;
    const far = Math.abs(x - d.x) + Math.abs(y - d.y);
    const sc = (isForest(b, x, y) ? -30 : 0) + threatAt(b, u, x, y) * 2 + steps - far * 3;
    if (!best || sc < best.sc) best = { x, y, sc };
  }
  return best ? { x: best.x, y: best.y } : null;
}

// ---------- 行動 ----------

function snapshot(b: TBattle): string { const { undo: _u, fx: _f, ...rest } = b; return JSON.stringify(rest); }
function remember(b: TBattle): void { b.undo = snapshot(b); }
/** ひとつ戻す */
export function undoLast(b: TBattle): boolean {
  if (!b.undo || b.phase !== 'player') return false;
  const prev = JSON.parse(b.undo) as TBattle;
  Object.assign(b, prev, { undo: null, fx: [] });
  return true;
}

function say(b: TBattle, u: TUnit, keyName: string, fx: TFx[]): void {
  const text = b.lines?.[`${u.uid}:${keyName}`] ?? b.lines?.[keyName];
  const k = `${u.uid}:${keyName}`;
  if (!text || b.said.includes(k)) return;
  b.said.push(k);
  fx.push({ k: 'say', by: u.uid, text, tone: u.side === 'foe' ? 'nemesis' : 'me' });
  b.log.push({ turn: b.turn, text: `${u.name}「${text}」` });
  if (u.nemesis) b.scenes.push({ turn: b.turn, text: `${u.name}「${text}」`, big: true });
}
function log(b: TBattle, text: string, big = false): void { b.log.push({ turn: b.turn, text, big }); if (big) b.scenes.push({ turn: b.turn, text, big }); }

/** 攻撃する（spot に動いてから）。死なしの設定は noDeath */
export function attack(b: TBattle, uid: string, targetUid: string, techId: string | null, spot?: { x: number; y: number } | null, opt: { noDeath?: boolean; keepUndo?: boolean } = {}): TFx[] {
  const a = unit(b, uid), d = unit(b, targetUid);
  const fx: TFx[] = [];
  if (!a || !d || !a.alive || !d.alive || a.acted || b.phase === 'done') return fx;
  if (!opt.keepUndo) remember(b);
  const pos = spot ?? bestSpot(b, a, d, techId);
  if (!pos) return fx;
  if (pos.x !== a.x || pos.y !== a.y) { a.x = pos.x; a.y = pos.y; fx.push({ k: 'move', uid: a.uid, x: a.x, y: a.y }); }
  if (!inRange(b, a, a.x, a.y, d, techId)) return fx;
  strike(b, a, d, techId, fx, opt.noDeath ?? false, false);
  a.acted = true;
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}

function strike(b: TBattle, a: TUnit, d: TUnit, techId: string | null, fx: TFx[], noDeath: boolean, rage: boolean): void {
  const tech = techOf(techId);
  const tt = a.techs.find((t) => t.id === techId);
  if (tt) tt.left -= 1;
  if (tech && (d.boss || tech.hits > 1)) fx.push({ k: 'cutin', by: a.uid, title: `${tech.name}！`, sub: `${a.name}の技` });
  const c = calc(b, a, d, techId, { rage });
  let shieldGone = 0;
  for (let i = 0; i < c.hits && d.alive; i++) {
    let dmg = c.per;
    // 執念：ブレイクしていないとき、一度だけ持ちこたえる（宿敵）
    if (d.nemesis && !d.clung && d.broken === 0 && d.hp - dmg <= 0) { dmg = d.hp - 1; d.clung = true; say(b, d, 'clung', fx); log(b, `${d.name}は執念で持ちこたえた！`, true); }
    d.hp = Math.max(0, d.hp - dmg);
    a.dealt += dmg; d.taken += dmg;
    d.lastHitBy = a.uid;
    d.lastType = c.type;
    if (a.studentId && !a.teacher) (d.hitBy ??= {})[a.studentId] = ((d.hitBy ??= {})[a.studentId] ?? 0) + dmg;
    let shield = false, brk = false;
    if (c.weak && d.sh > 0 && d.broken === 0) {
      d.sh -= 1; shield = true; shieldGone++; a.weakHits++;
      if (!d.known.includes(c.type)) { d.known.push(c.type); }
      (d.weakHitBy ??= []).includes(c.type) || d.weakHitBy!.push(c.type);
      if (d.sh === 0 && d.hp > 0) {
        d.broken = 2; brk = true; a.breaks++; d.aim = null;
        (d.brokenBy ??= []).push(a.studentId ?? a.uid);
      }
    }
    const kill = d.hp <= 0;
    fx.push({ k: 'hit', a: a.uid, d: d.uid, dmg, weak: c.weak, resisted: c.resisted, shield, brk, kill, tech: tech?.name, broken: d.broken > 0 && !brk });
    if (shield && !brk && d.nemesis && shieldGone === 1) say(b, d, 'shield', fx);
    if (brk) {
      log(b, `${d.name}の守りが崩れた！（ブレイク：次の番は動けず、受ける傷が2倍）`, !!d.boss);
      if (d.nemesis) say(b, d, 'break', fx);
    }
    if (kill) down(b, a, d, fx, noDeath, c.lethal || rage);
  }
  if (c.resisted && d.nemesis) say(b, d, 'resist', fx);
  const head = `${a.name}の${tech ? `「${tech.name}」` : '攻撃'}！ ${d.name}に${c.total}${c.weak ? `（弱点・${ATK_NAME[c.type]}）` : ''}${c.resisted ? '（効かない）' : ''}`;
  log(b, head);
  // 宿敵：追いつめられると、大技の構え・逃げる
  if (d.alive && d.nemesis) {
    if (!d.rage && !d.fleeing && d.hp / d.max <= TB.rageAt && !b.said.includes(`${d.uid}:rageArmed`)) { d.rage = true; b.said.push(`${d.uid}:rageArmed`); say(b, d, 'cornered', fx); log(b, `${d.name}が大技の構えに入った`, true); }
    if (!d.fleeing && d.hp / d.max <= TB.fleeAt && b.lines?.[`${d.uid}:canFlee`] !== 'no') { d.fleeing = true; d.rage = false; say(b, d, 'flee', fx); log(b, `${d.name}は退こうとしている！`, true); }
  }
}

function down(b: TBattle, a: TUnit, d: TUnit, fx: TFx[], noDeath: boolean, lethal: boolean): void {
  d.alive = false;
  a.kills++;
  if (d.side === 'me') {
    d.down = d.teacher ? 'out' : lethal ? (noDeath ? 'injured' : 'dead') : 'injured';
    if (a.nemesis) say(b, a, 'kill', fx);
    log(b, d.down === 'dead' ? `${d.name}が倒れた……` : d.teacher ? `${d.name}が倒れた！` : `${d.name}は深手を負って退いた`, true);
  } else {
    d.down = 'dead';
    if (d.nemesis) { say(b, d, 'fall', fx); log(b, `${d.name}を討ち取った！`, true); }
    else log(b, `${d.name}は倒れた`);
  }
}

/** 回復 */
export function heal(b: TBattle, uid: string, targetUid: string, techId: string, spot?: { x: number; y: number } | null): TFx[] {
  const a = unit(b, uid), d = unit(b, targetUid);
  const fx: TFx[] = [];
  const tech = techOf(techId);
  const tt = a?.techs.find((t) => t.id === techId);
  if (!a || !d || !tech?.heal || !tt || tt.left <= 0 || a.acted) return fx;
  remember(b);
  let pos = spot ?? null;
  if (!pos) {
    const R = reach(b, a);
    let best: { x: number; y: number; sc: number } | null = null;
    for (const [k, steps] of Object.entries(R)) { const [x, y] = k.split('-').map(Number); const dd = Math.abs(x - d.x) + Math.abs(y - d.y); if (dd < 1 || dd > 2) continue; const sc = threatAt(b, a, x, y) * 2 + steps - (isForest(b, x, y) ? 30 : 0); if (!best || sc < best.sc) best = { x, y, sc }; }
    pos = best;
  }
  if (!pos) return fx;
  if (pos.x !== a.x || pos.y !== a.y) { a.x = pos.x; a.y = pos.y; fx.push({ k: 'move', uid: a.uid, x: a.x, y: a.y }); }
  tt.left -= 1;
  const amt = Math.min(d.max - d.hp, tech.heal);
  d.hp += amt;
  fx.push({ k: 'heal', a: a.uid, d: d.uid, amt, tech: tech.name });
  log(b, `${a.name}の「${tech.name}」 ${d.name}のHPが${amt}戻った`);
  a.acted = true;
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}

/** 動くだけ（そのあと待機） */
export function moveOnly(b: TBattle, uid: string, x: number, y: number): TFx[] {
  const u = unit(b, uid);
  const fx: TFx[] = [];
  if (!u || u.acted || b.phase !== 'player') return fx;
  const R = reach(b, u);
  if (!(key(x, y) in R)) return fx;
  remember(b);
  if (x !== u.x || y !== u.y) { u.x = x; u.y = y; fx.push({ k: 'move', uid: u.uid, x, y }); }
  u.acted = true;
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}

/** 傷薬 */
export function usePotion(b: TBattle, uid: string): TFx[] {
  const u = unit(b, uid);
  const fx: TFx[] = [];
  if (!u || u.acted || !u.potion || u.hp >= u.max) return fx;
  remember(b);
  u.potion -= 1;
  const amt = Math.min(u.max - u.hp, TB.potionHeal);
  u.hp += amt;
  fx.push({ k: 'heal', a: u.uid, d: u.uid, amt, tech: '傷薬' });
  log(b, `${u.name}は傷薬を使った（HP+${amt}）`);
  u.acted = true;
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}

/** 先生の号令：動き終えた子をもう一度動かす */
export function command(b: TBattle, allyUid: string): TFx[] {
  const t = unit(b, b.teacherUid), a = unit(b, allyUid);
  const fx: TFx[] = [];
  if (!t || !a || !t.alive || t.acted || b.command <= 0 || !a.acted || a.teacher || !a.alive) return fx;
  remember(b);
  b.command -= 1;
  t.acted = true;
  a.acted = false;
  fx.push({ k: 'cutin', by: t.uid, title: '号令！', sub: `${a.name}、もう一度！` });
  log(b, `${t.name}の号令！ ${a.name}がもう一度動ける`, true);
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}
/** 先生の見極め：隠れた弱点を1つ明かす（届く距離） */
export function insight(b: TBattle, foeUid: string): TFx[] {
  const t = unit(b, b.teacherUid), f = unit(b, foeUid);
  const fx: TFx[] = [];
  if (!t || !f || !t.alive || t.acted || b.insight <= 0 || dist(t, f) > TB.insightRange) return fx;
  const hidden = f.weak.find((w) => !f.known.includes(w));
  if (!hidden) return fx;
  remember(b);
  b.insight -= 1;
  t.acted = true;
  f.known.push(hidden);
  fx.push({ k: 'reveal', d: f.uid, type: hidden });
  log(b, `${t.name}の見極め：${f.name}の弱点は「${ATK_NAME[hidden]}」だ`, !!f.boss);
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}
export function insightTargets(b: TBattle): TUnit[] {
  const t = unit(b, b.teacherUid);
  if (!t || !t.alive || t.acted || b.insight <= 0) return [];
  return foes(b).filter((f) => dist(t, f) <= TB.insightRange && f.weak.some((w) => !f.known.includes(w)));
}

/** 待機 */
export function wait(b: TBattle, uid: string): void {
  const u = unit(b, uid);
  if (!u || u.acted) return;
  remember(b);
  u.acted = true;
  afterAction(b, []);
}

function afterAction(b: TBattle, fx: TFx[]): void {
  // 救い出す：捕らわれた人のとなりに着いた
  if (b.captive && !b.captive.freed) {
    const c = b.captive;
    const by = mine(b).find((u) => Math.abs(u.x - c.x) + Math.abs(u.y - c.y) === 1);
    if (by) { c.freed = true; log(b, `${by.name}が${c.name}を助け出した！`, true); fx.push({ k: 'say', by: by.uid, text: `${c.name}、もう大丈夫だ！`, tone: 'me' }); }
  }
  intents(b);
  checkEnd(b);
}

// ---------- 敵 ----------

/** 敵の次の狙い（前もって見せる） */
export function intents(b: TBattle): void {
  for (const f of foes(b)) {
    f.aim = null;
    if (f.broken > 0) continue;
    if (f.fleeing) { f.aim = { flee: true }; continue; }
    const targets = mine(b);
    if (!targets.length) continue;
    let best: { m: TUnit; sc: number } | null = null;
    for (const m of targets) {
      const d = f.rmax > 1 ? Math.max(0, dist(f, m) - f.rmax) : pathDist(b, f, m.x, m.y);
      let sc = d * 100 + m.hp;
      if (f.grudge && (m.studentId === f.grudge)) sc -= 400; // 前に自分をやった子を、真っ先に
      if (f.boss && m.teacher) sc -= 60; // 宿敵は先生も狙う
      if (!best || sc < best.sc) best = { m, sc };
    }
    if (!best) continue;
    const can = canHit(b, f, best.m);
    const c = calc(b, f, best.m, null, { rage: f.rage });
    f.aim = can ? { t: best.m.uid, dmg: c.total, lethal: c.lethal || (!!f.rage && c.total >= best.m.hp && !best.m.teacher && !!b.nemesisId), rage: f.rage } : { t: best.m.uid, dmg: 0, lethal: false, approach: true };
  }
}
export function canHit(b: TBattle, f: TUnit, m: TUnit): boolean {
  const R = reach(b, f);
  for (const k of Object.keys(R)) { const [x, y] = k.split('-').map(Number); const d = Math.abs(x - m.x) + Math.abs(y - m.y); if (d >= f.rmin && d <= f.rmax) return true; }
  return false;
}

/** ターンを終える：敵の番を最後まで進め、次のターンへ */
export function endTurn(b: TBattle, opt: { noDeath?: boolean } = {}): TFx[] {
  const fx: TFx[] = [];
  if (b.phase !== 'player') return fx;
  b.undo = null;
  b.phase = 'enemy';
  fx.push({ k: 'phase', side: 'foe', turn: b.turn });
  // ブレイクから立ち直る（崩れた次の自分の番は、まだ動けない）
  for (const f of foes(b)) if (f.broken === 1) { f.broken = 0; f.sh = f.shMax; }
  for (const f of [...foes(b)]) {
    if (b.phase !== 'enemy') break;
    if (!f.alive) continue;
    if (f.broken > 0) continue;
    if (f.fleeing) {
      if (f.edge) { f.alive = false; f.down = 'fled'; say(b, f, 'fled', fx); fx.push({ k: 'flee', uid: f.uid }); log(b, `${f.name}は逃げ去った`, true); checkEnd(b); continue; }
      const R = reach(b, f);
      let best: { x: number; y: number; sc: number } | null = null;
      for (const k of Object.keys(R)) { const [x, y] = k.split('-').map(Number); const sc = y * 10 + Math.abs(x - f.x); if (!best || sc < best.sc) best = { x, y, sc }; }
      if (best) { f.x = best.x; f.y = best.y; fx.push({ k: 'move', uid: f.uid, x: f.x, y: f.y }); }
      if (f.y === 0) { f.edge = true; log(b, `${f.name}は端に着いた。次の敵の番で逃げ去る！`, true); }
      continue;
    }
    const aimed = f.aim && 't' in f.aim ? unit(b, f.aim.t) : null;
    const target = aimed?.alive ? aimed : mine(b).sort((p, q) => dist(f, p) - dist(f, q))[0];
    if (!target) break;
    const R = reach(b, f);
    let spot: { x: number; y: number; sc: number } | null = null;
    for (const [k, steps] of Object.entries(R)) { const [x, y] = k.split('-').map(Number); const d = Math.abs(x - target.x) + Math.abs(y - target.y); if (d >= f.rmin && d <= f.rmax) { const sc = steps - (isForest(b, x, y) ? 1 : 0); if (!spot || sc < spot.sc) spot = { x, y, sc }; } }
    if (!spot) {
      for (const [k] of Object.entries(R)) { const [x, y] = k.split('-').map(Number); const sc = Math.abs(x - target.x) + Math.abs(y - target.y); if (!spot || sc < spot.sc) spot = { x, y, sc }; }
    }
    if (spot && (spot.x !== f.x || spot.y !== f.y)) { f.x = spot.x; f.y = spot.y; fx.push({ k: 'move', uid: f.uid, x: f.x, y: f.y }); }
    const tgt = inRangeBasic(f, target) ? target : mine(b).find((m) => inRangeBasic(f, m));
    if (!tgt) continue;
    const rage = !!f.rage;
    if (rage) { f.rage = false; fx.push({ k: 'cutin', by: f.uid, title: '渾身の一撃', sub: f.name }); }
    strike(b, f, tgt, null, fx, opt.noDeath ?? false, rage);
    checkEnd(b);
  }
  if ((b.phase as string) === 'done') { b.fx = fx; return fx; }
  // 次のターン
  for (const f of foes(b)) if (f.broken === 2) f.broken = 1;
  b.turn += 1;
  for (const u of b.units) u.acted = false;
  b.phase = 'player';
  fx.push({ k: 'phase', side: 'me', turn: b.turn });
  intents(b);
  checkEnd(b);
  b.fx = fx;
  return fx;
}
function inRangeBasic(f: TUnit, m: TUnit): boolean { const d = dist(f, m); return d >= f.rmin && d <= f.rmax; }

/** 勝ち負けの判定 */
export function checkEnd(b: TBattle): void {
  if (b.phase === 'done') return;
  const t = unit(b, b.teacherUid);
  const kids = mine(b).filter((u) => !u.teacher);
  if (t && !t.alive) return finish(b, 'lose', '先生が倒れた……');
  if (!kids.length && !t) return finish(b, 'lose', 'みな倒れた……');
  if (!kids.length) return finish(b, 'lose', '教え子がみな倒れた……');
  const bs = boss(b);
  const fl = foes(b);
  switch (b.objective) {
    case 'boss': if (bs && !bs.alive) return finish(b, 'win', bs.down === 'fled' ? `${bs.name}を退けた！` : `${bs.name}を討ち取った！`); if (!fl.length) return finish(b, 'win', '敵をすべて倒した！'); break;
    case 'rout': if (!fl.length) return finish(b, 'win', '敵をすべて倒した！'); break;
    case 'defend': if (!fl.length) return finish(b, 'win', '敵をすべて倒した！'); if (b.holdTurns && b.turn > b.holdTurns) return finish(b, 'win', '守り抜いた！'); break;
    case 'rescue': if (b.captive?.freed) return finish(b, 'win', `${b.captive.name}を救い出した！`); if (!fl.length) return finish(b, 'win', '敵をすべて倒した！'); break;
    case 'escape': if (t && t.y <= (b.exitRow ?? 0)) return finish(b, 'win', '囲みを抜けた！'); if (!fl.length) return finish(b, 'win', '敵をすべて倒した！'); break;
  }
  if (b.turn > TB.maxTurns) return finish(b, b.objective === 'defend' ? 'win' : 'lose', b.objective === 'defend' ? '守り抜いた！' : '日が暮れ、引き上げた');
}
function finish(b: TBattle, r: 'win' | 'lose', text: string): void {
  b.phase = 'done';
  b.result = r;
  b.undo = null;
  log(b, text, true);
  const bs = boss(b);
  if (bs?.nemesis) { if (r === 'lose') say(b, bs, 'win', []); }
}
