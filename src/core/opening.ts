// 19夜目：始まりの1時間（着任の道中の戦い → 学校に着く）。この戦いの敵将が、最初の宿敵になる。DOMに依存しない
import type { GameState, Quest } from './state';
import type { Deploy } from './tactics/types';
import { Rng } from './rng';
import { activeOf, newOfficer, officerName, officerById } from './officers';
import { enrolled } from './game';

export const OPENING_ID = 'q_open';

/** 着任の道中：教え子を守って戦う（説明つき・死なない）。上級生と1年生から4人 */
export function startOpening(s: GameState, r: Rng): void {
  const pool = activeOf(s, 'bandit').filter((o) => o.rank === 2);
  const o = pool.length ? r.pick(pool) : newOfficer(s, r, 'bandit', 2);
  if (!s.officers!.includes(o)) s.officers!.push(o);
  o.field = 'woods';
  const q: Quest = {
    id: OPENING_ID, kind: 'bandit', title: '着任の道中', client: '街道', clientCountry: null, enemyCountry: null, objective: 'boss', template: 'forest_road',
    level: 1, reward: 0, danger: 0, weather: 'clear', real: true, tutorial: true, opening: true, officerId: o.id,
  };
  s.quests = [q];
  s.openingOfficer = o.id;
  const list = enrolled(s);
  const seniors = list.filter((x) => x.grade >= 2).sort((a, c) => c.level - a.level);
  const fresh = list.filter((x) => x.grade === 1).sort((a, c) => c.level - a.level);
  const ids = [...seniors.slice(0, 2), ...fresh].slice(0, 4).map((x) => x.id);
  const deploy: Deploy[] = ids.map((id) => ({ studentId: id, armoryUid: null, item: null }));
  s.sortie = { squads: [{ questId: q.id, deploy, manual: true }], idx: 0, reports: [], pendFrom: 0 };
  // 戦いは flow.startOpeningBattle で作る（循環を避けるため、ここでは印だけ）
  s.openingPending = true;
}

/** 学校に着いたときの場面の文 */
export function arrivalLines(s: GameState): string[] {
  const o = officerById(s, s.openingOfficer);
  const out = [
    '街道を抜けると、丘の上に古い校舎が見えた。どの国にも属さない、辺境の士官学校。',
    '出迎えた上級生が言った。「先生、道中で襲われたんですって？　……ようこそ、リミナ分校へ」',
  ];
  if (o) out.push(o.status === 'active' ? `あの${officerName(o)}は、去りぎわに教え子たちの顔を見ていた。きっとまた現れる。ホームの机の「因縁の帳」に、その名が記された。` : `あの${officerName(o)}は倒れた。だが、死体は見つからなかった。`);
  out.push('最初の1か月は、週のはじめに授業の札と交流の札を1枚ずつ選んで過ごす。月末には、依頼を受けて出撃する。');
  return out;
}
