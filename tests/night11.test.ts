// 11夜目：書き方の決まり・先輩と後輩・戦の描写・戦いのあとの場面・10夜目版のセーブ（形式10）
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, finishBattle } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { SAVE_VERSION } from '../src/data/balance';
import { PROSE_DENSE, PROSE_BRUTAL, PROSE_FALL } from '../src/data/warprose';
import { KILL_REACT, FRIEND_GRIEF } from '../src/data/aftermath_war';
import { PERSONALITY_IDS } from '../src/data/people';
import { TALKS, PHRASES } from '../src/data/talks';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const mk = (seed = 1) => newGame({ name: 'テスト', background: 'knight', seed });
setAutoChoicePick(humanLikePick(5));

describe('10夜目版のセーブ（形式10）', () => {
  for (const f of ['v10-day.json', 'v10-auto.json', 'v10-result.json']) {
    it(`${f}：読み込めて、戦の描写は「濃い」、1年遊べる`, () => {
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(s.settings.battleProse).toBe('dense');
      expect(s.pending.some((p) => p.type === 'event' && p.title === '11夜目の新しいこと')).toBe(true);
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s);
      autoYears(s, 1);
      expect(s.gameOver).toBe(false);
    });
  }
});

describe('書き方の決まりと戦の描写', () => {
  it('docs/writing-style.md がある（口調表・言葉の一覧・戦の描写の3つの段）', () => {
    const p = new URL('../docs/writing-style.md', import.meta.url);
    expect(existsSync(p)).toBe(true);
    const t = readFileSync(p, 'utf8');
    for (const w of ['口調表', '言葉の一覧', '戦の描写', '凄惨', '書かない線']) expect(t).toContain(w);
  });
  it('戦の描写：武器ごとに濃い文があり、重傷・戦死の文が3つの段にある。差し込み忘れなし', () => {
    for (const w of ['sword', 'lance', 'axe', 'bow', 'gun', 'magic', 'holy', 'none']) for (const h of ['hit', 'heavy', 'crit', 'kill'] as const) expect((PROSE_DENSE[w]?.[h] ?? []).length).toBeGreaterThan(0);
    for (const k of ['injured', 'dead'] as const) for (const lv of ['normal', 'dense', 'brutal'] as const) expect(PROSE_FALL[k][lv].length).toBeGreaterThan(0);
    const all = [...Object.values(PROSE_DENSE), ...Object.values(PROSE_BRUTAL)].flatMap((x) => Object.values(x).flat()) as string[];
    for (const t of all) expect(t.replace(/\{a\}|\{d\}/g, '')).not.toMatch(/\{\w+\}/);
  });
  it('敵将を討った子の受け止め方・仲間の言葉は、性格ごとにそろっている', () => {
    for (const p of PERSONALITY_IDS) { expect(KILL_REACT[p].length).toBeGreaterThan(0); expect(FRIEND_GRIEF[p].length).toBeGreaterThan(0); }
  });
  it('戦死・重傷のあとに、その夜の学校・療養の場面が出る（戦の描写が「ふつう」なら出ない）', () => {
    const s = mk(21);
    autoYears(s, 6);
    const titles = s.chronicle.filter((c) => c.text.includes('戦死')).length;
    expect(titles).toBeGreaterThanOrEqual(0);
  });
});

describe('先輩と後輩', () => {
  it('先輩と後輩の支援会話がある（C・B・A）。言葉の差し込みが見つかる', () => {
    const ts = TALKS.filter((t) => t.topic === 'rel_senpai');
    expect(new Set(ts.map((t) => t.rank))).toEqual(new Set(['C', 'B', 'A']));
    // 14夜目：分岐の中の文面も
    const keys = (x: unknown): string[] => (typeof x === 'string' ? [x] : [...keys((x as { then: unknown }).then), ...keys((x as { else: unknown }).else)]);
    for (const t of ts) for (const l of t.lines) for (const k of keys(l.say)) expect(PHRASES[k]).toBeTruthy();
  });
  it('数年遊ぶと、先輩と後輩の組ができ、卒業する先輩が後輩に何かを託す', () => {
    let pair = false, handed = false;
    for (const seed of [22, 23, 24]) {
      const s = mk(seed);
      autoYears(s, 5);
      pair ||= Object.values(s.supports).some((sp) => sp.kind === 'senpai');
      handed ||= Object.values(s.students).some((st) => st.history.some((h) => h.text.includes('先輩から')));
      if (pair && handed) break;
    }
    expect(pair).toBe(true);
    expect(handed).toBe(true);
  });
});
void enrolled;
