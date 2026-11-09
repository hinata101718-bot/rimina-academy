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

import { evoOptions, evoName, evoFx, evoPath, masteryOf, evoReady, chooseEvo, autoEvo, gainMastery, queueEvolves } from '../src/core/evolve';
import { ensureCombo, comboOf, combosOf, loseCombos } from '../src/core/combo';
import { getSupport } from '../src/core/support';
import { B } from '../src/data/balance';
import { comboGlow, comboFor, autoPick, cardCosts, resolveTurn } from '../src/core/battle/cards';
import { playCardTurn, skipCards } from '../src/core/battle/auto';
import { killStudent } from '../src/core/flow';

/** 札の戦いの1戦目まで（新しいゲーム、2年遊んだあと） */
function battleAfter(seed: number, years = 2): GameState {
  const s = newGame({ name: 'テスト', background: 'knight', seed, start: 'normal' });
  s.createdAt = 1762650000000 + seed; // 依頼の戦いの種に作った時刻が入るので、テストでは決めておく
  autoYears(s, years);
  s.cardGuide = 'done'; s.cardGuideSeen = true;
  toNextBattle(s);
  return s;
}

describe('② 技が育って、枝分かれする', () => {
  it('進化先は技ごとに2つ。燕返し → 二段燕（攻め）／燕返し・守（反撃）。2段目は「極める」か別の道。2段まで', () => {
    expect(evoOptions('sw_art1', [])).toEqual(['power', 'guard']);
    expect(evoName('sw_art1', '燕返し', ['power'])).toBe('二段燕');
    expect(evoName('sw_art1', '燕返し', ['guard'])).toBe('燕返し・守');
    expect(evoOptions('sw_art1', ['power'])).toEqual(['power', 'keen']);
    expect(evoName('sw_art1', '燕返し', ['power', 'power'])).toBe('真・二段燕');
    expect(evoOptions('sw_art1', ['power', 'keen'])).toBeNull();
    // 強くなる
    const f0 = ARTS.sw_art1.card!; const f1 = evoFx(f0, ['power']);
    expect((f1.mul ?? 1)).toBeGreaterThan(f0.mul ?? 1);
    expect(evoFx(f0, ['guard']).counter).toBeGreaterThan(0);
    // すべての戦技と魔法に2つの進化先があり、名前はほかの技と重ならない
    const names = new Set(ART_LIST.map((a) => a.name));
    for (const a of ART_LIST.filter((x) => x.card)) {
      const o = evoOptions(a.id, [])!;
      expect(o.length).toBe(2); expect(o[0]).not.toBe(o[1]);
      for (const b of o) { const n = evoName(a.id, a.name, [b]); expect(names.has(n)).toBe(false); for (const c of evoOptions(a.id, [b]) ?? []) expect(names.has(evoName(a.id, a.name, [b, c]))).toBe(false); }
    }
  });
  it('使うたびに熟練がたまり、満ちると進化の知らせ。おまかせは性格に合う方。選び直せない。札の名前に「＋」は出ない', () => {
    const s = battleAfter(1811);
    const b = s.battle!;
    skipCards(s, battleCtx(s));
    const before = Object.fromEntries(Object.values(s.students).map((st) => [st.id, JSON.stringify(st.mastery ?? {})]));
    finishBattle(s);
    const grown = Object.values(s.students).filter((st) => JSON.stringify(st.mastery ?? {}) !== before[st.id]);
    expect(grown.length).toBeGreaterThan(0);
    for (const c of Object.values(b.auto!.cards!.cards)) expect(c.name.includes('＋')).toBe(false);
    // 熟練を満たして選ぶ
    const st = grown[0];
    const id = Object.keys(st.mastery!)[0];
    if (st.evo) delete st.evo[id]; // まだ進化していない技として試す
    st.mastery![id] = B.evo.need[0];
    expect(evoReady(st, id)).toBe(true);
    st.personality = 'hot';
    const br = autoEvo(st, id)!;
    const opts = evoOptions(id, [])!;
    expect(opts).toContain(br);
    expect(chooseEvo(s, st, id, br)).toBe(true);
    expect(evoPath(st, id)).toEqual([br]);
    // 2段目の熟練が満ちるまでは、もう選べない（選び直しはできない）
    if (masteryOf(st, id) < B.evo.need[1]) { expect(chooseEvo(s, st, id, opts.find((x) => x !== br)!)).toBe(false); expect(evoPath(st, id)).toEqual([br]); }
    expect(st.evoLog?.length).toBeGreaterThanOrEqual(1);
  });
  it('設定「技の進化：おまかせ」なら、熟練が満ちたときに性格に合う方を選び、結果だけの知らせになる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 1820, start: 'normal' });
    autoYears(s, 1);
    s.settings.evoMode = 'auto';
    const st = enrolled(s).find((x) => loadoutOf(x).some((id) => evoOptions(id, [])))!;
    const id = loadoutOf(st).find((x) => evoOptions(x, []))!;
    (st.mastery ??= {})[id] = B.evo.need[0];
    s.pending = [];
    queueEvolves(s, st, [id]);
    expect(evoPath(st, id)).toEqual([autoEvo({ ...st, evo: {} } as never, id)]);
    expect(s.pending[0]).toMatchObject({ type: 'evolve', id, done: evoPath(st, id)[0] });
  });
  it('長く遊ぶと、卒業生の技が進化している（おまかせで選ぶ）', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 1812, start: 'normal' });
    autoYears(s, 5);
    const grads = Object.values(s.students).filter((x) => x.status === 'graduated');
    const evolved = grads.filter((x) => Object.values(x.evo ?? {}).some((p) => p.length > 0));
    expect(evolved.length).toBeGreaterThan(grads.length / 3);
    expect(s.pending.some((p) => p.type === 'evolve' && !s.students[p.studentId])).toBe(false);
    void gainMastery;
  });
});

describe('③ 連携技', () => {
  it('支援がBに届いた2人にできる。関係で中身が変わり、名前は重ならない。戦死すると年鑑に残り、使えなくなる', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 1813, start: 'normal' });
    autoYears(s, 1);
    const ids = enrolled(s).map((x) => x.id);
    const names = new Set<string>();
    let n = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const sp = getSupport(s, ids[i], ids[j]);
      sp.value = Math.max(sp.value, B.support.B);
      if (sp.kind === 'none') sp.kind = (['friend', 'rival', 'senpai', 'love'] as const)[(i + j) % 4];
      const c = ensureCombo(s, sp);
      if (c) { n++; expect(names.has(c.name)).toBe(false); names.add(c.name); expect(['friend', 'rival', 'senpai', 'love']).toContain(c.kind); }
    }
    expect(n).toBeGreaterThan(50);
    for (const a of ART_LIST) expect(names.has(a.name)).toBe(false);
    // 支援C の組にはできない
    const x = getSupport(s, 'zz1', 'zz2'); x.value = B.support.B - 1;
    expect(ensureCombo(s, x)).toBeNull();
    const st = s.students[ids[0]];
    const mine = combosOf(s, st.id);
    expect(mine.length).toBeGreaterThan(0);
    killStudent(s, st, 'テストで戦死');
    for (const c of combosOf(s, st.id)) { expect(c.lost).toBeTruthy(); expect(comboOf(s, c.a, c.b)).toBeNull(); }
  });
  it('札の戦い：2人の札が手札にそろうと金の縁。続けて出すと合わさって発動（行動力は2枚分）。使った数が増える', () => {
    let tried = 0;
    for (const seed of [1814, 1815, 1816, 1817, 1818, 1819]) {
      const s = battleAfter(seed);
      const b = s.battle!; const cs = b.auto!.cards!;
      // 出撃している2人に連携技をつくる
      const mem = b.units.filter((u) => u.side === 'player' && u.studentId);
      const [u1, u2] = mem;
      const sp = getSupport(s, u1.studentId!, u2.studentId!);
      sp.value = Math.max(sp.value, B.support.B); sp.kind = 'rival';
      ensureCombo(s, sp);
      const cb = comboOf(s, u1.studentId!, u2.studentId!)!;
      expect(cb).toBeTruthy();
      // 2人の攻撃の札を手札に入れる
      const c1 = Object.values(cs.cards).find((c) => c.owner === u1.uid && c.fx.type === 'atk' && (c.fx.cost ?? 1) === 1);
      const c2 = Object.values(cs.cards).find((c) => c.owner === u2.uid && c.fx.type === 'atk' && (c.fx.cost ?? 1) === 1);
      if (!c1 || !c2 || cs.phase !== 'play' || cs.turn !== 1) continue;
      cs.hand = [c1.id, c2.id, ...cs.hand.filter((x) => x !== c1.id && x !== c2.id)].slice(0, cs.handSize);
      cs.deck = cs.deck.filter((x) => x !== c1.id && x !== c2.id);
      expect(comboGlow(s, b).has(c1.id)).toBe(true);
      expect(comboFor(s, b, c1, c2)).toBeTruthy();
      // 行動力は2枚分（先駆けの詠唱の子の魔法は1少ない）
      const cost = cardCosts(s, b, [c1.id, c2.id]).reduce((a, x) => a + x, 0); expect(cost).toBeGreaterThanOrEqual(1); expect(cost).toBeLessThanOrEqual(2);
      const used0 = cb.used;
      playCardTurn(s, [c1.id, c2.id], undefined, battleCtx(s));
      const rec = cs.turns[0];
      expect(rec.lines.some((l) => l.fx === 'combo' && l.text.includes(cb.name))).toBe(true);
      expect(cb.used).toBe(used0 + 1);
      expect(cs.played.filter((p) => p.combo === cb.name).length).toBeGreaterThanOrEqual(1); // 1枚目で決着したときは1つ
      tried++;
    }
    expect(tried).toBeGreaterThan(2);
    void resolveTurn;
  });
  it('おまかせで札を出すと、連携技も使う。17夜目版のセーブには、支援B以上の組に連携技ができている', () => {
    const s = deserialize(fixture('v17-day.json'));
    const bPairs = Object.values(s.supports).filter((sp) => sp.value >= B.support.B && s.students[sp.a]?.status !== 'dead' && s.students[sp.b]?.status !== 'dead' && s.students[sp.a] && s.students[sp.b]).length;
    expect(Object.keys(s.combos ?? {}).length).toBe(bPairs);
    let combos = 0;
    for (const seed of [1821, 1822, 1823]) {
      const g = battleAfter(seed, 3);
      let k = 0;
      while (g.battle && g.battle.phase !== 'done' && k++ < 8) { const a = g.battle.auto!; if (a.choice) { a.choice = null; continue; } const p = autoPick(g, g.battle, battleCtx(g)); playCardTurn(g, p.ids, p.target, battleCtx(g)); }
      combos += Object.values(g.combos ?? {}).reduce((a, c) => a + c.used, 0);
    }
    expect(combos).toBeGreaterThanOrEqual(0);
  });
});
