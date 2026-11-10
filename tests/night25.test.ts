import { describe, it, expect } from 'vitest';
import { newGame, enrolled } from '../src/core/game';
import { serialize, deserialize } from '../src/core/save';
import { battleTechs, autoBattleTechs, toggleBattleTech, autoPickTechs, techUsable } from '../src/core/techs';
import { applyClass } from '../src/core/tactics/setup';
import { inRange, rangeOf } from '../src/core/tactics/engine';
import { ENEMY_KINDS, TECH_BY_ID, WTYPE_ATK } from '../src/data/tactics';
import { SAVE_VERSION } from '../src/data/balance';
import type { TUnit, TBattle } from '../src/core/tactics/types';
import type { Student } from '../src/core/state';

function mk(over: Partial<TUnit> = {}): TUnit {
  return { uid: 'x', side: 'me', name: 'x', classId: 'swordsman', x: 0, y: 0, hp: 30, max: 30, str: 10, mag: 4, skl: 4, spd: 6, def: 4, res: 3, mov: 3, rmin: 1, rmax: 1, type: 'slash', magic: false, might: 5, techs: [], sh: 0, shMax: 0, weak: [], resist: [], known: [], broken: 0, acted: false, alive: true, kills: 0, dealt: 0, taken: 0, weakHits: 0, breaks: 0, ...over };
}
const B0 = { units: [], w: 8, h: 10 } as unknown as TBattle;
/** u が (ux,uy) に立って、距離 d の敵を射てるか */
function can(classId: string, wtype: string, d: number, moved = false, techId: string | null = null): boolean {
  const u = mk({ classId, x: 0, y: 0 });
  applyClass(u, classId, wtype);
  const foe = mk({ uid: 'f', side: 'foe', x: d, y: 0 });
  const [x, y] = moved ? [0, 0] : [u.x, u.y];
  if (moved) { u.x = 9; u.y = 9; }
  return inRange(B0, u, x, y, foe, techId);
}

describe('25夜目②：弓の届く距離（問120・A）', () => {
  it('弓兵は2マス先だけ（隣も3マス先も射てない）', () => {
    expect(can('archer', 'bow', 1)).toBe(false);
    expect(can('archer', 'bow', 2)).toBe(true);
    expect(can('archer', 'bow', 3)).toBe(false);
  });
  it('狙撃手は動かなかった番だけ3マス、スナイパーは4マス', () => {
    expect(can('sharpshooter', 'bow', 3)).toBe(true);
    expect(can('sharpshooter', 'bow', 3, true)).toBe(false);
    expect(can('sharpshooter', 'bow', 4)).toBe(false);
    expect(can('sniper', 'bow', 4)).toBe(true);
    expect(can('sniper', 'bow', 5)).toBe(false);
    expect(can('sniper', 'bow', 3, true)).toBe(false);
  });
  it('弓聖は動いても4マスまで（盤のどこへでも、ではない）', () => {
    expect(can('bow_saint', 'bow', 4, true)).toBe(true);
    expect(can('bow_saint', 'bow', 5)).toBe(false);
    expect(can('bow_saint', 'bow', 1)).toBe(false);
  });
  it('技：狙い撃ち・火矢・二連射・狙撃は2〜3マス', () => {
    for (const id of ['aimshot', 'firearrow', 'twin', 'snipe']) expect(TECH_BY_ID[id].range).toEqual([2, 3]);
    expect(can('archer', 'bow', 3, true, 'aimshot')).toBe(true);
    expect(can('archer', 'bow', 4, false, 'aimshot')).toBe(false);
  });
  it('敵の弓兵・銃・斧と弓・弓と剣も2マス', () => {
    expect(ENEMY_KINDS.bow.range).toEqual([2, 2]);
    expect(WTYPE_ATK.bow.range).toEqual([2, 2]);
    expect(WTYPE_ATK.gun.range).toEqual([2, 2]);
    const w = mk({ classId: 'warrior' }); applyClass(w, 'warrior', 'axe');
    expect(rangeOf(w, null, 'basic:shot')).toEqual([2, 2]);
    expect(rangeOf(w, null, 'basic:crush')).toEqual([1, 1]);
    const k = mk({ classId: 'bowknight' }); applyClass(k, 'bowknight', 'bow');
    expect(rangeOf(k, null, 'basic:shot')).toEqual([2, 2]);
  });
});

function archerKid(): Student {
  const s = newGame({ name: 'テスト', background: 'knight', seed: 5 });
  const st = enrolled(s)[0];
  st.classId = 'archer';
  st.skills.bow = 300;
  st.skills.sword = 300;
  st.techs = ['firearrow', 'aimshot', 'twin', 'swallow', 'iai', 'moonlight'];
  // 弓の技はあと1つ（狙撃＝銃は兵種の武器に合わないので使えない）
  st.techs.push('snipe');
  delete st.techPick;
  return st;
}

describe('25夜目①：戦いに持っていく技を選ぶ', () => {
  it('選んでいない子はおまかせ（今までの決め方）', () => {
    const st = archerKid();
    expect(battleTechs(st).map((t) => t.id)).toEqual(autoBattleTechs(st).map((t) => t.id));
    expect(battleTechs(st).every((t) => techUsable(st, t))).toBe(true);
  });
  it('今の兵種で使えない技は選べない', () => {
    const st = archerKid();
    expect(techUsable(st, TECH_BY_ID.iai)).toBe(false);
    expect(toggleBattleTech(st, 'iai')).toEqual({ ok: false, why: 'unusable' });
  });
  it('外すとそのぶん減り、入れ替えもできる。4つ選んでいて5つ目は「入れ替え」', () => {
    const st = archerKid();
    st.classId = 'bowknight'; // 弓と剣：剣の技も使える
    const now = battleTechs(st).map((t) => t.id);
    expect(now.length).toBe(4);
    const extra = (st.techs ?? []).find((id) => !now.includes(id) && techUsable(st, TECH_BY_ID[id]))!;
    expect(extra).toBeTruthy();
    expect(toggleBattleTech(st, extra)).toEqual({ ok: false, why: 'full' });
    expect(toggleBattleTech(st, extra, now[0]).ok).toBe(true);
    expect(battleTechs(st).map((t) => t.id)).toContain(extra);
    expect(battleTechs(st).map((t) => t.id)).not.toContain(now[0]);
    expect(toggleBattleTech(st, extra).ok).toBe(true);
    expect(battleTechs(st).length).toBe(3);
    autoPickTechs(st);
    expect(st.techPick).toBeUndefined();
    expect(battleTechs(st).length).toBe(4);
  });
  it('兵種を変えて使えなくなった技は、おまかせで埋める', () => {
    const st = archerKid();
    st.classId = 'bowknight';
    st.techPick = ['iai', 'moonlight', 'aimshot'];
    st.classId = 'archer';
    const ids = battleTechs(st).map((t) => t.id);
    expect(ids[0]).toBe('aimshot');
    expect(ids.length).toBe(3);
    expect(ids.every((id) => techUsable(st, TECH_BY_ID[id]))).toBe(true);
  });
  it('24夜目版のセーブを読める（みな「おまかせ」のまま）', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 8 });
    const f = JSON.parse(serialize(s));
    f.version = 24;
    const t = deserialize(JSON.stringify(f));
    expect(t.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(25);
    for (const st of Object.values(t.students)) expect(st.techPick).toBeUndefined();
  });
  it('選んだ技はセーブに残る', () => {
    const s = newGame({ name: 'テスト', background: 'knight', seed: 9 });
    const st = enrolled(s).find((x) => (x.techs ?? []).length >= 2);
    if (!st) return;
    st.techPick = [st.techs![0]];
    const t = deserialize(serialize(s));
    expect(t.students[st.id].techPick).toEqual([st.techs![0]]);
  });
});
