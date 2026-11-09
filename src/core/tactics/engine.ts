// 19夜目：新しい戦いの計算（運なし。必ず当たり、決まった計算）。DOMに依存しない
import { TB, TECH_BY_ID, MAGIC_TYPES, ATK_NAME, type AtkType, type TechDef } from '../../data/tactics';
import type { TBattle, TUnit, TFx } from './types';
import { TEACHER_RANK } from '../../data/balance';

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

/** 動ける範囲（仲間の上は通れるが止まれない。敵の上は通れない）。key→歩数
 *  20夜目：敵は結界の光の壁を通れない。槍聖（不動）の隣に入った敵は、そこで止まる */
export function reach(b: TBattle, u: TUnit, mov = u.mov): Record<string, number> {
  const seen: Record<string, number> = { [key(u.x, u.y)]: 0 };
  const q: [number, number][] = [[u.x, u.y]];
  const walls = u.side === 'foe' ? b.walls ?? [] : [];
  const holders = u.side === 'foe' ? b.units.filter((o) => o.side !== u.side && o.alive && !o.moved && T(o, 'unmoving')) : [];
  const stopAt = (x: number, y: number) => holders.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) === 1);
  while (q.length) {
    const [x, y] = q.shift()!;
    const d = seen[key(x, y)];
    if (d >= mov) continue;
    if (d > 0 && stopAt(x, y)) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (k in seen) continue;
      if (blocked(b, nx, ny) && !(flyer(u) && nx >= 0 && ny >= 0 && nx < b.w && ny < b.h && b.rock.includes(k))) continue;
      if (walls.includes(k)) continue;
      const o = at(b, nx, ny);
      if (o && o.side !== u.side) continue;
      seen[k] = d + 1;
      q.push([nx, ny]);
    }
  }
  // 仲間のいるマス・岩（飛兵が越えるだけ）には止まれない
  for (const k of Object.keys(seen)) { const [x, y] = k.split('-').map(Number); const o = at(b, x, y); if ((o && o !== u) || b.rock.includes(k)) delete seen[k]; }
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
      if (u.side === 'foe' && b.walls?.includes(k)) continue;
      const o = at(b, nx, ny);
      if (o && o.side !== u.side && !(nx === tx && ny === ty)) continue;
      seen[k] = d + 1;
      q.push([nx, ny]);
    }
  }
  return 99;
}

/** 届く距離。20夜目：斧と弓・弓と剣は、ふつうの攻撃の種類で変わる（近くは斧・剣、遠くは弓） */
export function rangeOf(u: TUnit, tech: TechDef | null, techId?: string | null): [number, number] {
  if (tech?.range) return tech.range;
  if (!tech && (T(u, 'axebow') || T(u, 'bowsword'))) return basicType(u, techId) === 'shot' ? [2, 3] : [1, 1];
  return [u.rmin, u.rmax];
}
const flyer = (u: TUnit) => T(u, 'fly') || T(u, 'roar');
export function defOf(b: TBattle, u: TUnit): number {
  return u.def + (isForest(b, u.x, u.y) ? TB.forestDef : 0) - (u.bonus?.note?.includes('reckless') ? TB.recklessDef : 0);
}

export interface Calc { per: number; hits: number; total: number; weak: boolean; resisted: boolean; broken: boolean; type: AtkType; shields: number; brk: boolean; kill: boolean; lethal: boolean; perHit: number }

/** 攻撃の見込み（必ず当たる）。pos を渡すと、そのマスから攻撃したときの守り（森）を使う */
/** 特技を持っているか */
export const T = (u: TUnit, t: string) => !!u.traits?.includes(t);
/** ふつうの攻撃の種類を選ぶ id（'basic:fire' など）を分ける */
export function techOf(id: string | null | undefined): TechDef | null { return id && !id.startsWith('basic:') ? TECH_BY_ID[id] ?? null : null; }
function basicType(u: TUnit, id: string | null | undefined): AtkType { return id?.startsWith('basic:') ? (id.slice(6) as AtkType) : u.type; }
function adj(a: { x: number; y: number }, b: { x: number; y: number }, n = 1): boolean { const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y); return d >= 1 && d <= n; }

/** 敵の背中側か（背討ち）：敵が狙っている相手と反対の側。狙いがなければ北（敵の陣の奥）の側 */
export function fromBehind(b: TBattle, a: { x: number; y: number }, d: TUnit): boolean {
  const t = d.aim && 't' in d.aim ? unit(b, d.aim.t) : null;
  const vx = t ? t.x - d.x : 0, vy = t ? t.y - d.y : d.side === 'foe' ? 1 : -1;
  return (a.x - d.x) * vx + (a.y - d.y) * vy < 0;
}
/** 旗の届く仲間か（軍旗：隣・大軍旗：盤のどこでも） */
function underBanner(b: TBattle, a: TUnit): boolean {
  return b.units.some((o) => o.side === a.side && o !== a && o.alive && T(o, 'banner') && (T(o, 'general_flag') || adj(o, a, 1)));
}
function hasSide(b: TBattle, side: TUnit['side'], t: string): boolean { return b.units.some((o) => o.side === side && o.alive && T(o, t)); }

/** 攻撃の見込み（必ず当たる）。opt.steps＝その攻撃の前に動いた歩数 */
export function calc(b: TBattle, a: TUnit, d: TUnit, techId?: string | null, opt: { rage?: boolean; steps?: number } = {}): Calc {
  const tech = techOf(techId);
  const type: AtkType = tech?.type ?? basicType(a, techId);
  let types: AtkType[] = [type];
  // 焔刃・火矢・ルーン：ふつうの攻撃は2つの種類を同時に
  if (!tech && a.dual && a.dual !== type) types = [type, a.dual];
  // 理の重ね：魔法をもう1つの種類と重ねる（分かっている弱点があれば、それを）
  if (T(a, 'layer') && MAGIC_TYPES.includes(type)) {
    const pool = (a.atks?.length ? a.atks : (['fire', 'thunder', 'ice'] as AtkType[])).filter((t) => MAGIC_TYPES.includes(t) && !types.includes(t));
    const second = pool.find((t) => d.known.includes(t) && d.weak.includes(t)) ?? pool[0];
    if (second) types = [...types, second];
  }
  const anyMagic = types.some((t) => MAGIC_TYPES.includes(t));
  const anyPhys = types.some((t) => !MAGIC_TYPES.includes(t));
  const magic = (MAGIC_TYPES.includes(type) || (!tech && a.magic)) && !(anyPhys && a.str > a.mag);
  const base = anyMagic && anyPhys ? Math.max(a.str, a.mag) : magic ? a.mag : a.str;
  const steps = opt.steps ?? 0;
  const far = Math.abs(a.x - d.x) + Math.abs(a.y - d.y);
  let atk = base + a.might + (tech ? tech.pow + Math.floor(a.skl / TB.sklDiv) : 0) + (opt.rage ? TB.ragePow : 0);
  atk += a.bonus?.dmg ?? 0;
  if (d.officerId && a.bonus?.vsOfficer && d.nemesis) atk += a.bonus.vsOfficer;
  if (a.bonus?.vsClass?.[d.classId]) atk += a.bonus.vsClass[d.classId];
  // 兵種の特技
  if (a.traits?.length) {
    const fight = a.bonus?.fight ?? 50;
    if (T(a, 'veteran') && !d.boss) atk += 3;
    if (T(a, 'twoarms') && (types.includes('slash') || types.includes('crush'))) atk += 3;
    if (T(a, 'spear') && type === 'thrust') atk += 2;
    if (T(a, 'frenzy')) atk += Math.min(4, Math.max(0, Math.floor((fight - 50) / 10)));
    if (T(a, 'berserk')) atk += Math.round(6 * (1 - a.hp / a.max)) + (fight >= 70 ? 2 : 0);
    if (T(a, 'axeplus') && type === 'crush') atk += 2;
    if (T(a, 'aim') && steps === 0) atk += 2;
    if (T(a, 'farshot') && steps === 0 && type === 'shot') atk += Math.max(0, far - 2);
    if (T(a, 'judge') && (d.revived || d.type === 'dark' || T(d, 'cursed'))) atk += 4;
    if (T(a, 'charge') && steps >= 3) atk += 3;
  }
  // 英雄の声：仲間全員の傷+2
  if (hasSide(b, a.side, 'herald')) atk += 2;
  // 軍旗：隣（大軍旗は盤のどこでも）の仲間の攻撃+2、宿敵の前ですくむ心を消す。軍神旗は盤のどこでも、すくまない
  const banner = underBanner(b, a);
  if (banner) atk += 2;
  if (a.bonus?.note?.includes('fear') && (banner || hasSide(b, a.side, 'warflag'))) atk += TB.fearDmg;
  if (a.teacher) atk = Math.round(atk * TB.teacherAtk);
  let df = defOf(b, d);
  if (magic) df = Math.floor(df * TB.magicDefRate);
  df += d.bonus?.prot ?? 0;
  if (d.bonus?.protFrom?.[a.classId]) df += d.bonus.protFrom[a.classId];
  if (d.bonus?.protFrom?.[type]) df += d.bonus.protFrom[type];
  if (T(d, 'push') || T(d, 'scales')) df += 2;
  if (T(d, 'frenzy')) df -= 2;
  if (T(d, 'forest') && isForest(b, d.x, d.y)) df += 2;
  if (b.units.some((o) => o.side === d.side && o !== d && o.alive && T(o, 'barrier') && adj(o, d, 1))) df += 2;
  df -= d.cursed ? 2 : 0;
  const resisted = types.every((t) => d.resist.includes(t));
  let per = Math.max(1, atk - Math.max(0, df));
  if (resisted) per = Math.max(1, Math.floor(per / TB.resistDiv));
  // 背討ち：敵の背中側から、傷が2倍
  if (T(a, 'backstab') && d.side !== a.side && fromBehind(b, a, d)) per *= 2;
  // 飛兵は射に弱い（硬い鱗はちがう）・呪いの子は光に弱い
  if (type === 'shot' && flyer(d) && !T(d, 'scales')) per = Math.round(per * 1.5);
  if (types.includes('light') && T(d, 'cursed')) per = Math.round(per * 1.5);
  // 聖域：まわり2マスの仲間は、闇の傷が半分
  if (types.includes('dark') && b.units.some((o) => o.side === d.side && o.alive && T(o, 'sanctuary') && Math.abs(o.x - d.x) + Math.abs(o.y - d.y) <= 2)) per = Math.max(1, Math.floor(per / 2));
  // 軍神旗：宿敵の大技（渾身の一撃）の傷が半分
  if (opt.rage && hasSide(b, d.side, 'warflag')) per = Math.max(1, Math.floor(per / 2));
  const broken = d.broken > 0;
  if (broken) per *= TB.breakMul;
  const hits = tech
    ? (tech.id === 'barrage' && T(a, 'shura') && broken ? 5 : tech.hits)
    : T(a, 'volley') && type === 'shot' && steps >= 1 ? 3 : a.spd >= d.spd + (T(a, 'twin') ? 1 : TB.doubleSpd) ? 2 : 1;
  const weakTypes = d.side === 'foe' ? types.filter((t) => d.weak.includes(t) && !d.resist.includes(t)) : [];
  const weak = weakTypes.length > 0;
  const oneeye = T(a, 'oneeye') && type === 'shot' && far === 2;
  let perHit = (weak ? weakTypes.length : 0) + (!weak && tech?.smash && T(a, 'smash') ? (T(a, 'kingsaxe') ? 2 : 1) : 0);
  if (weak && tech?.smash && T(a, 'kingsaxe')) perHit += 1;
  if (oneeye) perHit = Math.max(perHit, 1) + (weak ? 1 : 0);
  const shields = !broken && d.side === 'foe' ? Math.min(d.sh, perHit * hits) : 0;
  const total = per * hits;
  const brk = !broken && shields > 0 && d.sh - shields <= 0 && d.hp - total > 0;
  const kill = total >= d.hp && !(d.nemesis && !d.clung && !broken);
  // 命の危険：宿敵のとどめ（すでに深手を負った子への、宿敵その人の倒れる一撃）だけ
  const lethal = a.side === 'foe' && total >= d.hp && d.hp <= d.max * TB.lethalHp && !!(b.nemesisId && a.nemesis) && !d.teacher && !d.raised;
  return { per, hits, total, weak, resisted, broken, type, shields, brk, kill, lethal, perHit };
}

/** その子の使える攻撃（ふつうの攻撃＝null と、のこりのある技） */
export function attacksOf(u: TUnit): (string | null)[] {
  // 魔道士などは、ふつうの攻撃の種類を選べる（炎・雷・氷）
  const out: (string | null)[] = (u.atks?.length ?? 0) > 1 ? u.atks!.map((t) => `basic:${t}`) : [null];
  for (const t of u.techs) { const d = TECH_BY_ID[t.id]; if (d && !d.heal && t.left > 0) out.push(t.id); }
  return u.teacher ? [null] : out;
}
export function healsOf(u: TUnit): string[] { return u.techs.filter((t) => TECH_BY_ID[t.id]?.heal && t.left > 0).map((t) => t.id); }

/** そのマスから届く敵 */
export function inRange(b: TBattle, u: TUnit, x: number, y: number, d: TUnit, techId: string | null): boolean {
  const tech = techOf(techId);
  const [mn, mx0] = rangeOf(u, tech, techId);
  // 遠撃ち：動かずに撃つと5マス先まで
  const mx = !tech && T(u, 'farshot') && x === u.x && y === u.y ? Math.max(mx0, 5) : mx0;
  const dd = Math.abs(x - d.x) + Math.abs(y - d.y);
  return dd >= mn && dd <= mx;
}

/** 選んだ子が攻撃できる敵（青い範囲のどこかから、どれかの攻撃が届く） */
export function attackable(b: TBattle, u: TUnit): TUnit[] {
  const R = reach(b, u);
  const atks = attacksOf(u);
  return foes(b).filter((f) => !!shadowSpot(b, u, f) || Object.keys(R).some((k) => { const [x, y] = k.split('-').map(Number); return atks.some((t) => inRange(b, u, x, y, f, t)); }));
}
/** 影渡り：近くの敵の背後（狙っている相手と反対側）のマスへ跳ぶ */
export function shadowSpot(b: TBattle, u: TUnit, f: TUnit): { x: number; y: number } | null {
  if (!T(u, 'shadowstep') || u.side !== 'me' || dist(u, f) > u.mov + 2) return null;
  for (const [dx, dy] of DIRS) {
    const x = f.x + dx, y = f.y + dy;
    if (blocked(b, x, y) || (at(b, x, y) && at(b, x, y) !== u)) continue;
    if (fromBehind(b, { x, y }, f)) return { x, y };
  }
  return null;
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
  const sh = shadowSpot(b, u, d);
  if (sh && !(key(sh.x, sh.y) in R)) R[key(sh.x, sh.y)] = 0;
  let best: { x: number; y: number; sc: number } | null = null;
  for (const [k, steps] of Object.entries(R)) {
    const [x, y] = k.split('-').map(Number);
    if (!inRange(b, u, x, y, d, techId)) continue;
    const far = Math.abs(x - d.x) + Math.abs(y - d.y);
    const sc = (isForest(b, x, y) ? -30 : 0) + threatAt(b, u, x, y) * 2 + steps - far * 3 - (T(u, 'backstab') && fromBehind(b, { x, y }, d) ? 25 : 0) - (T(u, 'charge') && steps >= 3 ? 6 : 0);
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
  const from = { x: a.x, y: a.y };
  const steps = reach(b, a)[key(pos.x, pos.y)] ?? 0;
  if (pos.x !== a.x || pos.y !== a.y) {
    if (T(a, 'shadowstep') && !(key(pos.x, pos.y) in reach(b, a))) log(b, `${a.name}は影を渡り、${d.name}の背後へ跳んだ`);
    a.x = pos.x; a.y = pos.y; a.moved = true; fx.push({ k: 'move', uid: a.uid, x: a.x, y: a.y });
  }
  if (!inRange(b, a, a.x, a.y, d, techId)) return fx;
  strike(b, a, d, techId, fx, opt.noDeath ?? false, false, steps, from);
  // 駆け抜け・一撃離脱・走り撃ち：残りの歩数で、安全なところへ下がる
  if (a.alive && (T(a, 'ride') || T(a, 'hitrun') || T(a, 'runshot')) && a.mov - steps > 0 && (b.phase as string) !== 'done') {
    const now = threatAt(b, a, a.x, a.y);
    if (now > 0) {
      let best: { x: number; y: number; sc: number } | null = null;
      for (const [k, st] of Object.entries(reach(b, a, a.mov - steps))) { const [x, y] = k.split('-').map(Number); const sc = threatAt(b, a, x, y) * 10 + st - (isForest(b, x, y) ? 5 : 0); if (!best || sc < best.sc) best = { x, y, sc }; }
      if (best && best.sc < now * 10 && (best.x !== a.x || best.y !== a.y)) { a.x = best.x; a.y = best.y; fx.push({ k: 'move', uid: a.uid, x: a.x, y: a.y }); log(b, `${a.name}は駆け抜けて、間合いの外へ下がった`); }
    }
  }
  a.acted = true;
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}

/** 特技の巻きぞえの傷（盾は割らない）。倒れれば down */
function chip(b: TBattle, a: TUnit, d: TUnit, dmg: number, fx: TFx[], noDeath: boolean, why: string): void {
  if (!d.alive || dmg <= 0) return;
  if (d.nemesis && !d.clung && d.broken === 0 && d.hp - dmg <= 0) dmg = d.hp - 1;
  if (d.lastStand !== undefined) dmg = Math.min(dmg, d.hp - 1);
  if (dmg <= 0) return;
  d.hp = Math.max(0, d.hp - dmg);
  a.dealt += dmg; d.taken += dmg; d.lastHitBy = a.uid;
  if (a.studentId && !a.teacher) (d.hitBy ??= {})[a.studentId] = (d.hitBy[a.studentId] ?? 0) + dmg;
  fx.push({ k: 'hit', a: a.uid, d: d.uid, dmg, weak: false, resisted: false, shield: false, brk: false, kill: d.hp <= 0, tech: why, broken: d.broken > 0 });
  if (d.hp <= 0) down(b, a, d, fx, noDeath, false);
}
function addDeed(u: TUnit, k: string, n = 1): void { (u.deeds ??= {})[k] = (u.deeds[k] ?? 0) + n; }
function once(b: TBattle, k: string): boolean { if ((b.once ??= []).includes(k)) return false; b.once.push(k); return true; }
const near = (a: { x: number; y: number }, b: { x: number; y: number }, n: number) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= n;

function strike(b: TBattle, a: TUnit, d0: TUnit, techId: string | null, fx: TFx[], noDeath: boolean, rage: boolean, steps = 0, from?: { x: number; y: number }, isCounter = false): void {
  // かばう：隣の仲間（重装兵など）が代わりに受ける。パラディンは先生をかばう（グレートパラディンは2マス以内から）
  let d = d0;
  const lethal0 = a.side === 'foe' ? calc(b, a, d0, techId, { rage, steps }).lethal : false;
  if (a.side === 'foe') {
    const g = b.units.find((o) => o.side === d0.side && o !== d0 && o.alive && !o.lastStand && (((T(o, 'guard') && !o.teacher) && near(o, d0, 1)) || (d0.teacher && ((T(o, 'paladin') && near(o, d0, 1)) || (T(o, 'paladin2') && near(o, d0, 2))))));
    if (g) {
      d = g; g.guarded = (g.guarded ?? 0) + 1;
      fx.push({ k: 'say', by: g.uid, text: `${d0.name}、下がって！`, tone: 'me' }); log(b, `${g.name}が${d0.name}をかばった`);
      if (lethal0) addDeed(g, 'guardLethal');
      if (d0.teacher && a.nemesis) addDeed(g, 'shieldTeacher');
    }
  }
  const guarding = d !== d0;
  const tech = techOf(techId);
  const tt = a.techs.find((t) => t.id === techId);
  if (tt && !isCounter) tt.left -= 1;
  // 見切り：一度だけ（剣神は敵の番ごとに）、敵の攻撃をかわして斬り返す
  if (a.side === 'foe' && d.side === 'me' && T(d, 'mikiri') && (T(d, 'mikiri_all') ? d.mikiriTurn !== b.turn : !d.mikiriUsed) && !isCounter) {
    d.mikiriUsed = true; d.mikiriTurn = b.turn;
    fx.push({ k: 'cutin', by: d.uid, title: '見切り！', sub: `${d.name}が${a.name}の攻撃をかわした` });
    log(b, `${d.name}の見切り！ ${a.name}の攻撃をかわして斬り返した`, true);
    if (inRangeBasic(d, a)) strike(b, d, a, null, fx, noDeath, false, 0, undefined, true);
    return;
  }
  if (tech && (d.boss || tech.hits > 1)) fx.push({ k: 'cutin', by: a.uid, title: `${tech.name}！`, sub: `${a.name}の技` });
  const c = calc(b, a, d, techId, { rage, steps });
  if (c.type === 'fire' || (a.dual === 'fire' && !tech)) a.usedFire = true;
  let shieldGone = 0;
  for (let i = 0; i < c.hits && d.alive; i++) {
    let dmg = c.per;
    // 戦神で踏みとどまっているあいだは、倒れない
    if (d.lastStand !== undefined) dmg = Math.min(dmg, d.hp - 1);
    // 不落：かばっているあいだ倒れない（体力1で残る）
    if (guarding && T(d, 'unfallen') && d.hp - dmg <= 0) { dmg = d.hp - 1; if (i === 0) log(b, `${d.name}は倒れない！`, true); }
    // 戦神：戦いで一度、体力0でも倒れず、次の自分の番の終わりまで戦い続ける（命の危険も、そこで止まる）
    if (d.side === 'me' && T(d, 'wargod') && !d.lastStandUsed && d.hp - dmg <= 0) { dmg = d.hp - 1; d.lastStandUsed = true; d.lastStand = b.turn + 1; log(b, `${d.name}は倒れない……！（次の番の終わりまで戦う）`, true); fx.push({ k: 'cutin', by: d.uid, title: '戦神', sub: `${d.name}はまだ立っている` }); }
    // 執念：ブレイクしていないとき、一度だけ持ちこたえる（宿敵）
    if (d.nemesis && !d.clung && d.broken === 0 && d.hp - dmg <= 0) { dmg = d.hp - 1; d.clung = true; say(b, d, 'clung', fx); log(b, `${d.name}は執念で持ちこたえた！`, true); }
    d.hp = Math.max(0, d.hp - dmg);
    a.dealt += dmg; d.taken += dmg;
    d.lastHitBy = a.uid;
    d.lastType = c.type;
    if (a.studentId && !a.teacher) (d.hitBy ??= {})[a.studentId] = ((d.hitBy ??= {})[a.studentId] ?? 0) + dmg;
    let shield = false, brk = false;
    if (c.perHit > 0 && d.sh > 0 && d.broken === 0) {
      d.sh = Math.max(0, d.sh - c.perHit); shield = true; shieldGone++; a.weakHits++;
      if (!d.known.includes(c.type)) { d.known.push(c.type); }
      (d.weakHitBy ??= []).includes(c.type) || d.weakHitBy!.push(c.type);
      if (d.sh === 0 && d.hp > 0) {
        d.broken = 2; brk = true; a.breaks++; d.aim = null;
        (d.brokenBy ??= []).push(a.studentId ?? a.uid);
      }
    }
    // 呪縛：闇を当てた敵の守りを下げ、宿敵の執念を削る（刻印：隠れた弱点が見える）
    if (c.type === 'dark' && T(a, 'curse')) {
      if (!d.cursed) { d.cursed = true; log(b, `${d.name}の守りが呪いで下がった`); addDeed(a, 'curseMaster'); }
      if (d.nemesis && !d.clung) { d.clung = true; log(b, `呪いが${d.name}の執念を削った`); }
      if (T(a, 'hex')) { const h = d.weak.find((w) => !d.known.includes(w)); if (h) { d.known.push(h); fx.push({ k: 'reveal', d: d.uid, type: h }); } }
    }
    const kill = d.hp <= 0;
    fx.push({ k: 'hit', a: a.uid, d: d.uid, dmg, weak: c.weak, resisted: c.resisted, shield, brk, kill, tech: tech?.name, broken: d.broken > 0 && !brk });
    if (shield && !brk && d.nemesis && shieldGone === 1) say(b, d, 'shield', fx);
    if (brk) {
      log(b, `${d.name}の守りが崩れた！（ブレイク：次の番は動けず、受ける傷が2倍）`, !!d.boss);
      if (d.nemesis) say(b, d, 'break', fx);
    }
    if (kill) {
      // 最上級の条件になる出来事（討ち方）
      if (d.boss && a.side === 'me') {
        if (a.hp <= Math.max(1, Math.floor(a.max * 0.1))) addDeed(a, 'lastBreath');
        if (c.type === 'crush') addDeed(a, 'axeBoss');
        if (d.nemesis) {
          if (c.type === 'shot' && dist(a, d) >= 2) addDeed(a, 'snipeNemesis');
          if (flyer(a)) addDeed(a, 'skyKill');
          if (d.fleeing || d.fledBefore) addDeed(a, 'chaseKill');
          if (d.revived || T(d, 'cursed') || d.type === 'dark') addDeed(a, 'darkNemesis');
        }
      }
      down(b, a, d, fx, noDeath, c.lethal);
    }
  }
  if (c.resisted && d.nemesis) say(b, d, 'resist', fx);
  const head = `${a.name}の${tech ? `「${tech.name}」` : '攻撃'}！ ${d.name}に${c.total}${c.weak ? `（弱点・${ATK_NAME[c.type]}）` : ''}${c.resisted ? '（効かない）' : ''}`;
  log(b, head);
  if (a.side === 'me' && d.nemesis && d.fleeing && flyer(a)) addDeed(a, 'skyChase');
  // ---- 攻撃のあとに効く特技（味方の攻撃） ----
  if (a.side === 'me' && !isCounter) afterStrike(b, a, d, c, tech, fx, noDeath, steps, from);
  // 守りの反撃：攻撃を受けたあと、届けば反撃する
  if (a.side === 'foe' && d.alive && d.side === 'me' && T(d, 'counter') && !isCounter && a.alive && inRangeBasic(d, a)) { log(b, `${d.name}の守りの反撃！`); strike(b, d, a, null, fx, noDeath, false, 0, undefined, true); }
  // 宿敵：追いつめられると、大技の構え・逃げる
  if (d.alive && d.nemesis && !d.rage && !d.fleeing && d.hp / d.max <= TB.rageAt && !b.said.includes(`${d.uid}:rageArmed`)) {
    b.said.push(`${d.uid}:rageArmed`);
    const sealer = b.units.find((o) => o.side !== d.side && o.alive && T(o, 'seal'));
    if (sealer) log(b, `${sealer.name}の封印！ ${d.name}の大技は封じられた`, true);
    else { d.rage = true; say(b, d, 'cornered', fx); log(b, `${d.name}が大技の構えに入った`, true); }
  }
  // 名前のある将は、追いつめられると逃げる（忠義の厚い将は逃げない。狩りの王がいると逃げられない）
  if (d.alive && d.boss && d.officerId && !d.fleeing && d.hp / d.max <= TB.fleeAt && b.lines?.[`${d.uid}:canFlee`] !== 'no') {
    const king = b.units.find((o) => o.side !== d.side && o.alive && T(o, 'huntking'));
    const snare = b.units.find((o) => o.side !== d.side && o.alive && (T(o, 'snare') || T(o, 'farsight')));
    if (king) { if (!b.said.includes('huntking')) { b.said.push('huntking'); log(b, `${d.name}は退こうとしたが、${king.name}の目から逃れられない！`, true); } }
    else {
      d.fleeing = true; d.rage = false; say(b, d, 'flee', fx);
      // ブレイク中・罠で逃げ道をふさがれたときは、端まで逃げる（追いつけば討てる）。そうでなければ、その場で退く
      if (d.broken > 0) log(b, `${d.name}は退こうとしている！（ブレイクが解ければ逃げる）`, true);
      else if (snare) log(b, `${d.name}は退こうとしたが、${snare.name}の罠で逃げ道がふさがれている！（北の端まで走る）`, true);
      else { d.alive = false; d.down = 'fled'; fx.push({ k: 'flee', uid: d.uid }); log(b, `${d.name}は兵をまとめて退いた`, true); }
    }
  }
}

/** 攻撃のあとに効く特技：広がる魔法・光の王・阿修羅・竜の息・蹂躙・押し込み・竜の咆哮・燃える地面・劫火 */
function afterStrike(b: TBattle, a: TUnit, d: TUnit, c: Calc, tech: TechDef | null, fx: TFx[], noDeath: boolean, steps: number, from?: { x: number; y: number }): void {
  const others = (pred: (f: TUnit) => boolean) => foes(b).filter((f) => f !== d && pred(f));
  const magic = MAGIC_TYPES.includes(c.type);
  if (T(a, 'splash') && magic) for (const f of others((f) => near(f, d, 1))) chip(b, a, f, Math.floor(c.per / 2), fx, noDeath, '広がる魔法');
  if (T(a, 'lightburst') && c.type === 'light') for (const f of others((f) => near(f, d, 1))) chip(b, a, f, Math.max(1, Math.floor(c.per * 0.75)), fx, noDeath, '光の王');
  if (T(a, 'ashura') && tech?.id === 'barrage') for (const f of others((f) => near(f, a, 1))) { const cc = calc(b, a, f, tech.id, { steps }); chip(b, a, f, cc.total, fx, noDeath, '阿修羅'); }
  if (T(a, 'breath')) {
    const dx = Math.sign(d.x - a.x), dy = Math.sign(d.y - a.y);
    const side = dx !== 0 && dy === 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    const tiles = side.map(([sx, sy]) => ({ x: d.x + sx, y: d.y + sy }));
    for (const f of others((f) => tiles.some((t) => t.x === f.x && t.y === f.y))) chip(b, a, f, Math.floor(c.per / 2), fx, noDeath, '竜の息');
  }
  if (T(a, 'trample') && steps >= 3 && from) {
    const x0 = Math.min(from.x, a.x), x1 = Math.max(from.x, a.x), y0 = Math.min(from.y, a.y), y1 = Math.max(from.y, a.y);
    const hit = others((f) => f.x >= x0 - 1 && f.x <= x1 + 1 && f.y >= y0 - 1 && f.y <= y1 + 1);
    if (hit.length) log(b, `${a.name}の蹂躙！`, true);
    for (const f of hit) chip(b, a, f, Math.floor(c.per / 2), fx, noDeath, '蹂躙');
  }
  if (T(a, 'push') && steps >= 3 && d.alive) {
    const nx = d.x + Math.sign(d.x - a.x), ny = d.y + Math.sign(d.y - a.y);
    if ((nx !== d.x || ny !== d.y) && !blocked(b, nx, ny) && !at(b, nx, ny)) { d.x = nx; d.y = ny; fx.push({ k: 'move', uid: d.uid, x: nx, y: ny }); log(b, `${a.name}が${d.name}を押し下げた`); }
  }
  if (T(a, 'roar')) for (const f of others((f) => near(f, a, 1) && f.sh > 0 && f.broken === 0)) { f.sh -= 1; log(b, `${f.name}は竜の咆哮にひるんだ（盾−1）`); }
  const fire = c.type === 'fire' || a.dual === 'fire';
  if (T(a, 'burn') && fire) (b.burn ??= {})[key(d.x, d.y)] = 2;
  if (T(a, 'inferno') && fire && once(b, `inferno:${a.uid}`)) {
    log(b, `${a.name}の劫火！ 横一列が炎に包まれた`, true);
    fx.push({ k: 'cutin', by: a.uid, title: '劫火！', sub: `${a.name}の炎` });
    for (let x = 0; x < b.w; x++) (b.burn ??= {})[key(x, d.y)] = 2;
    for (const f of others((f) => f.y === d.y)) chip(b, a, f, Math.floor(c.per / 2), fx, noDeath, '劫火');
  }
}

function down(b: TBattle, a: TUnit, d: TUnit, fx: TFx[], noDeath: boolean, lethal: boolean): void {
  d.alive = false;
  a.kills++;
  if (d.side === 'me') {
    if (d.raised) { log(b, `起こされた${d.name.replace(/^起こされた/, '')}は、ふたたび土に還った`); return; }
    // 祈り：命の危険の一撃を、その戦いで一度だけ防ぐ
    const priest = lethal && !noDeath ? b.units.find((o) => o.side === 'me' && o.alive && T(o, 'prayer') && !b.said.includes(`prayer:${o.uid}`)) : null;
    if (priest) { b.said.push(`prayer:${priest.uid}`); addDeed(priest, 'saveLife'); log(b, `${priest.name}の祈りが、${d.name}の命をつないだ`, true); fx.push({ k: 'say', by: priest.uid, text: `${d.name}……戻ってきて！`, tone: 'me' }); }
    d.down = d.teacher ? 'out' : lethal && !priest ? (noDeath ? 'injured' : 'dead') : 'injured';
    if (a.nemesis) say(b, a, 'kill', fx);
    log(b, d.down === 'dead' ? `${d.name}が倒れた……` : d.teacher ? `${d.name}が倒れた！` : `${d.name}は深手を負って退いた`, true);
  } else {
    d.down = 'dead';
    if (d.nemesis) {
      say(b, d, 'fall', fx); log(b, `${d.name}を討ち取った！`, true);
      // 冥府の主の条件：最期の言葉を聞いた子／禁呪：二度と蘇らない
      for (const m of mine(b)) if (!m.teacher && !m.raised) addDeed(m, 'lastWords');
      const keeper = mine(b).find((m) => T(m, 'forbid'));
      if (keeper) { b.forbidden = true; log(b, `${keeper.name}の禁呪が、${d.name}を二度と戻れぬ眠りに封じた`, true); }
      if (d.revived || T(d, 'cursed')) for (const m of mine(b)) if (T(m, 'seal') || T(m, 'barrier')) addDeed(m, 'sealRevived');
    }
    else log(b, `${d.name}は倒れた`);
    // 起こす：倒れた敵兵を一度だけ（冥府の主は2人まで）起こし、味方として動かす
    if (!d.boss && !d.raised) {
      const nec = mine(b).find((m) => T(m, 'raise') && (b.once ?? []).filter((k) => k === `raise:${m.uid}`).length < (T(m, 'raise2') ? 2 : 1));
      const spotFree = !at(b, d.x, d.y);
      if (nec && spotFree) {
        (b.once ??= []).push(`raise:${nec.uid}`);
        const half = Math.ceil(d.max / 2);
        Object.assign(d, { side: 'me' as const, alive: true, raised: true, hp: half, acted: true, sh: 0, shMax: 0, broken: 0, aim: null, down: undefined, name: `起こされた${d.name}`, boss: false, nemesis: false, fleeing: false });
        log(b, `${nec.name}が倒れた${d.name.replace(/^起こされた/, '')}を起こした。いまは味方として動く`, true);
        fx.push({ k: 'say', by: nec.uid, text: '起きろ。もう一度だけ、戦え', tone: 'me' });
      }
    }
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
  if (pos.x !== a.x || pos.y !== a.y) { a.x = pos.x; a.y = pos.y; a.moved = true; fx.push({ k: 'move', uid: a.uid, x: a.x, y: a.y }); }
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
  if (x !== u.x || y !== u.y) { u.x = x; u.y = y; u.moved = true; fx.push({ k: 'move', uid: u.uid, x, y }); }
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
  if (!t || !f || !t.alive || t.acted || b.insight <= 0 || dist(t, f) > insightRange(b)) return fx;
  const hidden = f.weak.filter((w) => !f.known.includes(w)).slice(0, TEACHER_RANK.depth[b.teacherRank ?? 0] ?? 1);
  if (!hidden.length) return fx;
  remember(b);
  b.insight -= 1;
  t.acted = true;
  for (const h of hidden) { f.known.push(h); fx.push({ k: 'reveal', d: f.uid, type: h }); }
  log(b, `${t.name}の見極め：${f.name}の弱点は「${hidden.map((h) => ATK_NAME[h]).join('・')}」だ`, !!f.boss);
  afterAction(b, fx);
  b.fx = fx;
  return fx;
}
function insightRange(b: TBattle): number { return TEACHER_RANK.range[b.teacherRank ?? 0] ?? TB.insightRange; }
export function insightTargets(b: TBattle): TUnit[] {
  const t = unit(b, b.teacherUid);
  if (!t || !t.alive || t.acted || b.insight <= 0) return [];
  return foes(b).filter((f) => dist(t, f) <= insightRange(b) && f.weak.some((w) => !f.known.includes(w)));
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
      if (T(m, 'forest') && isForest(b, m.x, m.y)) sc += 150; // 森歩き：森の中では狙われにくい
      if (m.raised) sc += 80;
      if (f.grudge && (m.studentId === f.grudge)) sc -= 400; // 前に自分をやった子を、真っ先に
      if (f.boss && m.teacher) sc -= 60; // 宿敵は先生も狙う
      if (!best || sc < best.sc) best = { m, sc };
    }
    if (!best) continue;
    const can = canHit(b, f, best.m);
    const c = calc(b, f, best.m, null, { rage: f.rage });
    f.aim = can ? { t: best.m.uid, dmg: c.total, lethal: c.lethal, rage: f.rage } : { t: best.m.uid, dmg: 0, lethal: false, approach: true };
  }
}
export function canHit(b: TBattle, f: TUnit, m: TUnit): boolean {
  const R = reach(b, f);
  for (const k of Object.keys(R)) { const [x, y] = k.split('-').map(Number); const d = Math.abs(x - m.x) + Math.abs(y - m.y); if (d >= f.rmin && d <= f.rmax) return true; }
  return false;
}

/** 自分の番のはじめ：呪王の気（まわり2マスの敵の守りを下げる） */
export function myTurnStart(b: TBattle): void {
  for (const m of mine(b).filter((m) => T(m, 'cursearea'))) for (const f of foes(b)) if (near(f, m, 2) && !f.cursed) { f.cursed = true; log(b, `${m.name}の呪いの気が、${f.name}の守りを下げた`); }
}
/** 自分の番の終わり：癒しの輪・奇跡・戦神の終わり */
function myTurnEnd(b: TBattle, fx: TFx[]): void {
  for (const m of mine(b).filter((m) => T(m, 'ring'))) {
    let n = 0;
    for (const o of mine(b)) if (near(o, m, 2) && o.hp < o.max) { const amt = Math.min(o.max - o.hp, 3); o.hp += amt; n++; fx.push({ k: 'heal', a: m.uid, d: o.uid, amt, tech: '癒しの輪' }); }
    if (n) log(b, `${m.name}の癒しの輪（まわりの仲間の体力+3）`);
  }
  const saint = mine(b).find((m) => T(m, 'miracle'));
  if (saint && !(b.once ?? []).includes('miracle')) {
    const team = mine(b);
    const low = team.filter((o) => o.hp <= o.max * 0.35).length;
    const sumHp = team.reduce((x, o) => x + o.hp, 0), sumMax = team.reduce((x, o) => x + o.max, 0);
    if (low >= 2 || sumHp <= sumMax * 0.5) {
      once(b, 'miracle');
      for (const o of team) { o.lastStand = undefined; const amt = o.max - o.hp; if (amt > 0) { o.hp = o.max; fx.push({ k: 'heal', a: saint.uid, d: o.uid, amt, tech: '奇跡' }); } }
      fx.push({ k: 'cutin', by: saint.uid, title: '奇跡', sub: `${saint.name}の祈りが、みなの傷を癒した` });
      log(b, `${saint.name}の奇跡！ 仲間全員の傷が癒えた`, true);
      if (low >= 1) addDeed(saint, 'saveLife');
    }
  }
  // 戦神：踏みとどまった番が終わると、倒れる（深手。命はとりとめる）
  for (const m of mine(b).filter((m) => m.lastStand !== undefined && m.lastStand <= b.turn)) { m.lastStand = undefined; m.alive = false; m.down = 'injured'; log(b, `${m.name}は、ついに膝をついた（深手を負って退いた）`, true); }
  checkEnd(b);
}

/** ターンを終える：敵の番を最後まで進め、次のターンへ */
export function endTurn(b: TBattle, opt: { noDeath?: boolean } = {}): TFx[] {
  const fx: TFx[] = [];
  if (b.phase !== 'player') return fx;
  b.undo = null;
  myTurnEnd(b, fx);
  if ((b.phase as string) === 'done') { b.fx = fx; return fx; }
  b.phase = 'enemy';
  fx.push({ k: 'phase', side: 'foe', turn: b.turn });
  // 燃える地面：燃えているマスにいる敵は傷を負う
  if (b.burn) for (const f of foes(b)) { const k = key(f.x, f.y); if (b.burn[k] > 0) { const src = mine(b).find((m) => T(m, 'burn')) ?? mine(b)[0]; if (src) chip(b, src, f, 4, fx, !!opt.noDeath, '燃える地面'); } }
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
      if (f.y === 0) { f.alive = false; f.down = 'fled'; say(b, f, 'fled', fx); fx.push({ k: 'flee', uid: f.uid }); log(b, `${f.name}は逃げ去った`, true); checkEnd(b); }
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
    // 槍衾：隣に来た敵を、先に突く
    for (const m of mine(b).filter((m) => T(m, 'pike') && near(m, f, 1))) { if (!f.alive) break; log(b, `${m.name}の槍衾！`); strike(b, m, f, null, fx, opt.noDeath ?? false, false, 0, undefined, true); }
    checkEnd(b);
    if (!f.alive || f.broken > 0 || (b.phase as string) !== 'enemy') continue;
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
  // 阿修羅の条件：囲まれて（敵3人以上が隣）生き延びる
  for (const m of mine(b)) if (!m.teacher && !m.raised && foes(b).filter((f) => near(f, m, 1)).length >= 3) addDeed(m, 'surroundedTurn');
  if (b.burn) for (const k of Object.keys(b.burn)) { b.burn[k] -= 1; if (b.burn[k] <= 0) delete b.burn[k]; }
  if (b.walls?.length && b.wallTurns !== undefined) { b.wallTurns -= 1; if (b.wallTurns <= 0) { b.walls = []; log(b, '結界の光の壁が消えた'); } }
  b.turn += 1;
  for (const u of b.units) { u.acted = false; u.moved = false; }
  b.phase = 'player';
  fx.push({ k: 'phase', side: 'me', turn: b.turn });
  myTurnStart(b);
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
  const kids = mine(b).filter((u) => !u.teacher && !u.raised);
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
