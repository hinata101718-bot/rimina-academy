// 15夜目：片づけ（書状のまとめ・教官手帳・声をかけるのおまかせ・道具の自動補充・兵種試験・14夜目版のセーブ）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled, importantUnread, readAllMail, mailImportant } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, finishBattle } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { SAVE_VERSION } from '../src/data/balance';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
setAutoChoicePick(humanLikePick(5));

describe('14夜目版のセーブ（形式14）', () => {
  for (const f of ['v14-day.json', 'v14-auto.json', 'v14-squad.json', 'v14-result.json']) {
    it(`${f}：お知らせが出て、たまった書状は読んだことになり（大事な知らせは残る）、1年遊べる`, () => {
      const raw = JSON.parse(fixture(f));
      const before = raw.state.mail.filter((m: { read: boolean }) => !m.read).length;
      expect(before).toBeGreaterThan(50);
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(s.pending.some((p) => p.type === 'event' && p.title === '15夜目の片づけ')).toBe(true);
      expect(s.mail.filter((m) => !m.read).every((m) => mailImportant(m))).toBe(true);
      expect(s.spotlight.every((sp) => sp.done)).toBe(true);
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s); autoYears(s, 1);
      expect(s.gameOver).toBe(false);
    });
  }
});

describe('書状のまとめ', () => {
  it('誕生日の便りは月に1通まで。赤い数字は大事な知らせだけ。「すべて読んだ」で0になる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 15, start: 'normal' });
    autoYears(s, 3);
    const byMonth = new Map<string, number>();
    for (const m of s.mail) if (m.title === '誕生日のお祝い' || m.title.startsWith('今月の誕生日')) byMonth.set(`${m.year}-${m.month}`, (byMonth.get(`${m.year}-${m.month}`) ?? 0) + 1);
    expect(byMonth.size).toBeGreaterThan(3);
    expect([...byMonth.values()].every((n) => n === 1)).toBe(true);
    const merged = s.mail.find((m) => m.parts && m.parts.length > 1);
    expect(merged?.title).toMatch(/今月の誕生日 \d人/);
    const unread = s.mail.filter((m) => !m.read).length;
    expect(importantUnread(s).length).toBeLessThan(unread);
    expect(importantUnread(s).every((m) => mailImportant(m))).toBe(true);
    readAllMail(s);
    expect(importantUnread(s).length).toBe(0);
  });
});

describe('今月の主役（声をかけるのおまかせ）', () => {
  it('月のはじめに、先生が自動で声をかける', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 7, start: 'normal' });
    autoYears(s, 1);
    expect(s.spotlight.length).toBeGreaterThan(0);
    for (const sp of s.spotlight) { expect(sp.done).toBe(true); expect(sp.res).toBeTruthy(); }
    expect(enrolled(s).length).toBeGreaterThan(0);
  });
});

describe('道具の自動補充', () => {
  it('毎月のはじめに傷薬と特効薬が決まった数まで戻る（お金が少ないときは補充しない）', async () => {
    const { restockItems } = await import('../src/core/teachers');
    const { B } = await import('../src/data/balance');
    const s = newGame({ name: 'テスト', background: 'knight', seed: 3, start: 'normal' });
    s.items = { vulnerary: 0, elixir: 0 }; s.money = 5000;
    const spent = restockItems(s);
    expect(s.items).toEqual({ vulnerary: B.restock.vulnerary, elixir: B.restock.elixir });
    expect(spent).toBe(B.restock.vulnerary * B.itemPrice.vulnerary + B.restock.elixir * B.itemPrice.elixir);
    s.items = { vulnerary: 0, elixir: 0 }; s.money = B.restock.keep;
    expect(restockItems(s)).toBe(0);
    autoYears(s, 1);
    expect(s.gameOver).toBe(false);
  });
});

describe('兵種試験（2タップ）', () => {
  it('条件がそろえば、選んだ兵種に必ずなる（受験の画面をはさまない）', async () => {
    const { nextClasses, classUnlocked, meetsReq, takeExam, canTakeExam } = await import('../src/core/exam');
    const { rng } = await import('../src/core/flow');
    const { SKILLS, RANK_POINTS } = await import('../src/data/balance');
    const s = deserialize(fixture('v14-day.json'));
    s.pending = [];
    const st = enrolled(s).find((x) => nextClasses(s, x).length > 0)!;
    st.level = 30; for (const k of SKILLS) st.skills[k] = RANK_POINTS.A; st.examMonth = -1; st.injuredWeeks = 0;
    expect(canTakeExam(s, st)).toBe(true);
    const c = nextClasses(s, st).find((x) => classUnlocked(s, x) && meetsReq(st, x))!;
    const r = takeExam(s, rng(s), st, c.id);
    expect(r.ok).toBe(true);
    expect(s.students[st.id].classId).toBe(c.id);
  });
});
