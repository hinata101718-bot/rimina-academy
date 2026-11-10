import { describe, it, expect } from 'vitest';
import { newGame } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { takenNames } from '../src/core/officers';
import { NAMES } from '../src/data/names';
import { nameTag } from '../src/core/student';
import type { GameState } from '../src/core/state';

/** 同じ時期にいる人の下の名前を、重なりも数えて並べる */
function sameTimeNames(s: GameState): string[] {
  const out: string[] = [];
  for (const x of Object.values(s.students)) {
    if (x.status === 'enrolled') out.push(x.given);
    else if (x.status === 'graduated' && x.career && x.career.alive !== false && !x.career.retired) out.push(x.given);
  }
  for (const a of s.applicants ?? []) out.push(a.given);
  // 卒業生が敵将になったときは同じ人なので、卒業生の側だけ数える
  for (const o of s.officers ?? []) if (o.status === 'active' && !o.alumniId) out.push(o.given);
  return out;
}
function dups(list: string[]): string[] { return list.filter((n, i) => list.indexOf(n) !== i); }

describe('23夜目①：同じ時期に名前がかぶらない', () => {
  it('どの出身の表も、男・女・姓が50以上', () => {
    for (const o of Object.keys(NAMES) as (keyof typeof NAMES)[]) {
      expect(NAMES[o].male.length).toBeGreaterThanOrEqual(50);
      expect(NAMES[o].female.length).toBeGreaterThanOrEqual(50);
      expect(NAMES[o].family.length).toBeGreaterThanOrEqual(50);
    }
  });
  it('はじめの一期生と上級生で、同じ下の名前がない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame({ name: 'テスト', background: 'knight', seed });
      expect(dups(sameTimeNames(s))).toEqual([]);
      expect(takenNames(s).has(s.instructor.name.split('・')[0])).toBe(true);
    }
  });
  it('40年回して、同じ時期に同じ下の名前が2人いない', () => {
    const s = newGame({ name: 'テスト', background: 'merc', seed: 77 });
    const found: string[] = [];
    autoYears(s, 40, (g: GameState) => { const d = dups(sameTimeNames(g)); if (d.length) found.push(`${g.year}:${d.join(',')}`); });
    expect(found).toEqual([]);
  }, 120000);
  it('前からのセーブで同じ名前の子がいるときは、姓の頭を添える', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 5 });
    const [a, b] = Object.values(s.students).filter((x) => x.family);
    b.given = a.given;
    expect(nameTag(s, a)).toBe(`${a.given}・${a.family.replace(/^(フォン|ド|ディ)・/, '')[0]}`);
    const c = Object.values(s.students).find((x) => x.id !== a.id && x.id !== b.id)!;
    expect(nameTag(s, c)).toBe(c.given);
  });
});

import type { TBattle, TUnit } from '../src/core/tactics/types';
import { endTurn, intents, unit, trapSpots, placeTrap } from '../src/core/tactics/engine';
import { shouldRetreat, autoTurn } from '../src/core/tactics/ai';
import { startTraits } from '../src/core/tactics/setup';
import { CLASSES, CLASS_LIST } from '../src/data/classes';
import { nextClasses, sideClasses, canSideChange, sideChange, autoSideChange, sameTier, recommendClass } from '../src/core/exam';
import { RANK_POINTS } from '../src/data/balance';
import { enrolled } from '../src/core/game';

function tb(): TUnit {
  return { uid: 'x', side: 'me', name: 'x', classId: 'swordsman', x: 0, y: 0, hp: 30, max: 30, str: 10, mag: 4, skl: 4, spd: 6, def: 4, res: 3, mov: 3, rmin: 1, rmax: 1, type: 'slash', magic: false, might: 5, techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0 };
}
function board(units: TUnit[], o: Partial<TBattle> = {}): TBattle {
  const b: TBattle = { v: 19, questId: 'q', title: 't', field: 'plain', w: 8, h: 10, forest: [], rock: [], units, turn: 1, phase: 'player', result: null, objective: 'boss', teacherUid: 'teacher', command: 1, insight: 2, undo: null, log: [], scenes: [], fx: [], said: [], foes0: 1, real: true, ...o };
  intents(b);
  return b;
}

describe('23夜目②：負けそうなとき、おまかせが退く', () => {
  it('深手の子が2人いて勝ち目が薄いと退く（負けになるが、残った子はそれ以上傷つかない）', () => {
    const a: TUnit = { ...tb(), uid: 'a', x: 2, y: 8, hp: 5 };
    const c: TUnit = { ...tb(), uid: 'c', x: 3, y: 8, hp: 4 };
    const t: TUnit = { ...tb(), uid: 'teacher', teacher: true, x: 2, y: 9 };
    const f: TUnit = { ...tb(), uid: 'boss', side: 'foe', boss: true, x: 2, y: 2, hp: 90, max: 90, sh: 3, shMax: 3 };
    const b = board([a, c, t, f]);
    expect(shouldRetreat(b)).toBe(true);
    autoTurn(b);
    expect(b.phase).toBe('done');
    expect(b.result).toBe('lose');
    expect(b.retreated).toBe(true);
    expect(a.alive && c.alive).toBe(true);
  });
  it('元気なうちは退かない', () => {
    const a: TUnit = { ...tb(), uid: 'a', x: 2, y: 8 };
    const t: TUnit = { ...tb(), uid: 'teacher', teacher: true, x: 2, y: 9 };
    const f: TUnit = { ...tb(), uid: 'boss', side: 'foe', boss: true, x: 2, y: 2, hp: 30, max: 30 };
    expect(shouldRetreat(board([a, t, f]))).toBe(false);
  });
});

describe('23夜目③：斥候の罠・兵種の条件・最上級', () => {
  it('斥候は罠を置く場所を選べる。踏んだ敵は傷を負って、そこで止まる', () => {
    const sc: TUnit = { ...tb(), uid: 'sc', classId: 'scout', traits: ['spot', 'trap'], x: 3, y: 8 };
    const t: TUnit = { ...tb(), uid: 'teacher', teacher: true, x: 3, y: 9 };
    const f: TUnit = { ...tb(), uid: 'e0', side: 'foe', x: 3, y: 3, hp: 20, max: 20, mov: 4 };
    const b = board([sc, t, f], { objective: 'rout' });
    startTraits(b);
    const spots = trapSpots(b, sc);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.some((p) => p.x === 3 && p.y === 5)).toBe(true);
    expect(spots.some((p) => Math.abs(p.x - 3) + Math.abs(p.y - 8) > 4)).toBe(false);
    placeTrap(b, 'sc', 3, 5);
    expect(b.traps).toEqual([{ x: 3, y: 5, by: 'sc' }]);
    expect(trapSpots(b, sc)).toEqual([]);
    expect(sc.acted).toBe(false);
    endTurn(b);
    expect([f.x, f.y]).toEqual([3, 5]);
    expect(f.hp).toBe(13);
    expect(b.traps).toEqual([]);
  });
  it('密偵の系統の上級は、剣だけでなく軍略・魔法も要る（ソードマスターと並ばない）', () => {
    expect(CLASSES.shadow.req).toEqual({ sword: 'B', tactics: 'D' });
    expect(CLASSES.trickster.req).toEqual({ sword: 'B', magic: 'D' });
    const s = newGame({ name: 'テスト', background: 'knight', seed: 9 });
    const st = enrolled(s)[0];
    st.classId = 'kensei'; st.grade = 3; st.level = 25;
    for (const k of Object.keys(st.skills) as (keyof typeof st.skills)[]) st.skills[k] = 0;
    st.skills.sword = RANK_POINTS.B;
    const ids = nextClasses(s, st).filter((c) => !sameTier(st, c)).map((c) => c.id);
    expect(ids).toContain('swordmaster');
    expect(ids).not.toContain('shadow');
    expect(ids).not.toContain('trickster');
  });
});

describe('23夜目④：同じ段階の兵種へ', () => {
  it('初級どうしは試験なしで移れる（条件を満たすものだけ・月に1回まで）。特技は入れ替わる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 11 });
    const st = enrolled(s).find((x) => CLASSES[x.classId].tier === 1)!;
    for (const k of Object.keys(st.skills) as (keyof typeof st.skills)[]) st.skills[k] = 0;
    st.classId = 'swordsman';
    st.skills.sword = 30; st.skills.lance = 30;
    const ids = sideClasses(st).map((c) => c.id);
    expect(ids).toContain('lancer');
    expect(ids).not.toContain('archer');
    expect(sideChange(s, st, 'lancer').ok).toBe(true);
    expect(st.classId).toBe('lancer');
    expect(canSideChange(s, st)).toBe(false);
    expect(sideChange(s, st, 'thief').ok).toBe(false);
  });
  it('中級より上は、同じ段階の兵種が試験の候補に「同じ段階」として並ぶ（勧めには出ない）', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 12 });
    const st = enrolled(s)[0];
    st.classId = 'kensei'; st.grade = 2; st.level = 12;
    st.skills.lance = RANK_POINTS.C; st.skills.sword = RANK_POINTS.C;
    const opts = nextClasses(s, st);
    expect(opts.some((c) => c.id === 'highlancer' && sameTier(st, c))).toBe(true);
    const rec = recommendClass(s, st, opts);
    expect(rec && sameTier(st, rec)).toBeFalsy();
    expect(CLASS_LIST.filter((c) => c.tier === 1).every((c) => Object.keys(c.req).length === 1)).toBe(true);
  });
  it('おまかせは、得意と兵種が合わない子だけを初級のうちに移す', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 13 });
    const st = enrolled(s)[0];
    st.classId = 'swordsman';
    st.apt = { good: ['bow'], bad: [] } as never;
    st.skills.bow = 30;
    expect(autoSideChange(s, st)).toBeTruthy();
    expect(st.classId).toBe('archer');
    const st2 = enrolled(s)[1];
    st2.classId = 'archer'; st2.apt = { good: ['bow'], bad: [] } as never;
    expect(autoSideChange(s, st2)).toBeNull();
  });
});
