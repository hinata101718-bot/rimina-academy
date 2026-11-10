// 19夜目：新しい戦いを組み立てる（依頼・出撃する子・先生・敵将から）。DOMに依存しない
import { nameTag } from '../student';
import { TB, ENEMY_KINDS, ENEMY_MIX, ENEMY_BASE, BOSS_MUL, WTYPE_ATK, SPELL_MIGHT, FIELD_BY_ID, ATK_TYPES, ATK_NAME, MAGIC_TYPES, type AtkType } from '../../data/tactics';
import { CLASSES, newClassId, resLevelOf } from '../../data/classes';
import { WEAPONS } from '../../data/weapons';
import { SKILLS } from '../../data/balance';
import type { GameState, Student, Quest, EnemyOfficer } from '../state';
import type { TBattle, TUnit, Objective, Deploy } from './types';
import { Rng } from '../rng';
import { effectiveStats } from '../game';
import { armoryItem } from '../loot';
import { battleTechs } from '../techs';
import { officerName } from '../officers';
import { intents, key, myTurnStart } from './engine';
import { TEACHER_RANK } from '../../data/balance';
import { teacherRank } from '../instructor';
import { allies } from '../bonds';
import { B } from '../../data/balance';

function hash(s: string): number { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function questSeed(s: GameState, q: Pick<Quest, 'id'>): number { return hash(`${q.id}|${s.year}|${s.month}|${s.createdAt}`) ^ 0x5bd1e995; }

const OBJ: Record<Quest['objective'], Objective> = { rout: 'rout', boss: 'boss', defend: 'defend', escort: 'escape', seize: 'boss', rescue: 'rescue', escape: 'escape' };

/** 依頼の戦場 */
export function fieldFor(q: Quest, o: EnemyOfficer | null): string {
  if (o?.field) return o.field;
  switch (q.kind) {
    case 'bandit': return 'woods';
    case 'monster': return 'woods';
    case 'fort': return 'fort';
    case 'defend': case 'refugee': case 'schoolDefense': return 'village';
    case 'rescue': return 'ruins';
    case 'breakout': case 'escort': return 'pass';
    default: return 'plain';
  }
}

/** 生徒の武器（持たせた武器庫の武器 → なければ兵種の武器の鉄） */
function weaponOf(s: GameState, st: Student, uid?: string | null): { might: number; wtype: string } {
  const a = uid ? armoryItem(s, uid) : null;
  const w = a ? WEAPONS[a.weaponId] : null;
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  if (w && c.weapons.includes(w.type)) return { might: w.might + (a?.named?.might ?? 0), wtype: w.type };
  // 兵種の武器のうち、いちばん育った技能のもの
  let best = c.weapons[0];
  let pts = -1;
  for (const t of c.weapons) { const k = (t === 'holy' || t === 'staff' ? 'faith' : t) as keyof Student['skills']; const p = st.skills[k] ?? 0; if (p > pts) { pts = p; best = t; } }
  if (best === 'magic' || best === 'holy' || best === 'staff') return { might: SPELL_MIGHT + Math.floor(pts / 140), wtype: best };
  const iron = Object.values(WEAPONS).find((x) => x.type === best && x.rank === 'E' && x.price > 0);
  return { might: iron?.might ?? 5, wtype: best };
}

/** 心と教訓から、戦いの補正を作る */
export function mindBonus(st: Student, nemesisId?: string | null, s?: GameState): TUnit['bonus'] {
  const m = st.mind ?? { fight: 50, calm: 50, grudge: 20 };
  const bonus: NonNullable<TUnit['bonus']> = { dmg: 0, prot: 0, note: [] };
  if (m.fight >= TB.fightHot) bonus.dmg! += TB.fightHotDmg;
  if (m.fight > TB.fightReckless) bonus.note!.push('reckless');
  if (nemesisId) {
    if (m.calm < TB.calmLow) { bonus.dmg! -= TB.fearDmg; bonus.note!.push('fear'); }
    const rv = s?.rivalries?.[`${st.id}|${nemesisId}`];
    if (rv) bonus.vsOfficer = Math.floor(m.grudge / TB.grudgeDiv) + (rv.vow ? 1 : 0) + (rv.oath ? B.bonds.oathDmg : 0);
  }
  for (const l of st.lessons ?? []) {
    if (!l.vs) continue;
    if (CLASSES[l.vs]) { (bonus.vsClass ??= {})[l.vs] = (bonus.vsClass[l.vs] ?? 0) + TB.lessonDmg; (bonus.protFrom ??= {})[l.vs] = (bonus.protFrom[l.vs] ?? 0) + TB.lessonProt; }
    else if ((ATK_TYPES as string[]).includes(l.vs)) (bonus.protFrom ??= {})[l.vs] = (bonus.protFrom[l.vs] ?? 0) + TB.lessonProt;
    else if (nemesisId && l.vs === nemesisId) bonus.vsOfficer = (bonus.vsOfficer ?? 0) + TB.lessonDmg;
  }
  return bonus;
}

export function unitFromStudent(s: GameState, st: Student, uid: string, x: number, y: number, armoryUid?: string | null, nemesisId?: string | null): TUnit {
  const e = effectiveStats(st);
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  const w = weaponOf(s, st, armoryUid);
  const atk = WTYPE_ATK[w.wtype] ?? WTYPE_ATK.sword;
  const techs = battleTechs(st).map((t) => ({ id: t.id, left: t.uses }));
  const u: TUnit = {
    uid, side: 'me', name: nameTag(s, st), studentId: st.id, classId: st.classId, x, y,
    hp: e.hp, max: e.hp, str: e.str, mag: e.mag, skl: e.skl, spd: e.spd, def: e.def, res: Math.max(0, e.res),
    mov: c.move, rmin: atk.range[0], rmax: atk.range[1], type: atk.type, magic: !!atk.magic, might: w.might,
    techs, sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true,
    armoryUid: armoryUid ?? null, bonus: { ...mindBonus(st, nemesisId, s), fight: st.mind?.fight ?? 50 }, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0,
  };
  applyClass(u, st.classId, w.wtype);
  return u;
}

/** 兵種の特技・攻撃の種類・届く距離・動ける歩数をユニットに。enemy のときは、敵に向かない特技（かばう・祈り など）を外す */
export function applyClass(u: TUnit, classId: string, wtype?: string, enemy = false): void {
  const c = CLASSES[classId];
  if (!c) return;
  const NOT_FOE = ['guard', 'paladin', 'paladin2', 'prayer', 'spot', 'trap', 'ambush', 'farsight', 'allseeing', 'mend', 'ring', 'miracle', 'raise', 'raise2', 'forbid', 'seal', 'snare', 'huntking', 'steal', 'swap', 'swap2', 'barrier', 'wargod', 'mikiri', 'mikiri_all', 'cursearea'];
  u.traits = c.traits.filter((t) => !enemy || !NOT_FOE.includes(t));
  const has = (t: string) => u.traits!.includes(t);
  const atks = c.atk.length ? c.atk : [u.type];
  // 武器の種類に合う攻撃の種類を、ふつうの攻撃に
  const wt = wtype ? WTYPE_ATK[wtype]?.type : undefined;
  u.type = wt && atks.includes(wt) ? wt : atks[0];
  u.magic = MAGIC_TYPES.includes(u.type);
  u.dual = undefined;
  if (has('rune')) {
    // ルーン：斬に、炎・雷・氷（ルーンロードは5つの理）のどれかを重ねる
    u.atks = has('allarts') ? ['fire', 'thunder', 'ice', 'light', 'dark'] : atks.filter((t) => MAGIC_TYPES.includes(t));
    u.type = u.atks[0]; u.dual = 'slash'; u.magic = false;
  } else if (has('flameblade') || has('firearrow')) { u.dual = atks.find((t) => t !== u.type) ?? undefined; u.atks = [u.type]; }
  else u.atks = atks.length > 1 ? [...atks] : [u.type];
  if (has('allarts') && !has('rune')) u.atks = ['fire', 'thunder', 'ice', 'light', 'dark'];
  // 届く距離
  if (u.type === 'shot' || has('longshot')) { u.rmin = 2; u.rmax = TB.bowRange.base; }
  if (u.magic) { u.rmin = 1; u.rmax = 2; }
  if (has('rune') || has('flameblade')) { u.rmin = 1; u.rmax = 1; }
  if (has('reach')) { u.rmin = 1; u.rmax = 2; }
  if (has('spear')) { u.rmin = 1; u.rmax = 3; }
  // 25夜目②：狙い澄まし・遠撃ちは「動かなかった番」だけ遠くへ（engine の inRange）
  if (has('axebow') || has('bowsword')) { u.rmin = 1; u.rmax = TB.bowRange.base; }
  if (has('oneeye')) { u.rmin = 2; u.rmax = 2; }
  if (has('thousand')) { u.rmin = 2; u.rmax = TB.bowRange.far; }
  if (u.type === 'blunt' && !wtype) u.might = Math.max(u.might, 4);
  // 動ける歩数（兵種の移動は data/classes の move）。天翔は盤のどこへでも
  u.mov = c.move + (has('step') ? 1 : 0);
  if (has('skyward')) u.mov = 12;
}

/** 戦いのはじめに効く特技（見抜き・読み切り・天眼・罠・闇討ち・結界・呪王の気） */
export function startTraits(b: TBattle): void {
  const bs = b.units.find((u) => u.boss) ?? b.units.filter((u) => u.side === 'foe').sort((a, c) => c.max - a.max)[0];
  for (const u of b.units.filter((x) => x.side === 'me')) {
    const has = (t: string) => !!u.traits?.includes(t);
    if (bs && (has('farsight') || has('allseeing'))) { for (const w of bs.weak) if (!bs.known.includes(w)) bs.known.push(w); b.log.push({ turn: 1, text: `${u.name}の${has('allseeing') ? '天眼' : '読み切り'}：${bs.name}の弱点がすべて分かった${has('allseeing') && bs.resist.length ? '（効かない種類も）' : ''}` }); }
    else if (bs && has('spot')) { const h = bs.weak.find((w) => !bs.known.includes(w)); if (h) { bs.known.push(h); b.log.push({ turn: 1, text: `${u.name}の見抜き：${bs.name}の弱点は「${ATK_NAME[h]}」` }); } }
    // 23夜目③：罠は、置く場所を選べる（戦いのはじめに1つ。踏んだ敵は傷を負って止まる）
    if (has('trap')) { (b.trapLeft ??= {})[u.uid] = TB.trap.count; b.log.push({ turn: 1, text: `${u.name}は罠を1つ仕掛けられる（「罠」ボタンで置く場所を選ぶ）` }); }
    if (bs && has('ambush') && bs.broken === 0) { bs.sh = 0; bs.broken = 2; b.log.push({ turn: 1, text: `${u.name}の闇討ち！ ${bs.name}が崩れた`, big: true }); }
    // 結界：前（敵の側）に光の壁を立てる。3ターンで消える
    if (has('barrier')) {
      for (const dx of [-1, 0, 1]) {
        const x = u.x + dx, y = u.y - 1, k = key(x, y);
        if (x < 0 || y < 0 || x >= b.w || b.rock.includes(k) || b.units.some((o) => o.alive && o.x === x && o.y === y)) continue;
        (b.walls ??= []).includes(k) || b.walls!.push(k);
      }
      b.wallTurns = 3;
      b.log.push({ turn: 1, text: `${u.name}が結界を張った（光の壁は敵を通さない。3ターン）` });
    }
  }
  myTurnStart(b);
}

function teacherUnit(s: GameState, x: number, y: number, lv0 = 1): TUnit {
  const ins = s.instructor;
  const st = ins.studentId ? s.students[ins.studentId] : null;
  const best = [...SKILLS].sort((a, b) => (ins.skills[b] ?? 0) - (ins.skills[a] ?? 0))[0];
  const wt = best === 'faith' ? 'holy' : best === 'tactics' || best === 'command' || best === 'riding' || best === 'heavy' || best === 'flying' ? 'sword' : best;
  const atk = WTYPE_ATK[wt] ?? WTYPE_ATK.sword;
  const age = ins.age ?? 35;
  const e = st ? effectiveStats(st) : null;
  const decline = Math.max(0, Math.floor((age - 50) / 5));
  const u: TUnit = {
    uid: 'teacher', side: 'me', name: `${ins.name}先生`, teacher: true, studentId: st?.id, classId: 'novice', x, y,
    // 先生も、学校の強さに合わせて少しずつ戦い慣れていく（年をとると衰える）
    hp: Math.max(20, Math.max(e?.hp ?? 0, 28 + lv0) - decline * 2), max: Math.max(20, Math.max(e?.hp ?? 0, 28 + lv0) - decline * 2),
    str: Math.max(4, Math.max(e?.str ?? 0, 8 + Math.floor(lv0 * 0.4)) - decline), mag: Math.max(4, Math.max(e?.mag ?? 0, 7 + Math.floor(lv0 * 0.4)) - decline), skl: 8 + Math.floor(lv0 * 0.3), spd: Math.max(3, Math.max(e?.spd ?? 0, 6 + Math.floor(lv0 * 0.35)) - decline), def: Math.max(3, Math.max(e?.def ?? 0, 7 + Math.floor(lv0 * 0.35)) - decline), res: Math.max(2, Math.max(e?.res ?? 0, 5 + Math.floor(lv0 * 0.3)) - decline),
    mov: 3, rmin: atk.range[0], rmax: atk.range[1], type: atk.type, magic: !!atk.magic, might: 5,
    techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0,
  };
  // 20夜目：教え子が先生になったときは、その子の兵種を持ったまま（特技・届く距離）
  if (st && CLASSES[st.classId] && st.classId !== 'novice') { applyClass(u, st.classId, undefined, false); u.classId = st.classId; u.traits = (u.traits ?? []).filter((t) => !['skyward'].includes(t)); u.mov = Math.min(u.mov, 4); }
  return u;
}

function baseStat(k: string, lv: number, mul: number): number { const [a, p] = ENEMY_BASE[k]; return Math.max(1, Math.round((a + lv * p) * mul)); }

/** 敵将の戦い方（弱点・効かない種類）。名簿の敵将に一度だけ決める（覚えていく） */
export function ensureOfficerCombat(o: EnemyOfficer): void {
  if (o.weak?.length) return;
  const r = new Rng({ rng: hash(o.id + o.given) ^ 0x77 });
  const pool = ATK_TYPES.filter((t) => !(o.resist ?? []).includes(t));
  const w1 = r.pick(pool);
  const w2 = r.pick(pool.filter((t) => t !== w1));
  o.weak = [w1, w2];
  o.resist ??= [];
  o.knownWeak ??= [];
}

export interface SetupOpts { nemesisId?: string | null; tutorial?: boolean; lines?: Record<string, string>; field?: string; officer?: EnemyOfficer | null; extraShields?: number;
  /** 23夜目⑦：進軍の途中の戦場の勝ち方・道（近道は雑兵が多い）・雑兵を減らす数 */
  objective?: Objective; route?: 'short' | 'detour'; fewer?: number; stageIdx?: number }

/** 戦いを作る */
export function createTactics(s: GameState, q: Quest, deploys: Deploy[], opt: SetupOpts = {}): TBattle {
  const r = new Rng({ rng: (questSeed(s, q) ^ 0x3d1) + (opt.stageIdx ?? 0) * 7919 });
  const o = opt.officer ?? null;
  const fieldId = opt.field ?? fieldFor(q, o);
  const F = FIELD_BY_ID[fieldId] ?? FIELD_BY_ID.plain;
  const objective = opt.objective ?? OBJ[q.objective] ?? 'rout';
  const b: TBattle = {
    v: 19, questId: q.id, title: q.title, field: F.id, w: TB.w, h: TB.h, forest: [...F.forest], rock: [...F.rock],
    units: [], turn: 1, phase: 'player', result: null, objective, teacherUid: 'teacher',
    command: TEACHER_RANK.command[teacherRank(s)] ?? TB.command, insight: TEACHER_RANK.insight[teacherRank(s)] ?? TB.insight, teacherRank: teacherRank(s), undo: null, log: [], scenes: [], fx: [], said: [], foes0: 0, real: q.real,
    tutorial: opt.tutorial, nemesisId: opt.nemesisId ?? undefined, lines: opt.lines,
  };
  if (objective === 'defend') b.holdTurns = q.defendTurns ?? 5;
  if (objective === 'escape') b.exitRow = 0;
  // 21夜目：砦には木の門（火矢で焼ける。焼けるまで通れない）
  if (F.id === 'fort' && !opt.tutorial) b.gate = key(3, 3);
  const free = (x: number, y: number) => !b.rock.includes(key(x, y)) && b.gate !== key(x, y) && !b.units.some((u) => u.x === x && u.y === y) && !(b.captive && b.captive.x === x && b.captive.y === y);
  const place = (cands: [number, number][]): [number, number] => { for (const [x, y] of cands) if (free(x, y)) return [x, y]; for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (free(x, y)) return [x, y]; return [0, 0]; };
  if (objective === 'rescue') { const cx = r.int(1, TB.w - 2); b.rock = b.rock.filter((k) => k !== key(cx, 0)); b.captive = { x: cx, y: 0, name: q.spyRescue && s.students[q.spyRescue] ? s.students[q.spyRescue].given : q.kind === 'rescue' ? '捕らわれた村人' : '捕らわれた仲間', freed: false }; }
  // 味方：先生は後ろ、教え子は前の列
  const [tx, ty] = place([[3, 9], [4, 9], [2, 9], [5, 9]]);
  { const tu = teacherUnit(s, tx, ty, Math.max(1, q.level)); b.units.push(tu); }
  const spots: [number, number][] = [[2, 8], [5, 8], [3, 8], [4, 8], [1, 8], [6, 8], [0, 8], [7, 8], [2, 9], [5, 9], [1, 9], [6, 9], [0, 9], [7, 9]];
  for (const d of deploys) {
    const st = s.students[d.studentId];
    if (!st) continue;
    const [x, y] = place(spots);
    const u = unitFromStudent(s, st, `s_${st.id}`, x, y, d.armoryUid, opt.nemesisId);
    if (d.item === 'vulnerary' || d.item === 'elixir') u.potion = 1;
    b.units.push(u);
  }
  // 敵
  const kind: 'army' | 'bandit' | 'monster' = q.kind === 'monster' ? 'monster' : q.enemyCountry ? 'army' : 'bandit';
  const mul = (TB.enemyMul[Math.max(0, Math.min(3, q.danger))] ?? 1) * (s.settings.mods?.enemy ?? 1) * (opt.tutorial ? 0.75 : 1);
  const lv = Math.max(1, q.level);
  // 23夜目⑥：1つの戦場に敵は8〜12人（雑兵7〜11＋敵将）。近道は多め
  const M = B.march;
  const nGrunt = opt.tutorial ? 3 : Math.min(M.grunts.max, M.grunts.base + Math.max(0, q.danger) + (objective === 'defend' ? 1 : 0) + (opt.route === 'short' ? M.shortExtra : 0) - (opt.fewer ?? 0));
  const enemySpots: [number, number][] = [[1, 2], [6, 2], [2, 1], [5, 1], [3, 2], [4, 2], [0, 1], [7, 1], [1, 3], [6, 3], [2, 0], [5, 0], [0, 2], [7, 2], [3, 3], [4, 3], [2, 3], [5, 3], [1, 0], [6, 0], [0, 3], [7, 3]];
  const hasBoss = !!o || objective === 'boss';
  if (hasBoss) {
    const [x, y] = place(o?.id === opt.nemesisId ? [[3, 1], [4, 1], [3, 2]] : [[4, 1], [3, 1], [4, 0]]);
    b.units.push(bossUnit(s, o, kind, lv, mul, x, y, !!opt.nemesisId && o?.id === opt.nemesisId, opt.extraShields ?? 0, r));
  }
  const mix = ENEMY_MIX[kind];
  const gm = mul * (opt.tutorial ? 1 : M.gruntMul);
  for (let i = 0; i < nGrunt; i++) {
    const k = ENEMY_KINDS[mix[(i + r.int(0, mix.length - 1)) % mix.length]];
    const [x, y] = place(enemySpots);
    const sh = opt.tutorial ? 1 : r.int(...TB.shields.grunt);
    b.units.push({
      uid: `e${i}`, side: 'foe', name: k.name, mark: k.mark, classId: k.classId, x, y,
      hp: baseStat('hp', lv, gm) + (k.hp ?? 0), max: baseStat('hp', lv, gm) + (k.hp ?? 0),
      str: baseStat('str', lv, gm), mag: baseStat('mag', lv, gm), skl: baseStat('skl', lv, gm), spd: baseStat('spd', lv, gm) + (k.spd ?? 0), def: Math.max(0, baseStat('def', lv, gm) + (k.def ?? 0)), res: Math.max(0, baseStat('res', lv, gm) + (k.res ?? 0)),
      mov: k.mov, rmin: k.range[0], rmax: k.range[1], type: k.type, magic: !!k.magic, might: 4 + Math.floor(lv / 8),
      techs: [], sh, shMax: sh, weak: [...k.weak], resist: [], known: opt.tutorial ? [...k.weak] : [k.weak[0]], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0,
    });
  }
  // 20夜目④：味方になった宿敵が、ときどき駆けつける
  const al = q.real && !opt.tutorial && !q.opening ? allies(s).filter((x) => x.id !== o?.id) : [];
  if (al.length && r.chance(B.bonds.allyHelp)) {
    const ao = r.pick(al);
    const [x, y] = place([[0, 9], [7, 9], [0, 8], [7, 8]]);
    const h = bossUnit(s, ao, 'army', lv, mul * 0.8, x, y, false, 0, r);
    Object.assign(h, { uid: 'ally', side: 'me' as const, boss: false, nemesis: false, helper: true, sh: 0, shMax: 0, weak: [], resist: [], known: [], grudge: undefined, studentId: undefined });
    applyClass(h, h.classId, undefined, false);
    b.units.push(h);
    b.log.push({ turn: 1, text: `援軍：かつての宿敵、${h.name}が駆けつけた！`, big: true });
    b.scenes.push({ turn: 1, text: `援軍：かつての宿敵、${h.name}が駆けつけた！`, big: true });
  }
  for (const u of b.units) if (u.side === 'foe') { u.hp = u.max = Math.max(u.max, 6); const keepType = u.type; const r0 = [u.rmin, u.rmax]; applyClass(u, u.classId, undefined, true); if (!u.boss) { u.type = keepType; u.atks = [keepType]; u.dual = undefined; u.rmin = r0[0]; u.rmax = r0[1]; u.mov = Math.min(u.mov, 4); } }
  { const bu = b.units.find((u) => u.boss); if (bu && o?.cursed) (bu.traits ??= []).push('cursed'); }
  placeChests(s, b, q, opt);
  startTraits(b);
  b.foes0 = b.units.filter((u) => u.side === 'foe').length;
  intents(b);
  return b;
}

/** 21夜目：盤にときどき宝箱と扉（盗賊の系統だけ開けられる）。戦いの乱数とは別の乱数で決める */
function placeChests(s: GameState, b: TBattle, q: Quest, opt: SetupOpts): void {
  if (opt.tutorial || q.opening || !q.real) return;
  const r = new Rng({ rng: questSeed(s, q) ^ 0x51c4e });
  if (!r.chance(TB.chest.chance)) return;
  const free = (x: number, y: number) => !b.rock.includes(key(x, y)) && !b.forest.includes(key(x, y)) && b.gate !== key(x, y) && !b.units.some((u) => u.x === x && u.y === y) && !(b.captive && b.captive.x === x && b.captive.y === y) && !(b.chests ?? []).some((c) => c.x === x && c.y === y) && !(b.doors ?? []).includes(key(x, y));
  const cells = (y0: number, y1: number) => { const out: [number, number][] = []; for (let y = y0; y <= y1; y++) for (let x = 0; x < b.w; x++) if (free(x, y)) out.push([x, y]); return out; };
  const c1 = cells(3, 5);
  if (!c1.length) return;
  const [cx, cy] = r.pick(c1);
  const potion = r.chance(TB.chest.potionChance);
  const pool = Object.values(WEAPONS).filter((w) => w.price > 0 && (w.rank === 'D' || w.rank === 'C'));
  b.chests = [{ x: cx, y: cy, kind: potion || !pool.length ? 'potion' : 'weapon', weaponId: potion || !pool.length ? undefined : r.pick(pool).id }];
  if (r.chance(TB.chest.doorChance)) {
    const c2 = cells(4, 6).filter(([x, y]) => Math.abs(x - cx) + Math.abs(y - cy) >= 2);
    if (c2.length) { const [dx, dy] = r.pick(c2); b.doors = [key(dx, dy)]; }
  }
}

function bossUnit(s: GameState, o: EnemyOfficer | null, kind: 'army' | 'bandit' | 'monster', lv0: number, mul: number, x: number, y: number, nemesis: boolean, extraShields: number, r: Rng): TUnit {
  const cid = newClassId(o?.classId ?? (kind === 'monster' ? 'fighter' : 'lancer'));
  const c = CLASSES[cid] ?? CLASSES.lancer;
  const atk = WTYPE_ATK[c.weapons[0]] ?? WTYPE_ATK.lance;
  // 宿敵は会うたび強くなるが、学校の強さから離れすぎない
  const lv = Math.min(lv0 + BOSS_MUL.lvCap, Math.max(lv0, o?.level ?? lv0));
  const meets = o?.meets.length ?? 0;
  const hpM = (nemesis ? BOSS_MUL.nemesisHp : BOSS_MUL.hp) * (1 + meets * BOSS_MUL.perMeet);
  const oM = (nemesis ? BOSS_MUL.nemesisOther : BOSS_MUL.other) * (1 + meets * BOSS_MUL.perMeet);
  if (o) ensureOfficerCombat(o);
  const weak: AtkType[] = o?.weak ? [...o.weak] : [r.pick(ATK_TYPES), r.pick(ATK_TYPES)].filter((v, i, a) => a.indexOf(v) === i);
  const resist: AtkType[] = o?.resist ? o.resist.filter((t) => !weak.includes(t)) : [];
  const sh = Math.min(TB.shields.nemesisMax, (nemesis ? TB.shields.nemesis : TB.shields.captain) + extraShields);
  return {
    uid: 'boss', side: 'foe', name: o ? officerName(o) : kind === 'monster' ? '群れの頭' : '敵の隊長', officerId: o?.id, faceImage: o?.faceImage ?? null,
    studentId: o?.alumniId, classId: cid, x, y, boss: true, nemesis,
    hp: Math.round(baseStat('hp', lv, mul) * hpM), max: Math.round(baseStat('hp', lv, mul) * hpM),
    str: Math.round(baseStat('str', lv, mul) * oM), mag: Math.round(baseStat('mag', lv, mul) * oM), skl: Math.round(baseStat('skl', lv, mul) * oM), spd: Math.round(baseStat('spd', lv, mul) * oM), def: Math.round(baseStat('def', lv, mul) * oM), res: Math.round(baseStat('res', lv, mul) * oM * (TB.bossResMul[resLevelOf(c)] ?? 1)),
    mov: Math.min(4, c.move), rmin: atk.range[0], rmax: atk.range[1], type: atk.type, magic: !!atk.magic, might: 5 + Math.floor(lv / 6),
    techs: [], sh, shMax: sh, weak, resist, known: o?.knownWeak ? o.knownWeak.filter((t) => weak.includes(t)) : [], broken: 0, acted: false, alive: true,
    grudge: o?.grudge ?? undefined, revived: !!o?.revived, fledBefore: !!o?.meets.some((m) => m.result === 'fled'), kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0,
  };
}
