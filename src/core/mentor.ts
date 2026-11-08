// 先生の経験ポイントと特殊能力（8夜目）。DOMに依存しない。
// 授業で経験ポイントがたまり、ポイントで先生の技能と特殊能力を上げる。
import { B, SKILLS, RANK_POINTS, RANKS } from '../data/balance';
import { MENTOR_ABILITIES, MENTOR_BY_ID, type MentorAbility, type MentorEffectKey } from '../data/mentor';
import type { SkillId, Rank } from './types';
import type { GameState, Instructor } from './state';
import { Rng } from './rng';
import { rankOf } from './util';

/** 覚えている特殊能力のid */
export function mentorAbilities(s: GameState): string[] { return s.instructor.abilities ?? []; }
export function hasAbility(s: GameState, id: string): boolean { return mentorAbilities(s).includes(id); }

/** 効き目の合計（覚えている能力の同じ種類の数字を足す） */
export function fx(s: GameState | null | undefined, key: MentorEffectKey): number {
  if (!s?.instructor) return 0;
  let v = 0;
  for (const id of s.instructor.abilities ?? []) v += MENTOR_BY_ID[id]?.effect[key] ?? 0;
  return v;
}

/** 経験ポイント（今持っている分） */
export function mentorXp(s: GameState): number { return Math.floor(s.instructor.xp ?? 0); }

export interface LessonXpInfo { faces: number; tags: number; grew: number; social: boolean; rest: boolean }
/** 1回の授業でもらえる経験ポイント（顔の子が多い・友情タッグ・ランクアップやレベルアップした子がいると多め） */
export function lessonXp(info: LessonXpInfo): number {
  const M = B.mentor;
  if (info.rest) return M.xpRest;
  return (info.social ? M.xpSocial : M.xpBase) + info.faces * M.xpFace + info.tags * M.xpTag + Math.min(M.xpGrowMax, info.grew * M.xpGrow);
}
export function gainMentorXp(s: GameState, n: number): void {
  if (n <= 0) return;
  s.instructor.xp = (s.instructor.xp ?? 0) + n;
  s.instructor.xpTotal = (s.instructor.xpTotal ?? 0) + n;
}

// ---------- 特殊能力 ----------
/** 値段（経歴で安くなる・覚えるたびに少しずつ高くなる） */
export function abilityCost(s: GameState, a: MentorAbility): number {
  const M = B.mentor;
  const base = M.cost[a.cost] ?? 500;
  const disc = a.cheap?.[s.instructor.background] ?? 1;
  const n = (s.instructor.abilities ?? []).filter((x) => !(s.instructor.inherited ?? []).includes(x)).length;
  return Math.round((base * disc * (1 + M.costGrowth * n)) / 10) * 10;
}
export type AbilityState = 'learned' | 'ready' | 'poor' | 'locked';
export function abilityState(s: GameState, a: MentorAbility): AbilityState {
  if (hasAbility(s, a.id)) return 'learned';
  if (a.pre && !hasAbility(s, a.pre)) return 'locked';
  return mentorXp(s) >= abilityCost(s, a) ? 'ready' : 'poor';
}
/** 特殊能力を覚える。覚えたら true */
export function learnAbility(s: GameState, id: string): boolean {
  const a = MENTOR_BY_ID[id];
  if (!a || abilityState(s, a) !== 'ready') return false;
  const cost = abilityCost(s, a);
  s.instructor.xp = (s.instructor.xp ?? 0) - cost;
  s.instructor.abilities = [...(s.instructor.abilities ?? []), id];
  s.chronicle.push({ year: s.year, month: s.month, text: `教官（${s.instructor.name}）が特殊能力「${a.name}」を覚えた`, kind: 'school' });
  return true;
}

// ---------- 技能 ----------
/** 技能の上限（得意科目S・ほかB・流れの旅人はすべてA）。instructor.ts の instructorCaps と同じもの */
function capOf(s: GameState, k: SkillId, caps: Record<SkillId, number>): number { void s; return caps[k]; }
/** 次のランクへ上げる値段（足りないポイント×3）。上限なら null */
export function skillCost(s: GameState, k: SkillId, caps: Record<SkillId, number>): { cost: number; to: Rank } | null {
  const p = s.instructor.skills[k] ?? 0;
  const cap = capOf(s, k, caps);
  if (p >= cap) return null;
  const i = RANKS.indexOf(rankOf(p));
  const to = RANKS[Math.min(RANKS.length - 1, i + 1)];
  const target = Math.min(cap, RANK_POINTS[to]);
  if (target <= p) return null;
  return { cost: Math.max(10, Math.round(((target - p) * B.mentor.skillCostPerPt) / 10) * 10), to };
}
/** 技能を次のランクへ。上がったら [前, 後] */
export function trainSkill(s: GameState, k: SkillId, caps: Record<SkillId, number>): [Rank, Rank] | null {
  const c = skillCost(s, k, caps);
  if (!c || mentorXp(s) < c.cost) return null;
  const before = rankOf(s.instructor.skills[k] ?? 0);
  s.instructor.xp = (s.instructor.xp ?? 0) - c.cost;
  s.instructor.skills[k] = RANK_POINTS[c.to];
  s.chronicle.push({ year: s.year, month: s.month, text: `教官（${s.instructor.name}）の技能が上がった：${before}→${c.to}`, kind: 'school' });
  return [before, c.to];
}

// ---------- 後継 ----------
/** 後継の教官が先代から受け継ぐ特殊能力（教え子なら2つ、外から来た教官は1つ） */
export function inheritAbilities(prev: Instructor, next: Instructor, r: Rng, alumni: boolean): string[] {
  const have = (prev.abilities ?? []).filter((id) => MENTOR_BY_ID[id]);
  const n = alumni ? B.mentor.inheritAlumni : B.mentor.inheritExternal;
  // 前提のある能力は、前提も一緒でないと持てないので、前提のないものを先に選ぶ
  const pool = r.shuffle([...have]).sort((a, b) => (MENTOR_BY_ID[a].pre ? 1 : 0) - (MENTOR_BY_ID[b].pre ? 1 : 0));
  const got: string[] = [];
  for (const id of pool) {
    if (got.length >= n) break;
    const pre = MENTOR_BY_ID[id].pre;
    if (pre && !got.includes(pre)) continue;
    got.push(id);
  }
  next.abilities = got;
  next.inherited = [...got];
  next.xp = 0; next.xpTotal = 0;
  return got;
}

// ---------- おまかせ（オートプレイ・シミュレーション用） ----------
/** ポイントの使い道をおまかせで決める：特殊能力を優先し、余ったら得意科目の技能 */
export function autoSpend(s: GameState, caps: Record<SkillId, number>, goodSkills: SkillId[]): string[] {
  const out: string[] = [];
  let guard = 0;
  while (guard++ < 20) {
    const ready = MENTOR_ABILITIES.filter((a) => abilityState(s, a) !== 'learned' && abilityState(s, a) !== 'locked');
    if (ready.length) {
      const cheapest = ready.reduce((a, b) => (abilityCost(s, a) <= abilityCost(s, b) ? a : b));
      if (abilityState(s, cheapest) === 'ready') { learnAbility(s, cheapest.id); out.push(cheapest.id); continue; }
      // 次の能力のために貯める（ただし大きく余っていれば技能にも）
      if (mentorXp(s) < abilityCost(s, cheapest) + 300) break;
    }
    const ks = [...goodSkills, ...SKILLS.filter((k) => !goodSkills.includes(k) && (k !== 'gun' || s.world.gunUnlocked))];
    const k = ks.find((x) => { const c = skillCost(s, x, caps); return c && c.cost <= mentorXp(s); });
    if (!k || !trainSkill(s, k, caps)) break;
  }
  return out;
}
