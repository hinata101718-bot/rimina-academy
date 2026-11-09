import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, autoWeek } from '../src/core/autoplay';
import { deserialize, serialize } from '../src/core/save';
import { CLASSES } from '../src/data/classes';
import { STATS, SAVE_VERSION } from '../src/data/balance';
import { TB } from '../src/data/tactics';
import type { TBattle, TUnit } from '../src/core/tactics/types';
import { attack, endTurn, undoLast, calc, intents, unit, attackable, bestSpot, reach, insight, command } from '../src/core/tactics/engine';
import { autoFinish } from '../src/core/tactics/ai';
import { buildBattle, finishBattle, chooseLesson, startOpeningBattle } from '../src/core/flow';
import { recommendSquad } from '../src/core/sortie';
import type { GameState } from '../src/core/state';

const mk = (seed = 1) => newGame({ name: 'テスト', background: 'knight', seed });

function base(): TUnit {
  return { uid: 'x', side: 'me', name: 'x', classId: 'swordsman', x: 0, y: 0, hp: 30, max: 30, str: 10, mag: 4, skl: 4, spd: 6, def: 4, mov: 3, rmin: 1, rmax: 1, type: 'slash', magic: false, might: 5, techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0 };
}
function mini(): TBattle {
  const a: TUnit = { ...base(), uid: 'a', x: 2, y: 5 };
  const t: TUnit = { ...base(), uid: 'teacher', teacher: true, x: 2, y: 7, name: '先生' };
  const f: TUnit = { ...base(), uid: 'boss', side: 'foe', name: '敵将', x: 2, y: 3, hp: 60, max: 60, str: 8, def: 3, spd: 4, sh: 2, shMax: 2, weak: ['slash', 'fire'], known: ['slash'], boss: true };
  const b: TBattle = { v: 19, questId: 'q', title: 't', field: 'plain', w: 6, h: 8, forest: [], rock: [], units: [a, t, f], turn: 1, phase: 'player', result: null, objective: 'boss', teacherUid: 'teacher', command: 1, insight: 2, undo: null, log: [], scenes: [], fx: [], said: [], foes0: 1, real: true };
  intents(b);
  return b;
}

describe('19夜目：新しい戦い（運なし）', () => {
  it('攻撃は必ず当たり、決まった計算になる', () => {
    const b1 = mini(), b2 = mini();
    attack(b1, 'a', 'boss', null); attack(b2, 'a', 'boss', null);
    expect(unit(b1, 'boss')!.hp).toBe(unit(b2, 'boss')!.hp);
    expect(unit(b1, 'boss')!.hp).toBeLessThan(60);
  });
  it('弱点を突くと盾が割れ、0でブレイク。ブレイク中は傷が2倍で、次の敵の番は動けない', () => {
    const b = mini();
    const before = calc(b, unit(b, 'a')!, unit(b, 'boss')!, null);
    expect(before.weak).toBe(true);
    expect(before.hits).toBe(1);
    attack(b, 'a', 'boss', null);
    expect(unit(b, 'boss')!.sh).toBe(1);
    unit(b, 'a')!.acted = false;
    attack(b, 'a', 'boss', null);
    const bs = unit(b, 'boss')!;
    expect(bs.sh).toBe(0);
    expect(bs.broken).toBeGreaterThan(0);
    const c = calc(b, unit(b, 'a')!, bs, null);
    expect(c.per).toBe(before.per * TB.breakMul);
    const ax = unit(b, 'a')!; const hp = ax.hp;
    endTurn(b);
    expect(unit(b, 'a')!.hp).toBe(hp); // 動けない
    expect(b.turn).toBe(2);
    expect(unit(b, 'boss')!.broken).toBeGreaterThan(0); // 次のこちらの番も、まだ崩れている
    endTurn(b);
    expect(unit(b, 'boss')!.broken).toBe(0);
  });
  it('ひとつ戻す', () => {
    const b = mini();
    const hp = unit(b, 'boss')!.hp;
    attack(b, 'a', 'boss', null);
    expect(unit(b, 'boss')!.hp).toBeLessThan(hp);
    expect(undoLast(b)).toBe(true);
    expect(unit(b, 'boss')!.hp).toBe(hp);
    expect(unit(b, 'a')!.acted).toBe(false);
  });
  it('宿敵は執念で一度だけ持ちこたえる', () => {
    const b = mini();
    const bs = unit(b, 'boss')!; bs.nemesis = true; bs.hp = 3; bs.sh = 5; bs.weak = []; bs.known = [];
    attack(b, 'a', 'boss', null);
    expect(bs.alive).toBe(true);
    expect(bs.hp).toBe(1);
    expect(bs.clung).toBe(true);
  });
  it('「命の危険」は宿敵戦だけ。しるしのある攻撃で倒れると戦死、死なしの設定なら大けが', () => {
    const b = mini();
    const a = unit(b, 'a')!; a.hp = 3; a.y = 4;
    intents(b);
    expect((unit(b, 'boss')!.aim as { lethal: boolean }).lethal).toBe(false);
    b.nemesisId = 'o1'; unit(b, 'boss')!.nemesis = true; // 20夜目：命の危険は宿敵その人の一撃だけ
    intents(b);
    expect((unit(b, 'boss')!.aim as { lethal: boolean }).lethal).toBe(true);
    const b2: TBattle = JSON.parse(JSON.stringify(b));
    endTurn(b);
    expect(unit(b, 'a')!.down).toBe('dead');
    endTurn(b2, { noDeath: true });
    expect(unit(b2, 'a')!.down).toBe('injured');
  });
  it('先生の見極めで隠れた弱点が分かる。号令でもう一度動ける', () => {
    const b = mini();
    unit(b, 'teacher')!.y = 6; unit(b, 'teacher')!.x = 3;
    unit(b, 'boss')!.y = 4;
    insight(b, 'boss');
    expect(unit(b, 'boss')!.known).toContain('fire');
    const b2 = mini();
    attack(b2, 'a', 'boss', null);
    command(b2, 'a');
    expect(unit(b2, 'a')!.acted).toBe(false);
    expect(b2.command).toBe(0);
  });
  it('赤い敵（攻撃できる敵）と、いちばんいい場所', () => {
    const b = mini();
    const a = unit(b, 'a')!;
    expect(attackable(b, a).map((u) => u.uid)).toContain('boss');
    const sp = bestSpot(b, a, unit(b, 'boss')!, null)!;
    expect(Math.abs(sp.x - 2) + Math.abs(sp.y - 3)).toBe(1);
    expect(sp.x + '-' + sp.y in reach(b, a)).toBe(true);
  });
  it('おまかせは同じ盤面なら同じ結果（運なし）で、最後まで決着する', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s1 = toQuest(mk(seed)), s2 = JSON.parse(JSON.stringify(s1)) as GameState;
      const q1 = s1.quests[0], q2 = s2.quests[0];
      const b1 = buildBattle(s1, q1, recommendSquad(s1, q1).deploy), b2 = buildBattle(s2, q2, recommendSquad(s2, q2).deploy);
      autoFinish(b1); autoFinish(b2);
      expect(b1.phase).toBe('done');
      expect(b1.result).toBe(b2.result);
      expect(b1.turn).toBe(b2.turn);
    }
  });
});

function toQuest(s: GameState): GameState {
  let k = 0;
  while (!s.pending.some((p) => p.type === 'questBoard') && k++ < 40) { s.pending = []; chooseLesson(s, 0); }
  return s;
}

describe('19夜目：始まりの1時間', () => {
  it('着任の道中の戦いから始まり、その敵将が最初の宿敵になる', () => {
    const s = mk(11);
    expect(s.openingPending).toBe(true);
    startOpeningBattle(s);
    expect(s.battle?.tutorial).toBe(true);
    const oid = s.openingOfficer!;
    expect(s.battle!.units.find((u) => u.boss)?.officerId).toBe(oid);
    autoFinish(s.battle!, { noDeath: true });
    finishBattle(s);
    expect(s.battle).toBeNull();
    expect(s.month).toBe(0);
    expect(s.pending.some((p) => p.type === 'nemesis' && p.kind === 'first')).toBe(true);
    const o = s.officers!.find((x) => x.id === oid)!;
    expect(o.status).toBe('active');
    expect(o.meets.length).toBe(1);
    expect(Object.values(s.students).every((st) => st.status !== 'dead')).toBe(true);
  });
});

describe('19夜目：片づけ', () => {
  it('兵種の木（初級8・中級24・上級26）、能力は体の6つ＋心の3つ', () => {
    const L = Object.values(CLASSES);
    expect(L.filter((c) => c.tier === 1 && !c.hidden).length).toBe(8);
    expect(L.filter((c) => c.tier === 2 && !c.hidden).length).toBe(24);
    expect(L.filter((c) => c.tier === 3 && !c.hidden).length).toBe(26);
    for (const c of L) for (const p of c.prereq) expect(CLASSES[p]).toBeTruthy();
    const s = mk(3);
    for (const st of enrolled(s)) {
      expect(CLASSES[st.classId].tier).toBe(1);
      expect(Object.keys(st.stats).sort()).toEqual([...STATS].sort());
      expect(st.mind).toBeTruthy();
      expect(st.mind!.fight).toBeGreaterThan(0);
    }
    expect(s.facilities).toBeTruthy();
  });
  it('1年を最後まで回せる（月末は新しい戦い・おまかせ）', () => {
    const s = mk(5);
    autoYears(s, 1);
    expect(s.year).toBe(2);
    expect(s.stats.battlesWon + s.stats.battlesLost).toBeGreaterThanOrEqual(10);
    expect(s.battle).toBeNull();
  });
  it('月末の戦いを自分で始めて、結果まで進められる', () => {
    const s = toQuest(mk(6));
    const q = s.quests[0];
    s.pending = [];
    s.battle = buildBattle(s, q, recommendSquad(s, q).deploy);
    autoFinish(s.battle);
    finishBattle(s);
    expect(s.battle).toBeNull();
    expect(s.pending.some((p) => p.type === 'battleResult')).toBe(true);
    autoPending(s);
    autoWeek(s);
  });
});

describe('19夜目：古いセーブ（17夜目版・16夜目版）を読み込める', () => {
  const dir = new URL('./fixtures/', import.meta.url);
  const files = readdirSync(dir).filter((f) => /^v1[0-7]-/.test(f));
  for (const f of files) {
    it(`${f}：変換して1年遊べる`, () => {
      const s = deserialize(readFileSync(new URL(f, dir), 'utf8'));
      expect(s.version).toBe(SAVE_VERSION);
      expect(s.oldSave).toBeLessThan(19);
      expect(s.battle).toBeNull();
      for (const st of Object.values(s.students)) {
        expect(CLASSES[st.classId]).toBeTruthy();
        expect((st.stats as unknown as Record<string, number>).lck).toBeUndefined();
        expect((st.stats as unknown as Record<string, number>).res).toBeUndefined();
        expect(st.mind).toBeTruthy();
      }
      expect(s.pending.some((p) => p.type === 'event' && p.title === '大きく作り直しました')).toBe(true);
      autoYears(s, 1);
      const again = deserialize(serialize(s));
      expect(again.year).toBe(s.year);
    });
  }
});
