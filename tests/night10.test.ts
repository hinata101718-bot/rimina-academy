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
