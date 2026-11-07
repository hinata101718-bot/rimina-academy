import { describe, it, expect } from 'vitest';
import { newGame, enrolled } from '../src/core/game';
import { startBattle, battleCtx, finishBattle } from '../src/core/flow';
import { autoDeploy, autoBattle } from '../src/core/autoplay';
import { forecast } from '../src/core/battle/calc';
import { baseUnit } from '../src/core/battle/setup';
import { attack, rewind, endPlayerPhase, reachable, canRewind } from '../src/core/battle/engine';
import { rollQuests } from '../src/core/quests';
import { emptyStats } from '../src/core/util';
import type { BattleState } from '../src/core/battle/types';

function testBattle(): BattleState {
  const s = newGame({ name: 't', background: 'knight', seed: 2 });
  s.quests = rollQuests(s);
  startBattle(s, s.quests[0].id, autoDeploy(s));
  return s.battle!;
}

function unit(side: 'player' | 'enemy', x: number, y: number, weapon: string, st: Partial<ReturnType<typeof emptyStats>> = {}) {
  const stats = { ...emptyStats(5), hp: 20, ...st };
  const u = baseUnit({ uid: `${side}${x}${y}`, side, name: side, classId: 'fighter', level: 1, stats, x, y });
  u.weapons = [weapon]; u.weaponId = weapon;
  return u;
}

describe('戦闘の計算', () => {
  it('三すくみ：剣は斧に有利（命中+15・威力+1）', () => {
    const b = testBattle();
    b.units = [];
    b.tiles = b.tiles.map(() => 'plain');
    const a = unit('player', 0, 0, 'iron_sword'), d = unit('enemy', 1, 0, 'iron_axe');
    const n = unit('player', 0, 0, 'iron_lance');
    b.units.push(a, d);
    const f = forecast(b, a, d, 0, 0, () => 0);
    expect(f.atk.triangle).toBe(1);
    expect(f.def.triangle).toBe(-1);
    b.units = [n, d];
    const f2 = forecast(b, n, d, 0, 0, () => 0);
    expect(f2.atk.triangle).toBe(-1);
    expect(f.atk.dmg - f2.atk.dmg).toBeGreaterThanOrEqual(1);
  });
  it('速さが4以上上回ると追撃', () => {
    const b = testBattle(); b.units = []; b.tiles = b.tiles.map(() => 'plain');
    const a = unit('player', 0, 0, 'iron_sword', { spd: 12 }), d = unit('enemy', 1, 0, 'iron_sword', { spd: 6 });
    b.units.push(a, d);
    expect(forecast(b, a, d, 0, 0, () => 0).atk.count).toBe(2);
  });
  it('射程外は反撃できない（弓は隣接で反撃不可）', () => {
    const b = testBattle(); b.units = []; b.tiles = b.tiles.map(() => 'plain');
    const a = unit('player', 0, 0, 'iron_sword'), d = unit('enemy', 1, 0, 'iron_bow');
    b.units.push(a, d);
    expect(forecast(b, a, d, 0, 0, () => 0).def.canAttack).toBe(false);
  });
  it('弓は飛行に特効', () => {
    const b = testBattle(); b.units = []; b.tiles = b.tiles.map(() => 'plain');
    const a = unit('player', 0, 0, 'iron_bow'), d = unit('enemy', 2, 0, 'iron_lance');
    d.classId = 'pegasus_rider';
    b.units.push(a, d);
    expect(forecast(b, a, d, 0, 0, () => 0).atk.effective).toBe(true);
  });
  it('森は回避+20', () => {
    const b = testBattle(); b.units = []; b.tiles = b.tiles.map(() => 'plain');
    const a = unit('player', 0, 0, 'iron_sword'), d = unit('enemy', 1, 0, 'iron_sword');
    b.units.push(a, d);
    const h1 = forecast(b, a, d, 0, 0, () => 0).atk.hit;
    b.tiles[1] = 'forest';
    const h2 = forecast(b, a, d, 0, 0, () => 0).atk.hit;
    expect(h1 - h2).toBe(Math.min(20, h1));
  });
  it('騎兵は山に入れない', () => {
    const b = testBattle(); b.units = []; b.tiles = b.tiles.map(() => 'mountain');
    b.tiles[0] = 'plain';
    const a = unit('player', 0, 0, 'iron_lance'); a.classId = 'cavalier';
    b.units.push(a);
    expect(reachable(b, a).size).toBe(1);
  });
});

describe('戦闘の進行', () => {
  it('演習は死なない', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 3 });
    s.quests = rollQuests(s);
    const drill = s.quests.find((q) => !q.real)!;
    startBattle(s, drill.id, autoDeploy(s));
    autoBattle(s);
    expect(enrolled(s).length).toBe(Object.values(s.students).length);
    expect(s.pending.some((p) => p.type === 'battleResult')).toBe(true);
  });
  it('実戦は最後まで進み、結果が反映される', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = newGame({ name: 't', background: 'merc', seed });
      s.quests = rollQuests(s);
      const real = s.quests.find((q) => q.real)!;
      const before = s.money;
      startBattle(s, real.id, autoDeploy(s));
      autoBattle(s);
      expect(s.battle).toBeNull();
      const r = s.pending.find((p) => p.type === 'battleResult');
      expect(r).toBeTruthy();
      if (r && r.type === 'battleResult' && r.win) expect(s.money).toBeGreaterThan(before);
      expect(enrolled(s).every((st) => st.battles >= 0)).toBe(true);
    }
  });
  it('巻き戻しで前のターンに戻れる', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 4 });
    s.quests = rollQuests(s);
    startBattle(s, s.quests[0].id, autoDeploy(s));
    const b = s.battle!;
    const ctx = battleCtx(s);
    endPlayerPhase(b, ctx);
    expect(b.turn).toBe(2);
    expect(canRewind(b)).toBeGreaterThanOrEqual(2);
    const back = rewind(b, 2);
    expect(back.turn).toBe(1);
    expect(back.rewindsLeft).toBe(2);
    void attack; void finishBattle;
  });
});

import { MAPS } from '../src/data/maps';
describe('マップの型', () => {
  it('すべて縦12×横8で、出撃位置が10か所以上ある', () => {
    for (const m of Object.values(MAPS)) {
      expect(m.rows.length, m.id).toBe(12);
      for (const r of m.rows) expect(r.length, m.id).toBe(8);
      expect(m.rows.join('').split('P').length - 1, m.id).toBeGreaterThanOrEqual(10);
    }
  });
});
