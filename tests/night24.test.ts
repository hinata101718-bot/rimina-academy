import { describe, it, expect } from 'vitest';
import { newGame, enrolled, addRep, repGain } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { prepareEntrance, killStudent, autoAdmitIds } from '../src/core/flow';
import { serialize, deserialize } from '../src/core/save';
import { CLASSES } from '../src/data/classes';
import { B } from '../src/data/balance';
import type { GameState } from '../src/core/state';

const tick = () => new Promise((r) => setTimeout(r, 0));
function entranceAt(rep: number, seed: number): GameState['applicants'] {
  const s = newGame({ name: 'テスト', background: 'knight', seed });
  s.reputation = rep;
  s.pending = [];
  prepareEntrance(s);
  return s.applicants;
}

describe('24夜目②：評判', () => {
  it('高いほど上がりにくく、95より上は大きな出来事だけ', () => {
    expect(repGain(40, 1)).toBeCloseTo(1);
    expect(repGain(80, 1)).toBeLessThan(0.6);
    expect(repGain(95, 1)).toBe(0);
    expect(repGain(95, 4)).toBeGreaterThan(0);
  });
  it('下がる出来事（教え子の戦死・依頼の失敗）がはっきり効く', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 3 });
    s.reputation = 70;
    killStudent(s, enrolled(s)[0], '戦死した');
    expect(s.reputation).toBeLessThanOrEqual(70 + B.reputation.deathInSchool + 0.01);
    const r = s.reputation;
    addRep(s, B.reputation.questLose);
    expect(s.reputation).toBeLessThan(r - 3);
  });
  it('評判で入学の希望者が変わる（数・遠い国の子・育ちのよさ）', () => {
    let nLo = 0, nHi = 0, farLo = 0, farHi = 0, qLo = 0, qHi = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const lo = entranceAt(55, seed), hi = entranceAt(85, seed);
      nLo += lo.length; nHi += hi.length;
      farLo += lo.filter((x) => x.origin !== 'frontier').length / lo.length;
      farHi += hi.filter((x) => x.origin !== 'frontier').length / hi.length;
      qLo += lo.reduce((a, x) => a + x.stats.hp, 0) / lo.length; qHi += hi.reduce((a, x) => a + x.stats.hp, 0) / hi.length;
    }
    expect(nHi).toBeGreaterThan(nLo);
    expect(farHi).toBeGreaterThanOrEqual(farLo);
    expect(qHi).toBeGreaterThan(qLo);
  });
  it('12年のあいだ、評判は95に張りつかず動きつづける（入学の希望者の変わり方が効きつづける）・兵種の系統がかたよらない', async () => {
    const s = newGame({ name: 'テスト', background: 'merc', seed: 1002 });
    const reps: number[] = [];
    const lines: Record<string, number> = {};
    let total = 0;
    // 25夜目：1年ごとに一息つく（テストの作業者どうしの連絡が時間切れにならないように）
    for (let y = 0; y < 12; y++) {
      autoYears(s, 1, (g) => {
        reps.push(g.reputation);
        for (const st of enrolled(g)) { const l = CLASSES[st.classId]?.line ?? '?'; lines[l] = (lines[l] ?? 0) + 1; total += 1; }
      });
      await tick();
    }
    const late = reps.slice(5);
    expect(Math.max(...late)).toBeLessThan(B.reputation.softCap);
    expect(Math.min(...late)).toBeGreaterThan(40);
    expect(new Set(late.map((x) => Math.round(x))).size).toBeGreaterThanOrEqual(3);
    for (const [, n] of Object.entries(lines)) expect(n / total).toBeLessThanOrEqual(0.25);
  }, 120_000);
});

describe('24夜目③：兵種の釣り合い', () => {
  it('入学のおまかせは、学校に多い系統の子を後ろへ回す', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 7 });
    for (const st of enrolled(s)) st.classId = 'mage';
    s.pending = [];
    prepareEntrance(s);
    const ids = autoAdmitIds(s);
    const mages = s.applicants.filter((a) => CLASSES[a.classId]?.line === 'magic');
    const chosenMages = ids.filter((id) => mages.some((m) => m.id === id)).length;
    // 魔道士の系統の希望者がいても、全員は取らない（ほかの系統の子が先に入る）
    if (mages.length >= 2) expect(chosenMages).toBeLessThan(mages.length);
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe('24夜目：前の版（23夜目）のセーブ', () => {
  it('読み込める（断った数の欄を足す）', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 9 });
    delete s.world.declined;
    const f = JSON.parse(serialize(s));
    f.version = 23;
    const t = deserialize(JSON.stringify(f));
    expect(t.world.declined).toEqual({});
    expect(t.version).toBeGreaterThanOrEqual(24);
  });
});

import { classifyNews, summarizeMoves, NEWS_SAME_MAX } from '../src/core/newspaper';
import { alumniLetter, simulateAlumni } from '../src/core/alumni';
import { Rng } from '../src/core/rng';

describe('24夜目⑤：新聞の一面', () => {
  it('大きな話ほど重い。ほかの敵将の二つ名・昇進・引退は一面・二面に載せない（因縁のある宿敵だけ二面）', () => {
    const w = (text: string, kind: 'world' | 'school' | 'student' = 'world', names: string[] = []) => classifyNews({ text, kind }, names);
    expect(w('平和な時代が始まった')!.w).toBeGreaterThan(w('王国と帝国の国境紛争')!.w);
    expect(w('ローザが「砦の攻略」で戦死', 'student')!.w).toBeGreaterThan(8);
    expect(w('卒業生のオットーが、王国の将として学校の前に立ちはだかる', 'student')!.w).toBeGreaterThan(8);
    expect(w('帝国軍のアウレリウス・タウルスが幹部に昇進した')).toBeNull();
    expect(w('王国軍のグスタフ・ローゼンが引退した')).toBeNull();
    expect(w('帝国軍のクレメンスは、「隻眼のクレメンス」と呼ばれるようになった（光に焼かれた右目）')).toBeNull();
    expect(w('帝国軍のクレメンスは、「隻眼のクレメンス」と呼ばれるようになった（光に焼かれた右目）', 'world', ['クレメンス'])!.cat).toBe('nemOrg');
    expect(w('帝国軍のクレメンスを討ち取った', 'school')).toBeNull();
    expect(w('帝国軍のクレメンスを討ち取った', 'school', ['クレメンス'])!.cat).toBe('nemesis');
  });
  it('ほかの敵将の動きは「各国の動き」にまとめる', () => {
    const l = summarizeMoves([{ faction: '帝国軍', tag: '昇進', name: 'ア' }, { faction: '帝国軍', tag: '昇進', name: 'イ' }, { faction: '帝国軍', tag: '昇進', name: 'ウ' }, { faction: '王国軍', tag: '引退', name: 'エ' }]);
    expect(l).toHaveLength(2);
    expect(l[0]).toContain('昇進3人');
  });
  it('12年回して：一面に二つ名・昇進・引退が来ない。1つの号に同じ種類の話は2つまで', async () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 1001 });
    for (let y = 0; y < 12; y++) { autoYears(s, 1); await tick(); }
    const papers = s.news.filter((n) => n.kind === 'first' || n.kind === 'second');
    expect(papers.length).toBeGreaterThan(10);
    for (const n of papers) {
      expect(n.front!.head).not.toMatch(/と呼ばれるようになった|幹部に昇進|が引退した/);
      const tags: Record<string, number> = {};
      for (const o of n.orgs ?? []) tags[o.tag] = (tags[o.tag] ?? 0) + 1;
      for (const v of Object.values(tags)) expect(v).toBeLessThanOrEqual(NEWS_SAME_MAX);
    }
    const heads = new Set(papers.map((n) => n.front!.head.replace(/[^぀-ヿ一-鿿]/g, '').slice(-6)));
    expect(heads.size).toBeGreaterThan(5);
  }, 120_000);
});

describe('24夜目⑥：卒業生の手紙', () => {
  it('中身と題が広がり、同じ人から同じ型が続かない。1年に十数通まで', async () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 1003 });
    for (let y = 0; y < 10; y++) { autoYears(s, 1); await tick(); }
    const grads = Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive && !x.career.retired);
    expect(grads.length).toBeGreaterThan(20);
    const r = new Rng({ rng: 77 } as never);
    const kinds = new Set<string>(); const titles = new Set<string>();
    for (const st of grads) for (let i = 0; i < 3; i++) { const l = alumniLetter(s, r, st); kinds.add(l.kind); titles.add(l.title); expect(l.kind).not.toBe(st.lastLetter); st.lastLetter = l.kind; expect(l.body).not.toMatch(/\{\w+\}/); }
    expect(kinds.size).toBeGreaterThanOrEqual(6);
    expect(titles.size).toBeGreaterThanOrEqual(10);
    // 1年に届く数
    for (const st of grads) st.trust = 100;
    const before = s.mail.length;
    const ids = new Set(s.mail.map((m) => m.id));
    simulateAlumni(s, new Rng({ rng: 5 } as never));
    const fresh = s.mail.filter((m) => !ids.has(m.id) && m.studentId && !/差し入れ|昇格/.test(m.title));
    expect(fresh.length).toBeLessThanOrEqual(B.letters.yearMax);
    void before;
  }, 120_000);
});
