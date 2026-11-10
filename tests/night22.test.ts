import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newGame, effectiveStats } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION, STATS, B } from '../src/data/balance';
import { CLASSES, CLASS_LIST } from '../src/data/classes';
import type { TBattle, TUnit } from '../src/core/tactics/types';
import { calc, intents } from '../src/core/tactics/engine';
import { nextClasses, recommendClass, takeExam, onPath, meetsSkillReq, followChance } from '../src/core/exam';
import { renown, renownStars, epithetCount } from '../src/core/renown';
import { equipWeapon, holderOf, equipOptions, checkEquip, autoEquip } from '../src/core/equip';
import { deployFor } from '../src/core/sortie';
import { opensWith, recommendTargets, topSkillsOf, topGrowthOf } from '../src/core/targets';
import { LESSON_BY_ID } from '../src/data/lessons';
import { LEGENDS } from '../src/data/rarity';
import { Rng } from '../src/core/rng';
import type { Student } from '../src/core/state';

function base(): TUnit {
  return { uid: 'x', side: 'me', name: 'x', classId: 'swordsman', x: 0, y: 0, hp: 30, max: 30, str: 10, mag: 10, skl: 4, spd: 6, def: 8, res: 2, mov: 3, rmin: 1, rmax: 1, type: 'slash', magic: false, might: 5, techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0 };
}
function mini(extra: TUnit[]): TBattle {
  const b: TBattle = { v: 19, questId: 'q', title: 't', field: 'plain', w: 6, h: 8, forest: [], rock: [], units: extra, turn: 1, phase: 'player', result: null, objective: 'rout', teacherUid: 'teacher', command: 1, insight: 2, undo: null, log: [], scenes: [], fx: [], said: [], foes0: 1, real: true };
  intents(b);
  return b;
}

describe('22夜目①：魔防', () => {
  it('能力は7つ。新しい生徒にも魔防がある', () => {
    expect(STATS).toEqual(['hp', 'str', 'mag', 'skl', 'spd', 'def', 'res']);
    const s = newGame({ name: 'テスト', background: 'knight', seed: 3 });
    for (const st of Object.values(s.students)) { expect(st.stats.res).toBeGreaterThanOrEqual(1); expect(st.growth.res).toBeGreaterThan(0); }
  });
  it('魔法・癒し・ペガサスの兵種は魔防が高く、重装・斧は低い', () => {
    expect(CLASSES.mage.bonus.res ?? 0).toBeGreaterThan(0);
    expect(CLASSES.bishop.bonus.res ?? 0).toBeGreaterThan(CLASSES.general.bonus.res ?? 0);
    expect(CLASSES.falcon_knight.growth.res ?? 0).toBeGreaterThan(0);
    expect(CLASSES.fighter.bonus.res ?? 0).toBeLessThan(0);
    expect(CLASSES.armor_knight.growth.res ?? 0).toBeLessThan(0);
  });
  it('魔法は魔防で、斬・突などは守りで受ける', () => {
    const a: TUnit = { ...base(), uid: 'a', side: 'foe', x: 2, y: 2, type: 'fire', magic: true };
    const p: TUnit = { ...base(), uid: 'p', side: 'foe', x: 2, y: 4, type: 'slash', magic: false };
    const hiRes: TUnit = { ...base(), uid: 'h', x: 2, y: 3, res: 9, def: 2 };
    const b = mini([a, p, hiRes]);
    const m = calc(b, a, hiRes, null);
    const ph = calc(b, p, hiRes, null);
    expect(m.per).toBe(Math.max(1, 10 + 5 - 9));
    expect(ph.per).toBe(Math.max(1, 10 + 5 - 2));
  });
  it('21夜目版のセーブを読み込むと、魔防が魔力と兵種から分けられ、守りはそのまま。1年遊べる', () => {
    const raw = JSON.parse(readFileSync(new URL('./fixtures/v21-save.json', import.meta.url), 'utf8'));
    const before = Object.fromEntries(Object.values(raw.state.students as Record<string, Student>).map((x) => [x.id, x.stats.def]));
    const s = deserialize(JSON.stringify(raw));
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(22);
    expect(s.instructor.cha).toBeUndefined();
    for (const st of Object.values(s.students)) {
      expect(st.stats.res).toBeGreaterThanOrEqual(1);
      expect(st.growth.res).toBeGreaterThanOrEqual(15);
      expect(st.stats.def).toBe(before[st.id]);
    }
    // 魔法の兵種の子は、重装・斧の子より（魔力が同じなら）魔防が高め
    const mages = Object.values(s.students).filter((x) => ['magic', 'heal'].includes(CLASSES[x.classId]?.line ?? ''));
    for (const st of mages) expect(st.stats.res).toBeGreaterThanOrEqual(Math.round(st.stats.mag * 0.45));
    autoYears(s, 1);
    expect(deserialize(serialize(s)).year).toBe(s.year);
  });
});

describe('22夜目②：兵種試験は技能の条件で開く', () => {
  it('枝分かれの先でなくても、技能の条件を満たす次の段階の兵種は受けられる。満たさないものは並ばない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 7 });
    const st = Object.values(s.students).find((x) => x.status === 'enrolled')!;
    st.classId = 'swordsman';
    st.grade = 2; st.level = 12; st.battles = 6;
    for (const k of Object.keys(st.skills) as (keyof typeof st.skills)[]) st.skills[k] = 0;
    st.skills.sword = 200; st.skills.lance = 200; // 剣C・槍C
    const opts = nextClasses(s, st).map((c) => c.id);
    expect(opts).toContain('kensei');       // おすすめの道
    expect(opts).toContain('highlancer');   // ほかの枝（槍C）
    expect(opts).not.toContain('pegasus_rider'); // 飛行Dがない
    expect(opts).not.toContain('swordmaster');   // 次の段階だけ
    for (const id of opts) expect(meetsSkillReq(st, CLASSES[id])).toBe(true);
    // 先生の勧めが先頭、次におすすめの道
    const rec = recommendClass(s, st)!;
    expect(opts[0]).toBe(rec.id);
    expect(onPath(st, rec)).toBe(true);
    // ほかの枝の兵種にも受かる（先生の勧めとして受ける。強く決めて受けさせる）
    const r = takeExam(s, new Rng({ rng: 1 }), st, 'highlancer', { force: true });
    expect(r.ok).toBe(true);
    expect(st.classId).toBe('highlancer');
  });
  it('信頼が高いほど、先生の勧めを聞きやすい', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 7 });
    const st = Object.values(s.students)[0];
    st.trust = 90; const hi = followChance(st, CLASSES.kensei, CLASSES.highlancer);
    st.trust = 0; const lo = followChance(st, CLASSES.kensei, CLASSES.highlancer);
    expect(hi).toBeGreaterThan(lo);
    expect(lo).toBeGreaterThanOrEqual(B.exam.follow.min);
  });
  it('最上級は在学中には並ばない。隠れた兵種は出来事で開く', () => {
    expect(CLASS_LIST.filter((c) => c.tier === 4).every((c) => !!c.deed)).toBe(true);
    const s = newGame({ name: 'テスト', background: 'knight', seed: 7 });
    const st = Object.values(s.students)[0];
    st.classId = 'swordmaster'; st.skills.sword = 700;
    expect(nextClasses(s, st).some((c) => c.tier === 4)).toBe(false);
  });
});

describe('22夜目③④：人望と魅力の後始末', () => {
  it('人望は平静・信頼・家柄・二つ名で上がる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 9 });
    const st = Object.values(s.students)[0];
    st.mind = { fight: 50, calm: 30, grudge: 20 }; st.trust = 10; st.house = 'commoner'; st.epithet = undefined; st.history = [];
    const r0 = renown(st);
    st.mind.calm = 80; expect(renown(st)).toBeGreaterThan(r0);
    const r1 = renown(st); st.trust = 80; expect(renown(st)).toBeGreaterThan(r1);
    const r2 = renown(st); st.house = 'noble'; expect(renown(st)).toBeGreaterThan(r2);
    const r3 = renown(st); st.epithet = '盾の'; st.history.push({ year: 1, text: 'xは「盾のx」と呼ばれるようになった' }); expect(epithetCount(st)).toBe(1); expect(renown(st)).toBeGreaterThan(r3);
    expect(renownStars(renown(st))).toBeGreaterThanOrEqual(3);
  });
  it('礼法・外交の作法は平静の授業。伝説の弓の条件の文は実際の条件と同じ', () => {
    expect(LESSON_BY_ID.manners.calm).toBeGreaterThan(0);
    expect(LESSON_BY_ID.diplomacy.calm).toBeGreaterThan(0);
    expect(LESSON_BY_ID.diplomacy.trust).toBeGreaterThan(0);
    for (const L of LEGENDS) expect(L.cond.text).not.toContain('魅力');
    expect((B.enemy.growth as Record<string, number>).lck).toBeUndefined();
    expect((B.enemy.growth as Record<string, number>).cha).toBeUndefined();
  });
});

describe('22夜目⑤：生徒ごとの武器の装備', () => {
  const setup = () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 11 });
    const kids = Object.values(s.students).filter((x) => x.status === 'enrolled');
    for (const k of kids.slice(0, 2)) { k.classId = 'swordsman'; k.skills.sword = 300; }
    s.armory.push({ uid: 'w1', weaponId: 'steel_sword' }, { uid: 'w2', weaponId: 'silver_sword' }, { uid: 'w3', weaponId: 'steel_lance' });
    return { s, a: kids[0], b: kids[1] };
  };
  it('1つの武器を持てるのは1人だけ。選ぶと付け替わる', () => {
    const { s, a, b } = setup();
    expect(equipWeapon(s, a, 'w1').ok).toBe(true);
    expect(holderOf(s, 'w1')?.id).toBe(a.id);
    const r = equipWeapon(s, b, 'w1');
    expect(r.ok).toBe(true);
    expect(r.from).toBe(a.given);
    expect(a.equip).toBeUndefined();
    expect(b.equip).toBe('w1');
    // 兵種で使えない武器は装備できない
    expect(equipWeapon(s, a, 'w3').ok).toBe(false);
    expect(equipOptions(s, a).find((o) => o.a.uid === 'w1')?.holder?.id).toBe(b.id);
  });
  it('出撃は装備した武器で出る。装備のない子は、ほかの子の装備を避けて自動', () => {
    const { s, a, b } = setup();
    equipWeapon(s, a, 'w1');
    const d = deployFor(s, [a.id, b.id]);
    expect(d.find((x) => x.studentId === a.id)?.armoryUid).toBe('w1');
    expect(d.find((x) => x.studentId === b.id)?.armoryUid).not.toBe('w1');
    expect(autoEquip(s, b)).toBe('w2');
  });
  it('兵種が変わって使えなくなった武器は外し、お知らせ', () => {
    const { s, a } = setup();
    equipWeapon(s, a, 'w1');
    a.classId = 'lancer';
    expect(checkEquip(s, a)).toBe(true);
    expect(a.equip).toBeUndefined();
    expect(s.notices.some((n) => n.text.includes('外した'))).toBe(true);
  });
});

describe('22夜目⑥：目標技能の手がかり', () => {
  it('上位の技能・伸びやすい能力・開く兵種・先生のおすすめ', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 5 });
    const st = Object.values(s.students)[0];
    st.classId = 'lancer';
    for (const k of Object.keys(st.skills) as (keyof typeof st.skills)[]) st.skills[k] = 0;
    st.skills.lance = 120; st.skills.flying = 90; st.skills.command = 90;
    expect(topSkillsOf(s, st)[0]).toBe('lance');
    expect(topGrowthOf(st).length).toBe(2);
    const o = opensWith(s, st, 'lance');
    const names = o.flatMap((x) => x.names);
    expect(names).toEqual(expect.arrayContaining(['上槍兵', 'ペガサスナイト', '旗手']));
    const rec = recommendTargets(s, st);
    expect(rec[0]).not.toBe(rec[1]);
    void effectiveStats;
  });
});
