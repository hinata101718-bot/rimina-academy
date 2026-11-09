// 18夜目：技の夜（⓪ 札の画面と案内、① スキル、② 技の進化、③ 連携技）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { battleCtx, finishBattle, startSortie, chooseLesson } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { skipAuto } from '../src/core/battle/auto';
import { onCardsOpen, answerGuideOffer } from '../src/core/battle/cardGuide';
import { SAVE_VERSION } from '../src/data/balance';
import { ART_LIST, ARTS, ART_SLOTS, skillKey } from '../src/data/arts';
import { makeArtPlan, ensureArtPlan, artsOf, loadoutOf } from '../src/core/arts';
import type { GameState } from '../src/core/state';

const fixture = (f: string) => readFileSync(`tests/fixtures/${f}`, 'utf8');
setAutoChoicePick(humanLikePick(9));
/** 次の札の戦い（教官が見る1戦）まで進める */
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

describe('⓪ 札の戦いの案内（お知らせ）が確実に出る', () => {
  it('17夜目版のセーブは、案内に答えたことがなければ、次の札の戦いの1ターン目に必ず出る（顔ぶれが少なくても）', () => {
    for (const f of ['v17-day.json', 'v17-result.json']) {
      const raw = JSON.parse(fixture(f));
      raw.state.cardGuide = 'done'; // 17夜目では出ないまま done になっていたことがある
      const s = deserialize(JSON.stringify(raw));
      expect(s.cardGuide).toBe('pending');
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      toNextBattle(s);
      const cs = s.battle!.auto!.cards!;
      if (cs.turn === 1 && cs.phase === 'play') {
        onCardsOpen(s);
        expect(cs.guideOffer || !!cs.guide).toBe(true);
        if (cs.guideOffer) { answerGuideOffer(s, false); expect(s.cardGuide).toBe('done'); expect(s.cardGuideSeen).toBe(true); }
      }
    }
  });
  it('一度答えたセーブは、読みこみ直しても出ない', () => {
    const raw = JSON.parse(fixture('v17-day.json'));
    raw.state.cardGuide = 'done'; raw.state.cardGuideSeen = true;
    const s = deserialize(JSON.stringify(raw));
    expect(s.cardGuide).toBe('done');
  });
});

describe('① スキルを少なく、強く、違うものに', () => {
  it('スキルは72個・効果は40種以上。同じ効果は技能をまたいでも2つまで。札になるスキルはない。つけられるのは3つ', () => {
    const sk = ART_LIST.filter((a) => a.kind === 'mind');
    expect(sk.length).toBe(72);
    const by = new Map<string, number>();
    for (const a of sk) by.set(skillKey(a), (by.get(skillKey(a)) ?? 0) + 1);
    expect(by.size).toBeGreaterThanOrEqual(40);
    expect([...by.values()].every((n) => n <= 2)).toBe(true);
    expect(sk.filter((a) => a.card).length).toBe(0);
    expect(ART_SLOTS.mind).toBe(3);
    // 「盾となる将」「かばう」は戦技と魔法の欄（札）
    expect(ARTS.co_m1d.kind).toBe('art'); expect(ARTS.he_m1b.kind).toBe('art');
  });
  it('技・スキルの名前は重ならない', () => {
    const names = ART_LIST.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it('覚える表：いろいろな子で、同じ効果のスキルが1人の表に2つ入らない', () => {
    const P = ['hot', 'competitive', 'cheerful', 'calm', 'serious', 'timid', 'shy', 'gentle', 'cynic', 'whimsical'];
    const O = ['kingdom', 'empire', 'alliance', 'frontier'];
    let n = 0;
    for (let i = 0; i < 600; i++) {
      const st = { id: `t${i}`, given: `子${i}`, personality: P[i % P.length], origin: O[i % O.length], house: ['noble', 'commoner', 'orphan'][i % 3], dream: 'none', apt: { good: [['sword', 'lance', 'bow', 'magic'][i % 4]], bad: [] }, talent: null } as never;
      const p = makeArtPlan(st);
      const ks = Object.values(p).map((id) => ARTS[id]).filter((a) => a?.kind === 'mind').map(skillKey);
      expect(ks.length).toBe(36);
      expect(new Set(ks).size).toBe(ks.length);
      n++;
    }
    expect(n).toBe(600);
  });
  it('17夜目版のセーブ（形式17）4種：読みこめて、表と覚えたスキルに同じ効果の重なりがなく、つけているスキルは3つまで。1年遊べる', () => {
    for (const f of ['v17-day.json', 'v17-cards.json', 'v17-squad.json', 'v17-result.json']) {
      const raw = JSON.parse(fixture(f));
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(SAVE_VERSION).toBe(18);
      expect(s.pending.some((p) => p.type === 'event' && p.title === '18夜目の新しいこと')).toBe(true);
      for (const st of [...Object.values(s.students), ...s.applicants]) {
        const ks = Object.values(ensureArtPlan(st)).map((id) => ARTS[id]).filter((a) => a?.kind === 'mind').map(skillKey);
        expect(new Set(ks).size).toBe(ks.length);
        const ls = artsOf(st).map((id) => ARTS[id]).filter((a) => a?.kind === 'mind').map(skillKey);
        expect(new Set(ls).size).toBe(ls.length);
        for (const id of artsOf(st)) expect(ARTS[id] || id).toBeTruthy();
        expect(loadoutOf(st).filter((id) => ARTS[id]?.kind === 'mind').length).toBeLessThanOrEqual(3);
      }
      // 札の戦いの途中のセーブは、そのまま続きから
      if (raw.state.battle?.auto?.cards) { expect(s.battle?.auto?.cards?.turn).toBe(raw.state.battle.auto.cards.turn); }
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s);
      autoYears(s, 1);
      expect(s.gameOver).toBe(false);
      expect(enrolled(s).length).toBeGreaterThan(0);
    }
  });
  it('新しいゲームを2年：全員の表と覚えたスキルに重なりがない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 1801, start: 'normal' });
    autoYears(s, 2);
    for (const st of Object.values(s.students)) {
      const ls = artsOf(st).map((id) => ARTS[id]).filter((a) => a?.kind === 'mind').map(skillKey);
      expect(new Set(ls).size).toBe(ls.length);
    }
  });
});
