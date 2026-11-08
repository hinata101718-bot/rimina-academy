// 戦闘後の生徒ごとの評価（9夜目）：称号・名場面・本人のひとこと・戦績・前からの伸び・宿敵の進み具合。DOMに依存しない
import { BADGES, SCENE_TEXT, EVAL_SAY, type SayKey } from '../data/evaluation';
import { WEAPONS } from '../data/weapons';
import { COUNTRY_SHORT } from '../data/people';
import { OFFICER_TRAITS } from '../data/officers';
import type { GameState, Student, StudentEval, Quest } from './state';
import type { BattleState, BLog, Unit } from './battle/types';
import { isGrunt } from './battle/blog';
import { leaderOf } from './battle/auto';
import { officerById, officerName, rivalryOf, stageName } from './officers';
import { Rng } from './rng';

function fill(t: string, v: Record<string, string | number>): string { return t.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? String(v[k]) : m)); }

/** 戦いの記録をすべて（場面に移した分と、残っている分） */
export function allLogs(b: BattleState): BLog[] {
  const out: BLog[] = [];
  for (const sc of b.auto?.scenes ?? []) if (sc.log) out.push(...sc.log);
  out.push(...(b.blog ?? []));
  return out;
}

/** 戦いの記録で使う呼び名（敵将の名前、雑兵は「盗賊A」） */
export function unitLabel(s: GameState, b: BattleState, uid: string): string {
  const u = b.units.find((x) => x.uid === uid);
  if (!u) return '敵';
  const L = leaderOf(b);
  if (L && uid === L.uid) return L.name;
  if (u.studentId && s.students[u.studentId]) return s.students[u.studentId].given;
  const q = s.quests.find((x) => x.id === b.questId);
  const foe = q?.kind === 'monster' ? '魔物' : q?.enemyCountry ? `${COUNTRY_SHORT[q.enemyCountry]}兵` : q && !q.real ? '演習の相手' : '盗賊';
  const grunts = b.units.filter((x) => isGrunt(x, L?.uid));
  const i = grunts.indexOf(u);
  return i >= 0 ? `${foe}${String.fromCharCode(65 + (i % 26))}` : u.name;
}

interface Tally {
  arts?: number; swings: number; hits: number; crits: number; kills: number; dealt: number; taken: number; struck: number; dodged: number; healed: number; heals: number; follow: number; tri: number; counterKill: number; minHp: number; leaderDmg: number; eff: number }

/**
 * 出撃した生徒（在籍）の評価を作る。rivalsBefore＝戦いの前の宿敵の段階（生徒id→段階）
 */
export function evaluateBattle(s: GameState, b: BattleState, q: Quest | undefined, ids: string[], mvp: string | null, rivalsBefore: Record<string, number>, battlesBefore: Record<string, number>): StudentEval[] {
  const logs = allLogs(b);
  const L = leaderOf(b);
  const lu = L ? b.units.find((u) => u.uid === L.uid) : null;
  const o = officerById(s, L?.officerId);
  const a = b.auto;
  const r = new Rng({ rng: (b.rng ^ 0x3c1) | 0 });
  const uidOf = (id: string) => b.units.find((u) => u.studentId === id && u.side === 'player')?.uid ?? '';
  const tally = (uid: string): Tally => {
    const t: Tally = { swings: 0, hits: 0, crits: 0, kills: 0, dealt: 0, taken: 0, struck: 0, dodged: 0, healed: 0, heals: 0, follow: 0, tri: 0, counterKill: 0, minHp: 999, leaderDmg: 0, eff: 0 };
    for (const e of logs) {
      if (e.k === 'atk') {
        if (e.a === uid) {
          t.swings++;
          if (e.art) t.arts = (t.arts ?? 0) + 1; if (e.hit) { t.hits++; t.dealt += e.dmg; if (e.crit) t.crits++; if (e.role === 'follow') t.follow++; if (e.tri > 0) t.tri++; if (e.eff) t.eff++; if (lu && e.d === lu.uid) t.leaderDmg += e.dmg; }
          if (e.kill) { t.kills++; if (e.role === 'counter') t.counterKill++; }
        }
        if (e.d === uid) { if (e.hit) { t.struck++; t.taken += e.dmg; t.minHp = Math.min(t.minHp, e.hp1); } else t.dodged++; }
      } else if (e.k === 'heal' && e.a === uid && e.d !== uid) { t.heals++; t.healed += e.amt; }
    }
    return t;
  };
  // 一番槍：味方で最初に敵を倒した子
  const firstKill = logs.find((e) => e.k === 'atk' && e.kill && b.units.find((u) => u.uid === e.a)?.side === 'player' && b.units.find((u) => u.uid === e.d)?.side === 'enemy') as Extract<BLog, { k: 'atk' }> | undefined;
  // 仇：生徒を倒した敵
  const killers = new Set(b.fallen.map((f) => f.by).filter(Boolean) as string[]);
  const out: StudentEval[] = [];
  for (const id of ids) {
    const st = s.students[id];
    const uid = uidOf(id);
    const u = b.units.find((x) => x.uid === uid);
    if (!st || !u) continue;
    const t = logs.length ? tally(uid) : { swings: u.hits, hits: u.hits, crits: 0, kills: u.kills, dealt: u.dmgDealt, taken: u.dmgTaken, struck: 0, dodged: 0, healed: 0, heals: 0, follow: 0, tri: 0, counterKill: 0, minHp: 999, leaderDmg: 0, eff: 0 } as Tally;
    const fall = b.fallen.find((f) => f.studentId === id);
    const outcome = fall?.outcome === 'dead' ? 'dead' as const : fall?.outcome === 'injured' ? 'injured' as const : undefined;
    const rec = { kills: u.kills, dealt: u.dmgDealt, taken: u.dmgTaken, healed: t.healed, hits: t.hits, swings: t.swings };
    if (outcome === 'dead') { out.push({ id, grade: 'C', badges: [], scene: sceneLine(s, b, logs, uid, t, true), say: '', rec, growth: [], rivals: [], outcome }); continue; }
    // 称号
    const got: string[] = [];
    const add = (k: string, cond: boolean) => { if (cond && !got.includes(k)) got.push(k); };
    add('wounded', outcome === 'injured');
    add('mvp', mvp === id);
    add('giant', !!lu && logs.some((e) => e.k === 'atk' && e.a === uid && e.kill && (e.d === lu.uid || (b.units.find((x) => x.uid === e.d)?.level ?? 0) >= u.level + 3)));
    add('duelist', (a?.events ?? []).includes(`duelwin:${id}`) || (!!L?.duelWon && L.settleBy === id));
    add('avenger', logs.some((e) => e.k === 'atk' && e.a === uid && e.kill && killers.has(e.d)));
    add('musou', u.kills >= 3);
    add('bloom', (a?.effects ?? []).some((x) => x.kind === 'reveal' && x.id === id));
    add('weakspot', !!o && t.leaderDmg > 0 && o.knownTraits.some((k) => { const f = OFFICER_TRAITS[k]?.foe; if (!f || !OFFICER_TRAITS[k].weak) return false; const w = Object.keys(u.usedWeapon).map((x) => WEAPONS[x]?.type); return !!f.types?.some((x) => w.includes(x as never)); }));
    add('planner', a?.plan?.planner === id && (a?.strats ?? []).some((x) => x.ok));
    add('captain', a?.plan?.captain === id && b.result === 'win');
    add('close_call', !fall && t.minHp <= 5 && t.minHp > 0);
    add('saver', t.heals >= 2);
    add('wall', !fall && t.struck >= 4);
    add('first_blood', !!firstKill && firstKill.a === uid);
    add('general_hunter', !!lu && t.leaderDmg >= lu.maxHp * 0.3);
    add('double', u.kills === 2);
    add('crit', t.crits >= 1);
    add('art', (t.arts ?? 0) >= 2); // 12夜目：戦技を2回以上
    add('sniper', t.hits >= 3 && Object.keys(u.usedWeapon).some((w) => ['bow', 'magic', 'gun', 'holy'].includes(WEAPONS[w]?.type ?? '')));
    add('combo', (a?.events ?? []).some((x) => (x.startsWith('combo:') || x.startsWith('lovers:')) && x.endsWith(id)));
    add('dodge', t.dodged >= 3);
    add('counter', t.counterKill >= 1);
    add('guardian', u.row === 'front' && t.struck >= 3 && !fall);
    add('stand', !fall && u.hp > 0 && u.hp <= u.maxHp * 0.25);
    add('chain', t.follow >= 2);
    add('matchup', t.tri >= 3);
    add('first', (battlesBefore[id] ?? 0) === 0);
    add('unhurt', t.struck === 0 && t.swings > 0 && !fall);
    add('whiff', t.swings >= 3 && t.hits / t.swings < 0.4);
    if (!got.length) got.push('quiet');
    const badges = got.sort((x, y) => BADGES[y].pri - BADGES[x].pri).slice(0, 2);
    // 評価の文字（小さく残す）
    const score = u.kills * 3 + u.hits + u.dmgDealt / 12 - (fall ? 3 : 0) + (u.expGain >= 40 ? 1 : 0) + (mvp === id ? 2 : 0);
    const grade = score >= 9 ? 'S' : score >= 5 ? 'A' : score >= 2 ? 'B' : 'C';
    // ひとこと
    const rv = o ? rivalryOf(s, id, o.id) : null;
    let key: SayKey = b.result === 'win' ? 'win' : 'lose';
    if (outcome === 'injured') key = 'injured';
    else if (badges.includes('first') && u.kills === 0) key = 'first';
    else if (badges.some((x) => ['mvp', 'giant', 'duelist', 'musou', 'avenger'].includes(x))) key = 'great';
    else if (rv && !rv.settled && rv.stage > (rivalsBefore[id] ?? 0)) key = 'rival';
    else if (t.minHp <= Math.max(5, u.maxHp * 0.25)) key = 'hurt';
    else if (t.heals >= 1) key = 'heal';
    else if (badges.includes('guardian') || badges.includes('wall')) key = 'guard';
    else if (u.kills >= 1) key = 'kill';
    else if (badges.includes('whiff')) key = 'miss';
    const lastKill = [...logs].reverse().find((e) => e.k === 'atk' && e.a === uid && e.kill) as Extract<BLog, { k: 'atk' }> | undefined;
    const healed = [...logs].reverse().find((e) => e.k === 'heal' && e.a === uid && e.d !== uid) as Extract<BLog, { k: 'heal' }> | undefined;
    const say = fill(r.pick(EVAL_SAY[key][st.personality]), { foe: key === 'rival' && o ? officerName(o) : lastKill ? unitLabel(s, b, lastKill.d) : L?.name ?? '敵', friend: healed ? unitLabel(s, b, healed.d) : '仲間' });
    // 前の戦いからの伸び
    const growth: string[] = [];
    const hr = t.swings ? Math.round((t.hits / t.swings) * 100) : 0;
    if (st.lastRec && t.swings >= 2) {
      if (hr - st.lastRec.hitRate >= 10) growth.push(`前より命中が上がった（${st.lastRec.hitRate}%→${hr}%）`);
      if (u.dmgDealt - st.lastRec.dealt >= 10) growth.push(`与えたダメージが増えた（${st.lastRec.dealt}→${u.dmgDealt}）`);
      if (u.kills > st.lastRec.kills && u.kills >= 2) growth.push('前より多くの敵を倒した');
    }
    if (t.swings >= 1 || u.dmgDealt > 0) st.lastRec = { hitRate: hr, dealt: u.dmgDealt, kills: u.kills };
    // 宿敵・誓い
    const rivals: string[] = [];
    if (o && rv && (rv.stage >= 1 || rv.vow || (rivalsBefore[id] ?? 0) >= 1)) {
      const before = rivalsBefore[id] ?? 0;
      if (rv.settled) rivals.push(`${officerName(o)}との因縁に決着`);
      else if (rv.stage > before) rivals.push(`${officerName(o)}：${stageName(before)}→${stageName(rv.stage)}`);
      else if (rv.vow) rivals.push(`${officerName(o)}への仇討ちの誓い（${s.students[rv.vow]?.given ?? ''}）`);
      else if (rv.stage >= 1) rivals.push(`${officerName(o)}：${stageName(rv.stage)}（戦った回数 ${rv.battles}）`);
    }
    out.push({ id, grade, badges, scene: sceneLine(s, b, logs, uid, t, false, st), say, rec, growth, rivals, outcome });
  }
  return out;
}

/** 名場面：その子のいちばんの見せ場を1行で */
function sceneLine(s: GameState, b: BattleState, logs: BLog[], uid: string, t: Tally, fallen: boolean, st?: Student): string | null {
  const L = leaderOf(b);
  let turn = 1;
  let best: { v: number; text: string } | null = null;
  const put = (v: number, text: string) => { if (!best || v > best.v) best = { v, text }; };
  for (const e of logs) {
    if (e.k === 'turn') { turn = e.turn; continue; }
    if (e.k === 'heal') { if (e.a === uid && e.d !== uid) put(20 + e.amt, fill(SCENE_TEXT.heal, { t: turn, d: unitLabel(s, b, e.d), amt: e.amt })); continue; }
    if (e.a === uid && e.hit) {
      const d = unitLabel(s, b, e.d);
      if (e.kill && L && e.d === L.uid) put(100, fill(SCENE_TEXT.leaderKill, { t: turn, d }));
      else if (e.kill && e.crit) put(80, fill(SCENE_TEXT.critKill, { t: turn, d }));
      else if (e.crit) put(60 + e.dmg, fill(SCENE_TEXT.crit, { t: turn, d, dmg: e.dmg }));
      else if (e.kill) put(50, fill(SCENE_TEXT.kill, { t: turn, d }));
      else put(10 + e.dmg, fill(SCENE_TEXT.hit, { t: turn, d, dmg: e.dmg }));
    }
    if (e.d === uid && e.hit) {
      if (e.kill) put(fallen ? 200 : 0, fill(SCENE_TEXT.fallen, { t: turn, d: unitLabel(s, b, e.a) }));
      else if (e.hp1 <= 5) put(70, fill(SCENE_TEXT.survive, { t: turn, d: unitLabel(s, b, e.a), hp: e.hp1 }));
    }
  }
  if (!best && t.dodged >= 2) {
    const e = logs.find((x) => x.k === 'atk' && x.d === uid && !x.hit) as Extract<BLog, { k: 'atk' }> | undefined;
    if (e) put(5, fill(SCENE_TEXT.dodge, { d: unitLabel(s, b, e.a), n: t.dodged }));
  }
  if (L?.duelWon && st && L.settleBy === st.id) put(150, fill(SCENE_TEXT.duel, { d: L.name }));
  return (best as { v: number; text: string } | null)?.text ?? null;
}

void ({} as Unit);
