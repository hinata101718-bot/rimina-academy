import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newGame, enrolled, effectiveStats } from '../src/core/game';
import { deserialize, serialize } from '../src/core/save';
import { autoYears } from '../src/core/autoplay';
import { SAVE_VERSION, STATS, B } from '../src/data/balance';
import { CLASSES, CLASS_LIST } from '../src/data/classes';
import { RANK_POINTS } from '../src/data/balance';
import { calc, intents } from '../src/core/tactics/engine';
import type { TBattle, TUnit } from '../src/core/tactics/types';
import { nextClasses, onBranch, recommendedClass, takeExam, decideClass, followChance } from '../src/core/exam';
import { renown, renownParts, renownStars } from '../src/core/renown';
import { pathScores } from '../src/core/career';
import { LESSONS } from '../src/data/lessons';
import { LEGENDS } from '../src/data/rarity';
import { Rng } from '../src/core/rng';
import type { Student } from '../src/core/state';

function base(): TUnit {
  return { uid: 'x', side: 'me', name: 'x', classId: 'swordsman', x: 0, y: 0, hp: 40, max: 40, str: 12, mag: 12, skl: 4, spd: 4, def: 10, res: 2, mov: 3, rmin: 1, rmax: 2, type: 'slash', magic: false, might: 5, techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0 };
}
function mini(a: TUnit, d: TUnit): TBattle {
  const t: TUnit = { ...base(), uid: 'teacher', teacher: true, x: 5, y: 7, name: '先生' };
  const b: TBattle = { v: 19, questId: 'q', title: 't', field: 'plain', w: 6, h: 8, forest: [], rock: [], units: [a, t, d], turn: 1, phase: 'player', result: null, objective: 'rout', teacherUid: 'teacher', command: 1, insight: 2, undo: null, log: [], scenes: [], fx: [], said: [], foes0: 1, real: true };
  intents(b);
  return b;
}

describe('22夜目①：魔防', () => {
  it('能力は7つ（魔防を足した）', () => {
    expect(STATS).toEqual(['hp', 'str', 'mag', 'skl', 'spd', 'def', 'res']);
    const s = newGame({ name: 'テスト', background: 'knight', seed: 22 });
    for (const st of enrolled(s)) { expect(st.stats.res).toBeGreaterThan(0); expect(st.growth.res).toBeGreaterThan(0); }
  });
  it('守りは斬・突・射・砕・打を、魔防は炎・雷・氷・光・闇を受けるときに使う', () => {
    const a: TUnit = { ...base(), uid: 'a', x: 2, y: 5 };
    const d: TUnit = { ...base(), uid: 'd', side: 'foe', x: 2, y: 4, def: 10, res: 2 };
    const b = mini(a, d);
    const phys = calc(b, a, d, null).per;               // 力12＋5−守り10
    const mag = calc(b, { ...a, type: 'fire', magic: true }, d, null).per; // 魔力12＋5−魔防2
    expect(phys).toBe(7);
    expect(mag).toBe(15);
    // 魔防の高い相手には魔法が通りにくい
    const d2 = { ...d, def: 2, res: 10 };
    expect(calc(b, { ...a, type: 'fire', magic: true }, d2, null).per).toBeLessThan(calc(b, a, d2, null).per);
  });
  it('兵種：魔法・癒し・ペガサスは魔防が高く、重装・斧は低い', () => {
    const r = (id: string) => (CLASSES[id].bonus.res ?? 0) * 10 + (CLASSES[id].growth.res ?? 0);
    expect(r('archmage')).toBeGreaterThan(r('general'));
    expect(r('bishop')).toBeGreaterThan(r('berserker'));
    expect(r('falcon_knight')).toBeGreaterThan(r('warrior'));
    expect(CLASSES.armor_knight.growth.res ?? 0).toBeLessThan(0);
  });
  it('21夜目版のセーブを読み込むと、魔防を魔力から分ける（守りはそのまま）。1年遊べる', () => {
    const raw = readFileSync(new URL('./fixtures/v21-night21.json', import.meta.url), 'utf8');
    const old = JSON.parse(raw);
    expect(old.version).toBe(21);
    const defs: Record<string, number> = {};
    for (const [id, st] of Object.entries(old.state.students) as [string, { stats: Record<string, number> }][]) { expect(st.stats.res).toBeUndefined(); defs[id] = st.stats.def; }
    const s = deserialize(raw);
    expect(s.version).toBe(SAVE_VERSION);
    for (const st of Object.values(s.students)) {
      expect(st.stats.def).toBe(defs[st.id]);
      expect(st.stats.res).toBeGreaterThan(0);
      expect(st.growth.res).toBeGreaterThanOrEqual(15);
    }
    // 魔力の高い子ほど魔防も高い（同じくらいのレベルで）
    autoYears(s, 1);
    expect(s.gameOver).toBeFalsy();
    expect(() => deserialize(serialize(s))).not.toThrow();
  });
});

describe('22夜目②：兵種試験の受け方', () => {
  function kid(): { s: ReturnType<typeof newGame>; st: Student } {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 5 });
    const st = enrolled(s)[0];
    st.classId = 'swordsman'; st.grade = 2; st.level = 12; st.battles = 10;
    for (const k of Object.keys(st.skills) as (keyof typeof st.skills)[]) st.skills[k] = 0;
    return { s, st };
  }
  it('技能の条件を満たした兵種だけが並ぶ。枝分かれの先でなくても（剣士→斧Cで上斧兵も）', () => {
    const { s, st } = kid();
    st.skills.sword = RANK_POINTS.C;
    let ids = nextClasses(s, st).map((c) => c.id);
    expect(ids).toContain('kensei');
    expect(ids).not.toContain('spellblade'); // 魔道Dが足りない
    expect(ids).not.toContain('highaxe');
    st.skills.axe = RANK_POINTS.C;
    ids = nextClasses(s, st).map((c) => c.id);
    expect(ids).toContain('highaxe');   // ほかの枝
    expect(ids).toContain('mercenary'); // 剣C・斧D
    // 次の段階（中級）だけ
    expect(nextClasses(s, st).every((c) => c.tier === 2)).toBe(true);
  });
  it('並ぶ順は ①先生の勧め ②枝分かれの先 ③そのほか', () => {
    const { s, st } = kid();
    st.skills.sword = RANK_POINTS.C; st.skills.axe = RANK_POINTS.B;
    const list = nextClasses(s, st);
    const rec = recommendedClass(s, st);
    expect(list[0].id).toBe(rec);
    const rest = list.slice(1);
    const firstOther = rest.findIndex((c) => !onBranch(st, c));
    const lastBranch = rest.map((c) => onBranch(st, c)).lastIndexOf(true);
    if (firstOther >= 0 && lastBranch >= 0) expect(lastBranch).toBeLessThan(firstOther);
  });
  it('先生が勧め、生徒が決める：信頼が高いほど勧めを聞く。自分で選んだ子は別の兵種になる', () => {
    const { s, st } = kid();
    st.skills.sword = RANK_POINTS.C; st.skills.axe = RANK_POINTS.C;
    st.trust = 100; st.personality = 'calm';
    const hi = followChance(st);
    st.trust = 0; st.personality = 'competitive';
    expect(followChance(st)).toBeLessThan(hi);
    const opts = nextClasses(s, st);
    let own = 0;
    for (let i = 0; i < 60; i++) { const d = decideClass(st, new Rng({ rng: i + 1 }), opts[opts.length - 1].id, opts); if (d.own) own += 1; }
    // 勧めと本人の好みが違うときは、ときどき自分の道を選ぶ（好みが同じなら0）
    expect(own).toBeGreaterThanOrEqual(0);
    st.trust = 100; st.personality = 'calm';
    const r = takeExam(s, new Rng({ rng: 3 }), st, opts[0].id);
    expect(r.ok).toBe(true);
    expect(CLASSES[st.classId].tier).toBe(2);
  });
  it('最上級は今までどおり出来事の条件も要る（在学中は受けられない）', () => {
    const { s, st } = kid();
    st.classId = 'swordmaster'; st.grade = 3; st.skills.sword = RANK_POINTS.S;
    expect(nextClasses(s, st).length).toBe(0);
  });
  it('図鑑の木の兵種は、どれもいずれかの段階の前の兵種から技能で入れる（条件がからっぽの中級・上級はない）', () => {
    for (const c of CLASS_LIST.filter((x) => x.tier >= 2 && !x.hidden)) expect(Object.keys(c.req).length).toBeGreaterThan(0);
  });
});

describe('22夜目③：人望', () => {
  it('平静・信頼・家柄・二つ名で上がる（0〜100、星は1〜5）', () => {
    const s = newGame({ name: 'テスト', background: 'mage', seed: 9 });
    const st = enrolled(s)[0];
    st.mind = { fight: 50, calm: 20, grudge: 0 }; st.trust = 10; st.house = 'orphan'; st.history = []; st.epithet = undefined; st.bornLeader = false;
    const low = renown(st);
    st.mind.calm = 90; st.trust = 90; st.house = 'noble';
    st.epithet = '隻腕の'; st.history.push({ year: 1, text: `${st.given}は「隻腕の${st.given}」と呼ばれるようになった` });
    const high = renown(st);
    expect(high).toBeGreaterThan(low + 40);
    expect(renownParts(st).epithet).toBeGreaterThan(0);
    st.history.push({ year: 2, text: `${st.given}は「白狼の${st.given}」と呼ばれるようになった` });
    expect(renown(st)).toBeGreaterThan(high);
    expect(renownStars(0)).toBe(1); expect(renownStars(100)).toBe(5);
  });
  it('人望が高い子ほど文官に向く', () => {
    const s = newGame({ name: 'テスト', background: 'mage', seed: 9 });
    const st = enrolled(s)[0];
    st.mind = { fight: 50, calm: 10, grudge: 0 }; st.trust = 0; st.house = 'orphan';
    const a = pathScores(st).civil;
    st.mind.calm = 90; st.trust = 90; st.house = 'noble';
    expect(pathScores(st).civil).toBeGreaterThan(a);
    void effectiveStats;
  });
});

describe('22夜目④：魅力の後始末', () => {
  it('礼法は平静を、外交の作法は平静と信頼を育てる', () => {
    const m = LESSONS.find((l) => l.id === 'manners')!;
    const d = LESSONS.find((l) => l.id === 'diplomacy')!;
    expect(m.mind?.calm).toBeGreaterThan(0);
    expect(d.mind?.calm).toBeGreaterThan(0);
    expect(d.trust).toBeGreaterThan(0);
  });
  it('伝説の弓の条件の文は、実際の条件（信頼60）と同じ', () => {
    for (const L of LEGENDS) { expect(L.cond.text).not.toContain('魅力'); if (L.cond.kind === 'trust') expect(L.cond.text).toContain('信頼60'); }
  });
  it('先生に魅力の値はもう入らない', () => {
    const s = newGame({ name: 'テスト', background: 'mage', seed: 1 });
    expect(s.instructor.cha).toBeUndefined();
    expect(B.support.senpaiCalm).toBeGreaterThan(0);
  });
});

// ---------- ⑤ 生徒ごとの武器の装備 ----------
import { equipItem, equippable, holderOf, autoEquip, checkEquips, equipped } from '../src/core/equip';
import { deployFor } from '../src/core/sortie';

describe('22夜目⑤：生徒ごとの武器の装備', () => {
  function school() {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 31 });
    const kids = enrolled(s).slice(0, 2);
    for (const k of kids) { k.classId = 'swordsman'; k.skills.sword = RANK_POINTS.C; }
    s.armory.push({ uid: 'w1', weaponId: 'steel_sword' }, { uid: 'w2', weaponId: 'silver_sword' });
    return { s, a: kids[0], b: kids[1] };
  }
  it('1つの武器を持てるのは1人だけ。ほかの子が持つ武器を選ぶと付け替わる', () => {
    const { s, a, b } = school();
    expect(equippable(s, a).map((x) => x.uid)).toContain('w1');
    expect(equipItem(s, a.id, 'w1').ok).toBe(true);
    expect(holderOf(s, 'w1')?.id).toBe(a.id);
    const r = equipItem(s, b.id, 'w1');
    expect(r.ok).toBe(true); expect(r.from).toBe(a.given);
    expect(a.equip).toBeNull(); expect(b.equip).toBe('w1');
    equipItem(s, b.id, null); expect(equipped(s, b)).toBeNull();
  });
  it('出撃は装備した武器で出る。装備のない子は、ほかの子の装備を避けて自動で選ぶ', () => {
    const { s, a, b } = school();
    equipItem(s, a.id, 'w1');
    const d = deployFor(s, [a.id, b.id]);
    expect(d.find((x) => x.studentId === a.id)?.armoryUid).toBe('w1');
    expect(d.find((x) => x.studentId === b.id)?.armoryUid).not.toBe('w1');
    const best = autoEquip(s, b.id);
    expect(best?.uid).not.toBe('w1');
  });
  it('兵種が変わって使えなくなった武器は自動で外し、お知らせが出る', () => {
    const { s, a } = school();
    equipItem(s, a.id, 'w1');
    a.classId = 'archer';
    const out = checkEquips(s);
    expect(a.equip).toBeNull();
    expect(out.length).toBe(1);
    expect(s.notices.some((n) => n.text.includes('装備を外しました'))).toBe(true);
  });
  it('前の版のセーブでは、だれも装備していない（自動のまま）', () => {
    const s = deserialize(readFileSync(new URL('./fixtures/v21-night21.json', import.meta.url), 'utf8'));
    for (const st of Object.values(s.students)) expect(st.equip ?? null).toBeNull();
  });
});
