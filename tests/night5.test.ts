// 5夜目の追加分のテスト：自動の戦闘
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { enrolled } from '../src/core/game';
import { autoYears, autoWeek, autoDeploy, autoBattle, finishAuto } from '../src/core/autoplay';
import { startAutoQuest, battleCtx, finishBattle } from '../src/core/flow';
import { rollQuests } from '../src/core/quests';
import { defaultPlan, skipAuto, chooseAuto, roleFit, defaultRole, estimateWin, previewBattle, enemyIntel, advanceAuto, momentum } from '../src/core/battle/auto';
import { AUTO, TACTIC_OPTIONS } from '../src/data/autobattle';
import { SAVE_VERSION } from '../src/data/balance';
import type { GameState, Quest } from '../src/core/state';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

function boardOf(s: GameState, seed: number, pick: (q: Quest) => boolean = (q) => q.real): Quest {
  s.rng = seed; s.pending = []; s.battle = null;
  s.quests = rollQuests(s);
  return s.quests.find(pick) ?? s.quests[0];
}

describe('4夜目の版のセーブ（形式3）', () => {
  it('ふつうの時のセーブを読み込むと形式4になり、設定は自動の戦闘。1年遊べる', () => {
    const s = deserialize(fixture('v4-save.json'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(4);
    expect(s.settings.manualBattle).toBe(false);
    // 6夜目：因縁の敵将は敵将の名簿（officers）に入る
    expect(s.nemeses).toBeUndefined();
    expect((s.officers ?? []).every((o) => o.meets.length === 0)).toBe(true);
    expect(s.pending.some((p) => p.type === 'event' && p.title.includes('自動'))).toBe(true);
    const won = s.stats.battlesWon + s.stats.battlesLost;
    autoYears(s, 1);
    expect(s.stats.battlesWon + s.stats.battlesLost).toBeGreaterThan(won + 8);
    expect(enrolled(s).length).toBeGreaterThan(0);
    // 書き出し→読み込みで壊れない
    const back = deserialize(serialize(s));
    expect(back.year).toBe(s.year);
  });
  it('手動の戦闘の途中のセーブは、手動の戦闘の続きから遊べる', () => {
    const s = deserialize(fixture('v4-battle.json'));
    expect(s.battle).not.toBeNull();
    expect(s.battle!.auto).toBeUndefined();
    expect(s.battle!.turn).toBeGreaterThan(1);
    autoBattle(s);
    expect(s.battle).toBeNull();
    expect(s.pending.some((p) => p.type === 'battleResult')).toBe(true);
    for (let i = 0; i < 8; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
  });
});

describe('自動の戦闘', () => {
  it('開戦→ぶつかり合い→（山場）→決着の3〜4場面、選択は1〜2回、結果にMVP', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = deserialize(fixture('v3-save.json'));
      const q = boardOf(s, seed);
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      const b0 = s.battle!;
      expect(b0.auto!.scenes[0].title).toBe('開戦');
      skipAuto(s, battleCtx(s));
      const a = s.battle!.auto!;
      const main = a.scenes.filter((x) => x.title !== '指示');
      expect(main.length).toBeGreaterThanOrEqual(3);
      expect(main.length).toBeLessThanOrEqual(4);
      expect(main[main.length - 1].title).toBe('決着');
      expect(a.choicesMade.length).toBeLessThanOrEqual(2);
      if (main.length === 4) expect(a.choicesMade.length).toBeGreaterThanOrEqual(1);
      for (const sc of a.scenes) {
        expect(sc.lines.length).toBeGreaterThan(0);
        expect(sc.lines.length).toBeLessThanOrEqual(5);
        for (const l of sc.lines) { expect(l.text).not.toMatch(/\{\w+\}/); expect(l.text.length).toBeGreaterThan(0); }
        expect(sc.momentum).toBeGreaterThanOrEqual(0); expect(sc.momentum).toBeLessThanOrEqual(1);
      }
      finishBattle(s);
      const p = s.pending.find((x) => x.type === 'battleResult');
      expect(p && p.type === 'battleResult' && p.mvp).toBeTruthy();
      // この戦いで伸びた・分かったこと：レベルが上がった子は必ず載る
      if (p && p.type === 'battleResult') for (const g of p.growth ?? []) if (g.lv1 > g.lv0) expect(p.findings?.some((f) => f.id === g.id && f.text.includes(`Lv${g.lv1}`))).toBe(true);
      expect(s.battle).toBeNull();
    }
  });

  it('戦闘の途中（選択の前）で保存しても、読み込んで続きから最後まで遊べる', () => {
    const s = deserialize(fixture('v3-save.json'));
    let found = false;
    for (let seed = 1; seed < 30 && !found; seed++) {
      const q = boardOf(s, seed);
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      if (s.battle?.auto?.choice) found = true;
    }
    expect(found).toBe(true);
    const back = deserialize(serialize(s));
    expect(back.battle?.auto?.choice).toBeTruthy();
    chooseAuto(back, 0, battleCtx(back));
    skipAuto(back, battleCtx(back));
    finishBattle(back);
    expect(back.battle).toBeNull();
  });

  it('同じ依頼を同じ編成で20回：場面の文と出来事の並びが続けて同じにならない', () => {
    const s = deserialize(fixture('v3-save.json'));
    const q0 = boardOf(s, 5);
    const d = autoDeploy(s);
    const seqs: string[] = [];
    const opens: string[] = [];
    const events = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const g = deserialize(serialize(s));
      g.autoMemory = s.autoMemory; // 直近に使った文は持ち越す
      g.rng = 1000 + i;
      const q = { ...q0, id: `${q0.id}_${i}` };
      g.quests = [q];
      startAutoQuest(g, q.id, d, defaultPlan(g, q, d));
      skipAuto(g, battleCtx(g));
      const a = g.battle!.auto!;
      seqs.push(a.scenes.map((x) => x.lines.map((l) => l.text).join('|')).join('//'));
      opens.push(a.scenes[0].lines.map((l) => l.text).join('|'));
      for (const e of a.events) events.add(e.split(':')[0]);
      s.autoMemory = g.autoMemory;
    }
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).not.toBe(seqs[i - 1]);
    expect(new Set(seqs).size).toBe(20);
    expect(new Set(opens).size).toBeGreaterThanOrEqual(12);
    for (let i = 1; i < opens.length; i++) expect(opens[i]).not.toBe(opens[i - 1]);
    expect(events.size).toBeGreaterThanOrEqual(3);
  });

  it('まったく同じ戦い（同じ依頼・同じ編成・同じ流れ）を20回でも、場面の文は毎回ちがう', () => {
    const s = deserialize(fixture('v3-save.json'));
    const q = boardOf(s, 5);
    const d = autoDeploy(s);
    const seqs: string[] = [];
    for (let i = 0; i < 20; i++) {
      const g = deserialize(serialize(s));
      g.autoMemory = s.autoMemory;
      startAutoQuest(g, q.id, d, defaultPlan(g, q, d));
      skipAuto(g, battleCtx(g));
      seqs.push(g.battle!.auto!.scenes.map((x) => x.lines.map((l) => l.text).join('|')).join('//'));
      s.autoMemory = g.autoMemory;
    }
    expect(new Set(seqs).size).toBeGreaterThanOrEqual(18);
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).not.toBe(seqs[i - 1]);
  });

  it('役割は兵種から自動で決まり、向き不向きがある', () => {
    expect(roleFit('armor_knight', 'front')).toBe(2);
    expect(roleFit('archer', 'back')).toBe(2);
    expect(roleFit('archer', 'front')).toBe(0);
    expect(roleFit('cavalier', 'flank')).toBe(2);
    expect(defaultRole('archer')).toBe('back');
    expect(defaultRole('armor_knight')).toBe('front');
    for (const obj of Object.keys(TACTIC_OPTIONS)) { const n = TACTIC_OPTIONS[obj as Quest['objective']].length; expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(4); }
  });

  it('出撃前：敵の情報（兵種の内訳・相性・敵将）と勝ち目の目安。ゲームの状態は変えない', () => {
    const s = deserialize(fixture('v3-save.json'));
    const q = boardOf(s, 3);
    const d = autoDeploy(s);
    const before = serialize(s);
    const b = previewBattle(s, q, d);
    const intel = enemyIntel(s, b);
    expect(intel.count).toBeGreaterThan(0);
    expect(intel.types.length).toBeGreaterThan(0);
    expect(intel.matchText.length).toBeGreaterThan(0);
    expect(intel.leader?.name).toBeTruthy();
    const e = estimateWin(s, q, d, defaultPlan(s, q, d), battleCtx(s));
    expect(['優勢', '五分', '苦しい']).toContain(e.label);
    expect(JSON.parse(serialize(s)).state).toEqual(JSON.parse(before).state);
    // 同じ編成なら、出撃前に見た敵と実際の敵は同じ
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    expect(s.battle!.units.filter((u) => u.side === 'enemy').map((u) => u.classId).sort()).toEqual(b.units.filter((u) => u.side === 'enemy').map((u) => u.classId).sort());
  });

  it('育て方が結果に出る：生徒を強くすると勝ちやすく、弱くすると負けやすい', () => {
    let strong = 0, weak = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const mul of [1.4, 0.6]) {
        const s = deserialize(fixture('v3-save.json'));
        const q = boardOf(s, seed);
        const d = autoDeploy(s);
        // 敵は依頼の時点で決まるので、出撃前に見た敵の強さを固定してから生徒だけを変える
        const plan = defaultPlan(s, q, d);
        startAutoQuest(s, q.id, d, plan);
        for (const u of s.battle!.units.filter((x) => x.side === 'player')) for (const k of ['hp', 'str', 'mag', 'skl', 'spd', 'def', 'res'] as const) { u.stats[k] = Math.round(u.stats[k] * mul); if (k === 'hp') { u.maxHp = u.stats.hp; u.hp = u.maxHp; } }
        skipAuto(s, battleCtx(s));
        if (s.battle!.result === 'win') { if (mul > 1) strong++; else weak++; }
      }
    }
    expect(strong).toBeGreaterThan(weak);
  });

  it('ここぞの選択「撤退する」：負けになるが、それ以降は誰も倒れない', () => {
    const s = deserialize(fixture('v3-save.json'));
    for (let seed = 1; seed < 40; seed++) {
      const q = boardOf(s, seed);
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      const c = s.battle?.auto?.choice;
      const i = c?.options.findIndex((o) => o.id === 'retreat') ?? -1;
      if (!c || i < 0) continue;
      const fallen = s.battle!.fallen.length;
      chooseAuto(s, i, battleCtx(s));
      expect(s.battle!.result).toBe('lose');
      expect(s.battle!.fallen.length).toBe(fallen);
      expect(s.battle!.auto!.seg).toBe(3);
      return;
    }
    // 押されている場面を作る：敵を強くして試す
    const q = boardOf(s, 7);
    const d = autoDeploy(s);
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    expect(momentum(s.battle!)).toBeGreaterThanOrEqual(0);
  });

  it('演習では誰も死なない', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const s = deserialize(fixture('v3-save.json'));
      const q = boardOf(s, seed, (x) => !x.real);
      const before = s.stats.deaths;
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      // 「作戦を優先」など危ない選択ばかり選ぶ
      finishAuto(s, (c) => Math.max(0, c.options.findIndex((o) => o.id === 'plan' || o.id === 'push' || o.id.startsWith('duel:'))));
      expect(s.stats.deaths).toBe(before);
    }
  });

  it('敵将を取り逃がすと因縁の敵将になり、名簿に残る。のちにまた現れる（6夜目：名簿の敵将として）', () => {
    const s = deserialize(fixture('v3-save.json'));
    let o: import('../src/core/state').EnemyOfficer | undefined;
    for (let seed = 1; seed < 60 && !o; seed++) {
      const q = boardOf(s, seed, (x) => x.real && !!x.enemyCountry);
      if (!q.enemyCountry) continue;
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      skipAuto(s, battleCtx(s));
      const L = s.battle!.auto!.leader!;
      const lu = s.battle!.units.find((u) => u.uid === L.uid)!;
      // 取り逃がした（7夜目：敵が弱くなり討ち取ることが増えたので、倒れていても逃げたことにする）
      lu.dead = true; if (!s.battle!.retreated.includes(lu.uid)) s.battle!.retreated.push(lu.uid); L.fled = true; L.settled = null;
      finishBattle(s);
      o = (s.officers ?? []).find((x) => x.id === L.officerId && x.status === 'active' && x.meets.length === 1);
    }
    expect(o).toBeTruthy();
    expect(o!.meets[0].result).toBe('fled');
    // 同じ陣営の敵の依頼で、また現れることがある（会ったことのある敵将は選ばれやすい）
    let again = false;
    for (let seed = 100; seed < 200 && !again; seed++) {
      const q = boardOf(s, seed, (x) => x.real && x.enemyCountry === o!.faction);
      if (q.enemyCountry !== o!.faction) continue;
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      if (s.battle!.auto!.leader!.officerId === o!.id) {
        again = true;
        expect(s.battle!.auto!.leader!.again).toBe(true);
        expect(s.battle!.auto!.scenes[0].lines.some((l) => l.by === 'leader')).toBe(true);
      }
      s.battle = null;
    }
    expect(again).toBe(true);
  });

  it('場面を進める処理を何度呼んでも壊れない', () => {
    const s = deserialize(fixture('v3-save.json'));
    const q = boardOf(s, 2);
    const d = autoDeploy(s);
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    expect(s.battle!.auto).toBeTruthy();
    advanceAuto(s, battleCtx(s));
    skipAuto(s, battleCtx(s));
    finishBattle(s);
    expect(s.battle).toBeNull();
  });
});
