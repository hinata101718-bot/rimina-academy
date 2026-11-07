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
