// 手応えと発見（6夜目）：ランクアップの演出と、隠れた才能・意外な一面の発見を「処理待ち」に積む。DOMに依存しない
import { DISCOVERY_TEXT, SIDES, RANKUP, REP_TIERS, repTier } from '../data/discovery';
import { TALENTS, DREAMS, SKILL_NAMES } from '../data/people';
import { B, RANK_POINTS } from '../data/balance';
import type { GameState, Student, RankUpItem, Pending } from './state';
import type { SkillId, Rank } from './types';
import type { Rng } from './rng';
import { rankOf, nextRankPoints } from './util';

function fill(t: string, v: Record<string, string>): string { return t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m); }

/** 技能ポイントのゲージ（今のランクの中で、どこまで来たか 0..1） */
export function rankPct(p: number): number {
  const cur = RANK_POINTS[rankOf(p) as Rank];
  const n = nextRankPoints(p);
  if (n === null) return 1;
  return Math.max(0, Math.min(1, (p - cur) / (n - cur)));
}

/** ランクアップの演出を積む（同じ週のものは1つにまとめる） */
export function pushRankUp(s: GameState, item: RankUpItem): void {
  const last = s.pending[s.pending.length - 1];
  if (last && last.type === 'rankup' && last.items.length < 6) { last.items.push(item); return; }
  s.pending.push({ type: 'rankup', items: [item] });
}

/** 技能ランクが上がった（教官・講師） */
export function skillRankUp(s: GameState, who: string, k: SkillId, before: number, after: number): void {
  pushRankUp(s, { icon: 'lesson', title: `${who}の${SKILL_NAMES[k]}`, from: rankOf(before), to: rankOf(after), p0: rankPct(before), p1: 1 });
}

/** 評判の段階が上がった */
export function reputationRankUp(s: GameState, before: number, after: number): void {
  const t0 = repTier(before), t1 = repTier(after);
  if (t1 <= t0) return;
  const lo = REP_TIERS[t0].at, hi = REP_TIERS[t0 + 1]?.at ?? 100;
  pushRankUp(s, { icon: 'medal', title: '学校の評判', from: REP_TIERS[t0].name, to: REP_TIERS[t1].name, p0: Math.max(0, Math.min(1, (before - lo) / (hi - lo))), p1: 1, note: `評判 ${Math.round(before)} → ${Math.round(after)}` });
}

/** 発見の演出を積む */
export function pushDiscovery(s: GameState, p: Extract<Pending, { type: 'discovery' }>): void {
  if (s.pending.some((x) => x.type === 'discovery' && x.studentId === p.studentId && x.stage === p.stage)) return;
  s.pending.push(p);
}

/** 隠れた才能：ヒント1→ヒント2→判明（revealTalent から呼ぶ） */
export function talentDiscovery(s: GameState, st: Student, before: number, after: number): void {
  if (!st.talent || st.status !== 'enrolled') return;
  const t = TALENTS[st.talent];
  const T = DISCOVERY_TEXT;
  if (before < B.talent.full && after >= B.talent.full) pushDiscovery(s, { type: 'discovery', studentId: st.id, stage: 3, title: T.full.title, text: fill(T.full.text, { a: st.given, name: t.name }), name: t.name });
  else if (before < B.talent.hint2 && after >= B.talent.hint2) pushDiscovery(s, { type: 'discovery', studentId: st.id, stage: 2, title: T.hint2.title, text: fill(T.hint2.text, { a: st.given, hint: t.hint2 }) });
  else if (before < B.talent.hint1 && after >= B.talent.hint1) pushDiscovery(s, { type: 'discovery', studentId: st.id, stage: 1, title: T.hint1.title, text: fill(T.hint1.text, { a: st.given, hint: t.hint1 }) });
}

/** その子に起こりうる「意外な一面」 */
export function sidesFor(st: Student) { return SIDES.filter((d) => !d.pers.length || d.pers.includes(st.personality)); }

/** 週の終わり：会話や面談で「意外な一面」が見える（面談をした子ほど起きやすい） */
export function rollSides(s: GameState, rng: Rng, talked: Set<string>, lines?: string[]): void {
  for (const st of Object.values(s.students)) {
    if (st.status !== 'enrolled') continue;
    const cands = sidesFor(st).filter((d) => !(st.sides ?? []).includes(d.id));
    if (!cands.length) continue;
    const p = RANKUP.sideChance * (talked.has(st.id) ? RANKUP.sideInterviewMul : 1);
    if (!rng.chance(p)) continue;
    const d = rng.pick(cands);
    let dreamName = '';
    if (d.dream) {
      const top = (Object.keys(st.skills) as SkillId[]).sort((a, c) => st.skills[c] - st.skills[a])[0];
      const next = DREAMS.find((x) => x.id !== st.dream && x.skills.includes(top));
      if (!next) continue;
      st.dream = next.id; dreamName = next.name;
    }
    (st.sides ??= []).push(d.id);
    const text = d.lines.map((l) => fill(l, { a: st.given, dream: dreamName })).join('\n');
    pushDiscovery(s, { type: 'discovery', studentId: st.id, stage: 4, title: DISCOVERY_TEXT.side.title, text, name: d.label });
    lines?.push(`${st.given}の意外な一面：${d.label}`);
    st.history.push({ year: s.year, text: `意外な一面が分かった：${d.label}` });
    break; // 1週に1人まで
  }
}

/** 処理待ちの並びを整える：from 以降に積まれた演出（発見・ランクアップ）を、後ろへ回す */
export function deferShows(s: GameState, from: number): void {
  const moved: Pending[] = [];
  s.pending = s.pending.filter((p, i) => { if (i >= from && (p.type === 'discovery' || p.type === 'rankup' || p.type === 'newStrat' || p.type === 'legend' || p.type === 'guide')) { moved.push(p); return false; } return true; });
  s.pending.push(...moved);
}

/** 卒業生の今の肩書き（兵種を除く）。昇進の演出に使う */
export function careerTitleOnly(title: string): string { return title.replace(/（[^（）]*）$/, ''); }
