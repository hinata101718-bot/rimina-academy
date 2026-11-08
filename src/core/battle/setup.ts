// 依頼から戦闘を組み立てる（マップの型の組み替え・敵の生成・戦力の調整）
import { B, STATS } from '../../data/balance';
import { MAPS } from '../../data/maps';
import { CLASSES, CLASS_LIST } from '../../data/classes';
import { WEAPONS } from '../../data/weapons';
import { QUEST_KINDS } from '../../data/quests';
import { TRAITS } from '../../data/people';
import type { Stats, WeaponType, ClassDef } from '../types';
import type { GameState, Quest, Student } from '../state';
import type { BattleState, Terrain, Unit } from './types';
import { Rng } from '../rng';
import { effectiveStats } from '../game';
import { emptyStats } from '../util';
import { tensionStage } from '../world';
import { usableSpells } from '../spells';

const CHAR: Record<string, Terrain> = { '.': 'plain', F: 'forest', M: 'mountain', T: 'fort', '~': 'river', '=': 'bridge', V: 'village', '#': 'wall', r: 'road', D: 'door' };

export interface Deploy { studentId: string; armoryUid: string | null; item: 'vulnerary' | 'elixir' | null; staffUid?: string | null }

export function baseUnit(partial: Partial<Unit> & Pick<Unit, 'uid' | 'side' | 'name' | 'classId' | 'level' | 'stats' | 'x' | 'y'>): Unit {
  return {
    maxHp: partial.stats.hp, hp: partial.stats.hp, weaponId: null, weapons: [], item: null, moved: false, acted: false, dead: false,
    poison: 0, weaken: 0, reloadTurn: -1, aimed: false, abilities: [], expGain: 0, kills: 0, hits: 0, dmgDealt: 0, dmgTaken: 0, usedWeapon: {},
    ...partial,
  } as Unit;
}

export function studentAbilities(st: Student): string[] {
  const ab: string[] = [];
  const c = CLASSES[st.classId];
  if (c?.ability) ab.push(c.ability);
  for (const t of st.traits) { const a = TRAITS[t].ability; if (a) ab.push(a); }
  return ab;
}

export function unitFromStudent(st: Student, side: Unit['side'], uid: string, x: number, y: number, arms: string[]): Unit {
  const stats = effectiveStats(st);
  // 武器（武器庫から持ってきたもの）＋今の兵種で使える覚えた魔法
  const weapons = [...arms.filter((w) => WEAPONS[w] && !WEAPONS[w].spell), ...usableSpells(st)];
  const spells = usableSpells(st).map((id) => WEAPONS[id]).filter((w) => w.type !== 'staff').sort((a, b) => b.might - a.might);
  const attack = weapons.find((w) => WEAPONS[w] && !WEAPONS[w].spell) ?? spells[0]?.id ?? null;
  return baseUnit({
    uid, side, studentId: st.id, name: st.given, classId: st.classId, level: st.level, stats, x, y,
    weaponId: attack, weapons, abilities: studentAbilities(st), personality: st.personality,
  });
}

/** 兵種の段階をレベルに合わせて上げ下げする */
function classForLevel(rng: Rng, id: string, level: number, gun: boolean): ClassDef {
  // 生徒の兵種試験と同じレベルの区切り（中級Lv10・上級Lv20）
  const want = level < B.exam.levelReq[2] ? 1 : level < B.exam.levelReq[3] ? 2 : 3;
  let c = CLASSES[id] ?? CLASSES.fighter;
  while (c.tier > want && c.prereq.length) c = CLASSES[c.prereq[0]];
  while (c.tier < want) {
    const kids = CLASS_LIST.filter((k) => k.prereq.includes(c.id) && !k.nation && !k.hidden && (gun || !k.needGun));
    if (!kids.length) break;
    c = rng.pick(kids);
  }
  if (c.tier === 0) c = CLASSES.fighter;
  return c;
}

function weaponFor(type: WeaponType, level: number): string | null {
  const list = Object.values(WEAPONS).filter((w) => w.type === type && (w.price > 0 || (w.spell && !w.rare && (w.value ?? 0) <= 2000)));
  if (!list.length) return null;
  list.sort((a, b) => (a.price || a.value || 0) - (b.price || b.value || 0));
  const idx = level < B.enemy.weaponLv[0] ? 0 : level < B.enemy.weaponLv[1] ? Math.min(1, list.length - 1) : Math.min(2, list.length - 1);
  return list[idx].id;
}

export function enemyUnit(rng: Rng, uid: string, classId: string, level: number, x: number, y: number, gun: boolean, boss = false): Unit {
  const c = classForLevel(rng, classId, level, gun);
  const stats: Stats = emptyStats();
  const growthAvg: Record<string, number> = B.enemy.growth;
  for (const k of STATS) {
    const base = k === 'hp' ? 19 : 4;
    const g = growthAvg[k] + ((c.growth[k] ?? 0) / 100);
    stats[k] = Math.round(base + level * g + rng.int(-1, 1) + (c.bonus[k] ?? 0));
  }
  // 魔道系は魔力、物理系は力を伸ばす
  const magical = c.weapons.some((w) => w === 'magic' || w === 'holy') && !c.weapons.some((w) => ['sword', 'lance', 'axe', 'bow'].includes(w));
  if (magical) { stats.mag += 3; stats.str = Math.max(1, stats.str - 3); }
  if (boss) { stats.hp += 6; stats.def += 2; stats.str += 2; stats.mag += 2; stats.skl += 2; }
  const types = c.weapons.filter((w) => w !== 'staff' && (gun || w !== 'gun'));
  const weapons: string[] = [];
  const t = types.length ? rng.pick(types) : null;
  if (t) { const w = weaponFor(t, level + (boss ? 3 : 0)); if (w) weapons.push(w); }
  if (c.weapons.includes('staff')) weapons.push('heal');
  const u = baseUnit({ uid, side: 'enemy', name: c.name, classId: c.id, level, stats, x, y, boss });
  u.weapons = weapons;
  u.weaponId = weapons.find((w) => WEAPONS[w]?.type !== 'staff') ?? null;
  u.abilities = c.ability ? [c.ability] : [];
  return u;
}

export function unitPower(u: Unit): number {
  const s = u.stats;
  return s.hp * 0.5 + s.str + s.mag * 0.8 + s.skl * 0.6 + s.spd + s.def + s.res * 0.6 + (u.weaponId ? WEAPONS[u.weaponId].might : 0);
}

export function createBattle(s: GameState, quest: Quest, deploys: Deploy[], seed: number): BattleState {
  const rng = new Rng({ rng: seed });
  const tpl = MAPS[quest.template] ?? MAPS.training;
  const W = B.battle.width, H = B.battle.height;
  const tiles: Terrain[] = [];
  const deployTiles: [number, number][] = [];
  const enemyTiles: [number, number][] = [];
  let boss: [number, number] | null = null;
  let goal: [number, number] | null = null;
  let npc: [number, number] | null = null;
  const chestSpots: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = tpl.rows[y]?.[x] ?? '.';
    let t: Terrain = CHAR[ch] ?? 'plain';
    if (ch === '?') { const r = rng.next(); t = r < 0.45 ? 'forest' : r < 0.58 ? 'mountain' : 'plain'; }
    if (ch === 'P') deployTiles.push([x, y]);
    if (ch === 'E') enemyTiles.push([x, y]);
    if (ch === 'K') { boss = [x, y]; if (tpl.bossTerrain === 'fort') t = 'fort'; }
    if (ch === 'G') { goal = [x, y]; t = 'road'; }
    if (ch === 'C') chestSpots.push([x, y]);
    if (ch === 'S') npc = [x, y];
    tiles.push(t);
  }
  if (quest.objective === 'seize' && boss) goal = boss;
  const b: BattleState = {
    rng: rng.h.rng, questId: quest.id, title: quest.title, real: quest.real, objective: quest.objective,
    defendTurns: quest.defendTurns ?? 7, maxTurns: B.battle.maxTurnsDefault, weather: quest.weather,
    width: W, height: H, tiles, goal: goal && (quest.objective === 'escort' || quest.objective === 'seize') ? { x: goal[0], y: goal[1] } : null,
    chests: [], visited: [], units: [], turn: 1, phase: 'player', result: null,
    commandUsed: { again: false, retreat: false, turn: 0 }, rewindsLeft: s.settings.rewind ? B.battle.rewinds : 0,
    snapshots: [], log: [], retreated: [], fallen: [], reinforcementsAt: 0, reinforcement: null, enemyAlumni: null,
    popupSeq: 0, adjacencyPairs: {}, lastAction: null, hitBy: {},
  };
  if (quest.objective === 'escort' && !b.goal) b.goal = { x: 3, y: 0 };
  // 宝箱
  for (const [x, y] of chestSpots) if (tpl.doors || rng.chance(0.6)) {
    const specials = Object.values(WEAPONS).filter((w) => w.price === 0 && w.type !== 'gun' && !w.spell);
    b.chests.push({ x, y, weaponId: rng.pick(specials).id, opened: false });
  }
  // 味方
  deploys.forEach((d, i) => {
    const st = s.students[d.studentId];
    const pos = deployTiles[i] ?? deployTiles[0];
    if (!st) return;
    const ws: string[] = [];
    const item = d.armoryUid ? s.armory.find((a) => a.uid === d.armoryUid) : null;
    if (item) ws.push(item.weaponId);
    const u = unitFromStudent(st, 'player', `p${i}`, pos[0], pos[1], ws);
    u.armoryUid = d.armoryUid ?? undefined;
    u.item = d.item;
    b.units.push(u);
  });
  // 救出する捕虜（ボスの位置か、いちばん上の敵の位置に）
  if (quest.objective === 'rescue') {
    const spot = boss ?? [...enemyTiles].sort((p, q) => p[1] - q[1])[0] ?? [3, 0];
    const st = emptyStats(3); st.hp = B.battle.npcHp; st.def = B.battle.npcDef; st.res = B.battle.npcDef;
    b.units.push(baseUnit({ uid: 'captive', side: 'npc', name: '捕虜', classId: 'novice', level: 1, stats: st, x: spot[0], y: spot[1], captive: true, moved: true, acted: true }));
    boss = null;
  }
  if (quest.objective === 'escape') b.escapeNeed = Math.min(B.battle.escapeNeed, deploys.length);
  // 守る対象
  if (npc && (quest.objective === 'escort' || quest.objective === 'defend')) {
    const st = emptyStats(3); st.hp = B.battle.npcHp; st.def = B.battle.npcDef; st.res = B.battle.npcDef; st.spd = 5; st.lck = 8;
    b.units.push(baseUnit({ uid: 'npc', side: 'npc', name: quest.objective === 'escort' ? '依頼人' : '村人', classId: 'novice', level: 1, stats: st, x: npc[0], y: npc[1], escort: true }));
  }
  // 敵
  const gun = s.world.gunUnlocked;
  const kind = QUEST_KINDS.find((k) => k.kind === quest.kind);
  const pool = kind?.enemyPool ?? ['fighter', 'swordsman', 'lancer', 'archer', 'mage'];
  const level = Math.max(1, Math.round(quest.level * s.settings.mods.enemy));
  const nEnemy = Math.min(enemyTiles.length, deploys.length + (quest.danger - 1) + (quest.objective === 'defend' ? 2 : quest.objective === 'escape' ? 1 : 0) + (quest.real ? 0 : -1));
  const spots = rng.shuffle([...enemyTiles].filter(([x, y]) => !b.units.some((u) => u.x === x && u.y === y))).slice(0, Math.max(2, nEnemy));
  const aiFor = (): Unit['ai'] => rng.weighted(['charge', 'ambush', 'hold'] as const, (a) => ({ charge: quest.objective === 'defend' ? 8 : 4, ambush: 4, hold: 1 })[a]);
  let n = 0;
  for (const [x, y] of spots) {
    const cls = gun && quest.enemyCountry === 'empire' && rng.chance(0.3) ? 'gunner' : rng.pick(pool);
    const u = enemyUnit(rng, `e${n++}`, cls, Math.max(1, level + rng.int(-2, 1)), x, y, gun);
    u.ai = aiFor();
    b.units.push(u);
  }
  if ((boss || quest.objective === 'boss' || quest.objective === 'seize') && quest.objective !== 'rescue' && quest.objective !== 'escape') {
    const [bx, by] = boss ?? enemyTiles[0];
    const u = enemyUnit(rng, `e${n++}`, rng.pick(pool), level + 2, bx, by, gun, true);
    u.ai = quest.objective === 'boss' || quest.objective === 'seize' ? 'hold' : 'ambush';
    u.name = `${u.name}（頭目）`;
    b.units.push(u);
  }
  // 戦力の調整
  const players = b.units.filter((u) => u.side === 'player');
  const pPow = players.reduce((a, u) => a + unitPower(u), 0) || 1;
  const factor = (B.battle.enemyPowerBase + quest.danger * B.battle.enemyPowerPerDanger) * (quest.real ? 1 : B.battle.drillPowerMul) * s.settings.mods.enemy;
  const target = pPow * factor;
  for (let iter = 0; iter < 30; iter++) {
    const enemies = b.units.filter((u) => u.side === 'enemy');
    const ePow = enemies.reduce((a, u) => a + unitPower(u), 0);
    const ratio = ePow / target;
    if (ratio >= B.battle.enemyPowerRange[0] && ratio <= B.battle.enemyPowerRange[1]) break;
    const e = rng.pick(enemies);
    const d = ratio > 1 ? -1 : 1;
    if (d < 0 && e.level <= 1 && enemies.length > 2 && !e.boss) { b.units = b.units.filter((u) => u !== e); continue; }
    e.level = Math.max(1, e.level + d);
    for (const k of ['hp', 'str', 'mag', 'skl', 'spd', 'def', 'res'] as const) if (rng.chance(k === 'hp' ? 0.8 : 0.4)) e.stats[k] = Math.max(1, e.stats[k] + d);
    e.maxHp = e.stats.hp; e.hp = e.maxHp;
  }
  // 戦場に現れる卒業生
  maybeAlumni(s, b, quest, rng);
  b.rng = rng.h.rng;
  b.log.push({ text: `${quest.title} 開始（${{ clear: '晴れ', rain: '雨', fog: '霧' }[quest.weather]}）`, kind: 'info' });
  return b;
}

function maybeAlumni(s: GameState, b: BattleState, q: Quest, rng: Rng): void {
  if (!q.real) return;
  const stage = tensionStage(s.world.tension);
  if (!rng.chance(B.world.alumniAppear[stage])) return;
  const alive = Object.values(s.students).filter((st) => st.status === 'graduated' && st.career?.alive && !st.career.retired && st.career.kind === 'army');
  const allies = alive.filter((st) => q.clientCountry && st.career!.country === q.clientCountry);
  const foes = alive.filter((st) => q.enemyCountry && st.career!.country === q.enemyCountry);
  if (foes.length && rng.chance(0.4)) {
    const st = rng.pick(foes);
    const spot = b.units.find((u) => u.side === 'enemy' && !u.boss);
    const x = spot?.x ?? 3, y = spot?.y ?? 0;
    if (spot) b.units = b.units.filter((u) => u !== spot);
    const u = unitFromStudent(st, 'enemy', `alum_${st.id}`, x, y, [defaultWeaponFor(st)]);
    u.name = `${st.given}（卒業生）`; u.persuadable = true; u.ai = 'ambush';
    b.units.push(u);
    b.enemyAlumni = st.id;
    b.log.push({ text: `敵の中に、教え子の${st.given}の姿がある……（隣接して「説得」できる）`, kind: 'info' });
  } else if (allies.length) {
    const st = rng.pick(allies);
    b.reinforcement = st.id; b.reinforcementsAt = 2;
  }
}

/** 卒業生が戦場で使う武器（魔法は覚えたものを別に使う） */
export function defaultWeaponFor(st: Student): string {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  let best: { id: string; pts: number } | null = null;
  for (const t of c.weapons) {
    if (t === 'staff' || t === 'magic' || t === 'holy') continue;
    const skill = t;
    const pts = (st.skills as Record<string, number>)[skill] ?? 0;
    if (!best || pts > best.pts) best = { id: weaponFor(t, st.level) ?? 'iron_sword', pts };
  }
  return best?.id ?? (usableSpells(st).length ? '' : 'iron_sword');
}
