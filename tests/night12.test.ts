// 12夜目：戦技と心得・11夜目版のセーブ（形式11）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, finishBattle } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { SAVE_VERSION, RANK_POINTS, SKILLS } from '../src/data/balance';
import { ART_LIST, ARTS, ART_SLOTS } from '../src/data/arts';
import { learnArts, canLearn, toggleArt, equippedOf, officerArts, pickArt } from '../src/core/arts';
import { ABILITIES } from '../src/data/abilities';
import { unitFromStudent } from '../src/core/battle/setup';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const mk = (seed = 1) => newGame({ name: 'テスト', background: 'knight', seed });
setAutoChoicePick(humanLikePick(5));

describe('11夜目版のセーブ（形式11）', () => {
  for (const f of ['v11-day.json', 'v11-auto.json', 'v11-result.json']) {
    it(`${f}：今の技能ランクまでの技を覚えた状態（演出なし）。1年遊べる`, () => {
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      const list = enrolled(s);
      expect(list.some((st) => (st.arts ?? []).length > 0)).toBe(true);
      for (const st of list) for (const a of ART_LIST) if (!a.bloom) expect((st.arts ?? []).includes(a.id)).toBe(canLearn(st, a));
      expect(s.pending.some((p) => p.type === 'art')).toBe(false);
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s); autoYears(s, 1);
      expect(s.gameOver).toBe(false);
    });
  }
});

describe('戦技と心得', () => {
  it('すべての技能に、E+〜Sで技がある。心得は固有スキルとして登録', () => {
    for (const k of SKILLS) for (const r of ['E+', 'D', 'C', 'B', 'A', 'S']) expect(ART_LIST.some((a) => a.skill === k && a.rank === r && !a.bloom)).toBe(true);
    for (const a of ART_LIST.filter((x) => x.kind === 'mind')) expect(ABILITIES[a.id]).toBeTruthy();
  });
  it('得意な技能は1つ前のランクで覚える。覚えると演出が積まれ、付けかえはおまかせ（上限つき）', () => {
    const s = mk(31); s.pending = [];
    const st = enrolled(s)[0];
    st.arts = []; st.artsOn = []; st.apt = { good: ['sword'], bad: [] };
    st.skills.sword = RANK_POINTS.C;
    learnArts(s, st, true);
    expect(st.arts).toContain('sw_art2'); // B の技を C で
    expect(st.arts).not.toContain('sw_mind3');
    expect(s.pending.some((p) => p.type === 'art' && p.studentId === st.id)).toBe(true);
    const eq = equippedOf(st);
    expect(eq.filter((a) => a.kind === 'art').length).toBeLessThanOrEqual(ART_SLOTS.art);
    expect(eq.filter((a) => a.kind === 'mind').length).toBeLessThanOrEqual(ART_SLOTS.mind);
    const before = (st.artsOn ?? []).length;
    toggleArt(st, st.artsOn![0]);
    expect((st.artsOn ?? []).length).toBe(before - 1);
    expect(st.artsManual).toBe(true);
  });
  it('戦技は戦いで使われ、記録に技の名前が残る。敵将も使い手', () => {
    const s = mk(32);
    autoYears(s, 3);
    const st = enrolled(s).find((x) => equippedOf(x).some((a) => a.kind === 'art'));
    expect(st).toBeTruthy();
    const u = unitFromStudent(st!, 'player', 'p0', 0, 0, ['iron_sword']);
    expect((u.arts ?? []).length).toBeGreaterThan(0);
    const d = { ...u, uid: 'e', side: 'enemy', boss: true, hp: 5, maxHp: 30 } as typeof u;
    let used = 0;
    for (let i = 0; i < 50; i++) if (pickArt(u, d, 'sword', 10, () => (i % 10) / 10, () => 'infantry')) used++;
    expect(used).toBeGreaterThan(0);
    const o = (s.officers ?? []).find((x) => x.kind !== 'monster')!;
    expect(officerArts(o, s).length).toBeGreaterThan(0);
    for (const id of officerArts(o, s)) expect(ARTS[id].kind).toBe('art');
  });
});
