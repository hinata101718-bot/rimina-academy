import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { deserialize, serialize } from '../src/core/save';
import { CLASSES, CLASS_LIST, TRAITS_C, newClassId } from '../src/data/classes';
import { DEEDS } from '../src/data/deeds';
import { SAVE_VERSION, TEACHER_RANK } from '../src/data/balance';
import type { TBattle, TUnit } from '../src/core/tactics/types';
import { attack, endTurn, calc, intents, unit, reach } from '../src/core/tactics/engine';
import { applyClass, startTraits } from '../src/core/tactics/setup';
import { teacherRank, teacherWonNemesis } from '../src/core/instructor';
import { simulateAlumni } from '../src/core/alumni';
import { Rng } from '../src/core/rng';

function base(): TUnit {
  return { uid: 'x', side: 'me', name: 'x', classId: 'swordsman', x: 0, y: 0, hp: 30, max: 30, str: 10, mag: 4, skl: 4, spd: 6, def: 4, mov: 3, rmin: 1, rmax: 1, type: 'slash', magic: false, might: 5, techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0 };
}
function mini(extra: TUnit[] = []): TBattle {
  const a: TUnit = { ...base(), uid: 'a', x: 2, y: 5 };
  const t: TUnit = { ...base(), uid: 'teacher', teacher: true, x: 2, y: 7, name: '先生' };
  const f: TUnit = { ...base(), uid: 'boss', side: 'foe', name: '敵将', x: 2, y: 3, hp: 60, max: 60, str: 8, def: 3, spd: 4, sh: 2, shMax: 2, weak: ['slash', 'fire'], known: ['slash'], boss: true };
  const b: TBattle = { v: 19, questId: 'q', title: 't', field: 'plain', w: 6, h: 8, forest: [], rock: [], units: [a, t, f, ...extra], turn: 1, phase: 'player', result: null, objective: 'boss', teacherUid: 'teacher', command: 1, insight: 2, undo: null, log: [], scenes: [], fx: [], said: [], foes0: 1, real: true };
  intents(b);
  return b;
}
const withClass = (u: TUnit, cid: string) => { applyClass(u, cid); u.classId = cid; return u; };

describe('20夜目①：兵種の木（docs/new/classes.md の確定）', () => {
  it('86の兵種：初級8・中級24・上級26・最上級26・隠れた2', () => {
    const n = (t: number, h = false) => CLASS_LIST.filter((c) => c.tier === t && !!c.hidden === h).length;
    expect(CLASS_LIST.length).toBe(86);
    expect([n(1), n(2), n(3), n(4)]).toEqual([8, 24, 26, 26]);
    expect(CLASS_LIST.filter((c) => c.hidden).map((c) => c.name).sort()).toEqual(['呪いの子', '隻眼の射手'].sort());
  });
  it('枝分かれ：上級ごとに最上級が1つ。最上級には、なる条件の出来事がある', () => {
    for (const u of CLASS_LIST.filter((c) => c.tier === 3)) {
      const tops = CLASS_LIST.filter((c) => c.prereq.includes(u.id));
      expect(tops.length).toBe(1);
      expect(tops[0].tier).toBe(4);
      expect(tops[0].unlock).toBeTruthy();
      expect(DEEDS[tops[0].deed!]).toBeTruthy();
    }
    for (const c of CLASS_LIST) for (const p of c.prereq) expect(CLASSES[p].tier).toBe(c.tier - 1);
    expect(CLASSES.hexer && CLASS_LIST.filter((c) => c.prereq.includes('hexer')).map((c) => c.name).sort()).toEqual(['呪詛師', '死霊術士'].sort());
    expect(CLASS_LIST.filter((c) => c.prereq.includes('knight')).map((c) => c.name).sort()).toEqual(['グレートナイト', 'パラディン'].sort());
  });
  it('名前が確定のものになっている（19夜目の仮の名前はない）', () => {
    const names = new Set(CLASS_LIST.map((c) => c.name));
    for (const n of ['冥府の主', '禁呪の番人', '光の王', '道化王', 'グレートパラディン', 'マスターナイト', 'ボウマスター', '賢者', '呪王', '聖者', '影の王', '天眼', '竜王']) expect(names.has(n)).toBe(true);
    for (const n of ['冥王', '封神', '聖王騎', '幻影', '覇騎', '鉄騎王', '弓騎王', '仇討ち', '死に損ない', '語り部']) expect(names.has(n)).toBe(false);
  });
  it('特技はすべて説明がある。下の段階の特技は上がっても残る', () => {
    for (const c of CLASS_LIST) {
      for (const t of c.traits) expect(TRAITS_C[t], `${c.name}:${t}`).toBeTruthy();
      for (const p of c.prereq) for (const t of CLASSES[p].traits) expect(c.traits, `${c.name}は${CLASSES[p].name}の${t}を持つ`).toContain(t);
    }
  });
  it('古い兵種の id は、いちばん近い兵種に変わる', () => {
    expect(newClassId('deathlord')).toBe('netherlord');
    expect(newClassId('overlord')).toBe('greatpaladin');
    expect(newClassId('avenger')).toBe('mercenary');
    expect(newClassId('storyteller')).toBe('bishop');
    expect(newClassId('kenshin')).toBe('kenshin');
  });
});

describe('20夜目①：19夜目版のセーブを読み込める', () => {
  it('仮の最上級・はずした隠れた兵種の子が、近い兵種に変わり、1年遊べる', () => {
    const s = deserialize(readFileSync(new URL('./fixtures/v19-classes.json', import.meta.url), 'utf8'));
    expect(s.version).toBe(SAVE_VERSION);
    for (const st of Object.values(s.students)) expect(CLASSES[st.classId], st.classId).toBeTruthy();
    for (const o of s.officers ?? []) expect(CLASSES[o.classId], o.classId).toBeTruthy();
    const names = Object.values(s.students).map((x) => x.classId);
    expect(names).toContain('netherlord');
    expect(names).toContain('mercenary');
    expect(names).not.toContain('avenger');
    autoYears(s, 1);
    expect(deserialize(serialize(s)).year).toBe(s.year);
  });
});

describe('20夜目①：特技の効き目（戦いの中で）', () => {
  it('背討ち：敵の背中側（狙っている相手と反対側）からなら傷が2倍', () => {
    const b = mini();
    const a = withClass(unit(b, 'a')!, 'assassin');
    const f = unit(b, 'boss')!; f.weak = []; f.known = [];
    f.aim = { t: 'teacher', dmg: 1, lethal: false }; // 敵は先生（南）を狙っている
    a.x = 2; a.y = 4; // 正面（先生・教え子の側）
    const front = calc(b, a, f, null).per;
    a.x = 2; a.y = 2; // 背中側
    expect(calc(b, a, f, null).per).toBe(front * 2);
  });
  it('見切り：一度だけ、敵の攻撃をかわして斬り返す', () => {
    const b = mini();
    const a = withClass(unit(b, 'a')!, 'swordmaster');
    a.y = 4; intents(b);
    const hp = a.hp;
    const bossHp = unit(b, 'boss')!.hp;
    endTurn(b);
    expect(a.hp).toBe(hp);
    expect(unit(b, 'boss')!.hp).toBeLessThan(bossHp);
    expect(a.mikiriUsed).toBe(true);
  });
  it('戦神：体力0でも倒れず、次の自分の番の終わりまで戦う（命の危険でも戦死しない）', () => {
    const b = mini();
    const a = withClass(unit(b, 'a')!, 'senjin');
    a.y = 4; a.hp = 2; b.nemesisId = 'o1'; unit(b, 'boss')!.nemesis = true; intents(b);
    endTurn(b);
    expect(a.alive).toBe(true);
    expect(a.hp).toBe(1);
    endTurn(b);
    expect(a.alive).toBe(false);
    expect(a.down).toBe('injured');
  });
  it('結界：はじめに光の壁を立てる。敵は壁を通れない', () => {
    const b = mini();
    const a = withClass(unit(b, 'a')!, 'warder');
    startTraits(b);
    expect(b.walls).toContain(`${a.x}-${a.y - 1}`);
    const f = unit(b, 'boss')!;
    expect(`${a.x}-${a.y - 1}` in reach(b, f)).toBe(false);
  });
  it('狩りの王がいると、追いつめられた宿敵が逃げない（ふつうは退く）', () => {
    const run = (cid: string) => {
      const b = mini();
      const a = withClass(unit(b, 'a')!, cid);
      a.x = 2; a.y = 4;
      const f = unit(b, 'boss')!; f.officerId = 'o1'; f.hp = 20; f.sh = 9; f.weak = []; f.known = [];
      attack(b, 'a', 'boss', null);
      return f;
    };
    expect(run('swordsman').down).toBe('fled');
    const f = run('huntking');
    expect(f.down).not.toBe('fled');
  });
  it('死霊術士：倒れた敵兵を一度だけ起こし、味方として動かす', () => {
    const g: TUnit = { ...base(), uid: 'e1', side: 'foe', name: '剣兵', x: 2, y: 4, hp: 3, max: 20 };
    const b = mini([g]);
    const a = withClass(unit(b, 'a')!, 'necromancer'); a.mag = 20;
    attack(b, 'a', 'e1', 'basic:dark');
    const e = unit(b, 'e1')!;
    expect(e.alive).toBe(true);
    expect(e.side).toBe('me');
    expect(e.raised).toBe(true);
  });
  it('理の重ね：大魔道の魔法は2つの種類を同時に当てる（2つの弱点で盾を2つ）', () => {
    const b = mini();
    const a = withClass(unit(b, 'a')!, 'archmage');
    const f = unit(b, 'boss')!; f.weak = ['fire', 'ice']; f.known = ['fire', 'ice']; f.sh = 3;
    const c = calc(b, a, f, 'basic:fire');
    expect(c.perHit).toBe(2);
  });
  it('槍衾：隣に来た敵を、敵の番に先に突く', () => {
    const b = mini();
    const a = withClass(unit(b, 'a')!, 'ironlancer');
    a.y = 5; const f = unit(b, 'boss')!; f.y = 2; f.sh = 9; intents(b);
    const hp = f.hp;
    endTurn(b);
    expect(f.hp).toBeLessThan(hp);
    expect(b.log.some((l) => l.text.includes('槍衾'))).toBe(true);
  });
});

describe('20夜目①：最上級は、なる条件の出来事を成し遂げた卒業生だけ', () => {
  it('条件の出来事がないとなれない。成し遂げるとなり、年鑑と新聞に載る', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 5 });
    const st = Object.values(s.students)[0];
    st.status = 'graduated'; st.grade = 0; st.level = 50; st.classId = 'swordmaster';
    st.career = { kind: 'stay', country: null, path: 'warrior', rank: 0, rankYears: 0, growthMul: 0, front: false, alive: true, retired: false, injuredYears: 0 };
    simulateAlumni(s, new Rng({ rng: 3 }));
    expect(st.classId).toBe('swordmaster');
    st.deeds = { unhurt: 10 };
    const news = simulateAlumni(s, new Rng({ rng: 3 }));
    expect(st.classId).toBe('kenshin');
    expect(news.some((n) => n.text.includes('剣神') && n.text.includes('10の戦で傷を負わない'))).toBe(true);
    expect(s.chronicle.some((c) => c.text.includes('剣神'))).toBe(true);
  });
});

describe('20夜目②：先生の兵種（教官 → 指揮官 → 軍師 → 名将）', () => {
  it('年数と、勝った宿敵戦の数で上がる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 5 });
    expect(teacherRank(s)).toBe(0);
    s.instructor.since = s.year - 5;
    expect(teacherRank(s)).toBe(0);
    teacherWonNemesis(s);
    expect(teacherRank(s)).toBe(1);
    s.instructor.since = s.year - 30; s.instructor.nemWins = 10;
    expect(teacherRank(s)).toBe(3);
    expect(TEACHER_RANK.command[3]).toBeGreaterThan(TEACHER_RANK.command[0]);
  });
});

import { makeAlly, allies, maybeOath, sendSpy, spyReady, spyChance } from '../src/core/bonds';
import { officers, ensureRivalry } from '../src/core/officers';
import { memoryOf } from '../src/core/nemesis';
import { endingReady } from '../src/core/ending';
import { B } from '../src/data/balance';

function withNemesis() {
  const s = newGame({ name: 'テスト', background: 'knight', seed: 9, opening: false });
  autoYears(s, 1);
  const o = officers(s).find((x) => x.status === 'active' && x.kind !== 'monster' && !x.alumniId)!;
  const st = Object.values(s.students).find((x) => x.status === 'enrolled')!;
  const rv = ensureRivalry(s, st.id, o.id); rv.stage = 2; rv.battles = 3;
  return { s, o, st, rv };
}

describe('20夜目④：宿敵が味方になる・好敵手・密偵', () => {
  it('恩のある宿敵が味方になる。場面が出て、援軍として戦場に来られる', () => {
    const { s, o, st } = withNemesis();
    memoryOf(o).debts.push({ id: st.id, text: '止めを刺さなかった', year: s.year });
    makeAlly(s, o, 'debt');
    expect(o.allied?.why).toBe('debt');
    expect(o.status).toBe('retired');
    expect(allies(s).map((x) => x.id)).toContain(o.id);
    expect(s.pending.some((p) => p.type === 'nemesis' && p.kind === 'ally')).toBe(true);
    expect(s.rivalries![`${st.id}|${o.id}`].settled).toBe('ally');
  });
  it('好敵手：たがいに名を呼び合い、決着を約束する（ひとりの宿敵に1人だけ）', () => {
    const { s, o, st, rv } = withNemesis();
    o.heart = 'steady';
    let t: string | null = null;
    for (let i = 0; i < 40 && !t; i++) t = maybeOath(s, o, st.id, new Rng({ rng: i + 1 }));
    expect(t).toBeTruthy();
    expect(rv.oath).toBeTruthy();
    expect(o.grudge).toBe(st.id);
    expect(s.pending.some((p) => p.type === 'nemesis' && p.kind === 'rival' && p.text.some((x) => x.includes(st.given)))).toBe(true);
  });
  it('密偵：月に1回。弱点・性格・次の動きが分かるか、見つかると捕らわれる', () => {
    const { s, o, st } = withNemesis();
    st.injuredWeeks = 0; st.sickWeeks = 0;
    expect(spyReady(s)).toBe(true);
    expect(spyChance(s, st, o)).toBeGreaterThan(0);
    const r = sendSpy(s, st.id, o.id, new Rng({ rng: 4 }));
    expect(spyReady(s)).toBe(false);
    expect(r.lines.length).toBeGreaterThan(0);
    if (r.ok) expect(r.lines.some((x) => x.startsWith('次の動き'))).toBe(true);
    if (r.caught) expect(s.spyCaptive?.sid).toBe(st.id);
    expect(s.pending.some((p) => p.type === 'nemesis' && p.kind === 'spy')).toBe(true);
    // 2回目は同じ月には送れない
    expect(sendSpy(s, st.id, o.id, new Rng({ rng: 5 })).ok).toBe(false);
  });
});

describe('20夜目③：数字の調整', () => {
  it('最初の戦争は21年目より前には終わらない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 3 });
    s.world.peaceRoundYear = 5; s.year = 20;
    expect(endingReady(s, 'year')).toBeNull();
    s.year = 21;
    expect(endingReady(s, 'year')?.kind).toBe('peace');
    expect(B.ending.minYear).toBe(21);
  });
});
