// 3夜目の追加分のテスト
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoWeek, autoPending, autoBattle } from '../src/core/autoplay';
import { meetsReq, missingReqs, levelReq, takeExam, examCandidates } from '../src/core/exam';
import { rng } from '../src/core/flow';
import { CLASSES } from '../src/data/classes';
import { RANK_POINTS, SAVE_VERSION } from '../src/data/balance';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('兵種試験のレベル条件', () => {
  it('初級Lv5・中級Lv10・上級Lv20・最上級Lv30', () => {
    expect(levelReq(CLASSES.swordsman)).toBe(5);
    expect(levelReq(CLASSES.fencer)).toBe(10);
    expect(levelReq(CLASSES.swordmaster)).toBe(20);
    expect(levelReq(CLASSES.sword_saint)).toBe(30);
  });
  it('技能が足りていてもレベルが足りなければ受験できず、足りない条件が文で出る', () => {
    const s = newGame({ name: 't', background: 'knight', seed: 7 });
    const st = enrolled(s)[0];
    st.classId = 'lancer'; st.level = 7; st.skills.lance = RANK_POINTS['D+']; st.skills.riding = RANK_POINTS.D;
    const c = CLASSES.cavalier;
    expect(meetsReq(st, c)).toBe(false);
    const miss = missingReqs(s, st, c);
    expect(miss.some((m) => m.includes('Lv10から受験できます（あと3）'))).toBe(true);
    expect(miss.some((m) => m.includes('槍 C が必要（いま D+）'))).toBe(true);
    expect(takeExam(s, rng(s), st, 'cavalier').ok).toBe(false);
    expect(examCandidates(s).includes(st)).toBe(false);
  });
});

describe('2夜目の版のセーブ', () => {
  it('ふつうの時のセーブを読み込んで、1年遊べる。昇格済みの子は降格しない', () => {
    const raw = JSON.parse(fixture('v2-save.json'));
    expect(raw.version).toBe(2);
    const before = Object.fromEntries(Object.values(raw.state.students as Record<string, { id: string; classId: string }>).map((x) => [x.id, x.classId]));
    const s = deserialize(fixture('v2-save.json'));
    expect(s.version).toBe(SAVE_VERSION);
    for (const st of enrolled(s)) expect(CLASSES[st.classId].tier).toBeGreaterThanOrEqual(CLASSES[before[st.id]].tier);
    autoYears(s, 1);
    expect(Number.isFinite(s.money)).toBe(true);
    const again = deserialize(serialize(s));
    expect(again.year).toBe(s.year);
  });
  it('戦闘の途中のセーブも続きから遊べる', () => {
    const s = deserialize(fixture('v2-battle.json'));
    expect(s.battle).not.toBeNull();
    autoBattle(s);
    expect(s.battle).toBeNull();
    autoPending(s);
    for (let i = 0; i < 6; i++) autoWeek(s);
    expect(s.gameOver).toBe(false);
  });
});
