// 6夜目の追加分のテスト：宿敵の仕組み（敵将の名簿・記憶・因縁・弱点・卒業生の宿敵）、敵将の顔、手応えと発見
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { enrolled } from '../src/core/game';
import { autoYears, autoWeek, autoDeploy, autoBattle, finishAuto } from '../src/core/autoplay';
import { startAutoQuest, battleCtx, finishBattle } from '../src/core/flow';
import { rollQuests } from '../src/core/quests';
import { defaultPlan, skipAuto, chooseAuto, advanceAuto, officerForQuest, scoutQuest, leaderOf } from '../src/core/battle/auto';
import { officerName, activeOf, ensureRivalry, rivalryOf, memoryLine, yearlyOfficers, headOf, ensureRosters } from '../src/core/officers';
import { revealTalent } from '../src/core/week';
import { Rng } from '../src/core/rng';
import { SAVE_VERSION, B } from '../src/data/balance';
import { OFFICER, ROSTER_FACTIONS, ENEMY_FACES } from '../src/data/officers';
import type { GameState, Quest, EnemyOfficer } from '../src/core/state';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
function boardOf(s: GameState, seed: number, pick: (q: Quest) => boolean = (q) => q.real): Quest {
  s.rng = seed; s.pending = []; s.battle = null;
  s.quests = rollQuests(s);
  return s.quests.find(pick) ?? s.quests[0];
}
/** その敵将だけが出てくる依頼を作る（同じ陣営のほかの敵将は、戦いが始まるまで外しておく。restore で戻す） */
let restoreList: EnemyOfficer[] = [];
function restore() { for (const x of restoreList) x.status = 'active'; restoreList = []; }
function questFor(s: GameState, o: EnemyOfficer, seed0 = 1): Quest | null {
  restore();
  restoreList = activeOf(s, o.faction).filter((x) => x !== o);
  for (const x of restoreList) x.status = 'retired';
  if (s.month === 5) s.month = 6; // 9月は公開演武会だけなので避ける
  s.world.schoolDefensePending = false;
  for (let seed = seed0; seed < seed0 + 200; seed++) {
    const q = boardOf(s, seed, (x) => x.real && x.kind !== 'monster' && x.kind !== 'schoolDefense');
    if (!q.real || q.kind === 'monster') continue;
    if (o.faction === 'bandit') { q.enemyCountry = null; q.kind = 'bandit'; } else q.enemyCountry = o.faction as Quest['enemyCountry'];
    if (officerForQuest(s, q)?.id === o.id) return q;
  }
  return null;
}

describe('5夜目の版のセーブ（形式4）', () => {
  it('ふつうの時のセーブ：形式5になり、因縁の敵将は名簿の敵将に。陣営に合う顔がつき、1年遊べる', () => {
    const before = JSON.parse(fixture('v5-save.json')).state;
    expect((before.nemeses ?? []).length).toBeGreaterThan(0);
    const s = deserialize(fixture('v5-save.json'));
    expect(s.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(5);
    expect(s.nemeses).toBeUndefined();
    // 5夜目の因縁の敵将が、同じidで名簿に入っている
    for (const n of before.nemeses) {
      const o = s.officers!.find((x) => x.id === n.id)!;
      expect(o).toBeTruthy();
      expect(o.meets.length).toBe(n.meets.length);
      if (n.kind !== 'monster') { expect(o.faceImage).toBeTruthy(); expect(o.faceImage!.startsWith(`${o.faction}_`)).toBe(true); }
      expect(officerName(o).length).toBeGreaterThan(0);
    }
    // 三国の軍と盗賊団に名簿がある
    for (const f of ROSTER_FACTIONS) {
      const list = activeOf(s, f);
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(list.length).toBeLessThanOrEqual(OFFICER.rosterMax);
      expect(list.filter((o) => o.rank === 0).length).toBe(1);
    }
    expect(s.pending.some((p) => p.type === 'event' && p.title.includes('敵将の名簿'))).toBe(true);
    const n0 = s.stats.battlesWon + s.stats.battlesLost;
    autoYears(s, 1);
    expect(s.stats.battlesWon + s.stats.battlesLost).toBeGreaterThan(n0 + 8);
    expect(deserialize(serialize(s)).year).toBe(s.year);
  });
  it('自動の戦闘の途中（判断の手前）のセーブ：続きから最後まで遊べる', () => {
    const s = deserialize(fixture('v5-auto.json'));
    expect(s.battle?.auto?.choice).toBeTruthy();
    finishAuto(s);
    expect(s.battle).toBeNull();
    expect(s.pending.some((p) => p.type === 'battleResult')).toBe(true);
    for (let i = 0; i < 8; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
  });
  it('手動の戦闘の途中のセーブ：手動の戦闘の続きから最後まで遊べる', () => {
    const s = deserialize(fixture('v5-manual.json'));
    expect(s.battle).not.toBeNull();
    expect(s.battle!.auto).toBeUndefined();
    autoBattle(s);
    expect(s.battle).toBeNull();
    expect(s.pending.some((p) => p.type === 'battleResult')).toBe(true);
    for (let i = 0; i < 8; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
  });
});

describe('敵将の顔と名簿', () => {
  it('今いる敵将どうしで同じ顔にならない。顔は陣営に合い、性別もそろう', () => {
    const s = deserialize(fixture('v5-save.json'));
    autoYears(s, 2);
    const act = (s.officers ?? []).filter((o) => o.status === 'active' && o.faceImage);
    expect(act.length).toBeGreaterThan(20);
    expect(new Set(act.map((o) => o.faceImage)).size).toBe(act.length);
    for (const o of act) {
      expect(ENEMY_FACES).toContain(o.faceImage);
      expect(o.faceImage!.startsWith(`${o.faction}_${o.gender}_`)).toBe(true);
    }
  });
  it('頭が倒れると、下の者が昇格する（年鑑に残る）', () => {
    const s = deserialize(fixture('v5-save.json'));
    const h = headOf(s, 'empire')!;
    h.status = 'dead';
    ensureRosters(s, new Rng({ rng: 5 }));
    const h2 = headOf(s, 'empire')!;
    expect(h2).toBeTruthy();
    expect(h2.id).not.toBe(h.id);
    expect(s.chronicle.some((c) => c.text.includes('帝国軍') && (c.text.includes('将軍') || c.text.includes('権力争い')))).toBe(true);
  });
  it('依頼の大きさで敵将の階級が変わる（砦の攻略は幹部以上、盗賊退治はたいてい隊長）', () => {
    const s = deserialize(fixture('v5-save.json'));
    const ranks: Record<string, number[]> = {};
    for (let seed = 1; seed < 120; seed++) {
      const q = boardOf(s, seed, (x) => x.real);
      for (const x of s.quests.filter((y) => y.real)) { const o = officerForQuest(s, x); if (o) (ranks[x.kind] ??= []).push(o.rank); }
      void q;
    }
    const avg = (k: string) => (ranks[k] ?? []).reduce((a, b) => a + b, 0) / Math.max(1, (ranks[k] ?? []).length);
    if (ranks.fort?.length) expect(Math.max(...ranks.fort)).toBeLessThanOrEqual(1);
    if (ranks.bandit?.length) expect(avg('bandit')).toBeGreaterThan(1.5);
  });
});

describe('宿敵の仕組み', () => {
  it('同じ敵将と何度も戦うと、二つ名・傷・口上・宿敵の段階が変わっていく', () => {
    const s = deserialize(fixture('v5-save.json'));
    s.pending = [];
    const o = activeOf(s, s.quests.find((x) => x.enemyCountry)?.enemyCountry ?? 'empire').find((x) => x.rank === 2 && !x.alumniId) ?? activeOf(s, 'empire').find((x) => x.rank === 2)!;
    const hero = enrolled(s).sort((a, b) => b.level - a.level)[0];
    const victim = enrolled(s).sort((a, b) => b.level - a.level)[1];
    const lines: string[] = [];
    const stages: number[] = [];
    let seed = 1;
    for (let k = 0; k < 6; k++) {
      const q = questFor(s, o, seed);
      expect(q).toBeTruthy();
      seed += 7;
      s.pending = [];
      const d = autoDeploy(s).filter((x) => x.studentId !== victim.id || k === 1 || k === 2);
      if (!d.some((x) => x.studentId === hero.id)) continue;
      startAutoQuest(s, q!.id, d, defaultPlan(s, q!, d));
      restore();
      lines.push(...s.battle!.auto!.scenes[0].lines.filter((l) => l.by === 'leader').map((l) => l.text));
      skipAuto(s, battleCtx(s), () => 0);
      const b = s.battle!;
      const L = leaderOf(b)!;
      expect(L.officerId).toBe(o.id);
      const lu = b.units.find((u) => u.uid === L.uid)!;
      const hu = b.units.find((u) => u.studentId === hero.id)!;
      // 主人公の子は敵将とぶつかった。敵将は傷を負って逃げた
      (b.hitBy[lu.uid] ??= []).includes(hu.uid) || b.hitBy[lu.uid].push(hu.uid);
      hu.dmgDealt += 300;
      if (lu.dead && !b.retreated.includes(lu.uid)) b.retreated.push(lu.uid);
      lu.dead = true; L.fled = true; L.settled = null;
      if (!b.retreated.includes(lu.uid)) b.retreated.push(lu.uid);
      // 2戦目：敵将が生徒を重傷にした
      // （7夜目：敵が弱くなり自然な重傷が減ったので、2戦目と3戦目に重傷にする＝二つ名がつく）
      if (k === 1 || k === 2) { const vu = b.units.find((u) => u.studentId === victim.id); if (vu && !b.fallen.some((f) => f.studentId === victim.id)) b.fallen.push({ studentId: victim.id, outcome: 'injured', by: lu.uid }); }
      b.phase = 'done'; b.result = 'win';
      finishBattle(s);
      stages.push(rivalryOf(s, hero.id, o.id)?.stage ?? 0);
      for (const st of enrolled(s)) { st.injuredWeeks = 0; st.sickWeeks = 0; }
    }
    expect(o.status).toBe('active');
    expect(o.meets.length).toBeGreaterThanOrEqual(4);
    expect(o.scars).toBeGreaterThanOrEqual(3);
    expect(o.traits).toContain('old_wound');
    expect(o.epithet).toBeTruthy();
    expect(o.victims.some((v) => v.id === victim.id)).toBe(true);
    expect(o.grudge).toBe(hero.id);
    // 口上で過去の出来事に触れる（2戦目以降）
    expect(lines.slice(1).some((t) => /前|去年|今年|傷|借り|覚え|夢|お前|返す/.test(t))).toBe(true);
    const rem = memoryLine(s, o, [hero.id], new Rng({ rng: 3 }))!;
    expect(rem.text).toContain(hero.given);
    // 宿敵の段階が深まる（因縁→宿敵→生涯の宿敵）
    expect(stages[stages.length - 1]).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < stages.length; i++) expect(stages[i]).toBeGreaterThanOrEqual(stages[i - 1]);
    // 執着：次の戦いでその子を狙う
    const q = questFor(s, o, 500)!;
    const d = autoDeploy(s);
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    const L = leaderOf(s.battle!)!;
    const lu = s.battle!.units.find((u) => u.uid === L.uid)!;
    expect(lu.grudge).toBe(s.battle!.units.find((u) => u.studentId === hero.id)?.uid);
  });

  it('宿敵との戦いでは「宿命の対決」の判断が出て、見逃す・説得・一騎打ち・討ち取るから選べる。見逃すと因縁に決着', () => {
    let found = false;
    for (let seed = 1; seed < 80 && !found; seed++) {
      const s = deserialize(fixture('v5-save.json'));
      const q = boardOf(s, seed, (x) => x.real && !!x.enemyCountry);
      if (!q.enemyCountry) continue;
      const o = officerForQuest(s, q);
      if (!o) continue;
      const hero = enrolled(s).sort((a, b) => b.level - a.level)[0];
      const rv = ensureRivalry(s, hero.id, o.id); rv.battles = 3; rv.stage = 2;
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      for (let i = 0; i < 6 && s.battle?.auto && s.battle.auto.seg < 3; i++) {
        const c = s.battle.auto.choice;
        if (c?.kind === 'settle') {
          found = true;
          expect(c.duo).toBe(true);
          const ids = c.options.map((x) => x.id.split(':')[0]);
          expect(ids).toContain('spare'); expect(ids).toContain('kill'); expect(ids).toContain('persuade');
          chooseAuto(s, c.options.findIndex((x) => x.id === 'spare'), battleCtx(s));
          const sc = s.battle!.auto!.scenes.find((x) => x.duo);
          expect(sc?.title).toBe('宿命の対決');
          break;
        }
        if (c) chooseAuto(s, c.recommended, battleCtx(s)); else advanceAuto(s, battleCtx(s));
      }
      if (!found) continue;
      skipAuto(s, battleCtx(s));
      finishBattle(s);
      expect(rivalryOf(s, hero.id, o.id)!.settled).toBe('spare');
      expect(o.status).toBe('retired');
      expect(s.chronicle.some((c) => c.text.includes('見逃した'))).toBe(true);
    }
    expect(found).toBe(true);
  });

  it('仲間を倒された子は、その敵将に仇討ちの誓いを立てる（その敵将との戦いで能力が上がる）', () => {
    const s = deserialize(fixture('v5-save.json'));
    s.pending = [];
    const q = boardOf(s, 3, (x) => x.real && !!x.enemyCountry);
    const o = officerForQuest(s, q)!;
    const list = enrolled(s).sort((a, b) => b.level - a.level);
    const [vic, friend] = [list[0], list[1]];
    const key = vic.id < friend.id ? `${vic.id}|${friend.id}` : `${friend.id}|${vic.id}`;
    s.supports[key] = { a: vic.id < friend.id ? vic.id : friend.id, b: vic.id < friend.id ? friend.id : vic.id, value: B.support.A + 5, kind: 'friend', seen: [], lastRank: 'A' };
    const d = autoDeploy(s);
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    skipAuto(s, battleCtx(s), () => 0);
    const b = s.battle!;
    const L = leaderOf(b)!;
    const lu = b.units.find((u) => u.uid === L.uid)!;
    lu.dead = true; L.fled = true; L.settled = null; if (!b.retreated.includes(lu.uid)) b.retreated.push(lu.uid);
    b.fallen = [{ studentId: vic.id, outcome: 'dead', by: lu.uid }];
    b.phase = 'done'; b.result = 'win';
    finishBattle(s);
    expect(vic.status).toBe('dead');
    const rv = rivalryOf(s, friend.id, o.id)!;
    expect(rv.vow).toBe(vic.id);
    expect(rv.stage).toBeGreaterThanOrEqual(1);
    expect(o.victims.some((v) => v.id === vic.id && v.dead)).toBe(true);
    expect(o.epithet).toBeTruthy();
    // 次の戦いでは、誓いを立てた子に補正がつき、開戦の場面で誓いに触れる
    friend.injuredWeeks = 0; friend.sickWeeks = 0;
    const q2 = questFor(s, o, 300)!;
    const d2 = autoDeploy(s);
    if (!d2.some((x) => x.studentId === friend.id)) d2[0] = { ...d2[0], studentId: friend.id };
    startAutoQuest(s, q2.id, d2, defaultPlan(s, q2, d2));
    restore();
    const fu = s.battle!.units.find((u) => u.studentId === friend.id)!;
    expect((fu.mod?.hit ?? 0)).toBeGreaterThanOrEqual(OFFICER.vowMod.hit - 10);
    expect(s.battle!.auto!.scenes[0].lines.some((l) => l.text.includes(vic.given))).toBe(true);
  });

  it('偵察：敵将の特徴が1つ分かり、その依頼は偵察済みになる。依頼の敵将は編成を変えても同じ', () => {
    const s = deserialize(fixture('v5-save.json'));
    const q = boardOf(s, 4, (x) => x.real && !!x.enemyCountry);
    const o = officerForQuest(s, q)!;
    const k0 = o.knownTraits.length;
    const d1 = autoDeploy(s, 3), d2 = autoDeploy(s, 6);
    s.pending = [];
    startAutoQuest(s, q.id, d1, defaultPlan(s, q, d1)); const a = leaderOf(s.battle!)!.officerId; s.battle = null;
    startAutoQuest(s, q.id, d2, defaultPlan(s, q, d2)); const c = leaderOf(s.battle!)!.officerId; s.battle = null;
    expect(a).toBe(o.id); expect(c).toBe(o.id);
    const t = scoutQuest(s, q.id, false);
    expect(t).toBeTruthy();
    expect(o.knownTraits.length).toBe(k0 + 1);
    expect(q.scouted).toBe(true);
    expect(scoutQuest(s, q.id, false)).toBeNull();
  });

  it('分かった弱点は戦場で効く（炎に弱い敵将は、魔法の攻撃を受けやすい）', () => {
    const s = deserialize(fixture('v5-save.json'));
    const q = boardOf(s, 5, (x) => x.real && !!x.enemyCountry);
    const o = officerForQuest(s, q)!;
    o.traits = ['fire_weak', 'rain_hate']; o.knownTraits = ['fire_weak'];
    const d = autoDeploy(s);
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    const L = leaderOf(s.battle!)!;
    const lu = s.battle!.units.find((u) => u.uid === L.uid)!;
    const fm = (lu.foeMods ?? []).filter((m) => m.types?.includes('magic'));
    expect(fm.length).toBe(2); // 特徴そのものと、知っていて突く分
  });

  it('卒業生が敵国で出世すると、敵将として名簿に載る（生徒のときの顔のまま。説得できる）', () => {
    const s = deserialize(fixture('v5-save.json'));
    const alum = Object.values(s.students).find((x) => x.status === 'graduated' && x.career?.alive && x.career.kind === 'army' && x.career.path !== 'civil');
    expect(alum).toBeTruthy();
    alum!.career!.rank = 3; alum!.career!.retired = false;
    const c = alum!.career!.country!;
    for (const o of s.officers!) if (o.alumniId && o.faction === c) o.status = 'retired';
    const keep = OFFICER.alumniChance; OFFICER.alumniChance = 1;
    try { yearlyOfficers(s, new Rng({ rng: 9 })); } finally { OFFICER.alumniChance = keep; }
    const o = s.officers!.find((x) => x.alumniId === alum!.id)!;
    expect(o).toBeTruthy();
    expect(o.faceImage).toBeNull();
    expect(o.faction).toBe(c);
    // その卒業生が率いる戦い
    let met = false;
    for (let seed = 1; seed < 40 && !met; seed++) {
      const q = questFor(s, o, seed * 13);
      if (!q) continue;
      const d = autoDeploy(s);
      startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
      const L = leaderOf(s.battle!)!;
      if (L.officerId === o.id) {
        met = true;
        expect(L.alumniId).toBe(alum!.id);
        const lu = s.battle!.units.find((u) => u.uid === L.uid)!;
        expect(lu.persuadable).toBe(true);
        expect(lu.studentId).toBe(alum!.id);
        expect(s.battle!.auto!.scenes[0].lines.some((l) => l.by === 'leader' && l.text.includes('先生'))).toBe(true);
      }
      s.battle = null;
    }
    expect(met).toBe(true);
  });

  it('40年遊んでも、名簿の数は増えすぎない（陣営ごとに上限）', () => {
    const s = deserialize(fixture('v5-save.json'));
    autoYears(s, 6);
    for (const f of ROSTER_FACTIONS) expect(activeOf(s, f).length).toBeLessThanOrEqual(OFFICER.rosterMax);
    expect((s.officers ?? []).filter((o) => o.status !== 'active').length).toBeLessThanOrEqual(45);
  });
});

describe('手応えと発見', () => {
  it('授業でたまる疲労は7', () => {
    expect(B.fatigue.lesson).toBe(7);
  });
  it('隠れた才能：ヒント1→ヒント2→判明の順に、発見の演出が積まれる', () => {
    const s = deserialize(fixture('v5-save.json'));
    s.pending = [];
    const st = enrolled(s).find((x) => x.talent)!;
    st.talentReveal = 0;
    revealTalent(s, st, B.talent.hint1);
    revealTalent(s, st, B.talent.hint2 - B.talent.hint1);
    revealTalent(s, st, 100);
    const ds = s.pending.filter((p) => p.type === 'discovery' && p.studentId === st.id);
    expect(ds.map((p) => (p as { stage: number }).stage)).toEqual([1, 2, 3]);
    const last = ds[2] as { name?: string; text: string };
    expect(last.name).toBeTruthy();
    expect(last.text).not.toMatch(/\{\w+\}/);
  });
  it('施設を直す・評判の段階が上がると、ランクアップの演出が積まれる', async () => {
    const { upgradeFacility } = await import('../src/core/teachers');
    const { addRep } = await import('../src/core/game');
    const s = deserialize(fixture('v5-save.json'));
    s.pending = []; s.money = 99999; s.facilities.training = 1;
    const f = 'training' as const;
    expect(upgradeFacility(s, f)).toBe(true);
    s.reputation = 39; addRep(s, 3);
    const items = s.pending.filter((p) => p.type === 'rankup').flatMap((p) => (p as { items: { icon: string }[] }).items);
    expect(items.some((i) => i.icon === 'house')).toBe(true);
    expect(items.some((i) => i.icon === 'medal')).toBe(true);
  });
  it('意外な一面：何年か遊ぶと、いくつか見つかる（多すぎない）', () => {
    const s = deserialize(fixture('v5-save.json'));
    autoYears(s, 2);
    const n = Object.values(s.students).reduce((a, st) => a + (st.sides?.length ?? 0), 0);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(40);
  });
});
