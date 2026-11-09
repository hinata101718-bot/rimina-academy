// 17夜目：札の戦いの案内（最初の依頼は案内つきの1戦、今のセーブは「戦い方が新しくなりました」）・遊び方の手引き・16夜目版のセーブ
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { todayCards, recommendCard } from '../src/core/lessons';
import { recommendSquads, autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie, battleCtx, finishBattle, chooseLesson } from '../src/core/flow';
import { playCardTurn, skipAuto } from '../src/core/battle/auto';
import { onCardsOpen, answerGuideOffer, guideStage, guideNext, skipCardGuide, endCardGuide, startCardGuide } from '../src/core/battle/cardGuide';
import { replayGuide, skipTutorial } from '../src/core/tutorial';
import { SAVE_VERSION } from '../src/data/balance';
import { CARD_MANUAL, CARD_GUIDE } from '../src/data/cardGuide';
import type { GameState } from '../src/core/state';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
setAutoChoicePick(humanLikePick(5));

/** 4月の月末の依頼（案内つき）まで進めて、出撃する */
function toTutorialBattle(seed: number): GameState {
  const s = newGame({ name: 'テスト', background: 'knight', seed, tutorial: true });
  let g = 0;
  while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 40) {
    todayCards(s); chooseLesson(s, recommendCard(s));
    if (!s.pending.some((p) => p.type === 'questBoard')) s.pending = [];
  }
  s.pending = [];
  startSortie(s, recommendSquads(s));
  return s;
}
/** 次の月末の戦いまで進めて、出撃する（ふつうの依頼） */
function toNextBattle(s: GameState): void {
  let g = 0;
  while (!s.battle && g++ < 400) {
    const i = s.pending.findIndex((p) => p.type === 'questBoard');
    if (i >= 0) { s.pending.splice(i, 1); startSortie(s, recommendSquads(s)); break; }
    autoPending(s);
    if (s.battle) break;
    todayCards(s); chooseLesson(s, recommendCard(s));
  }
}

describe('最初の札の戦いは案内つき', () => {
  it('新しく始めた4月の終わりの戦いで、①予告 ②かばう ③攻める の順に案内が出て、言われた札だけ押せる', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = toTutorialBattle(seed);
      expect(s.cardGuide).toBe('pending');
      const b = s.battle!; const cs = b.auto!.cards!;
      expect(cs.phase).toBe('play'); expect(cs.turn).toBe(1);
      onCardsOpen(s);
      const g = cs.guide!;
      expect(g, `seed ${seed}`).toBeTruthy();
      expect(s.cardGuide).toBe('done');
      expect(cs.guideOffer).toBeFalsy();
      // ① 予告：1人が大振りで狙われる子を、ほかの敵は様子をうかがう
      expect(guideStage(b, [])).toBe('intent');
      const big = cs.intents.filter((it) => it.act === 'big');
      expect(big.length).toBe(1);
      expect(big[0].uid).toBe(g.foe); expect(big[0].target).toBe(g.ward);
      expect(cs.intents.filter((it) => it.uid !== g.foe).every((it) => it.act === 'wait')).toBe(true);
      guideNext(b);
      // ② かばう札 ③ 攻める札が手札にあり、行動力で2枚とも出せる
      expect(guideStage(b, [])).toBe('cover');
      expect(cs.hand).toContain(g.cover); expect(cs.hand).toContain(g.atk);
      expect(cs.hand.length).toBeLessThanOrEqual(cs.handSize);
      const cv = cs.cards[g.cover], ak = cs.cards[g.atk];
      expect(cv.fx.type).toBe('guard'); expect(cv.fx.cover).toBe(true); expect(cv.owner).toBe(g.coverBy);
      expect(ak.fx.type).toBe('atk'); expect(ak.owner).not.toBe(g.coverBy);
      expect((cv.fx.cost ?? 1) + (ak.fx.cost ?? 1)).toBeLessThanOrEqual(cs.ap);
      expect(guideStage(b, [g.cover])).toBe('atk');
      expect(guideStage(b, [g.cover, g.atk])).toBe('play');
      // 出す：かばう → 攻める → 敵の大振りはかばった子が受ける
      const wardHp = b.units.find((u) => u.uid === g.ward)!.hp;
      playCardTurn(s, [g.cover, g.atk], cs.target, battleCtx(s));
      const lines = cs.turns[0].lines.map((l) => l.text).join('\n');
      expect(lines, `seed ${seed}\n${lines}`).toContain('の大振り！');
      expect(lines, `seed ${seed}\n${lines}`).toContain('がかばう！');
      expect(b.units.find((u) => u.uid === g.ward)!.hp).toBe(wardHp);
      expect(cs.guide!.step).toBe('after');
      // 案内のために足した札は、山札・捨て札に残らない
      for (const id of cs.guide!.temp) { expect(cs.deck).not.toContain(id); expect(cs.discard).not.toContain(id); expect(cs.hand).not.toContain(id); }
      endCardGuide(b);
      expect(cs.guide).toBeUndefined();
      // そのあとはふつう。負けない・戦死なし
      for (let i = 0; i < 3 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      const res = s.pending.find((p) => p.type === 'battleResult');
      expect(res && res.type === 'battleResult' && res.win).toBe(true);
      expect(s.stats.deaths).toBe(0);
    }
  });
  it('飛ばすと、敵の動きと手札がもとに戻る。次の戦いには出ない', () => {
    const s = toTutorialBattle(3);
    const cs = s.battle!.auto!.cards!;
    const before = { intents: JSON.stringify(cs.intents), hand: [...cs.hand], deck: [...cs.deck], n: Object.keys(cs.cards).length };
    onCardsOpen(s);
    expect(cs.guide).toBeTruthy();
    skipCardGuide(s.battle!);
    expect(cs.guide).toBeUndefined();
    expect(JSON.stringify(cs.intents)).toBe(before.intents);
    expect(cs.hand).toEqual(before.hand); expect(cs.deck).toEqual(before.deck);
    expect(Object.keys(cs.cards).length).toBe(before.n);
    expect(s.cardGuide).toBe('done');
    for (let i = 0; i < 3 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
    toNextBattle(s);
    expect(s.battle).toBeTruthy();
    onCardsOpen(s);
    expect(s.battle!.auto!.cards!.guide).toBeFalsy();
    expect(s.battle!.auto!.cards!.guideOffer).toBeFalsy();
  });
  it('案内を飛ばして始めたゲームには出ない。設定の「案内を見なおす」で次の戦いに出る', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 4, tutorial: true });
    skipTutorial(s);
    expect(s.cardGuide).toBe('done');
    replayGuide(s);
    expect(s.cardGuide).toBe('pending');
  });
  it('案内の文：差しこむ名前の印がそろっている。手引きは7つ、どれも短い', () => {
    for (const k of ['intent', 'cover', 'atk', 'play', 'after'] as const) expect(CARD_GUIDE[k].text.length).toBeLessThan(140);
    expect(CARD_MANUAL.map((p) => p.title)).toEqual(['行動力', '敵の予告', '前列と後列', 'かばう', '策の札と地形', '信頼', 'おまかせで札を出す']);
    for (const p of CARD_MANUAL) { expect(p.lines.length).toBeLessThanOrEqual(2); for (const l of p.lines) expect(l.length).toBeLessThan(70); }
  });
});

describe('16夜目版のセーブ（形式16）', () => {
  for (const f of ['v16-day.json', 'v16-auto.json', 'v16-squad.json', 'v16-result.json']) {
    it(`${f}：読みこめて、次の戦いのはじめに1回だけ「戦い方が新しくなりました」。1年遊べる`, () => {
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(SAVE_VERSION).toBe(17);
      expect(s.cardGuide).toBe('pending');
      // 戦いの途中のセーブ：1ターン目の札を選ぶところなら、そこで出る
      if (!s.battle) toNextBattle(s);
      const b = s.battle!;
      expect(b).toBeTruthy();
      const cs = b.auto!.cards!;
      if (cs.turn === 1 && cs.phase === 'play') {
        onCardsOpen(s);
        expect(cs.guideOffer).toBe(true);
        expect(cs.guide).toBeFalsy();
        // 「案内を見る」：同じ案内が出る
        answerGuideOffer(s, true);
        expect(cs.guideOffer).toBeFalsy();
        expect(s.cardGuide).toBe('done');
        expect(cs.guide?.step).toBe('intent');
        // 2回目は出ない
        onCardsOpen(s);
        expect(cs.guideOffer).toBeFalsy();
      }
      autoYears(s, 1);
      expect(s.gameOver).toBe(false);
      expect(enrolled(s).length).toBeGreaterThan(0);
    });
  }
  it('「飛ばす」を選ぶと案内は出ず、次の戦いにも出ない', () => {
    const s = deserialize(fixture('v16-day.json'));
    toNextBattle(s);
    const cs = s.battle!.auto!.cards!;
    onCardsOpen(s);
    expect(cs.guideOffer).toBe(true);
    const hand = [...cs.hand];
    answerGuideOffer(s, false);
    expect(cs.guide).toBeFalsy(); expect(cs.hand).toEqual(hand);
    expect(s.cardGuide).toBe('done');
    expect(startCardGuide(s, s.battle!)).toBe(true); // 手で始めることはできる（テスト用）
  });
});
