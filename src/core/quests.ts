// 月末の依頼掲示板
import { questRewardWeapon } from './loot';
import { questRegion } from './regions';
import { B } from '../data/balance';
import { COUNTRY_NAMES, COUNTRY_SHORT, COUNTRIES } from '../data/people';
import { QUEST_KINDS } from '../data/quests';
import type { CountryId } from './types';
import type { GameState, Quest } from './state';
import { Rng } from './rng';
import { enrolled } from './game';
import { relKey, clamp } from './util';
import { tensionStage } from './world';
import { headEffect, factionOfQuest } from './officers';
import { SQUADS } from '../data/stratagems';

/** 部隊の数（在籍の人数から）。flow.squadCount は依頼の数でも抑える */
export function squadsBy(n: number): number { return n >= SQUADS.three ? 3 : n > SQUADS.two ? 2 : 1; }
/** 1つ目の部隊に入らない子たちのレベル（上から deployLimit 人を除いた次の6人の平均） */
export function restLevel(s: GameState, k = 1): number {
  const from = B.battle.deployAt20 + (k - 1) * SQUADS.extraLimit;
  const lv = enrolled(s).map((st) => st.level).sort((a, b) => b - a).slice(from, from + SQUADS.extraLimit);
  if (!lv.length) return partyLevel(s);
  return Math.max(1, Math.round(lv.reduce((a, b) => a + b, 0) / lv.length));
}

export function partyLevel(s: GameState): number {
  const lv = enrolled(s).map((st) => st.level).sort((a, b) => b - a).slice(0, 6);
  if (!lv.length) return 1;
  return Math.max(1, Math.round(lv.reduce((a, b) => a + b, 0) / lv.length));
}

function hostileTo(s: GameState, c: CountryId): CountryId {
  const others = COUNTRIES.filter((x) => x !== c);
  return others.sort((a, b) => s.world.relations[relKey(c, a)] - s.world.relations[relKey(c, b)])[0];
}

export function rollQuests(s: GameState): Quest[] {
  const r = new Rng(s);
  const lv = partyLevel(s);
  const quests: Quest[] = [];
  const mk = (q: Omit<Quest, 'id'>): Quest => ({ ...q, id: `q${s.nextId++}` });
  // 行事の月
  if (s.world.schoolDefensePending) {
    const enemy = (COUNTRIES.slice().sort((a, b) => s.world.power[b] - s.world.power[a]))[0];
    return [mk({ kind: 'schoolDefense', title: '学校防衛戦', client: 'リミナ分校', clientCountry: null, enemyCountry: enemy, objective: 'defend', template: 'school', level: lv + 2, reward: 600, danger: 3, weather: 'clear', real: true, defendTurns: 8 })];
  }
  if (s.month === 5) {
    return [mk({ kind: 'exhibition', title: '公開演武会', client: '三国の観覧席', clientCountry: null, enemyCountry: null, objective: 'rout', template: 'training', level: lv + 1, reward: 0, danger: 1, weather: 'clear', real: false })];
  }
  quests.push(mk({ kind: 'drill', title: '演習：訓練場', client: 'リミナ分校', clientCountry: null, enemyCountry: null, objective: r.chance(0.5) ? 'rout' : 'boss', template: 'training', level: lv, reward: 0, danger: 1, weather: 'clear', real: false }));
  const stage = tensionStage(s.world.tension);
  const kinds = QUEST_KINDS.filter((k) => k.stages.includes(stage));
  // 9夜目：2部隊・3部隊を出せる学校には、残りの子に合った小さな依頼も届く
  const extra = Math.max(0, squadsBy(enrolled(s).length) - 1);
  const n = r.int(...B.quests.realCount) + extra;

  const used = new Set<string>();
  for (let i = 0; i < n && kinds.length; i++) {
    const k = r.weighted(kinds, (x) => (used.has(x.kind) ? x.weight * 0.3 : x.weight));
    used.add(k.kind);
    // 依頼主
    let client: CountryId | null = null;
    if (k.country) {
      const pool = s.world.vassal ? [s.world.vassal, s.world.vassal, s.world.vassal, ...COUNTRIES] : COUNTRIES;
      client = r.weighted(pool, (c) => 10 + Math.max(0, s.world.friendship[c]));
    }
    const enemy = client && k.enemyCountry ? hostileTo(s, client) : null;
    const small = i >= n - extra;
    const danger = small ? Math.min(k.danger[1], Math.max(k.danger[0], r.int(1, 2))) : r.int(k.danger[0], k.danger[1]);
    // 敵の陣営の頭の性格で、敵の強さ・報酬が少し変わる（6夜目）
    const he = headEffect(s, factionOfQuest({ kind: k.kind, enemyCountry: enemy } as Quest));
    const level = Math.max(1, (small ? restLevel(s, n - i) - 2 : lv) + (danger - 2) * 2 + r.int(small ? -2 : -1, small ? 0 : 1) + he.level);
    const reward = clamp(Math.round((k.reward + level * 35 + danger * 120) * he.reward * (small ? B.quests.smallRewardMul : 1) / 10) * 10, B.quests.reward[0], B.quests.reward[1]);
    const weather = r.weighted(['clear', 'rain', 'fog'] as const, (w) => ({ clear: 6, rain: 2.5, fog: 1.5 })[w]);
    const objective = r.pick(k.objectives);
    const clientName = client ? `${COUNTRY_SHORT[client]}・${r.pick(k.clients)}` : r.pick(k.clients);
    quests.push(mk({
      kind: k.kind as Quest['kind'], title: k.title.replace('{enemy}', enemy ? COUNTRY_SHORT[enemy] : '').replace('{client}', client ? (k.kind === 'rescue' ? COUNTRY_SHORT[client] : COUNTRY_NAMES[client]) : ''),
      client: clientName, clientCountry: client, enemyCountry: enemy,
      objective, template: r.pick(k.templates), level, reward, danger, weather, real: true, ...(small ? { small: true } : {}),
      defendTurns: objective === 'defend' ? 7 : undefined,
    }));
  }
  // 10夜目：依頼の報酬に武器がつくことがある（掲示板の札に「報酬：銀の弓」）
  for (const q of quests) { const w = questRewardWeapon(s, q, r); if (w) q.rewardWeapon = w; }
  // 13夜目：依頼の場所を勢力図の地域に
  for (const q of quests) if (q.real) { const rg = questRegion(s, q, r); if (rg) q.region = rg; }
  return quests;
}

export const OBJECTIVE_NAMES: Record<Quest['objective'], string> = {
  rout: '敵の全滅', boss: 'ボスの撃破', defend: '指定ターンの防衛', escort: '護衛（目的地まで）', seize: '拠点の制圧',
  rescue: '捕虜の救出', escape: '包囲の突破（上の端から脱出）',
};
export const WEATHER_NAMES = { clear: '晴れ', rain: '雨', fog: '霧' };
