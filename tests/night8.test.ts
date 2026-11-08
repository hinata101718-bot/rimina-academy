// 8夜目：7夜目版のセーブ（形式7）・先生の経験ポイントと特殊能力・成長率5%きざみ・兵種図鑑・新聞（半年に一回・号外）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled, addRep } from '../src/core/game';
import { autoYears, autoPending, autoDay, finishAuto } from '../src/core/autoplay';
import { chooseLesson, rng, battleCtx, endMonth } from '../src/core/flow';
import { todayCards, resolveLesson, lessonCost } from '../src/core/lessons';
import { LESSON_BY_ID } from '../src/data/lessons';
import { B, SAVE_VERSION, STATS, RANK_POINTS } from '../src/data/balance';
import { Rng } from '../src/core/rng';
import { fx, lessonXp, learnAbility, abilityCost, abilityState, skillCost, trainSkill, inheritAbilities, mentorXp } from '../src/core/mentor';
import { MENTOR_ABILITIES, MENTOR_BY_ID } from '../src/data/mentor';
import { instructorCaps, externalSuccessor } from '../src/core/instructor';
import { growthRates, growthParts } from '../src/core/growth';
import { generateStudent } from '../src/core/student';
import { commandRate } from '../src/core/battle/engine';
import { startDropoutSign, interviewStudent } from '../src/core/week';
import { takeExam, nextClasses, meetsReq, classUnlocked } from '../src/core/exam';
import { publishIssue, extraEdition } from '../src/core/newspaper';
import { majorEvents } from '../src/core/world';
import type { GameState } from '../src/core/state';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const mk = (seed = 1, bg = 'knight') => newGame({ name: 'テスト', background: bg, seed });

describe('7夜目版のセーブ（形式7）', () => {
  it('日の途中：形式8になり、先生の技能はそのまま・ポイントは0から。成長率は5%きざみ。そのまま1年遊べる', () => {
    const raw = JSON.parse(fixture('v7-day.json'));
    const skills0 = { ...raw.state.instructor.skills };
    const s = deserialize(fixture('v7-day.json'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(8);
    expect(s.instructor.skills).toEqual(skills0);
    expect(s.instructor.xp).toBe(0);
    expect(s.instructor.abilities).toEqual([]);
    for (const st of Object.values(s.students)) for (const k of STATS) expect(st.growth[k] % 5).toBe(0);
    // 丸めは四捨五入（大きく変わらない）
    for (const st of Object.values(raw.state.students) as GameState['students'][string][]) for (const k of STATS) expect(Math.abs(s.students[st.id].growth[k] - st.growth[k])).toBeLessThanOrEqual(5);
    expect((s.classSeen ?? []).length).toBeGreaterThan(0);
    expect(s.newsDesk).toBeTruthy();
    expect(s.pending.some((p) => p.type === 'event' && p.title.includes('8夜目'))).toBe(true);
    // 今日のカードはそのまま
    expect(s.today?.key).toBe(raw.state.today.key);
    s.pending = [];
    const y = s.year;
    autoYears(s, 1);
    expect(s.year).toBe(y + 1);
    expect(s.gameOver).toBe(false);
    expect(s.instructor.xpTotal ?? 0).toBeGreaterThan(0);
    expect(deserialize(serialize(s)).version).toBe(SAVE_VERSION);
  });
  it('授業の結果の途中：結果を閉じて続けられる', () => {
    const s = deserialize(fixture('v7-result.json'));
    expect(s.pending.some((p) => p.type === 'lessonResult')).toBe(true);
    autoPending(s);
    for (let i = 0; i < 10; i++) { autoDay(s); autoPending(s); }
    expect(s.gameOver).toBe(false);
  });
  it('自動の戦闘の途中：判断を選んで最後まで', () => {
    const s = deserialize(fixture('v7-auto.json'));
    expect(s.battle?.auto).toBeTruthy();
    finishAuto(s);
    expect(s.battle).toBeNull();
    autoPending(s);
  });
});

describe('先生の経験ポイント', () => {
  it('授業のたびにたまる。顔の子・友情タッグ・伸びた子が多いほど多く、休講はなし', () => {
    expect(lessonXp({ faces: 3, tags: 1, grew: 2, social: false, rest: false })).toBeGreaterThan(lessonXp({ faces: 1, tags: 0, grew: 0, social: false, rest: false }));
    expect(lessonXp({ faces: 0, tags: 0, grew: 0, social: false, rest: true })).toBe(0);
    const s = mk(3);
    s.pending = [];
    const d = todayCards(s);
    const i = d.cards.findIndex((c) => c.id !== 'rest');
    const res = resolveLesson(s, new Rng(s), i);
    expect(res.xp).toBeGreaterThan(0);
    expect(mentorXp(s)).toBe(res.xp);
    // 教官の技能は授業では上がらない
    const before = { ...s.instructor.skills };
    for (let k = 0; k < 20; k++) { s.pending = []; chooseLesson(s, 0); }
    expect(s.instructor.skills).toEqual(before);
  });
  it('1年でおよそ特殊能力2〜3個分たまる（8夜目の長期シミュレーションで値段を調整）', () => {
    const s = mk(5);
    autoYears(s, 1);
    const total = s.instructor.xpTotal ?? 0;
    expect(total).toBeGreaterThan(B.mentor.cost.S * 2);
    expect(total).toBeLessThan(B.mentor.cost.L * 3);
    // おまかせで使うと、1年目に覚えるのは1〜4個
    const n = (s.instructor.abilities ?? []).length;
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(4);
  });
});

describe('先生の特殊能力', () => {
  it('20種あり、前提のあるものは前提を覚えてから。覚えるたびに次が高くなる', () => {
    expect(MENTOR_ABILITIES.length).toBe(20);
    for (const a of MENTOR_ABILITIES) if (a.pre) expect(MENTOR_BY_ID[a.pre]).toBeTruthy();
    const s = mk(1, 'mage');
    s.instructor.xp = 10000;
    expect(abilityState(s, MENTOR_BY_ID.passion)).toBe('locked');
    const c0 = abilityCost(s, MENTOR_BY_ID.eyes);
    expect(learnAbility(s, 'lecture')).toBe(true);
    expect(abilityCost(s, MENTOR_BY_ID.eyes)).toBeGreaterThan(c0);
    expect(abilityState(s, MENTOR_BY_ID.passion)).toBe('ready');
    expect(learnAbility(s, 'lecture')).toBe(false);
  });
  it('経歴で安くなる（元王国騎士は「声が届く」が安い）', () => {
    const k = mk(1, 'knight'); const m = mk(1, 'mage');
    expect(abilityCost(k, MENTOR_BY_ID.voice)).toBeLessThan(abilityCost(m, MENTOR_BY_ID.voice));
    expect(abilityCost(m, MENTOR_BY_ID.listener)).toBeLessThan(abilityCost(k, MENTOR_BY_ID.listener));
  });
  it('効き目：授業の引き出し（6種類）・目配り（顔+1）・省エネ授業（体力−20%）・声が届く・引き止め上手', () => {
    const s = mk(7);
    s.pending = [];
    s.instructor.abilities = ['drawer', 'eyes', 'economy', 'voice', 'listener', 'keeper'];
    s.today = null;
    const d = todayCards(s);
    expect(d.cards.length).toBe(B.day.cards + 1 + 1);
    expect(fx(s, 'faces')).toBe(1);
    const l = LESSON_BY_ID.sword;
    const c1 = lessonCost(s, l);
    s.instructor.abilities = [];
    expect(Math.abs(c1)).toBeLessThan(Math.abs(lessonCost(s, l)));
    s.instructor.abilities = ['voice', 'keeper'];
    const st = enrolled(s)[0];
    const ctx = battleCtx(s);
    expect(ctx.commandBonus).toBe(15);
    expect(commandRate(ctx, { studentId: st.id } as never)).toBe(Math.min(100, B.battle.commandBase + st.trust * B.battle.commandPerTrust + 15));
    st.trust = 0;
    startDropoutSign(s, rng(s), st, 'motivation');
    expect(st.dropoutSign!.talksNeeded).toBeGreaterThan(1);
    interviewStudent(s, rng(s), st, false);
    expect(st.dropoutSign).toBeNull();
  });
  it('技能はポイントで次のランクへ。上限（得意S・ほかB）は超えない', () => {
    const s = mk(2, 'knight');
    const caps = instructorCaps(s);
    s.instructor.xp = 100000;
    s.instructor.skills.magic = RANK_POINTS.B;
    expect(skillCost(s, 'magic', caps)).toBeNull();
    s.instructor.skills.magic = RANK_POINTS.C;
    expect(trainSkill(s, 'magic', caps)).toEqual(['C', 'C+']);
    for (let i = 0; i < 10; i++) trainSkill(s, 'lance', caps);
    expect(s.instructor.skills.lance).toBe(RANK_POINTS.S);
  });
  it('後継の教官は1〜2個を受け継ぐ（前提のある能力は前提と一緒に）', () => {
    const s = mk(4);
    s.instructor.abilities = ['lecture', 'passion', 'scout', 'tactician', 'sturdy'];
    const prev = s.instructor;
    externalSuccessor(s, rng(s));
    expect(s.instructor.abilities!.length).toBe(1);
    expect(s.instructor.inherited).toEqual(s.instructor.abilities);
    const next = { ...prev, abilities: [] as string[] };
    const got = inheritAbilities(prev, next, new Rng({ rng: 9 }), true);
    expect(got.length).toBe(2);
    for (const id of got) { const pre = MENTOR_BY_ID[id].pre; if (pre) expect(got).toContain(pre); }
  });
});

describe('成長率は5%きざみ・内わけ', () => {
  it('入学時の生成・受け継ぎ・兵種と才能の補正の結果すべて5%きざみ。本人＋兵種＋才能・特徴＝合計', () => {
    const s = mk(11);
    const r = rng(s);
    for (let i = 0; i < 60; i++) {
      const a = generateStudent(s, r, { quality: Math.random() });
      const b = generateStudent(s, r, { quality: 0.5 });
      const c = generateStudent(s, r, { parents: [a, b], quality: 0.3 });
      for (const st of [a, b, c]) {
        const g = growthRates(st);
        const p = growthParts(st);
        for (const k of STATS) {
          expect(st.growth[k] % 5).toBe(0);
          expect(g[k] % 5).toBe(0);
          expect(p[k].own + p[k].cls + p[k].extra).toBe(p[k].total);
        }
      }
    }
  });
});

describe('兵種図鑑', () => {
  it('初めてなった兵種は図鑑に載り、演出が出る', () => {
    const s = mk(12);
    s.pending = [];
    const st = enrolled(s)[0];
    st.level = 30;
    for (const k of Object.keys(st.skills)) st.skills[k as keyof typeof st.skills] = RANK_POINTS.B;
    const c = nextClasses(s, st).find((x) => classUnlocked(s, x) && meetsReq(st, x))!;
    s.classSeen = [];
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) { st.examMonth = -1; ok = takeExam(s, new Rng({ rng: 100 + i }), st, c.id).ok; }
    expect(ok).toBe(true);
    expect(s.classSeen).toContain(c.id);
    expect(s.pending.some((p) => p.type === 'rankup' && p.items[0].title === '兵種図鑑')).toBe(true);
  });
});

describe('新聞（半年に一回）', () => {
  it('9月の終わりに前期号、3月の年度末に後期号。1年で2号', () => {
    const s = mk(13);
    autoYears(s, 2);
    const y1 = s.news.filter((n) => n.year === 1 && (n.kind === 'first' || n.kind === 'second'));
    expect(y1.map((n) => n.kind).sort()).toEqual(['first', 'second']);
    expect(y1.find((n) => n.kind === 'first')!.month).toBe(5);
    for (const n of y1) {
      expect(n.front?.head).toBeTruthy();
      expect(n.politics?.length).toBeGreaterThanOrEqual(3);
      expect(n.gauges).toBeTruthy();
    }
  });
  it('大事件の月は号外（1面だけ）。同じ月の2つ目は同じ号外に', () => {
    const s = mk(14);
    s.pending = [];
    extraEdition(s, '王の崩御', ['王国の老王が亡くなった。']);
    extraEdition(s, '国境の衝突', ['帝国と王国の国境で衝突。']);
    const ex = s.news.filter((n) => n.kind === 'extra');
    expect(ex.length).toBe(1);
    expect(ex[0].front?.sub).toBe('国境の衝突');
    expect(s.pending.filter((p) => p.type === 'newspaper').length).toBe(1);
  });
  it('戦況の数字の動きを記事の言葉で（国力が伸びると見出しに）', () => {
    const s = mk(15);
    s.world.power.empire += 12;
    s.world.relations.ke -= 20;
    addRep(s, 5);
    const p = publishIssue(s, 'first');
    expect(p.front!.head.length).toBeGreaterThan(4);
    expect(p.body.join('')).toMatch(/帝国/);
    void majorEvents; void endMonth;
  });
});

import { yearEnd, acceptVassal } from '../src/core/flow';
describe('廃校の期限をなくす（8夜目の途中で届いた感想メモ）', () => {
  it('3年目の年度末に評判が低くても傘下に入らない', () => {
    const s = mk(21);
    s.year = 3; s.month = 11; s.reputation = 5; s.pending = [];
    yearEnd(s, []);
    expect(s.world.vassal).toBeNull();
  });
  it('友好度が偏ると傘下への誘いが来る。受けたときだけ傘下に入る', () => {
    const s = mk(22);
    s.world.friendship = { kingdom: 90, empire: 10, alliance: 10 };
    s.month = 11; s.pending = [];
    yearEnd(s, []);
    const offer = s.pending.find((p) => p.type === 'vassalOffer');
    expect(offer).toBeTruthy();
    expect(s.world.vassal).toBeNull();
    acceptVassal(s, 'kingdom');
    expect(s.world.vassal).toBe('kingdom');
  });
});

import { levelUp } from '../src/core/growth';
describe('レベルアップの2ピン保証（8夜目の途中で届いた感想メモ）', () => {
  it('成長率がとても低くても、最低2つの能力が上がる', () => {
    const s = mk(23);
    const st = enrolled(s)[0];
    for (const k of STATS) st.growth[k] = 5;
    st.classId = 'novice';
    for (let i = 0; i < 200; i++) {
      const g = levelUp(new Rng({ rng: i + 1 }), st);
      expect(Object.keys(g).length).toBeGreaterThanOrEqual(2);
      for (const k of STATS) st.stats[k] = Math.min(st.stats[k], 10);
    }
  });
});

describe('戦いの記録はタップで進む・兵種試験は必ず合格（8夜目の途中で届いた感想メモ）', () => {
  it('はじめの設定は「タップで1枚ずつ」。古いセーブも設定がなければタップ', () => {
    expect(mk(31).settings.battleLog).toBe('tap');
    const s = deserialize(fixture('v7-day.json'));
    expect(s.settings.battleLog ?? 'tap').toBe('tap');
  });
});
