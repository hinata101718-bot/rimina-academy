// 会話のテスト：すべての会話を、全性格の組み合わせ・家柄・夢・出身・関係で組み立てて、空の行や差し込み忘れがないか確かめる
import { describe, it, expect } from 'vitest';
import { newGame, enrolled } from '../src/core/game';
import { rng, nextWeek } from '../src/core/flow';
import { TALKS } from '../src/data/talks';
import { INTERVIEWS } from '../src/data/talks/interviews';
import { renderLines, getSupport, buildTalk, archiveOf, adaptPronoun, phraseFallbacks } from '../src/core/support';
import { buildInterview, chooseReply, specialInterview } from '../src/core/interview';
import { PERSONALITY_IDS } from '../src/data/people';
import type { Student } from '../src/core/state';
import type { House, Origin } from '../src/core/types';

const bad = (t: string) => !t.trim() || /\{\w+\}/.test(t) || /（[a-z_0-9]+）/.test(t);

describe('支援会話の組み立て', () => {
  it('全会話×全性格の組み合わせで、空の行・差し込み忘れがない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 3 });
    const [a, b] = enrolled(s);
    const r = rng(s);
    const houses: House[] = ['noble', 'commoner', 'orphan'];
    const origins: Origin[] = ['kingdom', 'empire', 'frontier'];
    const kinds = ['friend', 'rival', 'love'] as const;
    let n = 0;
    phraseFallbacks.count = 0;
    const fb = new Set<string>();
    for (const t of TALKS) {
      for (const pa of PERSONALITY_IDS) for (const pb of PERSONALITY_IDS) {
        const v = n++;
        a.personality = pa; b.personality = pb;
        a.house = houses[v % 3]; b.house = houses[(v + 1) % 3];
        a.origin = origins[v % 3]; b.origin = origins[(v >> 1) % 3];
        a.dream = v % 2 ? 'peace' : 'none'; b.dream = v % 3 ? 'scholar' : 'none';
        a.knownTraits = ['diligent']; b.knownTraits = ['friendly'];
        const sp = getSupport(s, a.id, b.id);
        sp.kind = kinds[v % 3];
        s.world.tension = [20, 50, 80][v % 3];
        const before = phraseFallbacks.count;
        const lines = renderLines(s, r, t.lines, a, b, sp, '剣');
        if (phraseFallbacks.count > before) fb.add(`${t.id}:${pa}/${pb}`);
        for (const l of lines) if (bad(l.text)) throw new Error(`${t.id} ${pa}/${pb}: 「${l.text}」`);
        expect(lines.length).toBeGreaterThanOrEqual(8);
      }
    }
    expect([...phraseFallbacks.keys].sort()).toEqual([]);
  });
  it('段階が上がると会話が組み立てられ、記録に残る', () => {
    const s = newGame({ name: 'テスト', background: 'mage', seed: 4 });
    const [a, b] = enrolled(s);
    const sp = getSupport(s, a.id, b.id);
    sp.kind = 'friend';
    for (const rank of ['C', 'B', 'A'] as const) {
      const t = buildTalk(s, rng(s), sp, rank);
      expect(t).not.toBeNull();
      const spoken = t!.lines.filter((l) => l.by !== 'narr').length;
      expect(spoken).toBeGreaterThanOrEqual(rank === 'C' ? 8 : rank === 'B' ? 10 : 14);
    }
    expect(archiveOf(s, a).length).toBe(3);
    expect(archiveOf(s, b).length).toBe(3);
  });
  it('一人称は話す人の性別に合わせる', () => {
    const st = { gender: 'f', personality: 'hot' } as Student;
    expect(adaptPronoun('俺がやる', st)).toBe('あたしがやる');
    const m = { gender: 'm', personality: 'timid' } as Student;
    expect(adaptPronoun('わたしも', m)).toBe('ぼくも');
  });
});

describe('面談', () => {
  it('全種類×全性格×4つの経歴で、空の行・差し込み忘れがない', () => {
    for (const bg of ['knight', 'merc', 'mage', 'wanderer']) {
      const s = newGame({ name: 'テスト', background: bg, seed: 5 });
      const st = enrolled(s)[0];
      for (const p of PERSONALITY_IDS) {
        st.personality = p;
        for (const d of INTERVIEWS) for (const flags of [['reason_family', 'cleared'], ['reason_poach'], ['s_study'], ['s_tired'], ['s_home'], ['s_friend']]) {
          const t = buildInterview(s, rng(s), st, d.topic, flags)!;
          const all = [...t.lines, ...(t.choice?.options.flatMap((o) => o.lines) ?? [])];
          for (const l of all) if (bad(l.text)) throw new Error(`${d.id} ${bg} ${p}: 「${l.text}」`);
          const spoken = [...t.lines, ...(t.choice?.options[0].lines ?? [])].filter((l) => l.by !== 'narr').length;
          expect(spoken).toBeGreaterThanOrEqual(8);
          expect(spoken).toBeLessThanOrEqual(12);
        }
      }
    }
  });
  it('返事を選ぶと信頼かやる気が少し変わり、二度は選べない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 6 });
    const st = enrolled(s)[0];
    st.motivation = 1;
    const t = buildInterview(s, rng(s), st, 'worry')!;
    expect(t.choice?.options.length).toBe(3);
    const trust0 = st.trust;
    chooseReply(s, t, 1);
    expect(st.trust).toBe(trust0 + 3);
    chooseReply(s, t, 0);
    expect(st.motivation).toBe(1);
    expect(s.archive[t.id!].chosen).toBe(1);
  });
  it('信頼が40・70・90に届くと特別な面談が1回ずつ起きる', () => {
    const s = newGame({ name: 'テスト', background: 'wanderer', seed: 7 });
    const st = enrolled(s)[0];
    st.trust = 95;
    const titles: string[] = [];
    for (let i = 0; i < 5; i++) { const t = specialInterview(s, rng(s), [st]); if (t) titles.push(t.kind + t.title); }
    expect(titles).toEqual(['special昔の話', 'special本音', 'special約束']);
  });
  it('面談をすると週のまとめに会話がつく', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 8 });
    const st = enrolled(s)[0];
    s.plan.tutoring.push({ studentId: st.id, kind: 'talk' });
    nextWeek(s);
    const p = s.pending.find((x) => x.type === 'weekSummary');
    expect(p && p.type === 'weekSummary' && p.talks.some((t) => t.kind === 'interview' && t.a === st.id)).toBe(true);
  });
});
