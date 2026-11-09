// 16夜目：生徒ごとに覚える技（覚える表）・条件で効くスキル・札の戦い・15夜目版のセーブ
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, finishBattle } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { SAVE_VERSION } from '../src/data/balance';
import { ART_LIST, ARTS, ART_MILESTONES } from '../src/data/arts';
import { makeArtPlan, canLearn, artsOf, plannedArts } from '../src/core/arts';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
setAutoChoicePick(humanLikePick(5));

describe('生徒ごとに覚える技（覚える表）', () => {
  it('技能×節目ごとに3〜5通りの候補があり、全体で250種以上', () => {
    const skills = [...new Set(ART_LIST.map((a) => a.skill))];
    expect(skills.length).toBe(12);
    for (const k of skills) for (const r of ART_MILESTONES) {
      const n = ART_LIST.filter((a) => a.skill === k && a.rank === r && !a.bloom).length;
      expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(5);
    }
    expect(ART_LIST.length).toBeGreaterThanOrEqual(250);
    // 条件で効くスキルが混ざっている
    expect(ART_LIST.filter((a) => a.cond).length).toBeGreaterThanOrEqual(30);
    expect(new Set(ART_LIST.filter((a) => a.cond).map((a) => a.cond)).size).toBe(5);
  });
  it('入学のときに表が決まり、生徒によって覚える技が違う。表にない技は覚えない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 16, start: 'normal' });
    const sts = enrolled(s);
    for (const st of sts) expect(st.artPlan).toBeTruthy();
    const plans = sts.map((st) => st.artPlan!['sword:D']);
    expect(new Set(plans).size).toBeGreaterThan(1);
    autoYears(s, 2);
    for (const st of Object.values(s.students)) for (const id of artsOf(st)) {
      const a = ARTS[id];
      const inp = st.artPlan![`${a.skill}:${a.bloom ? 'bloom' : a.rank}`] === id || (st.taught ?? []).includes(id);
      expect(inp).toBe(true);
    }
    // 同じidの子なら、いつ作っても同じ表
    const st = sts[0];
    expect(makeArtPlan(st)).toEqual(makeArtPlan(st));
  });
  it('性格・国で選ばれやすさが変わる（血の気の多い子は攻めの技が多い）', () => {
    const base = { id: 'x', given: 'テ', house: 'commoner', dream: 'none', apt: { good: [], bad: [] }, talent: null } as never as Parameters<typeof makeArtPlan>[0];
    let atkHot = 0, atkTimid = 0;
    for (let i = 0; i < 200; i++) {
      const h = makeArtPlan({ ...base, id: `h${i}`, personality: 'hot', origin: 'empire' });
      const t = makeArtPlan({ ...base, id: `t${i}`, personality: 'timid', origin: 'alliance' });
      atkHot += Object.values(h).filter((id) => ARTS[id].style?.includes('atk')).length;
      atkTimid += Object.values(t).filter((id) => ARTS[id].style?.includes('atk')).length;
    }
    expect(atkHot).toBeGreaterThan(atkTimid * 1.5);
  });
  it('秘伝（rare）は得意の技能の子だけ', () => {
    for (let i = 0; i < 100; i++) {
      const p = makeArtPlan({ id: `r${i}`, given: 'テ', personality: 'calm', origin: 'kingdom', house: 'noble', dream: 'none', apt: { good: ['sword'], bad: [] }, talent: null } as never);
      for (const [k, id] of Object.entries(p)) if (ARTS[id].rare) expect(k.startsWith('sword')).toBe(true);
    }
  });
  it('次に覚えそうな技はその子の表から', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 5, start: 'normal' });
    const st = enrolled(s)[0];
    const next = plannedArts(st);
    expect(next.length).toBeGreaterThan(10);
    for (const a of next) expect(canLearn(st, a) || !artsOf(st).includes(a.id)).toBe(true);
  });
});

describe('15夜目版のセーブ（形式15）', () => {
  for (const f of ['v15-day.json', 'v15-auto.json', 'v15-squad.json', 'v15-result.json']) {
    it(`${f}：覚える表ができ、もう覚えた技はそのまま。お知らせが出て1年遊べる`, () => {
      const raw = JSON.parse(fixture(f));
      const before: Record<string, string[]> = Object.fromEntries(Object.values(raw.state.students as Record<string, { id: string; arts?: string[] }>).map((x) => [x.id, x.arts ?? []]));
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(s.pending.some((p) => p.type === 'event' && p.title === '16夜目の新しいこと')).toBe(true);
      for (const st of Object.values(s.students)) {
        expect(st.artPlan).toBeTruthy();
        for (const id of before[st.id] ?? []) expect(st.arts).toContain(id);
        // もう覚えた技は、その節目の技として表に入っている
        for (const id of before[st.id] ?? []) { const a = ARTS[id]; expect(st.artPlan![`${a.skill}:${a.bloom ? 'bloom' : a.rank}`]).toBe(id); }
      }
      const n0 = Object.fromEntries(Object.values(s.students).map((x) => [x.id, (x.arts ?? []).length]));
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s);
      // 読みこんだだけでは、通り過ぎた節目の技を急に覚えない
      for (const st of Object.values(s.students)) if (st.status !== 'enrolled') expect((st.arts ?? []).length).toBe(n0[st.id]);
      autoYears(s, 1);
      expect(s.gameOver).toBe(false);
    });
  }
});
