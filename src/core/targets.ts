// 22夜目⑥：目標技能を決めるための手がかり（docs/feedback.md「目標技能の画面で、生徒の特徴が分からず決めづらい」）。DOMに依存しない
import { SKILLS, STATS, RANK_POINTS } from '../data/balance';
import { CLASS_LIST, CLASSES } from '../data/classes';
import { TECHS } from '../data/tactics';
import type { SkillId, StatId, Rank } from './types';
import type { GameState, Student } from './state';
import { goodOf, badOf, isBad } from './aptitude';
import { growthRates } from './growth';
import { autoTargets, skillUnlocked } from './week';
import { SCHOOL_MAX_TIER, meetsSkillReq } from './exam';

/** いまの技能ランクの上位3つ（統率・軍略も入る） */
export function topSkillsOf(s: GameState, st: Student, n = 3): SkillId[] {
  return SKILLS.filter((k) => skillUnlocked(s, k)).sort((a, b) => (st.skills[b] ?? 0) - (st.skills[a] ?? 0)).slice(0, n);
}
/** 伸びやすい能力の上位2つ（体力は除く） */
export function topGrowthOf(st: Student, n = 2): StatId[] {
  const g = growthRates(st);
  return STATS.filter((k) => k !== 'hp').sort((a, b) => g[b] - g[a]).slice(0, n);
}
/** その技能を上げると開く、次の段階の兵種の試験（ほかの条件はそろっているもの）。ランクごとにまとめる */
export function opensWith(s: GameState, st: Student, k: SkillId): { rank: Rank; names: string[] }[] {
  const cur = CLASSES[st.classId];
  const tier = cur?.tier ?? 0;
  if (tier + 1 > SCHOOL_MAX_TIER) return [];
  const by = new Map<Rank, string[]>();
  for (const c of CLASS_LIST) {
    if (c.hidden || c.tier !== tier + 1 || !c.req[k]) continue;
    if (meetsSkillReq(st, c)) continue;
    const others = Object.entries(c.req).every(([kk, r]) => kk === k || (st.skills[kk as SkillId] ?? 0) >= RANK_POINTS[r as Rank]);
    if (!others) continue;
    const r = c.req[k]!;
    by.set(r, [...(by.get(r) ?? []), c.name]);
  }
  return [...by.entries()].sort((a, b) => RANK_POINTS[a[0]] - RANK_POINTS[b[0]]).map(([rank, names]) => ({ rank, names }));
}
/** 先生のおすすめ（得意・夢・兵種の道は autoTargets、そこに宿敵の弱点を足す） */
export function recommendTargets(s: GameState, st: Student): [SkillId, SkillId] {
  const base = autoTargets(s, st);
  for (const rv of Object.values(s.rivalries ?? {})) {
    if (rv.sid !== st.id || rv.settled) continue;
    const o = (s.officers ?? []).find((x) => x.id === rv.oid && x.status === 'active');
    const t = (o?.knownWeak ?? []).find((w) => (o?.weak ?? []).includes(w));
    const tech = t ? TECHS.find((x) => x.type === t && !x.cls) : null;
    const k = tech?.skill;
    if (k && skillUnlocked(s, k) && !isBad(st, k) && !base.includes(k)) return [base[0], k];
  }
  return base;
}
/** 技能ごとのしるし（◎得意・×苦手） */
export function aptMark(st: Student, k: SkillId): '◎' | '×' | '' { return goodOf(st).includes(k) ? '◎' : badOf(st).includes(k) ? '×' : ''; }
