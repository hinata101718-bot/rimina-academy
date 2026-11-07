// 2夜目の追加分のテスト：古いセーブの読み込み・魔法の覚え方・戦闘の演出用の記録
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoWeek, autoYears, autoPending, autoBattle, autoDeploy } from '../src/core/autoplay';
import { startBattle, battleCtx, nextWeek } from '../src/core/flow';
import { endPlayerPhase, autoPlayerPhase, findPath, reachable } from '../src/core/battle/engine';
import { makeSpellPlan, learnSpells, usableSpells } from '../src/core/spells';
import { WEAPONS } from '../src/data/weapons';
import { SPELL_LIST } from '../src/data/spells';
import { RANK_POINTS, SAVE_VERSION } from '../src/data/balance';
import { rollQuests } from '../src/core/quests';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('古いセーブ（1夜目の版）の読み込み', () => {
  it('武器庫の魔道書・杖を半額で売り、在校生に魔法を覚えさせる', () => {
    const raw = JSON.parse(fixture('v1-save.json'));
    expect(raw.version).toBe(1);
    const oldMoney = raw.state.money;
    const oldSpellItems = raw.state.armory.filter((a: { weaponId: string }) => ['fire', 'heal', 'thunder', 'mend', 'lumina'].includes(a.weaponId)).length;
    expect(oldSpellItems).toBeGreaterThan(0);
    const s = deserialize(fixture('v1-save.json'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.armory.every((a) => !WEAPONS[a.weaponId].spell)).toBe(true);
    // fire 175 + heal 150 + thunder 400 + mend 400 + lumina 175
    expect(s.money).toBe(oldMoney + 175 + 150 + 400 + 400 + 175);
    for (const st of enrolled(s)) {
      expect(st.spellPlan?.length).toBeGreaterThanOrEqual(8);
      for (const slot of st.spellPlan!) {
        const reached = st.skills[slot.skill] >= RANK_POINTS[slot.rank];
        expect(st.spells.includes(slot.id)).toBe(reached);
      }
    }
    expect(s.pending.some((p) => p.type === 'event' && p.title.includes('魔法'))).toBe(true);
    expect(s.settings.animSpeed).toBe(2);
    expect(s.settings.enemySpeed).toBe(1);
  });

  it('読み込んだあと、1年遊んでも壊れない', () => {
    const s = deserialize(fixture('v1-save.json'));
    autoYears(s, 1);
    expect(s.year).toBe(2);
    expect(Number.isFinite(s.money)).toBe(true);
    // もう一度書き出して読み込める
    const again = deserialize(serialize(s));
    expect(again.year).toBe(2);
  });

  it('戦闘の途中のセーブも続きから遊べる', () => {
    const s = deserialize(fixture('v1-battle.json'));
    expect(s.battle).not.toBeNull();
    autoBattle(s);
    expect(s.battle).toBeNull();
    autoPending(s);
    for (let i = 0; i < 6; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
  });
});

describe('魔法の覚え方', () => {
  it('一人あたり魔道4〜5個・信仰4〜5個、生徒によって少しずつ違う', () => {
    const s = newGame({ name: 't', background: 'mage', seed: 11 });
    const plans = enrolled(s).map((st) => st.spellPlan!);
    for (const p of plans) {
      const m = p.filter((x) => x.skill === 'magic').length, f = p.filter((x) => x.skill === 'faith').length;
      expect(m).toBeGreaterThanOrEqual(4); expect(m).toBeLessThanOrEqual(5);
      expect(f).toBeGreaterThanOrEqual(4); expect(f).toBeLessThanOrEqual(5);
    }
    const keys = new Set(plans.map((p) => p.map((x) => `${x.id}${x.rank}`).join(',')));
    expect(keys.size).toBeGreaterThan(1);
  });
  it('珍しい魔法は天才の子だけ', () => {
    const rare = new Set(SPELL_LIST.filter((w) => w.rare).map((w) => w.id));
    for (let i = 0; i < 200; i++) {
      const plan = makeSpellPlan({ id: `s${i}`, given: `x${i}`, talent: null });
      expect(plan.some((x) => rare.has(x.id))).toBe(false);
    }
    let found = 0;
    for (let i = 0; i < 50; i++) if (makeSpellPlan({ id: `g${i}`, given: `y${i}`, talent: 'genius_magic' }).some((x) => rare.has(x.id))) found++;
    expect(found).toBeGreaterThan(20);
  });
  it('技能ランクが届くと覚える', () => {
    const s = newGame({ name: 't', background: 'mage', seed: 12 });
    const st = enrolled(s)[0];
    st.skills.magic = 0; st.spells = [];
    learnSpells(s, st);
    const atE = st.spells.length;
    st.skills.magic = RANK_POINTS.S; st.skills.faith = RANK_POINTS.S;
    const got = learnSpells(s, st);
    expect(st.spells.length).toBe(st.spellPlan!.length);
    expect(got.length).toBe(st.spellPlan!.length - atE);
  });
  it('武器庫・お店に魔法はない。戦闘では覚えた魔法を使える', () => {
    const s = newGame({ name: 't', background: 'mage', seed: 13 });
    expect(s.armory.every((a) => !WEAPONS[a.weaponId].spell)).toBe(true);
    const st = enrolled(s)[0];
    st.spells = ['fire', 'heal'];
    s.quests = rollQuests(s);
    const d = autoDeploy(s).filter((x) => x.studentId === st.id);
    startBattle(s, s.quests[0].id, d.length ? d : [{ studentId: st.id, armoryUid: null, item: null }]);
    const u = s.battle!.units.find((x) => x.studentId === st.id)!;
    expect(u.weapons).toContain('fire');
    expect(u.weapons).toContain('heal');
    expect(usableSpells(st)).toEqual(['fire', 'heal']);
  });
});

describe('戦闘の演出用の記録', () => {
  it('敵ターンの記録に、1マスずつの道順と行動後の位置が入る', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 21 });
    s.quests = rollQuests(s);
    startBattle(s, s.quests[0].id, autoDeploy(s));
    const b = s.battle!;
    const ctx = battleCtx(s);
    autoPlayerPhase(b, ctx);
    const rep = endPlayerPhase(b, ctx);
    expect(rep.initial.length).toBeGreaterThan(0);
    for (const st of rep.steps) {
      for (let i = 1; i < st.path.length; i++) {
        const [x0, y0] = st.path[i - 1], [x1, y1] = st.path[i];
        expect(Math.abs(x0 - x1) + Math.abs(y0 - y1)).toBe(1);
      }
      const after = st.after.find((v) => v.uid === st.uid)!;
      const last = st.path[st.path.length - 1];
      expect([after.x, after.y]).toEqual(last);
    }
  });
  it('味方の道順は移動できるマスの中を通る', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 22 });
    s.quests = rollQuests(s);
    startBattle(s, s.quests[0].id, autoDeploy(s));
    const b = s.battle!;
    const u = b.units.find((x) => x.side === 'player')!;
    const r = reachable(b, u);
    for (const k of r.keys()) {
      const x = k % b.width, y = Math.floor(k / b.width);
      const path = findPath(b, u, x, y);
      expect(path[0]).toEqual([u.x, u.y]);
      expect(path[path.length - 1]).toEqual([x, y]);
    }
  });
  it('戦闘の結果と週のまとめに成長の記録がつく', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 23 });
    for (let i = 0; i < 3; i++) { nextWeek(s); const p = s.pending.find((x) => x.type === 'weekSummary'); if (p && p.type === 'weekSummary') expect(Array.isArray(p.growth)).toBe(true); s.pending = []; }
    nextWeek(s);
    s.pending = [];
    startBattle(s, s.quests[0].id, autoDeploy(s));
    autoBattle(s);
    const br = s.pending.find((p) => p.type === 'battleResult');
    expect(br && br.type === 'battleResult' && br.growth && br.growth.length > 0).toBe(true);
  });
});
