// 3夜目の追加分のテスト
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoWeek, autoPending, autoBattle } from '../src/core/autoplay';
import { meetsReq, missingReqs, levelReq, takeExam, examCandidates } from '../src/core/exam';
import { rng } from '../src/core/flow';
import { CLASSES } from '../src/data/classes';
import { growTeachers, instructorCaps, retireInstructor, successorCandidates, askSuccessor, setVice, viceEligible, externalSuccessor } from '../src/core/instructor';
import { yearEnd } from '../src/core/flow';
import { resolveWeek } from '../src/core/week';
import { Rng } from '../src/core/rng';
import { RANK_POINTS, SAVE_VERSION } from '../src/data/balance';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('兵種試験のレベル条件', () => {
  it('初級Lv5・中級Lv10・上級Lv20・最上級Lv30', () => {
    expect(levelReq(CLASSES.swordsman)).toBe(5);
    expect(levelReq(CLASSES.fencer)).toBe(10);
    expect(levelReq(CLASSES.swordmaster)).toBe(20);
    expect(levelReq(CLASSES.sword_saint)).toBe(30);
  });
  it('技能が足りていてもレベルが足りなければ受験できず、足りない条件が文で出る', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 7 });
    const st = enrolled(s)[0];
    st.classId = 'lancer'; st.level = 7; st.skills.lance = RANK_POINTS['D+']; st.skills.riding = RANK_POINTS.D;
    const c = CLASSES.cavalier;
    expect(meetsReq(st, c)).toBe(false);
    const miss = missingReqs(s, st, c);
    expect(miss.some((m) => m.includes('Lv10から受験できます（あと3）'))).toBe(true);
    expect(miss.some((m) => m.includes('槍 C が必要（いま D+）'))).toBe(true);
    expect(takeExam(s, rng(s), st, 'cavalier').ok).toBe(false);
    expect(examCandidates(s).includes(st)).toBe(false);
  });
});

describe('2夜目の版のセーブ', () => {
  it('ふつうの時のセーブを読み込んで、1年遊べる。昇格済みの子は降格しない', () => {
    const raw = JSON.parse(fixture('v2-save.json'));
    expect(raw.version).toBe(2);
    const before = Object.fromEntries(Object.values(raw.state.students as Record<string, { id: string; classId: string }>).map((x) => [x.id, x.classId]));
    const s = deserialize(fixture('v2-save.json'));
    expect(s.version).toBe(SAVE_VERSION);
    for (const st of enrolled(s)) expect(CLASSES[st.classId].tier).toBeGreaterThanOrEqual(CLASSES[before[st.id]].tier);
    autoYears(s, 1);
    expect(Number.isFinite(s.money)).toBe(true);
    const again = deserialize(serialize(s));
    expect(again.year).toBe(s.year);
  });
  it('戦闘の途中のセーブも続きから遊べる', () => {
    const s = deserialize(fixture('v2-battle.json'));
    expect(s.battle).not.toBeNull();
    autoBattle(s);
    expect(s.battle).toBeNull();
    autoPending(s);
    for (let i = 0; i < 6; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
  });
});

describe('教官の技能は教えるほど上がる', () => {
  it('苦手科目（D）を重点にし続けると、10年ほどでBに届く。上限はB', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 3 });
    s.instructor.skills.magic = RANK_POINTS.D;
    s.instructor.caps = undefined; instructorCaps(s);
    for (const g of [1, 2, 3]) s.focus[g] = ['magic', 'sword'];
    let weeks = 0;
    while (s.instructor.skills.magic < RANK_POINTS.B && weeks < 2000) { growTeachers(s, []); weeks++; }
    expect(weeks / 48).toBeGreaterThan(8);
    expect(weeks / 48).toBeLessThan(13);
    for (let i = 0; i < 1000; i++) growTeachers(s, []);
    expect(s.instructor.skills.magic).toBe(RANK_POINTS.B);
    // 得意科目（槍）の上限はS
    expect(instructorCaps(s).lance).toBe(RANK_POINTS.S);
  });
});

describe('教官の代替わり', () => {
  it('65歳で必ず引退、講師の卒業生はすぐ引き受けて二代目になる', () => {
    const s = newGame({ name: '初代', background: 'mage', seed: 5 });
    autoYears(s, 4);
    autoPending(s);
    const grad = Object.values(s.students).find((x) => x.status === 'graduated' && x.career?.alive)!;
    s.teachers.push({ id: 'tx', name: grad.given, skill: 'sword', points: 200, salary: 100, alumniId: grad.id, since: s.year - 2 });
    s.instructor.age = 64;
    s.month = 11; s.pending = [];
    yearEnd(s, []);
    const p = s.pending.find((x) => x.type === 'retire');
    expect(p && p.type === 'retire' && p.forced).toBe(true);
    s.pending = s.pending.filter((x) => x.type === 'retire');
    retireInstructor(s, new Rng(s));
    expect(s.pending[0].type).toBe('scene');
    expect(s.pending.some((x) => x.type === 'successor')).toBe(true);
    const c = successorCandidates(s).find((x) => x.st.id === grad.id)!;
    expect(c.chance).toBe(100);
    expect(askSuccessor(s, new Rng(s), grad.id).ok).toBe(true);
    expect(s.instructor.generation).toBe(2);
    expect(s.instructor.studentId).toBe(grad.id);
    expect(s.instructor.skills.sword).toBe(grad.skills.sword);
    expect(s.pastInstructors?.[0].name).toBe('初代');
    expect(s.teachers.some((t) => t.alumniId === grad.id)).toBe(false);
    // もう一度代替わりしても壊れない（外部の教官）
    externalSuccessor(s, new Rng(s));
    expect(s.instructor.generation).toBe(3);
    const again = deserialize(serialize(s));
    expect(again.instructor.generation).toBe(3);
  });
});

describe('副教官', () => {
  it('担当学年の生徒を毎週1人、自動で指導する', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 9 });
    autoYears(s, 4);
    autoPending(s);
    const grad = Object.values(s.students).find((x) => x.status === 'graduated' && x.career?.alive)!;
    s.teachers.push({ id: 'tv', name: grad.given, skill: 'lance', points: 200, salary: 100, alumniId: grad.id, since: s.year - 1 });
    expect(viceEligible(s).some((t) => t.id === 'tv')).toBe(true);
    expect(setVice(s, 'tv', 1, 'combat')).toBe(true);
    const res = resolveWeek(s, new Rng(s));
    expect(res.lines.some((l) => l.includes(`担任の${grad.given}`))).toBe(true);
  });
});

import { endingReady, checkEndings, continueSchool, buildHallEntry, endingScene } from '../src/core/ending';
describe('エンディング', () => {
  const base = () => { const s = newGame({ name: 't', background: 'knight', seed: 21 }); autoYears(s, 3); autoPending(s); return s; };
  it('統一：一国の国力が他の二国の合計を上回る状態が2年続く', () => {
    const s = base();
    s.world.power = { kingdom: 90, empire: 30, alliance: 40 };
    s.world.unifyYears = { kingdom: 2 };
    expect(endingReady(s, 'year')).toEqual({ kind: 'unify', country: 'kingdom' });
    expect(endingReady(s, 'month')).toBeNull();
  });
  it('疲弊の停戦：戦いの疲れが8年分、三国すべての国力が35以下', () => {
    const s = base();
    s.world.power = { kingdom: 30, empire: 35, alliance: 20 };
    s.world.exhaustion = 8;
    expect(endingReady(s, 'year')?.kind).toBe('ceasefire');
    s.world.power.empire = 36;
    expect(endingReady(s, 'year')).toBeNull();
  });
  it('和平の円卓は、その月にも判定。場面は後日談・年表・エンドロール・最後の一枚まで', () => {
    const s = base();
    s.world.peaceRoundYear = s.year;
    expect(checkEndings(s, new Rng(s), 'month')).toBe('peace');
    const scene = s.pending.find((p) => p.type === 'scene');
    expect(scene && scene.type === 'scene' && scene.lines.some((l) => l.roll)).toBe(true);
    expect(scene && scene.type === 'scene' && scene.lines.some((l) => l.title === '最後の一枚')).toBe(true);
    expect(s.pending.some((p) => p.type === 'ending')).toBe(true);
    // 続ける：平和な時代、同じエンディングは二度起きない
    continueSchool(s);
    expect(s.world.era).toBe('peace');
    expect(endingReady(s, 'year')).toBeNull();
    autoYears(s, 2);
    expect(s.endings?.length).toBe(1);
    const hall = buildHallEntry(s);
    expect(hall.endings[0].kind).toBe('peace');
    expect(JSON.parse(JSON.stringify(hall)).graduates.length).toBeGreaterThan(0);
  });
  it('学校の中立宣言：評判・卒業生・友好度・独立・防衛戦に勝った年（4夜目に条件をゆるめた）', () => {
    const s = base();
    s.reputation = 100; s.world.friendship = { kingdom: 80, empire: 75, alliance: 90 }; s.world.vassal = null; s.world.defenseWonYear = s.year;
    expect(endingReady(s, 'month')).toBeNull(); // 卒業生が足りない
    const g = Object.values(s.students).find((x) => x.status === 'graduated')!;
    for (let i = 0; i < 150; i++) s.students[`x${i}`] = { ...g, id: `x${i}` };
    expect(endingReady(s, 'month')?.kind).toBe('neutral');
    for (const k of ['peace', 'unify', 'ceasefire', 'neutral'] as const) expect(endingScene(s, new Rng(s), k, 'kingdom').length).toBeGreaterThan(5);
  });
});

import { MAPS } from '../src/data/maps';
import { createBattle } from '../src/core/battle/setup';
import { canOpenDoor, openDoor } from '../src/core/battle/engine';
import { nextClasses, heroOpen } from '../src/core/exam';
import { forecast } from '../src/core/battle/calc';
describe('兵種の仕上げ', () => {
  it('扉のある型：扉を開けなくても敵将まで行ける、扉の奥には宝箱', () => {
    for (const id of ['old_keep', 'prison']) {
      const m = MAPS[id];
      expect(m.doors).toBe(true);
      const W = 8, H = 12;
      const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !'#D'.includes(m.rows[y][x]);
      const start = [m.rows.length - 2, 0].map(() => 0) && (() => { for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) if (m.rows[y][x] === 'P') return [x, y]; return [0, 0]; })();
      const seen = new Set([start.join(',')]); const q = [start];
      while (q.length) { const [x, y] = q.shift()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && ok(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); } } }
      let k = ''; m.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'K') k = `${x},${y}`; }));
      expect(seen.has(k), id).toBe(true);
      expect(m.rows.join('').includes('D')).toBe(true);
    }
  });
  it('シーフ系は扉を開けられる（ほかの兵種は開けられない）', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 31 });
    const st = enrolled(s)[0];
    const q = { id: 'qd', kind: 'bandit' as const, title: '古城', client: 'x', clientCountry: null, enemyCountry: null, objective: 'rout' as const, template: 'old_keep', level: 3, reward: 100, danger: 1, weather: 'clear' as const, real: false };
    s.quests = [q];
    const b = createBattle(s, q, [{ studentId: st.id, armoryUid: null, item: null, staffUid: null }], 5);
    expect(b.chests.length).toBe(2);
    const u = b.units.find((x) => x.studentId === st.id)!;
    u.x = 4; u.y = 2; // 扉 (4,3) の上
    expect(canOpenDoor(b, u)).toBeNull();
    u.abilities = ['lockpick'];
    expect(canOpenDoor(b, u)).toEqual({ x: 4, y: 3 });
    openDoor(b, u);
    expect(b.tiles[3 * 8 + 4]).toBe('road');
  });
  it('英雄：才能「英雄の器」の子が上級から、Lv20で受験できる', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 41 });
    const st = enrolled(s)[0];
    st.classId = 'swordmaster'; st.level = 20;
    st.talent = null;
    expect(nextClasses(s, st).some((c) => c.id === 'hero')).toBe(false);
    st.talent = 'hero';
    expect(heroOpen(st)).toBe(true);
    const hero = nextClasses(s, st).find((c) => c.id === 'hero')!;
    expect(meetsReq(st, hero)).toBe(true);
    st.level = 19;
    expect(meetsReq(st, hero)).toBe(false);
  });
  it('上級の固有スキル：魔騎突は守備・魔防を下げて攻撃、駆け射ちは追撃しやすい', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 51 });
    const st = enrolled(s)[0];
    const q = { id: 'qd', kind: 'drill' as const, title: '演習', client: 'x', clientCountry: null, enemyCountry: null, objective: 'rout' as const, template: 'training', level: 3, reward: 0, danger: 1, weather: 'clear' as const, real: false };
    const b = createBattle(s, q, [{ studentId: st.id, armoryUid: null, item: null, staffUid: null }], 5);
    const u = b.units.find((x) => x.studentId === st.id)!;
    const e = b.units.find((x) => x.side === 'enemy')!;
    u.weaponId = 'iron_sword'; u.weapons = ['iron_sword']; e.x = u.x; e.y = u.y - 1;
    const sup = () => 0;
    const base = forecast(b, u, e, u.x, u.y, sup).atk.dmg;
    u.abilities = ['magic_lance'];
    const pierced = forecast(b, u, e, u.x, u.y, sup).atk.dmg;
    expect(pierced).toBeGreaterThanOrEqual(Math.min(base + 4, pierced));
    expect(pierced).toBeGreaterThan(base - 1);
    u.stats.spd = e.stats.spd + 2; u.abilities = [];
    expect(forecast(b, u, e, u.x, u.y, sup).atk.count).toBe(1);
    u.abilities = ['running_shot'];
    expect(forecast(b, u, e, u.x, u.y, sup).atk.count).toBe(2);
  });
});

describe('誕生日', () => {
  it('入学時に誕生日が決まり、古いセーブの生徒にも付く。誕生日の週はやる気が上がる', () => {
    const s = deserialize(fixture('v2-save.json'));
    for (const st of Object.values(s.students)) expect(st.birthday).toBeTruthy();
    const st = enrolled(s)[0];
    st.birthday = { month: s.month, week: s.week };
    st.motivation = 1;
    s.pending = [];
    const res = resolveWeek(s, new Rng(s));
    expect(res.lines.some((l) => l.includes(`${st.given}の誕生日`))).toBe(true);
    const n = newGame({ name: 't', background: 'knight', seed: 77 });
    for (const x of enrolled(n)) { expect(x.birthday!.month).toBeGreaterThanOrEqual(0); expect(x.birthday!.week).toBeGreaterThanOrEqual(1); }
  });
});
