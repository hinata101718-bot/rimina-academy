// 兵種試験
import { B, RANK_POINTS } from '../data/balance';
import { CLASSES, CLASS_LIST } from '../data/classes';
import type { ClassDef, SkillId, Rank } from './types';
import type { GameState, Student } from './state';
import { Rng } from './rng';
import { absMonth } from './util';
import { available, chronicle, notify } from './game';
import { addRecent } from './support';

/** 学校で受けられる段階（設計書：上級まで。1夜目は中級までを主対象にするが、上級もデータ上は受験可） */
export const SCHOOL_MAX_TIER = 3;

export function classUnlocked(s: GameState, c: ClassDef): boolean {
  if (c.needGun && !s.world.gunUnlocked) return false;
  if (c.needStable && (s.facilities.stable ?? 0) < 1) return false;
  if (c.nation || c.hidden || c.tier > SCHOOL_MAX_TIER) return false;
  return true;
}

export function meetsReq(st: Student, c: ClassDef): boolean {
  return Object.entries(c.req).every(([k, r]) => st.skills[k as SkillId] >= RANK_POINTS[r as Rank]);
}

/** 受けられる兵種（前提を満たすもの全部。条件を満たさないものも含めて返す） */
export function nextClasses(s: GameState, st: Student): ClassDef[] {
  return CLASS_LIST.filter((c) => c.prereq.includes(st.classId) && !c.nation && !c.hidden && c.tier <= SCHOOL_MAX_TIER && (!c.needGun || s.world.gunUnlocked));
}

export function passRate(st: Student, c: ClassDef): number {
  let over = Infinity;
  for (const [k, r] of Object.entries(c.req)) over = Math.min(over, st.skills[k as SkillId] - RANK_POINTS[r as Rank]);
  if (over === Infinity) over = 0;
  if (over < 0) return 0;
  return Math.min(B.exam.max, Math.round(B.exam.baseRate + over / B.exam.perPoints));
}

export function canTakeExam(s: GameState, st: Student): boolean {
  return st.status === 'enrolled' && available(st) && st.examMonth !== absMonth(s.year, s.month);
}

export function examCandidates(s: GameState): Student[] {
  return Object.values(s.students).filter((st) => canTakeExam(s, st) && nextClasses(s, st).some((c) => classUnlocked(s, c) && meetsReq(st, c)));
}

export function takeExam(s: GameState, rng: Rng, st: Student, classId: string): { ok: boolean; rate: number; text: string } {
  const c = CLASSES[classId];
  if (!c || !canTakeExam(s, st) || !classUnlocked(s, c) || !meetsReq(st, c) || !c.prereq.includes(st.classId)) return { ok: false, rate: 0, text: '受験できません' };
  const rate = passRate(st, c);
  st.examMonth = absMonth(s.year, s.month);
  const ok = rng.next() * 100 < rate;
  if (ok) {
    st.classId = c.id;
    addRecent(s, st, 'ev_exam', c.name);
    st.motivation = Math.min(4, st.motivation + 1);
    if (c.tier >= 2) chronicle(s, `${st.given}が${c.name}に`, 'student');
    notify(s, `${st.given}が兵種試験に合格し、${c.name}になった`, st.id);
    return { ok, rate, text: `合格！ ${st.given}は${c.name}になった` };
  }
  st.motivation = Math.max(0, st.motivation - 1);
  return { ok, rate, text: `不合格……。${st.given}は来月また挑戦できる` };
}

/** オートプレイ・自動用：受けられる試験のうち一番良いものを受ける */
export function autoExam(s: GameState, rng: Rng, st: Student): string | null {
  const opts = nextClasses(s, st).filter((c) => classUnlocked(s, c) && meetsReq(st, c));
  if (!opts.length || !canTakeExam(s, st)) return null;
  const best = opts.sort((a, b) => passRate(st, b) - passRate(st, a))[0];
  if (passRate(st, best) < 70) return null;
  return takeExam(s, rng, st, best.id).text;
}
