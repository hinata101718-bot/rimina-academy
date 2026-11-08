// 4夜目の追加分のテスト
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoWeek, autoPending, autoBattle, autoCareerPlans } from '../src/core/autoplay';
import { endingReady, neutralProgress, neutralRevealed, buildHallEntry, hallRecords, hallCompareRow, type HallEntry } from '../src/core/ending';
import { yearEnd } from '../src/core/flow';
import { B, SAVE_VERSION } from '../src/data/balance';
import type { GameState } from '../src/core/state';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** 卒業生を n 人そろえる */
function withGrads(s: GameState, n: number) {
  const g = Object.values(s.students).find((x) => x.status === 'graduated') ?? enrolled(s)[0];
  const have = Object.values(s.students).filter((x) => x.status === 'graduated').length;
  for (let i = have; i < n; i++) s.students[`g${i}`] = { ...g, id: `g${i}`, status: 'graduated', career: g.career ? { ...g.career } : { alive: true, kind: 'home', country: null, path: 'warrior', rank: 0 } as never };
}

describe('学校の中立宣言（隠しエンド）', () => {
  it('条件：評判90以上・卒業生100人以上・三国との友好度60以上・独立・その年度に防衛戦に勝利', () => {
    expect(B.ending.neutralRep).toBe(90);
    expect(B.ending.neutralGrads).toBe(100);
    expect(B.ending.neutralFriendship).toBe(60);
    const s = deserialize(fixture('v3-save.json'));
    s.endings = [];
    s.reputation = 90; s.world.friendship = { kingdom: 60, empire: 61, alliance: 99 }; s.world.vassal = null; s.world.era = null; s.world.peaceRoundYear = null;
    withGrads(s, 99);
    s.world.defenseWonYear = s.year;
    expect(endingReady(s, 'month')).toBeNull(); // 卒業生が1人足りない
    withGrads(s, 100);
    expect(endingReady(s, 'month')?.kind).toBe('neutral');
    // ひとつでも欠けると届かない
    s.world.defenseWonYear = s.year - 1;
    expect(endingReady(s, 'month')).toBeNull();
    s.world.defenseWonYear = s.year;
    s.world.friendship.empire = 59;
    expect(endingReady(s, 'month')).toBeNull();
    s.world.friendship.empire = 60; s.world.vassal = 'kingdom';
    expect(endingReady(s, 'month')).toBeNull();
    s.world.vassal = null; s.reputation = 89.5;
    expect(endingReady(s, 'month')).toBeNull();
  });
  it('戦況タブの「中立宣言への道」：条件ごとの✓／×。評判70までは伏せる', () => {
    const s = deserialize(fixture('v3-save.json'));
    s.endings = [];
    s.reputation = 60;
    expect(neutralRevealed(s)).toBe(false);
    s.reputation = 70;
    expect(neutralRevealed(s)).toBe(true);
    const p = neutralProgress(s);
    expect(p.length).toBe(5);
    expect(p.find((x) => x.label.includes('評判'))!.ok).toBe(false);
    s.reputation = 95;
    expect(neutralProgress(s).find((x) => x.label.includes('評判'))!.ok).toBe(true);
  });
  it('友好度は、その国にいる卒業生が少ないと年度末に少しずつ下がる', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 11 });
    s.world.friendship = { kingdom: 100, empire: 100, alliance: 100 };
    yearEnd(s, []);
    // 卒業生がいないので、三国とも下がる
    for (const c of ['kingdom', 'empire', 'alliance'] as const) expect(s.world.friendship[c]).toBeLessThan(100);
  });
  it('中立狙いの進路は、三国へ均等に送る', () => {
    const s = deserialize(fixture('v3-save.json'));
    for (const st of enrolled(s)) { if (st.grade !== 3) continue; st.offers = ['kingdom', 'empire', 'alliance']; }
    const plans = autoCareerPlans(s, 'neutral');
    const n: Record<string, number> = {};
    for (const p of plans) n[p.recommend] = (n[p.recommend] ?? 0) + 1;
    const vals = Object.values(n);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(Math.max(2, Math.ceil(plans.length / 3)));
  });
});

describe('殿堂', () => {
  it('殿堂に保存するとき、顔画像の名前と似顔絵（パーツ）の両方を持つ。記録も残す', () => {
    const s = deserialize(fixture('v3-save.json'));
    const h = buildHallEntry(s, (st) => { st.faceImage ??= 'm_black_01.webp'; return st.faceImage; });
    expect(h.v).toBe(2);
    for (const g of h.graduates) { expect(g.face).toBeTruthy(); expect(typeof g.face.hair).toBe('number'); expect('faceImage' in g).toBe(true); }
    expect(h.graduates.every((g) => g.faceImage)).toBe(true);
    // 生徒の顔を後から変えても、殿堂の顔は変わらない
    const st = Object.values(s.students).find((x) => x.status === 'graduated')!;
    const before = JSON.stringify(h.graduates.find((g) => g.id === st.id)!.face);
    st.face.hair = (st.face.hair + 1) % 5;
    expect(JSON.stringify(h.graduates.find((g) => g.id === st.id)!.face)).toBe(before);
    expect(h.records?.topLevel?.n).toBeGreaterThan(0);
    const row = hallCompareRow(h);
    expect(row.graduates).toBeGreaterThan(0);
  });
  it('3夜目の殿堂（記録なし）も、ある項目から記録と比較の表を出せる', () => {
    const old = JSON.parse(fixture('v3-hall.json')) as HallEntry[];
    expect(old[0].v).toBeUndefined();
    const rec = hallRecords(old[0]);
    expect(rec.topLevel).not.toBeNull();
    const row = hallCompareRow(old[0]);
    expect(row.endings).toContain('疲弊の停戦');
    expect(old[0].graduates[0].face).toBeTruthy();
  });
});

describe('3夜目の版のセーブ', () => {
  it('ふつうの時のセーブを読み込んで、1年遊べる', () => {
    const raw = JSON.parse(fixture('v3-save.json'));
    expect(raw.version).toBe(3);
    const s = deserialize(fixture('v3-save.json'));
    expect(s.version).toBe(SAVE_VERSION);
    const n = enrolled(s).length;
    expect(n).toBeGreaterThan(0);
    autoYears(s, 1);
    expect(Number.isFinite(s.money)).toBe(true);
    expect(s.gameOver).toBe(false);
    const again = deserialize(serialize(s));
    expect(again.year).toBe(s.year);
  });
  it('戦闘の途中のセーブも続きから遊べる', () => {
    const s = deserialize(fixture('v3-battle.json'));
    expect(s.battle).not.toBeNull();
    autoBattle(s);
    expect(s.battle).toBeNull();
    autoPending(s);
    for (let i = 0; i < 6; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
  });
});
