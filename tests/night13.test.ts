// 13夜目：勢力図（地域・国境・依頼の場所・名産）・変化の場面・12夜目版のセーブ（形式12）
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { battleCtx, finishBattle } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { SAVE_VERSION } from '../src/data/balance';
import { REGIONS, REGION_ADJ } from '../src/data/regions';
import { ownerOf, setOwner, yearlyRegions, borderOf, neighbors, mapChanges, markMapSeen, regionShare, regionMul, warRegions } from '../src/core/regions';
import { Rng } from '../src/core/rng';
import { rollQuests } from '../src/core/quests';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const mk = (seed = 1) => newGame({ name: 'テスト', background: 'knight', seed });
setAutoChoicePick(humanLikePick(5));

describe('12夜目版のセーブ（形式12）', () => {
  for (const f of ['v12-day.json', 'v12-auto.json', 'v12-result.json']) {
    it(`${f}：勢力図ができ、お知らせが出て、1年遊べる`, () => {
      const s = deserialize(fixture(f));
      expect(s.version).toBe(SAVE_VERSION);
      expect(Object.keys(s.world.regions ?? {}).length).toBe(REGIONS.length);
      expect(s.pending.some((p) => p.type === 'event' && p.title === '13夜目の新しいこと')).toBe(true);
      for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
      autoPending(s); autoYears(s, 1);
      expect(s.gameOver).toBe(false);
    });
  }
});

describe('勢力図', () => {
  it('地域は15。王国・帝国・同盟・学校・無主地。地形の絵と区分けの絵がある。となりあう地域がつながっている', () => {
    expect(REGIONS.length).toBe(15);
    expect(new Set(REGIONS.map((r) => r.home))).toEqual(new Set(['kingdom', 'empire', 'alliance', 'school', 'wild']));
    for (const f of ['worldmap.webp', 'worldmap-regions.png']) expect(existsSync(new URL(`../public/art/${f}`, import.meta.url))).toBe(true);
    for (const r of REGIONS) expect(neighbors(r.id).length).toBeGreaterThan(0);
    expect(REGION_ADJ.length).toBeGreaterThan(15);
    const s = mk(1);
    expect(borderOf(s, 'kingdom', 'empire').length + borderOf(s, 'empire', 'kingdom').length).toBeGreaterThan(0);
  });
  it('戦争中は、強い国が国境の地域を奪うことがある。都は奪われない。変化は記録・年表に残り、場面で見られる', () => {
    const s = mk(2);
    markMapSeen(s);
    s.world.relations = { ke: -90, ea: -90, ak: -90 };
    s.world.power = { kingdom: 90, empire: 20, alliance: 50 };
    const r = new Rng({ rng: 3 });
    for (let i = 0; i < 12; i++) yearlyRegions(s, r);
    expect(warRegions(s).length).toBeGreaterThan(0);
    const ch = mapChanges(s);
    expect(ch.length).toBeGreaterThan(0);
    for (const x of REGIONS.filter((x) => x.kind === 'capital')) expect(ownerOf(s, x.id)).toBe(x.home);
    expect(s.chronicle.some((c) => c.text.includes('の手に'))).toBe(true);
    expect(regionShare(s).kingdom).toBeGreaterThan(5);
    expect(regionMul(s, 'kingdom')).toBeGreaterThan(1);
  });
  it('統一のときは、大陸が一色に（学校を除く）', () => {
    const s = mk(3);
    s.endings = [{ kind: 'unify', year: s.year, country: 'empire' }];
    yearlyRegions(s, new Rng({ rng: 1 }));
    for (const x of REGIONS) if (x.home !== 'school') expect(ownerOf(s, x.id)).toBe('empire');
  });
  it('依頼の場所が地域と結びつく', () => {
    const s = mk(4);
    autoYears(s, 1);
    const qs = rollQuests(s).filter((q) => q.real && !q.small);
    expect(qs.some((q) => q.region)).toBe(true);
    setOwner(s, REGIONS.find((x) => x.home === 'alliance' && x.kind === 'land')!.id, 'empire');
    expect(Object.values(s.world.regions ?? {}).filter((v) => v === 'empire').length).toBeGreaterThan(4);
  });
});
