// 16夜目：生徒ごとに覚える技（覚える表）・条件で効くスキル・札の戦い・15夜目版のセーブ
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, finishBattle } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { SAVE_VERSION } from '../src/data/balance';
import { ART_LIST, ARTS, ART_MILESTONES, ART_REMAP } from '../src/data/arts';
import { makeArtPlan, canLearn, artsOf, plannedArts } from '../src/core/arts';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
setAutoChoicePick(humanLikePick(5));

describe('生徒ごとに覚える技（覚える表）', () => {
  it('技能×節目ごとに候補があり、全体で250種以上（18夜目：スキルの節目は2つずつ、戦技の節目は4〜8つ）', () => {
    const skills = [...new Set(ART_LIST.map((a) => a.skill))];
    expect(skills.length).toBe(12);
    for (const k of skills) for (const r of ART_MILESTONES) {
      const n = ART_LIST.filter((a) => a.skill === k && a.rank === r && !a.bloom).length;
      if (r === 'E+' || r === 'C' || r === 'A') expect(n).toBe(2);
      else { expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThanOrEqual(8); }
    }
    expect(ART_LIST.length).toBeGreaterThanOrEqual(250);
    // 条件で効くスキルが混ざっている
    expect(ART_LIST.filter((a) => a.cond).length).toBeGreaterThanOrEqual(30);
    expect(new Set(ART_LIST.filter((a) => a.cond).map((a) => a.cond)).size).toBeGreaterThanOrEqual(10);
  });
  it('入学のときに表が決まり、生徒によって覚える技が違う。表にない技は覚えない', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 16, start: 'normal' });
    const sts = enrolled(s);
    for (const st of sts) expect(st.artPlan).toBeTruthy();
    const plans = sts.map((st) => st.artPlan!['sword:D']);
    expect(new Set(plans).size).toBeGreaterThan(1);
    autoYears(s, 2);
    for (const st of Object.values(s.students)) for (const id of artsOf(st)) {
      const a = ARTS[id];
      const inp = st.artPlan![`${a.skill}:${a.bloom ? 'bloom' : a.rank}`] === id || (st.taught ?? []).includes(id);
      expect(inp).toBe(true);
    }
    // 同じidの子なら、いつ作っても同じ表
    const st = sts[0];
    expect(makeArtPlan(st)).toEqual(makeArtPlan(st));
  });
  it('性格・国で選ばれやすさが変わる（血の気の多い子は攻めの技が多い）', () => {
    const base = { id: 'x', given: 'テ', house: 'commoner', dream: 'none', apt: { good: [], bad: [] }, talent: null } as never as Parameters<typeof makeArtPlan>[0];
    let atkHot = 0, atkTimid = 0;
    for (let i = 0; i < 200; i++) {
      const h = makeArtPlan({ ...base, id: `h${i}`, personality: 'hot', origin: 'empire' });
      const t = makeArtPlan({ ...base, id: `t${i}`, personality: 'timid', origin: 'alliance' });
      atkHot += Object.values(h).filter((id) => ARTS[id].style?.includes('atk')).length;
      atkTimid += Object.values(t).filter((id) => ARTS[id].style?.includes('atk')).length;
    }
    expect(atkHot).toBeGreaterThan(atkTimid * 1.5);
  });
  it('秘伝（rare）は得意の技能の子だけ', () => {
    for (let i = 0; i < 100; i++) {
      const p = makeArtPlan({ id: `r${i}`, given: 'テ', personality: 'calm', origin: 'kingdom', house: 'noble', dream: 'none', apt: { good: ['sword'], bad: [] }, talent: null } as never);
      for (const [k, id] of Object.entries(p)) if (ARTS[id].rare) expect(k.startsWith('sword')).toBe(true);
    }
  });
  it('次に覚えそうな技はその子の表から', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 5, start: 'normal' });
    const st = enrolled(s)[0];
    const next = plannedArts(st);
    expect(next.length).toBeGreaterThan(10);
    for (const a of next) expect(canLearn(st, a) || !artsOf(st).includes(a.id)).toBe(true);
  });
});

describe('15夜目版のセーブ（形式15）', () => {
  for (const f of ['v15-day.json', 'v15-auto.json', 'v15-squad.json', 'v15-result.json']) {
    it(`${f}：覚える表ができ、もう覚えた技はそのまま。お知らせが出て1年遊べる`, () => {
      const raw = JSON.parse(fixture(f));
      const before: Record<string, string[]> = Object.fromEntries(Object.values(raw.state.students as Record<string, { id: string; arts?: string[] }>).map((x) => [x.id, x.arts ?? []]));
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(s.pending.some((p) => p.type === 'event' && p.title === '16夜目の新しいこと')).toBe(true);
      for (const st of Object.values(s.students)) {
        expect(st.artPlan).toBeTruthy();
        // 18夜目：なくしたスキルは入れ替え（ART_REMAP）、同じ効果の重なりは外す。戦技はそのまま、その節目の技として表に入っている
        for (const id0 of before[st.id] ?? []) {
          const id = ART_REMAP[id0] ?? id0; const a = ARTS[id];
          if (a.kind === 'mind') continue;
          expect(st.arts).toContain(id);
          if (!ARTS[id0].card || ARTS[id0].id.includes('_art') || ARTS[id0].id.includes('_a')) expect(st.artPlan![`${a.skill}:${a.bloom ? 'bloom' : a.rank}`]).toBeTruthy();
        }
      }
      const n0 = Object.fromEntries(Object.values(s.students).map((x) => [x.id, (x.arts ?? []).length]));
      const grads = new Set(Object.values(s.students).filter((x) => x.status === 'graduated').map((x) => x.id));
      // 戦いの途中のセーブは、札の戦いとしてやり直している（同じ依頼）
      const qid = raw.state.battle?.questId;
      // （小さな依頼は結果だけになったので、そのときは次の部隊の戦いへ進んでいる）
      const small = !!raw.state.quests.find((q: { id: string; small?: boolean }) => q.id === qid)?.small;
      if (qid && !small) expect(s.battle?.questId).toBe(qid);
      if (qid && s.battle) expect(s.battle.auto?.cards).toBeTruthy();
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s);
      // 読みこんだだけでは、通り過ぎた節目の技を急に覚えない
      for (const st of Object.values(s.students)) if (grads.has(st.id)) expect((st.arts ?? []).length).toBe(n0[st.id]);
      autoYears(s, 1);
      expect(s.gameOver).toBe(false);
    });
  }
});

describe('札の戦い', async () => {
  const { setCardMode, playCardTurn, chooseAuto } = await import('../src/core/battle/auto');
  const { autoPick, usable, cardPreview, cardCosts } = await import('../src/core/battle/cards');
  const { B } = await import('../src/data/balance');
  const { recommendSquads, autoDay } = await import('../src/core/autoplay');
  const { startSortie } = await import('../src/core/flow');
  const toBoard = (s: ReturnType<typeof newGame>) => { let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 80) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); } s.pending = s.pending.filter((p) => p.type === 'questBoard'); };
  it('山札は出撃した子の札と先生の策。手札・行動力・敵の予告があり、4〜6ターンで決着する', () => {
    setCardMode(true);
    try {
      for (const seed of [3, 4, 5]) {
        const s = newGame({ name: 'テスト', background: 'knight', seed, start: 'normal' });
        autoYears(s, 1); toBoard(s);
        startSortie(s, recommendSquads(s).slice(0, 1));
        const b = s.battle!; const cs = b.auto!.cards!;
        expect(cs).toBeTruthy();
        const owners = new Set(Object.values(cs.cards).map((c) => c.owner));
        for (const u of b.units.filter((x) => x.side === 'player' && x.studentId)) expect(owners.has(u.uid)).toBe(true);
        // 18夜目：札を多く引くスキル（詠唱短縮・軍師の眼）があると、そのぶん多い
        expect(cs.hand.length).toBeGreaterThanOrEqual(cs.handSize); expect(cs.hand.length).toBeLessThanOrEqual(cs.handSize + B.cards.perkDrawMax);
        expect(cs.ap).toBeGreaterThanOrEqual(3);
        expect(cs.intents.length).toBeGreaterThan(0);
        expect(cs.maxTurns).toBeGreaterThanOrEqual(4); expect(cs.maxTurns).toBeLessThanOrEqual(6);
        for (const id of cs.hand) expect(cardPreview(s, b, battleCtx(s), id).text.length).toBeGreaterThan(0);
        let g = 0;
        while (b.phase !== 'done' && g++ < 20) {
          if (b.auto!.choice) { chooseAuto(s, b.auto!.choice.recommended, battleCtx(s)); continue; }
          // 倒れた子の札は手札に来ない
          for (const id of cs.hand) expect(usable(b, cs.cards[id])).toBe(true);
          const p = autoPick(s, b, battleCtx(s));
          const cost = cardCosts(s, b, p.ids).reduce((a, x) => a + x, 0);
          expect(cost).toBeLessThanOrEqual(cs.ap);
          playCardTurn(s, p.ids, p.target, battleCtx(s));
        }
        expect(b.phase).toBe('done');
        expect(cs.turn).toBeLessThanOrEqual(cs.maxTurns);
        expect(b.auto!.scenes.some((x) => x.title === '決着')).toBe(true);
        finishBattle(s);
        expect(s.battle).toBeNull();
      }
    } finally { setCardMode(false); }
  });
  it('札の戦いで数年遊べる（止まらない）', () => {
    setCardMode(true);
    try {
      const s = newGame({ name: 'テスト', background: 'knight', seed: 8, start: 'normal' });
      autoYears(s, 3);
      expect(s.gameOver).toBe(false);
      expect(s.stats.battlesWon).toBeGreaterThan(20);
    } finally { setCardMode(false); }
  });
});

describe('結果の4段（「串刺し」なのに生きている）', () => {
  it('ふつうの当たり・深手・重傷の文に、死ぬ段の言葉が0件。重傷の文には助かった理由が入っている', async () => {
    const { deathWordLeaks } = await import('../src/core/prosecheck');
    const r = deathWordLeaks();
    expect(r.checked).toBeGreaterThan(150);
    expect(r.issues).toEqual([]);
  });
  it('札の戦いの文：生き残った相手に死ぬ段の言葉を使わない（実際に戦って調べる）', async () => {
    const { DEATH_WORDS } = await import('../src/data/warprose');
    const { setCardMode, playCardTurn, chooseAuto } = await import('../src/core/battle/auto');
    const { autoPick } = await import('../src/core/battle/cards');
    const { recommendSquads, autoDay } = await import('../src/core/autoplay');
    const { startSortie } = await import('../src/core/flow');
    setCardMode(true);
    let lethal = 0;
    try {
      for (const seed of [21, 22, 23, 24, 25, 26]) {
        const s = newGame({ name: 'テスト', background: 'knight', seed, start: 'normal' });
        s.settings.battleProse = seed % 2 ? 'brutal' : 'dense';
        autoYears(s, 1 + (seed % 3));
        for (let m = 0; m < 3; m++) {
          let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 80) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); }
          s.pending = s.pending.filter((p) => p.type === 'questBoard');
          startSortie(s, recommendSquads(s).slice(0, 1));
          const b = s.battle!; const cs = b.auto!.cards!; let k = 0;
          while (b.phase !== 'done' && k++ < 20) { if (b.auto!.choice) { chooseAuto(s, 0, battleCtx(s)); continue; } const p = autoPick(s, b, battleCtx(s)); playCardTurn(s, p.ids, p.target, battleCtx(s)); }
          const L = b.auto!.leader;
          const names = [...b.units.map((u) => u.name), L?.name ?? ''].filter(Boolean).sort((x, y) => y.length - x.length);
          for (const t of cs.turns) for (const l of t.lines) {
            // 名前（「首狩りの〇〇」のような二つ名も）は除いて調べる
            let bare = l.text; for (const n of names) bare = bare.split(n).join('＿');
            if (!DEATH_WORDS.test(bare)) continue;
            lethal++;
            const named = b.units.filter((u) => l.text.includes(u.name) || (L && u.uid === L.uid && l.text.includes(L.name)));
            const dead = named.some((u) => u.dead && !(L && u.uid === L.uid && L.fled) && !(u.studentId && b.fallen.find((f) => f.studentId === u.studentId)?.outcome !== 'dead') && !u.persuadable);
            expect(dead, l.text).toBe(true);
          }
          finishBattle(s); autoPending(s);
        }
      }
    } finally { setCardMode(false); }
    expect(lethal).toBeGreaterThan(0);
  });
});

describe('札の戦いの細かな決まり', async () => {
  const { setCardMode, playCardTurn } = await import('../src/core/battle/auto');
  const { autoPick, strikeCalc, coverTarget, incoming } = await import('../src/core/battle/cards');
  const { recommendSquads, autoDay } = await import('../src/core/autoplay');
  const { startSortie } = await import('../src/core/flow');
  const start = (seed: number) => {
    const s = newGame({ name: 'テスト', background: 'knight', seed, start: 'normal' });
    autoYears(s, 2);
    let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 80) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); }
    s.pending = s.pending.filter((p) => p.type === 'questBoard');
    const sq = recommendSquads(s).slice(0, 1);
    sq[0].plan.strats = ['rally'];
    startSortie(s, sq);
    return s;
  };
  it('先生の策は山札の札になり、出すと黄色い帯の結果が出る', () => {
    setCardMode(true);
    const s = start(41);
    const b = s.battle!; const cs = b.auto!.cards!;
    const strat = Object.values(cs.cards).find((c) => c.kind === 'strat');
    expect(strat?.src).toBe('strat:rally');
    cs.hand = [strat!.id, ...cs.hand.filter((x) => x !== strat!.id)].slice(0, cs.handSize);
    playCardTurn(s, [strat!.id], undefined, battleCtx(s));
    expect(cs.turns[0].lines.some((l) => l.cls === 'strat' || l.cls === 'stratng')).toBe(true);
    expect((b.auto!.strats ?? []).map((x) => x.id)).toContain('rally');
  });
  it('かばう相手は、予告でいちばん傷を受けそうな仲間。札の数字と実際の計算は同じ式', () => {
    const s = start(42);
    const b = s.battle!; const cs = b.auto!.cards!;
    const inc = incoming(b);
    const mates = b.units.filter((u) => (u.side === 'player' || u.side === 'npc') && !u.dead);
    const g = mates.find((u) => u.side === 'player')!;
    const t = coverTarget(b, g)!;
    const worst = mates.filter((u) => u !== g).sort((x, y) => (inc[y.uid] ?? 0) / y.hp - (inc[x.uid] ?? 0) / x.hp)[0];
    expect(t.uid).toBe(worst.uid);
    const foe = b.units.find((u) => u.uid === cs.front[0])!;
    const h1 = strikeCalc(s, b, battleCtx(s), g, foe, { type: 'atk' });
    const h2 = strikeCalc(s, b, battleCtx(s), g, foe, { type: 'atk' });
    expect(h1).toEqual(h2);
    expect(h1.dmg).toBeGreaterThan(0);
  });
  it('信頼の低い子は、ときどき自分の判断で別の札を使う（信頼が高いと減る）', () => {
    let low = 0, high = 0;
    for (const trust of [0, 100]) for (const seed of [51, 52, 53, 54]) {
      const s = start(seed);
      for (const st of Object.values(s.students)) st.trust = trust;
      const b = s.battle!; const cs = b.auto!.cards!;
      let k = 0;
      while (b.phase !== 'done' && k++ < 8) { if (b.auto!.choice) { b.auto!.choice = null; } const p = autoPick(s, b, battleCtx(s)); playCardTurn(s, p.ids, p.target, battleCtx(s)); }
      const n = cs.played.filter((x) => x.disobey).length;
      if (trust === 0) low += n; else high += n;
    }
    expect(low).toBeGreaterThan(0);
    expect(high).toBe(0);
  });
});
