// 会話のテスト：すべての会話を、全性格の組み合わせ・家柄・夢・出身・関係で組み立てて、空の行や差し込み忘れがないか確かめる
import { describe, it, expect } from 'vitest';
import { newGame, enrolled } from '../src/core/game';
import { rng, nextWeek } from '../src/core/flow';
import { TALKS } from '../src/data/talks';
import { INTERVIEWS } from '../src/data/talks/interviews';
import { TEACHER_PHRASES } from '../src/data/talks/interviews';
import { renderLines, getSupport, buildTalk, archiveOf, adaptPronoun, phraseFallbacks } from '../src/core/support';
import { buildInterview, buildInterviewDef, chooseReply, specialInterview, interviewCandidates, interviewFlags } from '../src/core/interview';
import { PERSONALITY_IDS } from '../src/data/people';
import type { GameState, Student } from '../src/core/state';
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
  // 卒業生の先生・2代目・恋人・生きている卒業生を、まとめてつける／外す
  function setWorld(s: GameState, on: boolean) {
    const [st, love, grad] = enrolled(s);
    if (on) {
      s.instructor.studentId = 'old_student'; s.instructor.generation = 2;
      s.pastInstructors = [{ name: 'セオドア', background: 'knight', generation: 1, from: 1, to: 4, age: 50, taught: 3 }];
      getSupport(s, st.id, love.id).kind = 'love';
      grad.status = 'graduated'; grad.grade = 0;
      grad.career = { kind: 'army', country: 'kingdom', path: 'warrior', rank: 1, rankYears: 0, growthMul: 1, front: false, alive: true, retired: false, injuredYears: 0 };
    } else {
      s.instructor.studentId = undefined; s.instructor.generation = 1; s.pastInstructors = [];
      getSupport(s, st.id, love.id).kind = 'friend';
      grad.status = 'enrolled'; grad.grade = 1; grad.career = null;
    }
    return { st, love, grad };
  }
  it('全種類（選択肢も）×全性格×4つの経歴×卒業生の先生あり・なしで、空の行・差し込み忘れがない', () => {
    const houses: House[] = ['noble', 'commoner', 'orphan'];
    const flagSets = [['reason_family', 'cleared'], ['reason_poach'], ['reason_homewar'], ['reason_motivation'], ['s_study'], ['s_tired'], ['s_home'], ['s_friend']];
    phraseFallbacks.count = 0; phraseFallbacks.keys.clear();
    let n = 0;
    for (const bg of ['knight', 'merc', 'mage', 'wanderer']) {
      const s = newGame({ name: 'テスト', background: bg, seed: 5 });
      for (const on of [false, true]) {
        const { st, love, grad } = setWorld(s, on);
        for (const p of PERSONALITY_IDS) {
          st.personality = p;
          for (const d of INTERVIEWS) for (const flags of flagSets) {
            const v = n++;
            st.house = houses[v % 3]; st.dream = v % 2 ? 'peace' : 'none'; st.fatigue = v % 4 ? 0 : 60;
            s.world.tension = [20, 50, 80][v % 3];
            const t = buildInterviewDef(s, rng(s), st, d, flags);
            const all = [...t.lines, ...(t.choice?.options.flatMap((o) => o.lines) ?? [])];
            for (const l of all) if (bad(l.text)) throw new Error(`${d.id} ${bg} ${p} 卒業生の先生${on ? 'あり' : 'なし'}: 「${l.text}」`);
            for (const o of t.choice?.options ?? [{ lines: [] }]) {
              const spoken = [...t.lines, ...o.lines].filter((l) => l.by !== 'narr').length;
              expect(spoken).toBeGreaterThanOrEqual(8);
              expect(spoken).toBeLessThanOrEqual(12);
            }
            if (on && d.id === 'recent_love') expect(all.some((l) => l.text.includes(love.given))).toBe(true);
            if (on && d.id === 'recent_senior') expect(all.some((l) => l.text.includes(grad.given))).toBe(true);
            if (on && d.id === 'recent_prev') expect(all.some((l) => l.text.includes('セオドア先生'))).toBe(true);
          }
        }
      }
    }
    expect([...phraseFallbacks.keys].filter((k) => k.startsWith('iv')).sort()).toEqual([]);
  });
  it('卒業生の先生は、卒業生としての言い回しで話す', () => {
    const s = newGame({ name: 'テスト', background: 'mage', seed: 9 });
    const past = INTERVIEWS.find((d) => d.id === 'recent_past')!;
    const { st } = setWorld(s, false);
    const plain = buildInterviewDef(s, rng(s), st, past).lines.filter((l) => l.by === 'teacher').map((l) => l.text);
    setWorld(s, true);
    const alum = buildInterviewDef(s, rng(s), st, past).lines.filter((l) => l.by === 'teacher').map((l) => l.text);
    expect(alum).not.toEqual(plain);
    expect(alum.some((x) => x.includes('この学校の生徒'))).toBe(true);
    expect(plain.some((x) => x.includes('この学校の生徒'))).toBe(false);
    // 卒業生用の言い回しは、元の言い回しと対になっている
    for (const k of Object.keys(TEACHER_PHRASES)) if (k.endsWith('_alum')) expect(TEACHER_PHRASES[k.slice(0, -5)]).toBeTruthy();
  });
  it('面談の話題は条件（when）を守って選ばれる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 10 });
    const ids = (st: Student, topic: 'recent' | 'worry') => interviewCandidates(s, st, topic).map((d) => d.id);
    const { st } = setWorld(s, false);
    st.dream = 'none'; st.fatigue = 0; s.world.tension = 10;
    expect(interviewFlags(s, st)).toEqual([]);
    const off = ids(st, 'recent');
    for (const x of ['recent_love', 'recent_senior', 'recent_war', 'recent_prev', 'recent_dream', 'recent_friend']) expect(off).not.toContain(x);
    expect(off).toEqual(expect.arrayContaining(['recent1', 'recent_study', 'recent_letter', 'recent_past']));
    expect(ids(st, 'worry')).not.toContain('worry_tired');
    expect(ids(st, 'worry')).not.toContain('worry_homewar');
    // 何度選んでも、恋人のいない子に恋の相談は出ない
    const r = rng(s);
    for (let i = 0; i < 200; i++) expect(buildInterview(s, r, st, 'recent')!.title).not.toBe('気になる人');
    setWorld(s, true);
    st.dream = 'peace'; st.fatigue = 70; s.world.tension = 90;
    st.recent.push({ type: 'ev_homewar', week: s.absWeek, detail: '' });
    expect(interviewFlags(s, st).sort()).toEqual(['alumni_teacher', 'gen2', 'has_alumni', 'has_love', 'unrest']);
    expect(ids(st, 'recent')).toEqual(expect.arrayContaining(['recent_love', 'recent_senior', 'recent_war', 'recent_prev', 'recent_dream']));
    expect(ids(st, 'worry')).toEqual(expect.arrayContaining(['worry1', 'worry_tired', 'worry_homewar']));
    // 条件を満たすと実際に出てくる（同じ題が続きにくい）
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(buildInterview(s, r, st, 'recent')!.title);
    expect(seen.has('気になる人')).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
  it('返事を選ぶと信頼かやる気が少し変わり、二度は選べない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 6 });
    const st = enrolled(s)[0];
    st.motivation = 1;
    const t = buildInterviewDef(s, rng(s), st, INTERVIEWS.find((d) => d.id === 'worry1')!);
    expect(t.choice?.options.length).toBe(3);
    const trust0 = st.trust;
    chooseReply(s, t, 1);
    expect(st.trust).toBe(trust0 + 3);
    chooseReply(s, t, 0);
    expect(st.motivation).toBe(1);
    expect(s.archive[t.id!].chosen).toBe(1);
  });
  it('悩みの面談はいつも返事を選べる', () => {
    for (const d of INTERVIEWS.filter((x) => x.topic === 'worry')) expect(d.choice?.options.length).toBe(3);
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
