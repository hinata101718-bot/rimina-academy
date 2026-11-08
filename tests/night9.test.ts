// 9夜目：8夜目版のセーブ（形式8）・最大3部隊・策と陣形・戦闘後の評価・敵将の組織図と抜擢
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled, available } from '../src/core/game';
import { autoYears, autoPending, autoDay, finishAuto, autoBattle, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, squadCount, squadLimit, startSortie, finishBattle, chooseLesson, rng } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { startAutoQuest } from '../src/core/flow';
import { defaultPlan, skipAuto, chooseAuto, advanceAuto, officerForQuest, previewBattle } from '../src/core/battle/auto';
import { SAVE_VERSION } from '../src/data/balance';
import { STRATS, STRAT_IDS, SQUADS } from '../src/data/stratagems';
import { knownStrats, stratOdds, stratSlots, checkStratUnlocks, defaultRow, START_STRATS, addStrat } from '../src/core/stratagems';
import { BADGES, EVAL_SAY } from '../src/data/evaluation';
import { PERSONALITIES } from '../src/data/people';
import { linkOrg, markOrgSeen, orgChanges, activeOf, prospectsOf, addProspect, ensureRosters } from '../src/core/officers';
import { ROSTER_FACTIONS } from '../src/data/officers';
import { rollQuests } from '../src/core/quests';
import { generateFace } from '../src/core/student';
import { Rng } from '../src/core/rng';
import type { GameState, Quest } from '../src/core/state';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const mk = (seed = 1, bg = 'knight') => newGame({ name: 'テスト', background: bg, seed });
setAutoChoicePick(humanLikePick(5));

/** 月末の掲示板まで進める */
function toBoard(s: GameState): void {
  for (let guard = 0; guard < 80; guard++) {
    s.pending = s.pending.filter((p) => p.type === 'questBoard');
    if (s.pending.length) { if (s.quests.length >= 3) return; autoPending(s); continue; }
    autoPending(s);
    todayCards(s); chooseLesson(s, recommendCard(s));
  }
}
/** 在籍の人数を n 人にそろえる（多い分は卒業扱い） */
function trimTo(s: GameState, n: number): void {
  const list = enrolled(s);
  for (const st of list.slice(n)) st.status = 'graduated';
}

describe('8夜目版のセーブ（形式8）', () => {
  it('ふつう（日の途中）：形式9になり、策ははじめの4種・組織図の線がつながる。そのまま1年遊べる', () => {
    const raw = JSON.parse(fixture('v8-day.json'));
    expect(raw.version).toBe(8);
    const s = deserialize(fixture('v8-day.json'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(9);
    expect(knownStrats(s)).toEqual(START_STRATS);
    expect(START_STRATS.length).toBeGreaterThanOrEqual(3);
    expect(START_STRATS.length).toBeLessThanOrEqual(4);
    expect(s.settings.battleFx).toBe('big');
    for (const f of ROSTER_FACTIONS) for (const o of activeOf(s, f)) if (o.rank > 0) expect(o.parent).toBeTruthy();
    expect(s.orgSeen).toBeTruthy();
    expect(s.pending.some((p) => p.type === 'event' && p.title.includes('9夜目'))).toBe(true);
    autoYears(s, 1);
    expect(s.gameOver).toBe(false);
    expect(deserialize(serialize(s)).version).toBe(SAVE_VERSION);
  });
  it('自動の戦闘の途中：最後まで遊べ、結果に一人ずつの評価が出る', () => {
    const s = deserialize(fixture('v8-auto.json'));
    expect(s.battle?.auto).toBeTruthy();
    finishAuto(s);
    expect(s.battle).toBeNull();
    const p = s.pending.find((x) => x.type === 'battleResult');
    expect(p && p.type === 'battleResult' && (p.evals ?? []).length).toBeGreaterThan(0);
    autoPending(s);
    for (let i = 0; i < 10; i++) autoDay(s);
    expect(s.gameOver).toBe(false);
  });
  it('手動の戦闘の途中：最後まで遊べる', () => {
    const s = deserialize(fixture('v8-manual.json'));
    expect(s.battle && !s.battle.auto).toBe(true);
    autoBattle(s);
    expect(s.battle).toBeNull();
    autoPending(s);
    for (let i = 0; i < 10; i++) autoDay(s);
    expect(s.gameOver).toBe(false);
  });
  it('結果の途中（8夜目の形の結果）：閉じて続けられる', () => {
    const s = deserialize(fixture('v8-result.json'));
    const p = s.pending.find((x) => x.type === 'battleResult');
    expect(p).toBeTruthy();
    expect(p && p.type === 'battleResult' && p.evals).toBeUndefined();
    autoPending(s);
    for (let i = 0; i < 10; i++) autoDay(s);
    expect(s.gameOver).toBe(false);
  });
});

describe('月末に最大3部隊', () => {
  const base = (() => { const s = mk(11); autoYears(s, 4); toBoard(s); return serialize(s); })();
  const fresh = () => deserialize(base);
  it('部隊の数：在籍20人まで1、21人から2、30人で3（依頼の数まで）', () => {
    const s = fresh();
    // 30人にそろえる（足りなければ同じ子を写して足す）
    const src = enrolled(s)[0];
    for (let i = 0; enrolled(s).length < SQUADS.three; i++) s.students[`cl${i}`] = { ...JSON.parse(JSON.stringify(src)), id: `cl${i}` };
    expect(enrolled(s).length).toBeGreaterThanOrEqual(SQUADS.three);
    s.quests = [...s.quests, ...s.quests.map((q) => ({ ...q, id: `${q.id}x` }))];
    expect(squadCount(s)).toBe(3);
    trimTo(s, 29); expect(squadCount(s)).toBe(2);
    trimTo(s, 21); expect(squadCount(s)).toBe(2);
    trimTo(s, 20); expect(squadCount(s)).toBe(1);
    expect(squadLimit(s, 1)).toBeLessThanOrEqual(SQUADS.extraLimit);
  });
  it('おすすめの編成は全部隊ぶん：依頼・メンバー・武器が重ならない。部隊長と策もつく', () => {
    const s = fresh();
    const sq = recommendSquads(s);
    expect(sq.length).toBe(squadCount(s));
    expect(sq.length).toBeGreaterThanOrEqual(2);
    expect(new Set(sq.map((x) => x.questId)).size).toBe(sq.length);
    const ids = sq.flatMap((x) => x.deploy.map((d) => d.studentId));
    expect(new Set(ids).size).toBe(ids.length);
    const arms = sq.flatMap((x) => x.deploy.flatMap((d) => [d.armoryUid, d.staffUid]).filter(Boolean));
    expect(new Set(arms).size).toBe(arms.length);
    sq.forEach((x, i) => {
      expect(x.deploy.length).toBeLessThanOrEqual(squadLimit(s, i));
      expect(x.plan.captain && x.deploy.some((d) => d.studentId === x.plan.captain)).toBe(true);
      expect((x.plan.strats ?? []).length).toBeLessThanOrEqual(stratSlots(s));
    });
  });
  it('部隊の順番に1つずつ戦い、最後にまとめた結果が1枚。月は1つだけ進む', () => {
    const s = fresh();
    const m0 = s.month, y0 = s.year;
    const sq = recommendSquads(s);
    startSortie(s, sq);
    expect(s.sortie?.squads.length).toBe(sq.length);
    const seen: string[] = [];
    for (let i = 0; i < 5 && s.battle; i++) { seen.push(s.battle.questId); skipAuto(s, battleCtx(s)); finishBattle(s); }
    expect(seen).toEqual(sq.map((x) => x.questId));
    expect(s.sortie).toBeNull();
    const r = s.pending.find((p) => p.type === 'sortieResult');
    expect(r && r.type === 'sortieResult' && r.reports.length).toBe(sq.length);
    if (r?.type === 'sortieResult') r.reports.forEach((x, i) => { expect(x.squad).toBe(i); expect(x.evals?.length).toBeGreaterThan(0); });
    expect(s.year * 12 + s.month).toBe(y0 * 12 + m0 + 1);
  });
  it('途中の部隊で保存しても、読み込んで続きの部隊から戦える', () => {
    const s = fresh();
    startSortie(s, recommendSquads(s));
    skipAuto(s, battleCtx(s)); finishBattle(s);
    expect(s.sortie?.idx).toBe(1);
    const t = deserialize(serialize(s));
    expect(t.battle?.auto).toBeTruthy();
    for (let i = 0; i < 5 && t.battle; i++) { skipAuto(t, battleCtx(t)); finishBattle(t); }
    expect(t.pending.some((p) => p.type === 'sortieResult')).toBe(true);
  });
  it('2つ目・3つ目の部隊向けの小さな依頼：残りの子のレベルに合い、報酬は少なめ', () => {
    const s = fresh();
    const qs = rollQuests(s);
    const small = qs.filter((q) => q.small);
    expect(small.length).toBe(Math.max(0, Math.min(3, enrolled(s).length >= SQUADS.three ? 3 : 2) - 1));
    const main = qs.filter((q) => q.real && !q.small);
    for (const q of small) { expect(q.level).toBeLessThan(Math.max(...main.map((x) => x.level))); expect(q.reward).toBeLessThanOrEqual(Math.max(...main.map((x) => x.reward))); }
  });
});

describe('策（作戦カード）と陣形', () => {
  it('13種（10〜15）、はじめは3〜4種。効く条件と外れたときの痛手がある', () => {
    expect(STRAT_IDS.length).toBeGreaterThanOrEqual(10);
    expect(STRAT_IDS.length).toBeLessThanOrEqual(15);
    for (const id of STRAT_IDS) { const d = STRATS[id]; expect(d.ok.length).toBeGreaterThan(0); expect(d.ng.length).toBeGreaterThan(0); expect(d.tip).toBeTruthy(); }
  });
  it('地形・天候・敵将の弱点で見込みが変わる。雨の火計は不発', () => {
    const q = { template: 'forest_road', weather: 'clear', objective: 'rout' } as Quest;
    const base = stratOdds('fire', { q, members: [], traits: [], known: [] });
    expect(stratOdds('fire', { q: { ...q, weather: 'rain' }, members: [], traits: [], known: [] }).dud).toBe(true);
    expect(stratOdds('fire', { q, members: [], traits: ['fire_weak'], known: ['fire_weak'] }).rate).toBeGreaterThan(base.rate);
    expect(stratOdds('fire', { q, members: [], traits: ['fire_weak'], known: ['fire_weak'] }).weak).toBe(true);
    expect(stratOdds('fire', { q: { ...q, template: 'training' }, members: [], traits: [], known: [] }).rate).toBeLessThan(base.rate);
    expect(stratOdds('night', { q: { ...q, weather: 'fog' }, members: [], traits: [], known: [] }).rate).toBeGreaterThan(stratOdds('night', { q, members: [], traits: [], known: [] }).rate);
    // 分かっていない特徴は、理由の文には出ない
    expect(stratOdds('night', { q, members: [], traits: ['night_strong'], known: [] }).bad.length).toBe(0);
  });
  it('軍略が育つと新しい策を覚え、発見の演出が出る。軍師の眼で1枚多く', () => {
    const s = mk(2);
    s.pending = [];
    const st = enrolled(s)[0];
    expect(knownStrats(s)).not.toContain('fire');
    addStrat(st, 40);
    const got = checkStratUnlocks(s);
    expect(got).toContain('fire');
    expect(s.pending.some((p) => p.type === 'newStrat' && p.id === 'fire')).toBe(true);
    expect(checkStratUnlocks(s)).toEqual([]);
    const n = stratSlots(s);
    s.instructor.abilities = ['scout', 'tactician'];
    expect(stratSlots(s)).toBe(n + 1);
  });
  it('戦術論の授業で軍略がたまる', () => {
    const s = mk(4);
    s.pending = [];
    const d = todayCards(s);
    d.cards[0] = { id: 'tactics', faces: [], tags: [] };
    const before = enrolled(s).map((x) => x.strat ?? 0);
    chooseLesson(s, 0);
    const after = enrolled(s).map((x) => x.strat ?? 0);
    expect(after.reduce((a, b) => a + b, 0)).toBeGreaterThan(before.reduce((a, b) => a + b, 0));
  });
  it('開戦の策は黄色い帯になり、ぶつかり合いのあとの策はここぞの判断で早めに切れる', () => {
    const s = mk(6);
    autoYears(s, 1);
    toBoard(s);
    const q = s.quests.find((x) => x.real) ?? s.quests[0];
    const d = enrolled(s).filter(available).slice(0, 6).map((st) => ({ studentId: st.id, armoryUid: null, item: null, staffUid: null }));
    const plan = { ...defaultPlan(s, q, d), strats: ['rally', 'withdraw'] as ('rally' | 'withdraw')[] };
    startAutoQuest(s, q.id, d, plan);
    const a = s.battle!.auto!;
    expect((a.strats ?? []).map((x) => x.id)).toContain('rally');
    expect(a.scenes[0].lines.some((l) => l.by === 'strat' || l.by === 'stratng')).toBe(true);
    const c = a.choice;
    if (c) {
      const i = c.options.findIndex((o) => o.id === 'strat:withdraw');
      expect(i).toBeGreaterThanOrEqual(0);
      chooseAuto(s, i, battleCtx(s));
      expect((s.battle!.auto!.strats ?? []).some((x) => x.id === 'withdraw' && x.early)).toBe(true);
    } else {
      advanceAuto(s, battleCtx(s));
      expect((s.battle!.auto!.strats ?? []).some((x) => x.id === 'withdraw')).toBe(true);
    }
    skipAuto(s, battleCtx(s)); finishBattle(s);
    const p = s.pending.find((x) => x.type === 'battleResult');
    expect(p && p.type === 'battleResult' && (p.stratReview ?? []).length).toBeGreaterThan(0);
  });
  it('陣形：役割から前列・後列が決まり、戦場の子に付く', () => {
    expect(defaultRow('front')).toBe('front');
    expect(defaultRow('heal')).toBe('back');
    expect(defaultRow('back')).toBe('back');
    const s = mk(7);
    autoYears(s, 1);
    toBoard(s);
    const q = s.quests[0];
    const d = enrolled(s).filter(available).slice(0, 4).map((st) => ({ studentId: st.id, armoryUid: null, item: null, staffUid: null }));
    const plan = defaultPlan(s, q, d);
    plan.rows = { [d[0].studentId]: 'back' };
    const b = previewBattle(s, q, d, plan);
    expect(b.units.find((u) => u.studentId === d[0].studentId)?.row).toBe('back');
    expect(b.units.filter((u) => u.side === 'player').every((u) => u.row === 'front' || u.row === 'back')).toBe(true);
  });
});

describe('戦闘後の生徒ごとの評価', () => {
  it('称号は20種以上。全部の性格にひとことがある', () => {
    expect(Object.keys(BADGES).length).toBeGreaterThanOrEqual(20);
    for (const k of Object.keys(EVAL_SAY) as (keyof typeof EVAL_SAY)[]) for (const p of Object.keys(PERSONALITIES)) expect((EVAL_SAY[k] as Record<string, string[]>)[p]?.length).toBeGreaterThan(0);
  });
  it('出撃した子だけ・一人ずつ：称号1〜2個、名場面、ひとこと（差し込み忘れなし）、戦績', () => {
    const s = mk(8);
    autoYears(s, 2);
    for (let k = 0; k < 4; k++) {
      toBoard(s);
      const sq = recommendSquads(s);
      startSortie(s, sq);
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      const res = s.pending.find((p) => p.type === 'sortieResult' || p.type === 'battleResult');
      const reps = res?.type === 'sortieResult' ? res.reports : res?.type === 'battleResult' ? [res] : [];
      expect(reps.length).toBeGreaterThan(0);
      for (const [i, r] of reps.entries()) {
        const deployed = sq[i].deploy.map((d) => d.studentId);
        for (const e of r.evals ?? []) {
          expect(deployed).toContain(e.id);
          if (e.outcome === 'dead') { expect(e.badges.length).toBe(0); continue; }
          expect(e.badges.length).toBeGreaterThanOrEqual(1);
          expect(e.badges.length).toBeLessThanOrEqual(2);
          for (const bd of e.badges) expect(BADGES[bd]).toBeTruthy();
          expect(e.say.length).toBeGreaterThan(0);
          expect(e.say).not.toMatch(/\{\w+\}/);
          if (e.scene) expect(e.scene).not.toMatch(/\{\w+\}/);
          expect(['S', 'A', 'B', 'C']).toContain(e.grade);
        }
      }
      autoPending(s);
    }
    const st = Object.values(s.students).find((x) => (x.evalLog ?? []).length);
    expect(st?.honors).toBeTruthy();
  });
});

describe('敵将の組織図と抜擢', () => {
  it('組織図の線：幹部は将軍の下、隊長は幹部の下', () => {
    const s = mk(9);
    for (const f of ROSTER_FACTIONS) {
      const list = activeOf(s, f);
      const head = list.find((o) => o.rank === 0)!;
      for (const o of list.filter((x) => x.rank === 1)) expect(o.parent).toBe(head.id);
      for (const o of list.filter((x) => x.rank === 2)) expect(list.find((x) => x.id === o.parent)?.rank).toBe(1);
    }
  });
  it('前に見たときからの変化：討ち取り・昇進・新任・争い中に印', () => {
    const s = mk(10);
    markOrgSeen(s);
    const f = 'empire';
    const cap = activeOf(s, f).find((o) => o.rank === 2)!;
    const mid = activeOf(s, f).find((o) => o.rank === 1)!;
    mid.status = 'dead'; mid.endYear = 1;
    ensureRosters(s, new Rng({ rng: 5 }));
    const ch = orgChanges(s, f);
    expect(ch.some((c) => c.kind === 'fell' && c.id === mid.id)).toBe(true);
    expect(ch.some((c) => c.kind === 'promote')).toBe(true);
    expect(ch.some((c) => c.kind === 'new' || c.kind === 'raised')).toBe(true);
    cap.contest = s.year;
    expect(orgChanges(s, f).some((c) => c.kind === 'contest' && c.id === cap.id)).toBe(true);
    markOrgSeen(s, f);
    cap.contest = undefined;
    expect(orgChanges(s, f).filter((c) => c.kind !== 'contest').length).toBe(0);
  });
  it('見込みのある兵：生徒を倒した兵は名前を得て、隊長の席が空くと二つ名つきで抜擢される。生徒の側は覚えている', () => {
    const s = mk(12);
    const r = new Rng({ rng: 9 });
    const victim = enrolled(s)[0];
    const p = addProspect(s, 'bandit', { given: 'ダリオ', family: '', gender: 'm', face: generateFace(r, 'frontier', 'm'), faceImage: null, classId: 'archer', level: 5, deed: `${victim.given}を重傷にした`, victim: victim.id, dead: false, weapon: 'bow' }, '盗賊退治');
    expect(prospectsOf(s, 'bandit').map((o) => o.id)).toContain(p.id);
    expect(activeOf(s, 'bandit').some((o) => o.id === p.id)).toBe(false);
    expect(s.rivalries?.[`${victim.id}|${p.id}`]?.stage).toBeGreaterThanOrEqual(1);
    // 隊長の席を空ける
    let raised = false;
    for (let k = 0; k < 20 && !raised; k++) {
      for (const o of activeOf(s, 'bandit').filter((x) => x.rank === 2)) { o.status = 'dead'; }
      ensureRosters(s, new Rng({ rng: 100 + k }));
      raised = !p.prospect;
    }
    expect(raised).toBe(true);
    expect(p.rank).toBe(2);
    expect(p.raisedYear).toBe(s.year);
    expect(p.epithet).toContain(victim.given);
    expect(p.parent).toBeTruthy();
    expect(s.chronicle.some((c) => c.text.includes('抜擢'))).toBe(true);
  });
  it('長く遊ぶと、戦いで目立った兵が見込みのある兵になり、抜擢される', () => {
    const s = mk(13);
    autoYears(s, 6);
    const all = s.officers ?? [];
    expect(all.some((o) => o.prospect || o.raisedYear)).toBe(true);
  });
});

describe('いろいろ', () => {
  it('1年遊んでもエラーが出ない（3部隊・策・評価・組織図をすべて通る）', () => {
    const s = mk(14, 'merc');
    autoYears(s, 5);
    expect(s.gameOver).toBe(false);
    expect(rng(s)).toBeTruthy();
    void officerForQuest;
  });
});
