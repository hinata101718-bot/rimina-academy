import { describe, it, expect } from 'vitest';
import { newGame, enrolled, addRep, repGain } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { prepareEntrance, killStudent, autoAdmitIds } from '../src/core/flow';
import { serialize, deserialize } from '../src/core/save';
import { CLASSES } from '../src/data/classes';
import { B } from '../src/data/balance';
import type { GameState } from '../src/core/state';

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
  it('12年のあいだ、評判は95に張りつかず動きつづける（入学の希望者の変わり方が効きつづける）・兵種の系統がかたよらない', () => {
    const s = newGame({ name: 'テスト', background: 'merc', seed: 1002 });
    const reps: number[] = [];
    const lines: Record<string, number> = {};
    let total = 0;
    autoYears(s, 12, (g) => {
      reps.push(g.reputation);
      for (const st of enrolled(g)) { const l = CLASSES[st.classId]?.line ?? '?'; lines[l] = (lines[l] ?? 0) + 1; total += 1; }
    });
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
    expect(t.version).toBe(24);
  });
});
