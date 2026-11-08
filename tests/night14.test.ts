// 14夜目：最初の1時間の案内・1年の振り返り・武器のレアリティ・引き継ぎの文字・13夜目版のセーブ（形式13）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { battleCtx, finishBattle, chooseLesson, startSortie } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { todayCards, recommendCard } from '../src/core/lessons';
import { stratSlots } from '../src/core/stratagems';
import { SAVE_VERSION } from '../src/data/balance';
import { replayGuide, skipTutorial, deskTourStep } from '../src/core/tutorial';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
setAutoChoicePick(humanLikePick(5));

describe('13夜目版のセーブ（形式13）', () => {
  for (const f of ['v13-day.json', 'v13-auto.json', 'v13-result.json']) {
    it(`${f}：お知らせが出て、案内は出ず、1年遊べる`, () => {
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(s.pending.some((p) => p.type === 'event' && p.title === '14夜目の新しいこと')).toBe(true);
      expect(s.tutorial).toBeUndefined();
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s); autoYears(s, 1);
      expect(s.gameOver).toBe(false);
      expect(s.pending.some((p) => p.type === 'guide')).toBe(false);
    });
  }
});

describe('最初の1時間の案内', () => {
  /** 4月の月末の依頼まで、おすすめの札で進める。出た案内を順に返す */
  const toBoard = (seed: number) => {
    const s = newGame({ name: 'テスト', background: 'knight', seed, tutorial: true });
    const seen: string[] = [];
    const day1 = todayCards(s).cards.map((c) => c.id);
    let g = 0;
    while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 40) {
      todayCards(s); chooseLesson(s, recommendCard(s));
      for (const p of s.pending) if (p.type === 'guide') seen.push(p.key); else if (p.type === 'talk' && p.talk.title === '入学して一週目') seen.push('firstTalk');
      if (!s.pending.some((p) => p.type === 'questBoard')) s.pending = [];
    }
    return { s, seen, day1 };
  };
  it('新しく始めると、机の案内・3枚だけの1日目・最初の面談・はじめての説明が順に出る', () => {
    const { s, seen, day1 } = toBoard(11);
    expect(day1.length).toBe(3);
    expect(day1).not.toContain('rest');
    expect(seen.slice(0, 4)).toEqual(['lesson1', 'firstTalk', 'interview', 'target']);
    expect(seen).toContain('quest');
    // 2日目からは5枚＋休講
    expect(s.quests.length).toBe(1);
    expect(s.quests[0].tutorial).toBe(true);
  });
  it('最初の戦いは負けず、戦死しない。策は1枚、判断は1回、レベルアップと戦利品を一度は見せる', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { s } = toBoard(seed);
      expect(stratSlots(s)).toBe(1);
      startSortie(s, recommendSquads(s));
      let calls = 0;
      for (let i = 0; i < 3 && s.battle; i++) { skipAuto(s, battleCtx(s), (c) => { calls++; return c.recommended; }); finishBattle(s); }
      const res = s.pending.find((p) => p.type === 'battleResult');
      expect(res && res.type === 'battleResult' && res.win).toBe(true);
      expect(calls).toBeLessThanOrEqual(1);
      expect(s.stats.deaths).toBe(0);
      if (res?.type === 'battleResult') {
        expect((res.loot ?? []).length).toBeGreaterThan(0);
        expect((res.growth ?? []).some((x) => x.lv1 > x.lv0)).toBe(true);
      }
      expect(s.pending.some((p) => p.type === 'guide' && p.key === 'afterBattle')).toBe(true);
      // 5月からはふつうの依頼
      expect(s.month).toBe(1);
      expect(s.quests.some((q) => q.tutorial)).toBe(false);
      expect(todayCards(s).cards.length).toBeGreaterThanOrEqual(5);
    }
  });
  it('案内を飛ばすと、机の案内も説明も出ない。「案内を見なおす」でまた出る', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 3, tutorial: true });
    expect(deskTourStep(s)).not.toBeNull();
    skipTutorial(s);
    expect(deskTourStep(s)).toBeNull();
    expect(s.quests.some((q) => q.tutorial)).toBe(false);
    todayCards(s); chooseLesson(s, 0);
    expect(s.pending.some((p) => p.type === 'guide')).toBe(false);
    replayGuide(s);
    expect(s.tutorial!.seen).toEqual([]);
    expect(deskTourStep(s)).not.toBeNull();
  });
  it('案内つきで始めても、1年目を最後まで遊べる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 8, tutorial: true });
    autoYears(s, 2);
    expect(s.gameOver).toBe(false);
    expect(s.year).toBe(3);
    expect(enrolled(s).length).toBeGreaterThan(0);
  });
});
