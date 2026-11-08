// 10夜目：戦いの見え方（同行しない部隊）・戦利品・育ち方・会話の重なり・一般兵の名前・9夜目版のセーブ（形式9）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, autoDay, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, startSortie, finishBattle, chooseLesson, squadAway } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { skipAuto } from '../src/core/battle/auto';
import { awayJudgeRate } from '../src/core/stratagems';
import type { GameState } from '../src/core/state';

export const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const mk = (seed = 1, bg = 'knight') => newGame({ name: 'テスト', background: bg, seed });
setAutoChoicePick(humanLikePick(5));

function toBoard(s: GameState): void {
  for (let guard = 0; guard < 80; guard++) {
    s.pending = s.pending.filter((p) => p.type === 'questBoard');
    if (s.pending.length) { if (s.quests.length >= 3) return; autoPending(s); continue; }
    autoPending(s);
    todayCards(s); chooseLesson(s, recommendCard(s));
  }
}

describe('① 教官が同行しない部隊', () => {
  const base = (() => { const s = mk(11); autoYears(s, 4); toBoard(s); return serialize(s); })();
  const fresh = () => deserialize(base);
  it('2つ目・3つ目の部隊ははじめ同行しない：1つ目の戦いを終えると、残りは結果だけで1枚の結果に', () => {
    const s = fresh();
    const sq = recommendSquads(s);
    expect(sq.length).toBeGreaterThanOrEqual(2);
    expect(squadAway(sq[0], 0)).toBe(false);
    expect(squadAway(sq[1], 1)).toBe(true);
    startSortie(s, sq);
    expect(s.battle?.questId).toBe(sq[0].questId);
    skipAuto(s, battleCtx(s)); finishBattle(s);
    expect(s.battle).toBeNull();
    expect(s.sortie).toBeNull();
    const r = s.pending.find((p) => p.type === 'sortieResult');
    expect(r?.type === 'sortieResult' && r.reports.length).toBe(sq.length);
    if (r?.type === 'sortieResult') {
      expect(r.reports[0].away).toBeFalsy();
      for (const x of r.reports.slice(1)) { expect(x.away).toBe(true); expect(Array.isArray(x.calls)).toBe(true); }
    }
  });
  it('「同行する」にすれば今まで通り見られる', () => {
    const s = fresh();
    const sq = recommendSquads(s).map((x, i) => (i === 1 ? { ...x, away: false } : x));
    startSortie(s, sq);
    skipAuto(s, battleCtx(s)); finishBattle(s);
    expect(s.battle?.questId).toBe(sq[1].questId);
  });
  it('部隊長の腕前が高いほど、よい判断の見込みが上がる', () => {
    const s = fresh();
    const [lo, hi] = [...enrolled(s)].sort((a, b) => a.level - b.level).filter((_, i, l) => i === 0 || i === l.length - 1);
    expect(awayJudgeRate(hi, hi)).toBeGreaterThanOrEqual(awayJudgeRate(lo, lo));
    expect(awayJudgeRate(null, null)).toBeGreaterThan(0.2);
    expect(awayJudgeRate(hi, hi)).toBeLessThanOrEqual(0.9);
  });
});
void autoDay;

describe('9夜目版のセーブ（形式9）', () => {
  it('ふつう（日の途中）：読み込めて、1年遊べる', () => {
    const s = deserialize(fixture('v9-day.json'));
    expect(s.version).toBe(10);
    autoYears(s, 1);
    expect(s.gameOver).toBe(false);
  });
  it('自動の戦闘の途中：最後まで戦えて、まとめた結果が出る', () => {
    const s = deserialize(fixture('v9-auto.json'));
    expect(s.battle?.auto).toBeTruthy();
    for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
    expect(s.pending.some((p) => p.type === 'sortieResult' || p.type === 'battleResult')).toBe(true);
    autoYears(s, 1);
    expect(s.gameOver).toBe(false);
  });
  it('3部隊の途中の部隊：続きの部隊は9夜目と同じく同行したまま戦える', () => {
    const s = deserialize(fixture('v9-squad.json'));
    expect(s.sortie?.idx).toBeGreaterThanOrEqual(1);
    expect(s.battle?.auto).toBeTruthy();
    expect(s.sortie!.squads.every((x) => x.away === false)).toBe(true);
    for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
    expect(s.pending.some((p) => p.type === 'sortieResult')).toBe(true);
    autoYears(s, 1);
    expect(s.gameOver).toBe(false);
  });
  it('結果の途中：閉じて続けられる', () => {
    const s = deserialize(fixture('v9-result.json'));
    expect(s.pending.some((p) => p.type === 'sortieResult')).toBe(true);
    autoPending(s);
    autoYears(s, 1);
    expect(s.gameOver).toBe(false);
  });
});

describe('② 武器は戦利品で', () => {
  it('鉄の武器は学校の備え（数の制限なし）：新しい学校の武器庫に鉄の武器はなく、出撃では全員が持てる', async () => {
    const { STOCK_IDS, isStock } = await import('../src/core/loot');
    const s = mk(3);
    expect(s.armory.some((a) => STOCK_IDS.has(a.weaponId))).toBe(false);
    autoYears(s, 1); toBoard(s);
    const sq = recommendSquads(s);
    const ds = sq.flatMap((x) => x.deploy);
    expect(ds.filter((d) => isStock(d.armoryUid)).length).toBeGreaterThan(0);
  });
  it('敵将を討ち取ると、銘入りの武器を必ず手に入れる。1年遊ぶと戦利品が武器庫に入る', () => {
    const s = mk(5);
    autoYears(s, 3);
    const named = s.armory.filter((a) => a.named);
    const fell = (s.officers ?? []).filter((o) => o.kind !== 'monster' && o.meets.some((m) => m.result === 'fell')).length;
    expect(fell).toBeGreaterThan(0);
    expect(named.length).toBeGreaterThan(0);
    for (const a of named) { expect(a.named!.name).toMatch(/の(剣|槍|大斧|弓|銃)$/); expect(a.named!.story.length).toBeGreaterThan(5); }
    expect(s.armory.some((a) => a.got)).toBe(true);
  });
  it('9夜目のセーブ：鉄の武器は備えに戻り、ほかの武器はそのまま。途中の部隊の割り当ても備えに付けかえる', () => {
    const raw = JSON.parse(fixture('v9-squad.json')).state;
    const before = raw.armory.filter((a: { weaponId: string; engraved?: string }) => !a.weaponId.startsWith('iron_') && a.weaponId !== 'matchlock').length;
    const s = deserialize(fixture('v9-squad.json'));
    expect(s.armory.filter((a) => a.weaponId.startsWith('iron_') && !a.engraved).length).toBe(0);
    expect(s.armory.length).toBeGreaterThanOrEqual(before);
    for (const sq of s.sortie?.squads ?? []) for (const d of sq.deploy) if (d.armoryUid) expect(d.armoryUid.startsWith('stock:') || s.armory.some((a) => a.uid === d.armoryUid)).toBe(true);
  });
});

describe('③ 育ち方の見直し', () => {
  it('新しく入る子：本人の成長率は1つ15〜70%・合計330〜420%、入学時から見える。得意2〜3・苦手1〜2、隠れた才能はない', async () => {
    const { generateStudent } = await import('../src/core/student');
    const { Rng } = await import('../src/core/rng');
    const s = mk(7);
    const r = new Rng({ rng: 99 });
    let buds = 0;
    for (let i = 0; i < 200; i++) {
      const st = generateStudent(s, r);
      const vals = Object.values(st.growth);
      const total = vals.reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(330); expect(total).toBeLessThanOrEqual(420);
      for (const v of vals) { expect(v % 5).toBe(0); expect(v).toBeGreaterThanOrEqual(15); expect(v).toBeLessThanOrEqual(70); }
      expect(st.growthKnown).toBe(true);
      expect(st.talent).toBeNull();
      expect(st.apt!.good.length).toBeGreaterThanOrEqual(2); expect(st.apt!.good.length).toBeLessThanOrEqual(3);
      expect(st.apt!.bad.length).toBeGreaterThanOrEqual(1); expect(st.apt!.bad.length).toBeLessThanOrEqual(2);
      expect(st.apt!.good.some((k) => st.apt!.bad.includes(k))).toBe(false);
      if (st.bud && !st.bud.gold) { buds++; expect(st.apt!.bad).toContain(st.bud.skill); }
    }
    expect(buds).toBeGreaterThan(30); expect(buds).toBeLessThan(90);
  });
  it('得意は×1.5、苦手は×0.5、芽が見えた苦手はふつうに伸びる', async () => {
    const { aptMul } = await import('../src/core/aptitude');
    const s = mk(8);
    const st = enrolled(s)[0];
    st.apt = { good: ['sword'], bad: ['magic', 'axe'] };
    st.bud = { skill: 'magic', reveal: 0 };
    expect(aptMul(st, 'sword')).toBe(1.5); expect(aptMul(st, 'magic')).toBe(0.5); expect(aptMul(st, 'lance')).toBe(1);
    st.bud.reveal = 100;
    expect(aptMul(st, 'magic')).toBe(1); expect(aptMul(st, 'axe')).toBe(0.5);
  });
  it('芽の技能を目標にしてD+まで上げると開花：苦手が得意に、技を覚え、開花の演出が積まれる', async () => {
    const { checkBloom } = await import('../src/core/aptitude');
    const { RANK_POINTS } = await import('../src/data/balance');
    const s = mk(9); s.pending = [];
    const st = enrolled(s)[0];
    st.apt = { good: ['sword'], bad: ['magic'] }; st.bud = { skill: 'magic', reveal: 100 };
    st.skills.magic = RANK_POINTS['D+'];
    st.targets = ['sword', 'lance'];
    expect(checkBloom(s, st)).toBe(false); // 目標にしていない
    st.targets = ['sword', 'magic'];
    expect(checkBloom(s, st)).toBe(true);
    expect(st.apt.good).toContain('magic'); expect(st.apt.bad).not.toContain('magic');
    expect(st.bud.done).toBe(true); expect(st.bud.ability).toBe('bloom_magic');
    expect(s.pending.some((p) => p.type === 'bloom' && p.studentId === st.id)).toBe(true);
  });
  it('軍略・統率は技能ランク：戦術論で軍略、指揮の演習で統率が伸びる。部隊長の腕前は統率で決まる', async () => {
    const { captainScore } = await import('../src/core/stratagems');
    const s = mk(4); s.pending = [];
    const d = todayCards(s);
    d.cards[0] = { id: 'command', faces: [], tags: [] };
    const before = enrolled(s).map((x) => x.skills.command);
    chooseLesson(s, 0);
    expect(enrolled(s).reduce((a, x, i) => a + x.skills.command - before[i], 0)).toBeGreaterThan(0);
    const st = enrolled(s)[0];
    st.skills.command = 0; const lo = captainScore(st);
    st.skills.command = 270; expect(captainScore(st)).toBeGreaterThan(lo);
  });
  it('9夜目のセーブ：成長率は引き上げ（下がらない）、才能は得意に、軍略の数値は技能ランクに、敵将に型がつく', () => {
    const raw = JSON.parse(fixture('v9-day.json')).state;
    const s = deserialize(fixture('v9-day.json'));
    for (const [id, st0] of Object.entries(raw.students) as [string, { growth: Record<string, number>; talent: string | null; strat?: number; status: string }][]) {
      const st = s.students[id];
      for (const k of Object.keys(st0.growth)) expect(st.growth[k as keyof typeof st.growth]).toBeGreaterThanOrEqual(st0.growth[k] - 5);
      expect(st.apt).toBeTruthy();
      expect(st.talent).toBeNull();
      if (st0.talent?.startsWith('genius_')) expect(st.apt!.good).toContain(st0.talent.slice(7));
      expect(typeof st.skills.tactics).toBe('number'); expect(typeof st.skills.command).toBe('number');
    }
    for (const o of s.officers ?? []) if (o.kind !== 'monster') expect(o.traits.some((t) => t === 'valor' || t === 'marshal')).toBe(true);
    expect(s.pending.some((p) => p.type === 'event' && p.title === '10夜目の新しいこと')).toBe(true);
  });
  it('卒業後の道：将・参謀・勇士・文官。統率の高い子は将、個の武の子は勇士に向く', async () => {
    const { suitablePath } = await import('../src/core/career');
    const s = mk(10);
    const st = enrolled(s)[0];
    st.skills.sword = 300; st.skills.command = 0; st.skills.tactics = 0; st.stats.cha = 5;
    expect(suitablePath(st)).toBe('champion');
    st.skills.command = 300;
    expect(suitablePath(st)).toBe('warrior');
  });
});

describe('④ 同じ会話を二度出さない・⑤ 一般兵の名前', () => {
  it('同じ子に同じ面談は出ない。出し切ったら「前の続き」の短い会話、それも出し切ったら出さない', async () => {
    const { buildInterview } = await import('../src/core/interview');
    const { Rng } = await import('../src/core/rng');
    const s = mk(12);
    const st = enrolled(s)[0];
    const r = new Rng({ rng: 5 });
    const titles: string[] = [];
    for (let i = 0; i < 40; i++) { const t = buildInterview(s, r, st, 'recent'); if (t) titles.push(t.title); }
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.some((x) => x.includes('（その後）'))).toBe(true);
  });
  it('支援会話も、同じ組に同じ会話は二度出ない（出来事のあとの会話は別）', async () => {
    const { buildTalk, getSupport } = await import('../src/core/support');
    const { Rng } = await import('../src/core/rng');
    const s = mk(13);
    const [a, b] = enrolled(s);
    const sp = getSupport(s, a.id, b.id);
    const r = new Rng({ rng: 9 });
    const defs: string[] = [];
    for (let i = 0; i < 60; i++) { const t = buildTalk(s, r, sp, 'C'); if (t && !t.again) defs.push(t.def ?? ''); }
    expect(new Set(defs).size).toBe(defs.length);
  });
  it('9夜目のセーブ：これまでの面談の記録から、見た面談を拾う', () => {
    const s = deserialize(fixture('v9-day.json'));
    const withLog = enrolled(s).filter((x) => (x.archive ?? []).some((id) => s.archive[id]?.b === 'teacher'));
    expect(withLog.length).toBeGreaterThan(0);
    for (const st of withLog) expect((st.seenTalks ?? []).length).toBeGreaterThan(0);
  });
  it('名を得た一般兵の名前は、生徒・敵将と重ならない', () => {
    const s = mk(14);
    autoYears(s, 4);
    const prospects = (s.officers ?? []).filter((o) => o.deed);
    expect(prospects.length).toBeGreaterThan(0);
    // 名を得たときにいた生徒・敵将と重ならない（入学がそのあとの子も、なるべく避ける）
    const students = Object.values(s.students);
    let clash = 0;
    for (const o of prospects) if (students.some((x) => x.given === o.given && x.enrollYear <= (o.joined ?? 0))) clash++;
    expect(clash).toBe(0);
    const others = (s.officers ?? []).filter((o) => !o.deed);
    for (const o of prospects) expect(others.filter((x) => x.given === o.given && x.joined <= o.joined).length).toBe(0);
  });
});
