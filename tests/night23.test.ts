import { describe, it, expect } from 'vitest';
import { newGame } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { takenNames } from '../src/core/officers';
import { NAMES } from '../src/data/names';
import { nameTag } from '../src/core/student';
import type { GameState } from '../src/core/state';
import { WOUNDS } from '../src/data/nemesis';

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

describe("23夜目①⑤'：40年回して（名前のかぶり・二つ名）", () => {
  it('同じ時期に同じ下の名前が2人いない。3年以内に二つ名が2回変わらない（より大きな出来事は別）・傷と二つ名が合う・一生で3つまで', () => {
    const s = newGame({ name: 'テスト', background: 'merc', seed: 77 });
    const found: string[] = [];
    autoYears(s, 40, (g: GameState) => { const d = dups(sameTimeNames(g)); if (d.length) found.push(`${g.year}:${d.join(',')}`); });
    expect(found).toEqual([]);
    const woundEp = new Map<string, string>();
    for (const list of Object.values(WOUNDS)) for (const w of list) if (w.ep) woundEp.set(w.text, w.ep);
    let changes = 0;
    for (const o of s.officers ?? []) {
      const log = o.epithetLog ?? [];
      changes += log.length;
      expect(log.length).toBeLessThanOrEqual(3);
      for (let i = 1; i < log.length; i++) if (log[i].year - log[i - 1].year < 3) expect(log[i].level).toBeGreaterThan(log[i - 1].level);
      if (o.epithetWhy && woundEp.has(o.epithetWhy)) expect(o.epithet).toBe(woundEp.get(o.epithetWhy));
    }
    expect(changes).toBeGreaterThan(0);
  }, 900000);
});

import { buildBattle, finishBattle, startBattle, nextStage } from '../src/core/flow';
import { recommendSquad, recommendDeploy } from '../src/core/sortie';
import { ensureStages, questStages } from '../src/core/march';
import { autoFinish, autoOne } from '../src/core/tactics/ai';
import { checkEnd, foes, mine, attack } from '../src/core/tactics/engine';
import { B as BAL } from '../src/data/balance';
import { MARCH_TEXT } from '../src/data/march';
import { chooseWeek } from '../src/core/flow';
import { recommendCard, recommendSocial, todayCards } from '../src/core/lessons';
import { autoPending } from '../src/core/autoplay';
import type { Quest } from '../src/core/state';

/** 月末の依頼が出るところまで進める（最初の案内の月は飛ばす） */
function toBoard(seed: number): GameState {
  const s = newGame({ name: 'テスト', background: 'knight', seed });
  let k = 0;
  while (k++ < 200) {
    autoPending(s);
    if (s.year >= 1 && s.month >= 1 && s.quests.some((q) => q.real && !q.tutorial && !q.small)) break;
    todayCards(s); chooseWeek(s, recommendCard(s), recommendSocial(s));
    if (s.battle) { autoFinish(s.battle); finishBattle(s); }
  }
  s.pending = [];
  return s;
}
function winNow(b: TBattle): void { for (const f of foes(b)) { f.alive = false; f.down = 'dead'; } checkEnd(b); }

describe('23夜目⑥：盤は8×10・出撃は6人＋先生', () => {
  it('ふつうの依頼の盤は8×10で、教え子6人と先生。敵は8〜12人', () => {
    const s = toBoard(21);
    const q = s.quests.find((x) => x.real && !x.small)!;
    q.stages = 1;
    const ids = recommendDeploy(s, q);
    expect(ids.length).toBe(Math.min(6, enrolled(s).length));
    const b = buildBattle(s, q, recommendSquad(s, q).deploy);
    expect([b.w, b.h]).toEqual([8, 10]);
    expect(b.units.filter((u) => u.side === 'me' && !u.teacher && !u.helper).length).toBe(ids.length);
    const n = b.units.filter((u) => u.side === 'foe').length;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(12);
    for (const u of b.units) { expect(u.x).toBeLessThan(8); expect(u.y).toBeLessThan(10); }
  });
});

describe('23夜目⑦：進軍', () => {
  it('依頼に戦場の数がつく（1〜5）。大きめの依頼は報酬が多い', () => {
    let big = 0, two = 0, all = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = toBoard(seed);
      ensureStages(s);
      for (const q of s.quests) { const n = questStages(q); expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(5); if (!q.real || q.small) expect(n).toBe(1); all++; if (n >= 3) big++; if (n === 2) two++; if (n > 1) expect(q.stageNames?.length).toBe(n); }
    }
    expect(two).toBeGreaterThan(0);
    expect(big).toBeLessThan(all / 2);
  });
  it('自分で戦う進軍：勝つと戦場と戦場のあいだ → 体力は持ち越して少し戻り、技の回数は全部戻る → 最後に結果は1つ', () => {
    const s = toBoard(22);
    const q = s.quests.find((x) => x.real && !x.small)! as Quest;
    q.stages = 3; q.stageNames = ['前哨', '城門', '本陣'];
    startBattle(s, q.id, recommendSquad(s, q).deploy, false);
    const b0 = s.battle!;
    expect(b0.march).toMatchObject({ idx: 0, total: 3 });
    const kid = b0.units.find((u) => u.side === 'me' && !u.teacher && u.techs.length)! ?? b0.units.find((u) => u.side === 'me' && !u.teacher)!;
    kid.hp = Math.max(1, Math.floor(kid.max * 0.3));
    for (const tt of kid.techs) tt.left = 0;
    const hp0 = kid.hp;
    winNow(b0);
    finishBattle(s);
    expect(s.battle).toBeNull();
    expect(s.march?.between).toBe(true);
    const c = s.march!.carry[kid.studentId!];
    expect(c.hp).toBe(Math.min(kid.max, Math.round(hp0 + kid.max * BAL.march.carryHeal)));
    nextStage(s, { rest: 'heal', route: 'detour' });
    const b1 = s.battle!;
    expect(b1.march?.idx).toBe(1);
    const k1 = b1.units.find((u) => u.studentId === kid.studentId)!;
    expect(k1.hp).toBe(Math.min(k1.max, Math.round(c.hp + 0) ));
    for (const tt of k1.techs) expect(tt.left).toBeGreaterThan(0);
    expect(b1.chests?.length).toBeGreaterThan(0);
    winNow(b1);
    finishBattle(s);
    nextStage(s, { rest: 'scout', route: 'short' });
    const b2 = s.battle!;
    expect(b2.march?.idx).toBe(2);
    winNow(b2);
    finishBattle(s);
    expect(s.march).toBeNull();
    const res = s.pending.filter((p) => p.type === 'battleResult');
    expect(res.length).toBe(1);
    expect((res[0] as { title: string }).title).toBe(q.title);
  });
  it('2つ目より先で負けたら、そこまでの戦果（報酬の一部）が残る', () => {
    const s = toBoard(23);
    const q = s.quests.find((x) => x.real && !x.small)!;
    q.stages = 2; q.stageNames = ['前哨', '本陣'];
    startBattle(s, q.id, recommendSquad(s, q).deploy, false);
    winNow(s.battle!); finishBattle(s);
    nextStage(s, { rest: 'heal', route: 'short' });
    const b = s.battle!;
    const t = b.units.find((u) => u.teacher)!; t.alive = false; t.down = 'out'; checkEnd(b);
    finishBattle(s);
    const res = s.pending.find((p) => p.type === 'battleResult') as unknown as { lines: string[] };
    expect(res.lines.some((l) => l.includes('戦果'))).toBe(true);
  });
  it('最後でない戦場の敵将は、倒しても次の戦場へ退き、傷を負ったまま待ち構える（逃げたことに触れる口上）', () => {
    for (let seed = 30; seed < 40; seed++) {
      const s = toBoard(seed);
      const q = s.quests.find((x) => x.real && !x.small);
      if (!q) continue;
      q.stages = 2; q.stageNames = ['前哨', '本陣'];
      startBattle(s, q.id, recommendSquad(s, q).deploy, false);
      const b = s.battle!;
      const bu = b.units.find((u) => u.boss && u.officerId);
      if (!bu) { s.battle = null; s.march = null; continue; }
      const kid = mine(b).find((u) => !u.teacher)!;
      bu.hp = 1; bu.sh = 0; bu.broken = 2;
      // ふつうの攻撃で倒す
      kid.x = bu.x; kid.y = bu.y + 1;
      attack(b, kid.uid, bu.uid, null, { x: kid.x, y: kid.y });
      expect(bu.down).toBe('fled');
      if (b.phase !== 'done') winNow(b);
      finishBattle(s);
      expect(s.march?.foe?.fled).toBe(true);
      nextStage(s, { rest: 'scout', route: 'short' });
      const b2 = s.battle!;
      const bu2 = b2.units.find((u) => u.boss)!;
      expect(bu2.officerId).toBe(bu.officerId);
      expect(bu2.hp).toBeLessThan(bu2.max);
      if (b2.lines?.['boss:intro']) expect(MARCH_TEXT.regroup).toContain(b2.lines['boss:intro']);
      return;
    }
    throw new Error('敵将のいる依頼が見つからない');
  });
  it('おまかせの進軍は、小休止と道もおまかせで選んで最後まで進む', () => {
    const s = toBoard(24);
    const q = s.quests.find((x) => x.real && !x.small)!;
    q.stages = 4; q.stageNames = ['a', 'b', 'c', 'd'];
    startBattle(s, q.id, recommendSquad(s, q).deploy, true);
    expect(s.battle).toBeNull();
    expect(s.march).toBeNull();
    expect(s.pending.some((p) => p.type === 'battleResult')).toBe(true);
  });
});

describe('23夜目⑨：1人ずつおまかせ', () => {
  it('その子だけが動き、番は終わらない', () => {
    const s = toBoard(25);
    const q = s.quests.find((x) => x.real && !x.small)!;
    q.stages = 1;
    s.battle = buildBattle(s, q, recommendSquad(s, q).deploy);
    const b = s.battle;
    const kid = mine(b).find((u) => !u.teacher)!;
    autoOne(b, kid.uid);
    expect(kid.acted).toBe(true);
    expect(b.phase).toBe('player');
    expect(mine(b).filter((u) => !u.acted).length).toBeGreaterThan(0);
  });
});
