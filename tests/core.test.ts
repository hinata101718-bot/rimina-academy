import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';
import { newGame, enrolled, effectiveStats } from '../src/core/game';
import { rankOf } from '../src/core/util';
import { RANK_POINTS } from '../src/data/balance';
import { nextWeek, rng } from '../src/core/flow';
import { autoPending, autoYears, autoWeek } from '../src/core/autoplay';
import { passRate, takeExam, meetsReq } from '../src/core/exam';
import { CLASSES, CLASS_LIST } from '../src/data/classes';
import { serialize, deserialize } from '../src/core/save';
import { TALKS, PHRASES } from '../src/data/talks';
import { PERSONALITY_IDS } from '../src/data/people';
import { addSupport, getSupport } from '../src/core/support';

const mk = (seed = 1, bg = 'knight') => newGame({ name: 'テスト', background: bg, seed });

describe('乱数', () => {
  it('同じシードなら同じ結果', () => {
    const a = new Rng({ rng: 5 }), b = new Rng({ rng: 5 });
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });
  it('同じシードのゲームは同じ生徒になる', () => {
    const a = mk(9), b = mk(9);
    expect(enrolled(a).map((x) => x.given)).toEqual(enrolled(b).map((x) => x.given));
  });
});

describe('生徒の生成', () => {
  it('一期生は6〜8人、全員18歳以上', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = mk(seed);
      const list = enrolled(s);
      expect(list.length).toBeGreaterThanOrEqual(6);
      expect(list.length).toBeLessThanOrEqual(8);
      for (const st of list) {
        expect(st.age).toBeGreaterThanOrEqual(18);
        expect(st.stats.hp).toBeGreaterThanOrEqual(18);
        expect(st.traits.length).toBeGreaterThanOrEqual(1);
        expect(st.traits.length).toBeLessThanOrEqual(3);
        expect(st.given.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('技能ランク', () => {
  it('閾値どおり', () => {
    expect(rankOf(0)).toBe('E');
    expect(rankOf(49)).toBe('E+');
    expect(rankOf(50)).toBe('D');
    expect(rankOf(140)).toBe('C');
    expect(rankOf(650)).toBe('S');
  });
});

describe('兵種データ', () => {
  it('68種あり、前提兵種がすべて存在する', () => {
    expect(CLASS_LIST.length).toBe(68);
    for (const c of CLASS_LIST) for (const p of c.prereq) expect(CLASSES[p]).toBeTruthy();
  });
});

describe('1週間', () => {
  it('何も設定せずに4週進めると月末の依頼が出る', () => {
    const s = mk(3);
    const before = enrolled(s).map((x) => ({ ...x.skills }));
    for (let i = 0; i < 4; i++) { nextWeek(s); if (i < 3) s.pending = []; }
    expect(s.pending.some((p) => p.type === 'questBoard')).toBe(true);
    const after = enrolled(s);
    expect(after.some((x, i) => x.skills.sword + x.skills.lance > before[i].sword + before[i].lance)).toBe(true);
    expect((s.instructor.stamina ?? 100)).toBeLessThan(100); // 7夜目：体力は先生だけ
    expect(Object.values(s.supports).some((sp) => sp.value > 0)).toBe(true);
  });
  it('支援値が上がると会話が組み立てられる', () => {
    const s = mk(4);
    const [a, b] = enrolled(s);
    const t = addSupport(s, rng(s), a.id, b.id, 40);
    expect(t).not.toBeNull();
    expect(t!.lines.length).toBeGreaterThanOrEqual(3);
    expect(t!.lines.every((l) => !l.text.includes('{'))).toBe(true);
    expect(getSupport(s, a.id, b.id).kind).not.toBe('none');
  });
});

describe('会話データ', () => {
  it('話題20〜30種・地の文以外は性格ごとの口調がある（分岐で使わない性格は空でよい。talks.test.ts で全組み合わせを確認）', () => {
    const n = new Set(TALKS.map((t) => t.topic)).size;
    expect(n).toBeGreaterThanOrEqual(20);
    expect(n).toBeLessThanOrEqual(30);
    for (const [id, e] of Object.entries(PHRASES)) {
      if (id.startsWith('n_')) { expect(e.default, id).toBeTruthy(); continue; }
      for (const p of PERSONALITY_IDS) expect(e[p] !== undefined, `${id}/${p}`).toBe(true);
    }
  });
});

describe('兵種試験', () => {
  it('条件ちょうどで60%、超えると上がる', () => {
    const s = mk(5);
    const st = enrolled(s)[0];
    st.skills.sword = RANK_POINTS.D;
    st.level = 5;
    expect(meetsReq(st, CLASSES.swordsman)).toBe(true);
    expect(passRate(st, CLASSES.swordsman)).toBe(60);
    st.skills.sword = RANK_POINTS.D + 100;
    expect(passRate(st, CLASSES.swordsman)).toBe(80);
    st.skills.sword = 500;
    expect(passRate(st, CLASSES.swordsman)).toBe(100);
    const r = takeExam(s, rng(s), st, 'swordsman');
    expect(r.ok).toBe(true);
    expect(st.classId).toBe('swordsman');
    expect(effectiveStats(st).spd).toBeGreaterThanOrEqual(st.stats.spd);
  });
});

describe('セーブ', () => {
  it('書き出して読み込むと同じ状態に戻る', () => {
    const s = mk(6);
    for (let i = 0; i < 6; i++) autoWeek(s);
    const text = serialize(s);
    const back = deserialize(text);
    expect(JSON.stringify(back)).toBe(JSON.stringify(s));
  });
  it('壊れたファイルは読み込まない', () => {
    expect(() => deserialize('{"a":1}')).toThrow();
    expect(() => deserialize('not json')).toThrow();
  });
});

describe('1年', () => {
  it('3年生として始めると、1年で卒業生が出る', () => {
    const s = newGame({ name: 'テスト', background: 'mage', seed: 11, startGrade: 3 });
    autoYears(s, 1);
    autoPending(s);
    const grads = Object.values(s.students).filter((x) => x.status === 'graduated');
    expect(grads.length).toBeGreaterThan(0);
    expect(grads.every((g) => g.career && g.farewell !== null)).toBe(true);
    expect(s.photos.length).toBe(1);
    expect(s.news.length).toBeGreaterThan(0);
    expect(s.year).toBe(2);
  });
});
