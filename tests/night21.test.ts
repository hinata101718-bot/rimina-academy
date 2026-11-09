import { describe, it, expect } from 'vitest';
import type { TBattle, TUnit } from '../src/core/tactics/types';
import { endTurn, intents, unit, swapTargets, swapFoeTargets, swapUnits, undoLast, openables, openAt, ignitables, ignite, blocked, attack } from '../src/core/tactics/engine';
import { autoTurn } from '../src/core/tactics/ai';
import { applyClass } from '../src/core/tactics/setup';
import { TB } from '../src/data/tactics';

function base(): TUnit {
  return { uid: 'x', side: 'me', name: 'x', classId: 'swordsman', x: 0, y: 0, hp: 30, max: 30, str: 10, mag: 4, skl: 4, spd: 6, def: 4, mov: 3, rmin: 1, rmax: 1, type: 'slash', magic: false, might: 5, techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0 };
}
function mini(extra: TUnit[] = [], o: Partial<TBattle> = {}): TBattle {
  const a: TUnit = { ...base(), uid: 'a', name: 'あ', x: 2, y: 5 };
  const t: TUnit = { ...base(), uid: 'teacher', teacher: true, x: 2, y: 7, name: '先生' };
  const f: TUnit = { ...base(), uid: 'boss', side: 'foe', name: '敵将', x: 2, y: 2, hp: 60, max: 60, str: 8, def: 3, spd: 4, sh: 2, shMax: 2, weak: ['slash', 'fire'], known: ['slash'], boss: true };
  const b: TBattle = { v: 19, questId: 'q', title: 't', field: 'plain', w: 6, h: 8, forest: [], rock: [], units: [a, t, f, ...extra], turn: 1, phase: 'player', result: null, objective: 'boss', teacherUid: 'teacher', command: 1, insight: 2, undo: null, log: [], scenes: [], fx: [], said: [], foes0: 1, real: true, ...o };
  intents(b);
  return b;
}
const withClass = (u: TUnit, cid: string) => { applyClass(u, cid); u.classId = cid; return u; };

describe('21夜目①：入れ替え（トリックスター・道化王）', () => {
  it('トリックスターは3マス以内の仲間だけ（敵は入れ替えられない）。入れ替えるとその番の行動になり、ひとつ戻せる', () => {
    const tr = withClass({ ...base(), uid: 'tr', name: 'トリ', x: 4, y: 6 }, 'trickster');
    const b = mini([tr]);
    const ts = swapTargets(b, tr).map((u) => u.uid);
    expect(ts).toContain('a');
    expect(ts).not.toContain('boss');
    swapUnits(b, 'tr', 'a');
    expect([unit(b, 'tr')!.x, unit(b, 'tr')!.y]).toEqual([2, 5]);
    expect([unit(b, 'a')!.x, unit(b, 'a')!.y]).toEqual([4, 6]);
    expect(unit(b, 'tr')!.acted).toBe(true);
    expect(undoLast(b)).toBe(true);
    expect([unit(b, 'tr')!.x, unit(b, 'tr')!.y]).toEqual([4, 6]);
    expect(unit(b, 'tr')!.acted).toBe(false);
  });
  it('道化王は敵も紫に光り、敵どうしの場所も入れ替えられる（4マス）', () => {
    const jk = withClass({ ...base(), uid: 'jk', name: 'ジョ', x: 3, y: 4 }, 'jesterking');
    const g: TUnit = { ...base(), uid: 'e0', side: 'foe', name: '兵', x: 4, y: 2 };
    const b = mini([jk, g]);
    expect(swapTargets(b, jk).map((u) => u.uid)).toEqual(expect.arrayContaining(['a', 'boss', 'e0']));
    expect(swapFoeTargets(b, jk, 'boss').map((u) => u.uid)).toEqual(['e0']);
    swapUnits(b, 'jk', 'boss', 'e0');
    expect([unit(b, 'boss')!.x, unit(b, 'boss')!.y]).toEqual([4, 2]);
    expect([unit(b, 'e0')!.x, unit(b, 'e0')!.y]).toEqual([2, 2]);
    expect(unit(b, 'jk')!.acted).toBe(true);
  });
  it('おまかせは、命の危険のしるしがついた仲間を入れ替えで逃がす', () => {
    const tr = withClass({ ...base(), uid: 'tr', name: 'トリ', x: 3, y: 6, hp: 40, max: 40, def: 12 }, 'trickster');
    const nem: TUnit = { ...base(), uid: 'boss', side: 'foe', name: '宿敵', x: 2, y: 3, hp: 80, max: 80, str: 18, def: 6, spd: 4, sh: 4, shMax: 4, weak: ['fire'], known: [], boss: true, nemesis: true, mov: 2 };
    const b = mini([tr], { nemesisId: 'o1' });
    b.units = b.units.filter((u) => u.uid !== 'boss'); b.units.push(nem);
    const a = unit(b, 'a')!; a.hp = 5; a.x = 2; a.y = 4; a.mov = 0;
    intents(b);
    expect(nem.aim && 't' in nem.aim && nem.aim.lethal).toBe(true);
    autoTurn(b, { noDeath: true });
    expect(b.log.some((l) => l.text.includes('入れ替え'))).toBe(true);
    expect(unit(b, 'a')!.down).not.toBe('dead');
  });
});

describe('21夜目①：2手先の狙い（千里眼・天眼）', () => {
  it('千里眼がいると、敵の次の次の狙い（aim2）が分かる。いなければ出ない', () => {
    const g: TUnit = { ...base(), uid: 'e0', side: 'foe', name: '兵', x: 0, y: 0, mov: 2 };
    const b0 = mini([g]);
    expect(b0.units.some((u) => u.aim2)).toBe(false);
    const fs = withClass({ ...base(), uid: 'fs', name: 'セン', x: 5, y: 6 }, 'farsight');
    const b = mini([{ ...g }, fs]);
    expect(b.units.filter((u) => u.side === 'foe').some((u) => u.aim2)).toBe(true);
    // 試しの計算は本物の盤を動かさない
    expect(unit(b, 'e0')!.x).toBe(0);
    expect(b.turn).toBe(1);
  });
});

describe('21夜目①：宝箱と扉（盗賊の系統）', () => {
  it('宝箱と扉は通れない。盗賊だけが開けられ、薬は使え、武器と扉の奥のお金は戦いのあとに持ち帰る', () => {
    const rg = withClass({ ...base(), uid: 'rg', name: 'トウ', x: 4, y: 5 }, 'rogue');
    const b = mini([rg], { chests: [{ x: 4, y: 3, kind: 'potion' }, { x: 0, y: 4, kind: 'weapon', weaponId: 'steel_sword' }], doors: ['5-3'] });
    expect(blocked(b, 4, 3)).toBe(true);
    expect(blocked(b, 5, 3)).toBe(true);
    expect(openables(b, unit(b, 'a')!)).toEqual([]);
    const op = openables(b, rg);
    expect(op.map((o) => o.kind)).toEqual(expect.arrayContaining(['chest', 'door']));
    openAt(b, 'rg', 4, 3);
    expect(b.chests![0].opened).toBe(true);
    expect(rg.potion).toBe(1);
    expect(blocked(b, 4, 3)).toBe(false);
    endTurn(b, { noDeath: true });
    if (b.phase === 'player') { openAt(b, 'rg', 5, 3); expect(b.doors).toEqual([]); expect(b.found?.some((f) => f.money)).toBe(true); }
  });
});

describe('21夜目①：火矢で森と門を燃やす', () => {
  it('火矢兵は森を燃やせる。燃える森は通る者が傷を負い、燃え尽きると森でなくなる', () => {
    const fa = withClass({ ...base(), uid: 'fa', name: 'ヒヤ', x: 1, y: 6 }, 'firearcher');
    const b = mini([fa], { forest: ['1-3'] });
    const ig = ignitables(b, fa);
    expect(ig.some((o) => o.x === 1 && o.y === 3)).toBe(true);
    ignite(b, 'fa', 1, 3);
    expect(b.wild).toContain('1-3');
    expect(b.burn?.['1-3']).toBe(TB.wildfire.turns);
    for (let i = 0; i < TB.wildfire.turns && b.phase === 'player'; i++) endTurn(b, { noDeath: true });
    expect(b.forest).not.toContain('1-3');
  });
  it('森にいる敵に火矢を当てると、森が燃える', () => {
    const fa = withClass({ ...base(), uid: 'fa', name: 'ヒヤ', x: 2, y: 5, mag: 12 }, 'firearcher');
    const b = mini([fa], { forest: ['2-2'] });
    b.units = b.units.filter((u) => u.uid !== 'a');
    attack(b, 'fa', 'boss', null, { x: 2, y: 5 });
    expect(b.wild).toContain('2-2');
  });
  it('砦の木の門は通れず、火矢で焼き落とせる（劫火の条件）', () => {
    const fa = withClass({ ...base(), uid: 'fa', name: 'ヒヤ', x: 2, y: 5 }, 'firearcher');
    const b = mini([fa], { field: 'fort', gate: '2-3' });
    expect(blocked(b, 2, 3)).toBe(true);
    expect(ignitables(b, fa).some((o) => o.gate)).toBe(true);
    ignite(b, 'fa', 2, 3);
    expect(b.gate).toBeNull();
    expect(blocked(b, 2, 3)).toBe(false);
    expect(fa.deeds?.burnFort).toBe(1);
  });
});

import { newGame } from '../src/core/game';
import { TALKS, PHRASES } from '../src/data/talks';
import { condOk } from '../src/core/support';

describe('21夜目①：呪いの子の記憶', () => {
  it('蘇りの記憶の会話が3つ（C・B・A）あり、呪いで蘇った子にだけ出る。文はすべてある', () => {
    const mem = TALKS.filter((t) => t.topic === 'memory');
    expect(mem.map((t) => t.rank).sort()).toEqual(['A', 'B', 'C']);
    const s = newGame({ name: 'テスト', background: 'knight', seed: 7 });
    const [a, b] = Object.values(s.students).filter((x) => x.status === 'enrolled');
    expect(condOk(mem[0].when, a, b, null, s)).toBe(false);
    a.revivedBy = 'x';
    expect(condOk(mem[0].when, a, b, null, s)).toBe(true);
    for (const t of mem) for (const l of t.lines) { const keys = typeof l.say === 'string' ? [l.say] : [l.say.then, l.say.else]; for (const k of keys) expect(PHRASES[k as string], String(k)).toBeTruthy(); }
  });
});

import { ensureRivalry, officers as officerList } from '../src/core/officers';
import { sproutHeart, heartsMonth, heartBattleLines, heartAllyChance } from '../src/core/hearts';
import { Rng } from '../src/core/rng';
import { B } from '../src/data/balance';
import { calc } from '../src/core/tactics/engine';

describe('21夜目②：宿敵との友情と恋', () => {
  function setup() {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 11 });
    const st = Object.values(s.students).find((x) => x.status === 'enrolled')!;
    const o = officerList(s).find((x) => x.status === 'active' && x.kind !== 'monster' && !x.alumniId)!;
    o.heart = 'steady';
    const rv = ensureRivalry(s, st.id, o.id); rv.battles = 2;
    return { s, st, o, rv };
  }
  it('芽生えると場面が出て、年表に残る。前の縁から何年かあかないと、次は芽生えない', () => {
    const { s, st, o, rv } = setup();
    const r = new Rng({ rng: 3 });
    const before = s.pending.length;
    expect(sproutHeart(s, rv, 'debt', r)).toBeTruthy();
    expect(rv.heart?.why).toBe('debt');
    expect(s.pending.length).toBe(before + 1);
    expect(s.pending[s.pending.length - 1]).toMatchObject({ type: 'nemesis', kind: 'heart', officerId: o.id });
    const st2 = Object.values(s.students).filter((x) => x.status === 'enrolled')[1];
    const rv2 = ensureRivalry(s, st2.id, officerList(s).filter((x) => x.status === 'active' && x.id !== o.id && x.kind !== 'monster')[0].id);
    expect(sproutHeart(s, rv2, 'oath', r)).toBeNull();
    s.year += B.bonds.heartGap;
    void st;
  });
  it('宿敵戦：口上が変わり、縁のある子への一撃は命を奪わず、その子の剣は一度だけとどめを迷う', () => {
    const { s, st, o, rv } = setup();
    sproutHeart(s, rv, 'oath', new Rng({ rng: 1 }));
    const out: Record<string, string> = {};
    heartBattleLines(s, o, [st.id], out, new Rng({ rng: 2 }));
    expect(out['boss:intro']).toContain(st.given);
    expect(out[`heart:s_${st.id}`]).toBe(rv.heart!.kind);
    // 盤で確かめる
    const kid: TUnit = { ...base(), uid: `s_${st.id}`, name: st.given, x: 2, y: 3, hp: 3, max: 30, str: 30 };
    const nem: TUnit = { ...base(), uid: 'boss', side: 'foe', name: o.given, x: 2, y: 2, hp: 5, max: 60, str: 20, boss: true, nemesis: true, clung: true, broken: 2 };
    const b = mini([], { nemesisId: o.id, lines: out });
    b.units = [b.units[1], kid, nem];
    expect(calc(b, nem, kid).lethal).toBe(false);
    attack(b, kid.uid, 'boss', null, { x: 2, y: 3 });
    expect(nem.alive).toBe(true);
    expect(b.log.some((l) => l.text.includes('止まった'))).toBe(true);
  });
  it('手紙が届き、やがて気持ちを確かめ合う。宿敵が倒れると重い場面が一度だけ出る。味方になる見込みが上がる', () => {
    const { s, o, rv } = setup();
    sproutHeart(s, rv, 'meet', new Rng({ rng: 5 }));
    expect(heartAllyChance(s, o, true)).toBeGreaterThan(B.bonds.allyDebt);
    expect(heartAllyChance(s, o, false)).toBeGreaterThan(0);
    const r = new Rng({ rng: 9 });
    for (let i = 0; i < 200 && !rv.heart!.confessed; i++) heartsMonth(s, r);
    expect(rv.heart!.letters).toBeGreaterThanOrEqual(B.bonds.confessAfter);
    expect(rv.heart!.confessed).toBe(true);
    o.status = 'dead';
    const n0 = s.pending.length;
    heartsMonth(s, r);
    expect(rv.heart!.mourned).toBe(true);
    const n1 = s.pending.length;
    expect(n1).toBeGreaterThan(n0);
    heartsMonth(s, r);
    expect(s.pending.filter((p) => p.type === 'nemesis' && p.kind === 'heart').length).toBeGreaterThan(0);
  });
});

// ---------- 21夜目③④：数字の直し・小さな直し ----------
import { newGame, enrolled } from '../src/core/game';
import { B } from '../src/data/balance';
import { BACKGROUNDS } from '../src/data/people';
import { cohortName } from '../src/core/util';
import { recommendDeploy, fragileFor } from '../src/core/sortie';
import { retireCheck } from '../src/core/instructor';

describe('21夜目③：数字の直し', () => {
  it('はじめの先生は35〜42歳。57歳から「引退を考える」', () => {
    for (const bg of BACKGROUNDS) { expect(bg.age).toBeGreaterThanOrEqual(35); expect(bg.age).toBeLessThanOrEqual(42); }
    const s = newGame({ name: 'テスト', background: 'mage', seed: 4 });
    s.instructor.age = 56; expect(retireCheck(s).can).toBe(false);
    s.instructor.age = 57; expect(retireCheck(s).can).toBe(true);
    expect(B.long.autoRetireAge).toBe(57);
  });
  it('敵に回る教え子：国ごとの上限6人・卒業後8年まで', () => {
    expect(B.long.turnMax).toBe(6);
    expect(B.long.turnYears).toBe(8);
  });
  it('おまかせは、この年に深い傷を負った子・宿敵よりずっと弱い子を宿敵戦に出さない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 7 });
    const kids = enrolled(s);
    const q = { ...s.quests[0], nemesisId: 'nx' } as typeof s.quests[0];
    const hurt = kids[0];
    (hurt.scars ??= []).push({ year: s.year, text: '左の肩の傷' });
    expect(fragileFor(s, q, hurt)).toBe(true);
    if (kids.filter((k) => k !== hurt).length >= B.sortie.members) expect(recommendDeploy(s, q, B.sortie.members, true)).not.toContain(hurt.id);
    expect(fragileFor(s, { ...q, nemesisId: undefined } as typeof q, hurt)).toBe(false);
  });
});

describe('21夜目④：はじめの上級生の期', () => {
  it('期が0以下の子は「はじめの上級生」と出る（-1期生と出ない）', () => {
    expect(cohortName(1)).toBe('1期生');
    expect(cohortName(0)).toBe('はじめの上級生');
    expect(cohortName(-1)).toBe('はじめの上級生');
    expect(cohortName(3, true)).toBe('3期');
  });
});
