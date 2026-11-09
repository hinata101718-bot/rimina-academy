// 7夜目のテスト：日ごとの授業カード・育ち方・6夜目版のセーブの変換
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, autoWeek, autoDay, finishAuto, autoBattle } from '../src/core/autoplay';
import { chooseLesson, weekAuto, rng } from '../src/core/flow';
import { todayCards, resolveLesson, absDay, teacherStamina, teacherMax, teacherSick } from '../src/core/lessons';
import { LESSON_BY_ID } from '../src/data/lessons';
import { B, SAVE_VERSION } from '../src/data/balance';
import { Rng } from '../src/core/rng';
import { getSupport } from '../src/core/support';
import type { GameState } from '../src/core/state';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const fresh = (seed = 5) => { const s = newGame({ name: 't', background: 'knight', seed }); s.pending = []; return s; };
/** すべての子を同じ条件にする（才能・特徴・やる気・疲れ） */
function even(s: GameState) { s.instructor.stamina = 100; for (const st of enrolled(s)) { st.talent = null; st.apt = { good: [], bad: [] }; st.traits = []; st.motivation = 2; st.targets = ['sword', 'lance']; } }

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
  it('体力は先生だけ：授業で減り、休講で回復。0になると数日寝込んで自動で休講', () => {
    const s = fresh(12);
    s.instructor.stamina = 60;
    s.today = { key: absDay(s), cards: [{ id: 'axe_strike', faces: [], tags: [] }, { id: 'rest', faces: [], tags: [] }] };
    resolveLesson(s, rng(s), 0);
    expect(teacherStamina(s)).toBeLessThan(60);
    const before = teacherStamina(s);
    resolveLesson(s, rng(s), 1);
    expect(teacherStamina(s)).toBeGreaterThan(before + 20);
    // 生徒には体力も体調不良もない
    for (const st of enrolled(s)) { expect(st.fatigue).toBe(0); expect(st.sickDays ?? 0).toBe(0); }
    s.instructor.stamina = 3;
    const r = resolveLesson(s, rng(s), 0);
    expect(teacherSick(s)).toBe(true);
    expect(r.lines.some((l) => l.includes('寝込んで'))).toBe(true);
    const sk = enrolled(s)[0].skills.axe;
    const r2 = resolveLesson(s, rng(s), 0);
    expect(r2.lesson).toBe('rest');
    expect(enrolled(s)[0].skills.axe).toBe(sk);
  });
  it('年をとると先生の最大体力が少し下がる', () => {
    const s = fresh(13);
    s.instructor.age = 30; const young = teacherMax(s);
    s.instructor.age = 62; expect(teacherMax(s)).toBeLessThan(young);
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
    expect(Math.max(...top)).toBeLessThan(B.day ? 360 : 0); // 10夜目：得意の技能は×1.5（中央値は9夜目とほぼ同じ）
  });
});

describe('6夜目版のセーブ（形式5）', () => {
  it('週の途中（個人指導・週末の予定・重点科目あり）：形式6になり、重点科目と週末の予定は最初の日のカードに出る', () => {
    const s = deserialize(fixture('v6-week.json'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(8);
    for (const st of enrolled(s)) expect(st.fatigue).toBe(0);
    expect(s.instructor.stamina).toBe(100);
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
  it('手動の戦闘の途中：札の戦いとしてやり直して遊べる（16夜目）', () => {
    const s = deserialize(fixture('v6-manual.json'));
    expect(!!s.battle?.auto?.cards).toBe(true);
    autoBattle(s);
    expect(s.battle).toBeNull();
    autoPending(s);
    autoDay(s);
  });
});

import { startAutoQuest, battleCtx } from '../src/core/flow';
import { defaultPlan, skipAuto, setCardMode } from '../src/core/battle/auto';
import { battleItems, hpAt, compact } from '../src/core/battle/blog';
import type { Unit, BLog } from '../src/core/battle/types';
import { autoDeploy } from '../src/core/autoplay';
import { rollQuests } from '../src/core/quests';

describe('戦いの記録', () => {
  // 16夜目：7夜目の戦いの記録（古い場面の戦い）を確かめるテスト
  beforeAll(() => setCardMode(false));
  afterAll(() => setCardMode(true));
  const battle = (seed: number) => {
    const s = newGame({ name: 't', background: 'knight', seed });
    autoYears(s, 1); autoPending(s);
    s.pending = [{ type: 'questBoard' }]; s.quests = rollQuests(s);
    const q = s.quests.find((x) => x.real) ?? s.quests[0];
    const d = autoDeploy(s);
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    skipAuto(s, battleCtx(s), (c) => c.recommended);
    return s;
  };
  it('1回の攻撃ごとの記録が場面に入り、受けた側のHP（前と後）が正しい', () => {
    const s = battle(31);
    const b = s.battle!;
    const logs = b.auto!.scenes.flatMap((sc) => sc.log ?? []);
    const atk = logs.filter((e) => e.k === 'atk') as Extract<BLog, { k: 'atk' }>[];
    expect(atk.length).toBeGreaterThan(3);
    for (const e of atk) {
      if (e.role === 'duel') continue;
      expect(e.hp1).toBe(Math.max(0, e.hp0 - e.dmg));
      if (!e.hit) expect(e.dmg).toBe(0);
      if (e.kill) expect(e.hp1).toBe(0);
    }
    // 戦いは作った時刻で変わるので、敵の番・反撃が出る戦いを数回のうちに見つける
    let found = logs.some((e) => e.k === 'turn' && e.side === 'enemy') && atk.some((e) => e.role === 'counter');
    for (let sd = 41; sd < 80 && !found; sd++) { const l2 = battle(sd).battle!.auto!.scenes.flatMap((sc) => sc.log ?? []); found = l2.some((e) => e.k === 'turn' && e.side === 'enemy') && l2.some((e) => e.k === 'atk' && e.role === 'counter'); }
    expect(found).toBe(true);
  });
  it('記録を最後まで進めると、上のHPの一覧が戦闘の終わりのHPと一致する', () => {
    const s = battle(32);
    const b = s.battle!;
    const items = battleItems(b);
    const { hp } = hpAt(b, items, items.length);
    for (const u of b.units) if (hp[u.uid] !== undefined) expect(hp[u.uid]).toBe(Math.max(0, u.hp));
    // 黄色い帯（出来事・口上）と、ターンの区切りがある
    expect(items.some((x) => x.k === 'band')).toBe(true);
    expect(items.some((x) => x.k === 'turn')).toBe(true);
  });
  it('雑兵の行動が3つ以上続くと「盗賊3人の攻撃：合計」の1枚にまとまる', () => {
    const u = (uid: string, side: Unit['side']) => ({ uid, side, boss: false } as Unit);
    const units = [u('p1', 'player'), u('e1', 'enemy'), u('e2', 'enemy'), u('e3', 'enemy'), u('L', 'enemy')];
    const atk = (x: number, a: string, d: string, dmg: number, role: 'atk' | 'counter' = 'atk', kill = false): BLog => ({ k: 'atk', x, a, d, w: null, dmg, hit: dmg > 0, crit: false, tri: 0, eff: false, role, hp0: 20, hp1: 20 - dmg, max: 20, kill });
    const log: BLog[] = [{ k: 'turn', turn: 1, side: 'enemy' }, atk(1, 'e1', 'p1', 3), atk(1, 'p1', 'e1', 5, 'counter'), atk(2, 'e2', 'p1', 4), atk(3, 'e3', 'p1', 2), atk(4, 'L', 'p1', 6)];
    const items = compact(log, units, 'L');
    const g = items.find((x) => x.k === 'group');
    expect(g && g.k === 'group' && g.count === 3 && g.total === 9 && g.counter === 5).toBe(true);
    // 敵将の攻撃はまとめない
    expect(items.some((x) => x.k === 'atk' && x.e.a === 'L')).toBe(true);
    // 倒した攻撃が入ると、まとめない
    const log2: BLog[] = [atk(1, 'e1', 'p1', 3), atk(2, 'e2', 'p1', 4, 'atk', true), atk(3, 'e3', 'p1', 2)];
    expect(compact(log2, units, 'L').some((x) => x.k === 'group')).toBe(false);
  });
});

import { continueSchool, peaceEraYear, seedFactor, checkEndings, endingTitle, startSeed } from '../src/core/ending';
import { B as BAL } from '../src/data/balance';

describe('戦争のあと、また戦争が起きる', () => {
  const ended = (kind: 'peace' | 'unify' | 'ceasefire' | 'neutral') => {
    const s = newGame({ name: 't', background: 'knight', seed: 41 });
    autoYears(s, 2); autoPending(s);
    s.endings = [{ kind, year: s.year, country: kind === 'unify' ? 'empire' : undefined, n: 1 }];
    continueSchool(s);
    return s;
  };
  it('「この学校を続ける」で、終わり方ごとの火種と時期が決まる（毎年2%の再発はなくなる）', () => {
    for (const k of ['peace', 'unify', 'ceasefire', 'neutral'] as const) {
      const s = ended(k);
      const sd = s.world.seed!;
      expect(sd.kind).toBe(k);
      const range = { peace: [20, 30], unify: [10, 20], ceasefire: [8, 15], neutral: [15, 25] }[k];
      expect(sd.due).toBeGreaterThanOrEqual(range[0]);
      expect(sd.due).toBeLessThanOrEqual(range[1]);
      expect(s.world.era).toBe('peace');
    }
  });
  it('くすぶりが満ちると次の戦争が始まり、大事件の場面と年表に「第二次」。同じ種類のエンディングをまた見られる', () => {
    const s = ended('peace');
    s.world.seed!.smolder = 99;
    s.pending = [];
    const lines = peaceEraYear(s, new Rng({ rng: 5 }));
    expect(lines.some((l) => l.includes('第二次大陸戦争'))).toBe(true);
    expect(s.world.era).toBeNull();
    expect(s.world.warNo).toBe(2);
    expect(s.pending.some((p) => p.type === 'scene' && p.title.includes('第二次'))).toBe(true);
    expect(s.chronicle.some((c) => c.text.includes('第二次大陸戦争が始まった'))).toBe(true);
    // 二度目の戦争で和平の円卓に届くと「第二次和平の円卓」
    s.world.peaceRoundYear = s.year; s.pending = [];
    expect(checkEndings(s, new Rng({ rng: 6 }), 'year')).toBe('peace');
    const e = s.endings![s.endings!.length - 1];
    expect(e.n).toBe(2);
    expect(endingTitle(e.kind, e.country, e.n)).toBe('第二次和平の円卓');
    const sc = s.pending.find((p) => p.type === 'scene');
    expect(sc && sc.type === 'scene' && sc.title).toBe('第二次和平の円卓');
  });
  it('予兆が新聞・手紙・大事件で少しずつ出る', () => {
    const s = ended('ceasefire');
    s.pending = []; s.mail = [];
    const all: string[] = [];
    for (let i = 0; i < 40 && s.world.era === 'peace'; i++) all.push(...peaceEraYear(s, new Rng({ rng: i + 1 })));
    expect(all.filter((l) => l.startsWith('【決着をつけたい国】')).length).toBe(3);
    expect(s.pending.some((p) => p.type === 'event' && p.title === '戦の予兆')).toBe(true);
  });
  it('こちらの動きで火種を遅らせられる（和平：現役の文官が多いほど、中立：友好度が高いほど）', () => {
    const s = ended('neutral');
    s.reputation = 90;
    for (const c of ['kingdom', 'empire', 'alliance'] as const) s.world.friendship[c] = 40;
    const fast = seedFactor(s).mul;
    for (const c of ['kingdom', 'empire', 'alliance'] as const) s.world.friendship[c] = 95;
    const slow = seedFactor(s).mul;
    expect(slow).toBeLessThan(fast);
    startSeed(s, 'peace', null);
    expect(seedFactor(s).mul).toBeLessThanOrEqual(1 + BAL.ending.seed.peaceLostCivil * 6);
  });
});

import { WHOLE_TALKS, WHOLE_INTERVIEWS } from '../src/data/talks/whole_index';
import { TONE_OF, TONES } from '../src/data/talks/whole';
import { renderWhole, buildTalk } from '../src/core/support';
import { buildWholeInterview } from '../src/core/interview';
import { PERSONALITY_IDS } from '../src/data/people';

describe('まるごと書いた会話', () => {
  it('性格を5つのまとまりに分け、どれも2つの性格を持つ', () => {
    for (const t of TONES) expect(PERSONALITY_IDS.filter((p) => TONE_OF[p] === t).length).toBe(2);
  });
  it('全部の会話を、まとまりの全性格×性別で組み立てても、差し込み忘れや空の行がない', () => {
    const s = fresh(51);
    const [a, b] = enrolled(s);
    const ids = new Set<string>();
    for (const t of WHOLE_TALKS) {
      expect(ids.has(t.id)).toBe(false); ids.add(t.id);
      for (const pa of PERSONALITY_IDS.filter((p) => TONE_OF[p] === t.ga)) for (const pb of PERSONALITY_IDS.filter((p) => TONE_OF[p] === t.gb)) {
        a.personality = pa; b.personality = pb;
        for (const l of renderWhole(s, t.lines, a, b, '国境の小競り合い')) { expect(l.text.trim().length).toBeGreaterThan(0); expect(l.text).not.toMatch(/[{}]|undefined/); }
      }
    }
    for (const t of WHOLE_INTERVIEWS) for (const bg of ['knight', 'merc', 'mage', 'wanderer']) {
      s.instructor.background = bg; a.personality = PERSONALITY_IDS.find((p) => TONE_OF[p] === t.g)!;
      for (const l of buildWholeInterview(s, a, t).lines) expect(l.text).not.toMatch(/[{}]|undefined/);
    }
  });
  it('おもな話題は15の組み合わせすべてにある', () => {
    for (const topic of ['dream', 'future', 'fear', 'origin', 'house', 'family', 'food', 'hobby', 'daily', 'study', 'teacher', 'war', 'rel_friend', 'rel_rival', 'rel_love']) {
      const pairs = new Set(WHOLE_TALKS.filter((t) => t.topic === topic).map((t) => [t.ga, t.gb].sort().join('-')));
      expect(pairs.size).toBe(15);
    }
  });
  it('支援会話では、まるごと書いた会話がよく選ばれる', () => {
    const s = fresh(52);
    const [a, b] = enrolled(s);
    let whole = 0;
    for (let i = 0; i < 40; i++) {
      const sp = getSupport(s, a.id, b.id); sp.value = B.support.C + 1; sp.seen = []; sp.kind = 'friend';
      const t = buildTalk(s, new Rng({ rng: i + 1 }), sp, 'C');
      if (t && WHOLE_TALKS.some((w) => sp.seen.includes(w.id))) whole++;
    }
    expect(whole).toBeGreaterThan(10);
  });
});
