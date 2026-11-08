// 14夜目：最初の1時間の案内・1年の振り返り・武器のレアリティ・引き継ぎの文字・13夜目版のセーブ（形式13）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick, recommendSquads, autoCareerPlans } from '../src/core/autoplay';
import { battleCtx, finishBattle, chooseLesson, startSortie, finishCareers } from '../src/core/flow';
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

describe('1年の振り返り', () => {
  it('年度末に、見出しつきの振り返りができ、年鑑に残る。卒業式のあとに出る', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 21, startGrade: 3 });
    let order: string[] = [];
    for (let g = 0; g < 3000 && s.year === 1; g++) {
      if (s.pending[0]?.type === 'career') { finishCareers(s, autoCareerPlans(s)); order = s.pending.map((p) => p.type); continue; }
      if (s.month === 11 && s.pending.some((p) => p.type === 'questBoard') && s.pending[0].type !== 'questBoard') { s.pending.shift(); continue; }
      if (s.month === 11 && s.pending[0]?.type === 'questBoard') { startSortie(s, recommendSquads(s)); for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); } continue; }
      if (s.pending.length) { if (s.pending.some((p) => p.type === 'career')) { while ((s.pending[0]?.type as string) !== 'career') s.pending.shift(); continue; } autoPending(s); }
      else { todayCards(s); chooseLesson(s, recommendCard(s)); }
    }
    const rv = s.reviews?.find((x) => x.year === 1);
    expect(rv).toBeTruthy();
    expect(rv!.title).toMatch(/^第1年 ― .+年$/);
    expect(rv!.nums.graduated).toBeGreaterThan(0);
    expect(rv!.nums.battles).toBeGreaterThan(0);
    expect(rv!.grads.length).toBeGreaterThan(0);
    expect(rv!.closing.length).toBeGreaterThan(5);
    expect(order.indexOf('graduation')).toBeLessThan(order.indexOf('yearReview'));
  });
  it('長く遊ぶと、年ごとに1つずつ残る（見出しは何種類かに分かれる）', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 4 });
    autoYears(s, 8);
    expect((s.reviews ?? []).map((x) => x.year)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(s.reviews!.map((x) => x.title.split('―')[1])).size).toBeGreaterThan(2);
  });
  it('古いセーブは、年表から過去の年の分を作る', () => {
    const s = deserialize(fixture('v13-day.json'));
    const years = (s.reviews ?? []).map((x) => x.year);
    expect(years).toEqual([1, 2, 3, 4]);
    expect(s.reviews!.every((x) => x.rebuilt && x.title.startsWith(`第${x.year}年 ― `))).toBe(true);
    expect(s.reviews!.find((x) => x.year === 3)!.grads.length).toBeGreaterThan(0);
  });
});

import { rarityOf, itemName, itemMod, legendFits, ensureLegends, legendLoot, favoriteItem } from '../src/core/rarity';
import { takeLoot, armScore } from '../src/core/loot';
import { LEGENDS } from '../src/data/rarity';

describe('武器のレアリティ', () => {
  it('鉄＝ノーマル、鋼・銀など＝レア、銘入り＝ユニーク、伝説＝レジェンド。添え名で名前と強さが変わる', () => {
    expect(rarityOf({ weaponId: 'iron_sword' })).toBe('normal');
    expect(rarityOf({ weaponId: 'silver_lance' })).toBe('rare');
    expect(rarityOf({ weaponId: 'steel_axe', named: { name: 'x' } })).toBe('unique');
    expect(rarityOf({ weaponId: 'master_sword', legend: 'aurora' })).toBe('legend');
    const a = { uid: 'w1', weaponId: 'silver_lance', affix: ['keen', 'sure'] };
    expect(itemName(a)).toBe('鋭い確かな銀の槍');
    expect(itemMod(a)).toMatchObject({ crit: 5, hit: 10 });
  });
  it('今の武器庫の武器は、そのままレアリティがつく（13夜目のセーブ）', () => {
    const s = deserialize(fixture('v13-day.json'));
    const r = new Set(s.armory.map((a) => rarityOf(a)));
    expect(r.has('rare') || r.has('unique')).toBe(true);
    expect(Object.keys(s.legends ?? {}).length).toBe(LEGENDS.length);
    expect((s.weaponSeen ?? []).length).toBeGreaterThan(0);
  });
  it('伝説の武器は12振り。はじめに敵の将軍が何振りか持つ。手に入ると演出が出て、学校の武器庫に。持ち主を選ぶ', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 2 });
    expect(Object.values(s.legends!).filter((v) => v.holder === 'officer').length).toBeGreaterThan(0);
    s.legends!.asteria = { holder: 'none', log: [] };
    takeLoot(s, [legendLoot('asteria', 'テストで見つけた')]);
    const a = s.armory.find((x) => x.legend === 'asteria')!;
    expect(a).toBeTruthy();
    expect(s.legends!.asteria.holder).toBe('school');
    expect(s.pending.some((p) => p.type === 'legend' && p.id === 'asteria')).toBe(true);
    const st = enrolled(s)[0];
    st.skills.bow = 0;
    expect(legendFits(st, 'asteria')).toBe(false);
    expect(armScore(st, a)).toBe(-1);
    st.skills.bow = 300;
    expect(legendFits(st, 'asteria')).toBe(true);
    // いちばん使った子が卒業のとき持っていく
    a.uses = { [st.id]: 5 };
    expect(favoriteItem(s, st)?.uid).toBe(a.uid);
  });
  it('長く遊ぶと、レア・ユニークが手に入り、図鑑が埋まっていく', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 6 });
    ensureLegends(s);
    autoYears(s, 4);
    const r = s.armory.map((a) => rarityOf(a));
    expect(r.filter((x) => x === 'rare').length).toBeGreaterThan(3);
    expect((s.weaponSeen ?? []).length).toBeGreaterThan(3);
  });
});

import { encodeTransfer, decodeTransfer } from '../src/core/transfer';
describe('引き継ぎの文字', () => {
  it('セーブを縮めた文字にして、貼りつけると同じセーブに戻る（改行や空白が混ざっても読める）', async () => {
    const s = deserialize(fixture('v13-day.json'));
    const code = await encodeTransfer(s);
    expect(code.startsWith('RIMINA1:')).toBe(true);
    expect(code.length).toBeLessThan(fixture('v13-day.json').length / 3);
    const broken = `  ${code.slice(0, 100)}\n${code.slice(100)}\n`;
    const g = await decodeTransfer(broken);
    expect(g.year).toBe(s.year);
    expect(Object.keys(g.students).length).toBe(Object.keys(s.students).length);
    await expect(decodeTransfer(code.slice(0, code.length - 50))).rejects.toThrow();
    await expect(decodeTransfer('こんにちは')).rejects.toThrow();
  });
});
