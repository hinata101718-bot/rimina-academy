// 7夜目のテスト：日ごとの授業カード・育ち方・6夜目版のセーブの変換
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, autoWeek, autoDay, finishAuto, autoBattle } from '../src/core/autoplay';
import { chooseLesson, weekAuto, rng } from '../src/core/flow';
import { todayCards, resolveLesson, absDay, tired, stamina } from '../src/core/lessons';
import { LESSON_BY_ID } from '../src/data/lessons';
import { B, SAVE_VERSION } from '../src/data/balance';
import { Rng } from '../src/core/rng';
import { getSupport } from '../src/core/support';
import type { GameState } from '../src/core/state';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const fresh = (seed = 5) => { const s = newGame({ name: 't', background: 'knight', seed }); s.pending = []; return s; };
/** すべての子を同じ条件にする（才能・特徴・やる気・疲れ） */
function even(s: GameState) { for (const st of enrolled(s)) { st.talent = null; st.traits = []; st.motivation = 2; st.fatigue = 0; st.targets = ['sword', 'lance']; } }

describe('日ごとの授業カード', () => {
  it('毎日5種類＋休講が出る。1人の子の顔は1日に1枚だけ。同じ日には同じカード', () => {
    const s = fresh();
    const d = todayCards(s);
    expect(d.cards.length).toBe(B.day.cards + 1);
    expect(d.cards[d.cards.length - 1].id).toBe('rest');
    const ids = d.cards.flatMap((c) => c.faces);
    expect(new Set(ids).size).toBe(ids.length);
    expect(todayCards(s)).toBe(d);
    expect(d.key).toBe(absDay(s));
  });
  it('月〜金の5日で週が進み、4週目の金曜のあとは月末の依頼', () => {
    const s = fresh();
    for (let i = 0; i < 5; i++) { chooseLesson(s, 0); expect(s.pending[0]?.type).toBe('lessonResult'); s.pending = s.pending.filter((p) => p.type === 'questBoard'); }
    expect(s.week).toBe(2); expect(s.day).toBe(1);
    for (let i = 0; i < 15; i++) { chooseLesson(s, B.day.cards); s.pending = s.pending.filter((p) => p.type === 'questBoard'); }
    expect(s.pending.some((p) => p.type === 'questBoard')).toBe(true);
  });
  it('全員が伸び、顔が出ている子は約2倍、目標技能はさらに3割、友情タッグはさらに3割', () => {
    const s = fresh(11);
    even(s);
    const list = enrolled(s);
    const [a, b, c] = list;
    const sp = getSupport(s, a.id, b.id); sp.value = B.support.C + 1;
    s.today = { key: absDay(s), cards: [{ id: 'sword', faces: [a.id, b.id], tags: [[a.id, b.id]] }, { id: 'rest', faces: [], tags: [] }] };
    c.targets = ['axe', 'bow'];
    const before = list.map((x) => x.skills.sword);
    resolveLesson(s, new Rng({ rng: 1 }), 0);
    const g = list.map((x, i) => x.skills.sword - before[i]);
    const ci = list.indexOf(c);
    // c：顔なし・目標でない → 基準
    expect(g[ci]).toBeGreaterThan(0);
    // a：顔（×2）・目標（×1.3）・タッグ（×1.3）
    expect(g[0] / g[ci]).toBeGreaterThan(2 * 1.3 * 1.3 * 0.85);
    expect(g[0] / g[ci]).toBeLessThan(2 * 1.3 * 1.3 * 1.15);
  });
  it('休講で全員の体力が回復し、体力が尽きると体調を崩して何日か休む', () => {
    const s = fresh(12);
    for (const st of enrolled(s)) st.fatigue = 70;
    expect(tired(enrolled(s)[0])).toBe(true);
    s.today = { key: absDay(s), cards: [{ id: 'rest', faces: [], tags: [] }] };
    resolveLesson(s, rng(s), 0);
    for (const st of enrolled(s)) expect(stamina(st)).toBeGreaterThan(30 + 25);
    const st = enrolled(s)[0];
    st.fatigue = 98;
    s.today = { key: absDay(s), cards: [{ id: 'axe_strike', faces: [], tags: [] }] };
    const r = resolveLesson(s, rng(s), 0);
    expect(st.sickDays).toBeGreaterThan(0);
    expect(r.lines.some((l) => l.includes('体調を崩した'))).toBe(true);
  });
  it('鍛錬ゲージ：授業で能力ごとのゲージがたまり、満タンで+1', () => {
    const s = fresh(13);
    even(s);
    const st = enrolled(s)[0];
    st.stats.str = 5; st.train = { str: 95 };
    s.today = { key: absDay(s), cards: [{ id: 'strength', faces: [st.id], tags: [] }] };
    const r = resolveLesson(s, rng(s), 0);
    expect(st.stats.str).toBe(6);
    expect(st.trainGain?.str).toBe(1);
    expect(r.growth.find((g) => g.id === st.id)?.train).toContain('str');
  });
  it('退学の予兆がある子がいれば、面談のカードが必ず出て、その子の顔が出る', () => {
    const s = fresh(14);
    const st = enrolled(s)[2];
    st.dropoutSign = { reason: 'motivation', weeksLeft: 5, talksNeeded: 1 };
    s.today = null;
    const d = todayCards(s);
    const c = d.cards.find((x) => x.id === 'interview')!;
    expect(c).toBeTruthy();
    expect(c.faces).toContain(st.id);
    chooseLesson(s, d.cards.indexOf(c), st.id);
    expect(st.dropoutSign).toBeNull();
  });
  it('進路指導は3年生だけが顔に出る', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 15 });
    autoYears(s, 2); autoPending(s);
    for (let i = 0; i < 40; i++) {
      s.today = null; s.rng = i * 7 + 1;
      const c = todayCards(s).cards.find((x) => x.id === 'career');
      if (c) { for (const id of c.faces) expect(s.students[id].grade).toBe(3); return; }
    }
  });
  it('「今週はおまかせ」で金曜まで進み、まとめが1つ出る', () => {
    const s = fresh(16);
    chooseLesson(s, 0); s.pending = [];
    expect(s.day).toBe(2);
    weekAuto(s);
    expect(s.week).toBe(2); expect(s.day).toBe(1);
    const p = s.pending.find((x) => x.type === 'weekSummary');
    expect(p && p.type === 'weekSummary' && p.lines[0].startsWith('今週の授業：')).toBe(true);
  });
  it('設定「技能の伸び方」で伸びが変わる', () => {
    const run = (mul: number) => { const s = fresh(17); even(s); s.settings.mods.skill = mul; s.today = { key: absDay(s), cards: [{ id: 'lance', faces: [], tags: [] }] }; const st = enrolled(s)[0]; const b = st.skills.lance; resolveLesson(s, new Rng({ rng: 3 }), 0); return st.skills.lance - b; };
    expect(run(2) / run(1)).toBeGreaterThan(1.75);
    expect(run(2) / run(1)).toBeLessThan(2.25);
  });
  it('どのカードの名前も授業の一覧にある', () => {
    const s = fresh(18);
    for (let i = 0; i < 30; i++) { s.today = null; s.rng = i + 1; for (const c of todayCards(s).cards) expect(LESSON_BY_ID[c.id]).toBeTruthy(); }
  });
});

describe('育ち方', () => {
  it('兵種試験の条件：初級5・中級15・上級25・最上級45、英雄25。卒業後の上限Lv70', () => {
    expect(B.exam.levelReq).toEqual([0, 5, 15, 25, 45]);
    expect(B.exam.heroLevel).toBe(25);
    expect(B.student.maxLevel).toBe(70);
  });
  it('1年遊ぶと、よく出撃した子はLv8〜18あたり、目標技能はD〜C+あたり', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 19 });
    autoYears(s, 1);
    const first = enrolled(s).filter((x) => x.grade === 2).sort((a, b) => b.battles - a.battles).slice(0, 4);
    for (const st of first) {
      expect(st.level).toBeGreaterThanOrEqual(7);
      expect(st.level).toBeLessThanOrEqual(19);
    }
    const top = first.map((st) => Math.max(...Object.values(st.skills)));
    expect(Math.max(...top)).toBeLessThan(B.day ? 300 : 0);
  });
});

describe('6夜目版のセーブ（形式5）', () => {
  it('週の途中（個人指導・週末の予定・重点科目あり）：形式6になり、重点科目と週末の予定は最初の日のカードに出る', () => {
    const s = deserialize(fixture('v6-week.json'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(6);
    expect(s.day).toBe(1);
    expect(s.plan.tutoring.length + s.plan.weekend.length).toBe(0);
    expect(s.settings.mods.skill).toBe(1);
    for (const st of enrolled(s)) expect(st.train).toBeTruthy();
    expect(s.pending.some((p) => p.type === 'event' && p.title.includes('授業カード'))).toBe(true);
    s.pending = [];
    const d = todayCards(s);
    expect(d.cards.some((c) => c.id === 'tea')).toBe(true);
    expect(d.cards.some((c) => ['magic', 'magic_theory', 'lance', 'lance_thrust'].includes(c.id))).toBe(true);
    // そのまま遊べる
    for (let i = 0; i < 8; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
    const again = deserialize(serialize(s));
    expect(again.version).toBe(SAVE_VERSION);
  });
  it('月の途中：そのまま1年遊べる', () => {
    const s = deserialize(fixture('v6-month.json'));
    s.pending = [];
    const y = s.year;
    autoYears(s, 1);
    expect(s.year).toBe(y + 1);
  });
  it('自動の戦闘の途中：判断を選んで最後まで進められる', () => {
    const s = deserialize(fixture('v6-auto.json'));
    expect(s.battle?.auto).toBeTruthy();
    autoPending(s);
    finishAuto(s);
    expect(s.battle).toBeNull();
    expect(s.pending.some((p) => p.type === 'battleResult')).toBe(true);
    autoDay(s);
  });
  it('手動の戦闘の途中：自分で指揮する戦闘の続きから遊べる', () => {
    const s = deserialize(fixture('v6-manual.json'));
    expect(s.battle && !s.battle.auto).toBe(true);
    autoBattle(s);
    expect(s.battle).toBeNull();
    autoPending(s);
    autoDay(s);
  });
});
