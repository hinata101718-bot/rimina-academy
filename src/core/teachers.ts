// 講師の雇用・施設
import { B, SKILLS } from '../data/balance';
import { NAMES } from '../data/names';
import { SKILL_NAMES } from '../data/people';
import type { SkillId } from './types';
import type { GameState, Student } from './state';
import { Rng } from './rng';
import { RANK_POINTS } from '../data/balance';
import { notify, chronicle } from './game';

export function bestSkillOf(st: Student): SkillId {
  return (SKILLS.filter((k) => k !== 'gun' || st.skills.gun > 0) as SkillId[]).sort((a, b) => st.skills[b] - st.skills[a])[0];
}

export function rollTeacherCandidates(s: GameState, rng: Rng): void {
  const n = rng.int(...B.teachers.candidates);
  s.teacherCandidates = [];
  for (let i = 0; i < n; i++) {
    const skill = rng.pick(SKILLS.filter((k) => k !== 'gun' || s.world.gunUnlocked));
    const rank = rng.weighted(['C', 'B', 'A'] as const, (r) => ({ C: 5, B: 4, A: 1 })[r]);
    const salary = { C: 150, B: 250, A: 400 }[rank] + rng.int(-2, 2) * 10;
    const origin = rng.pick(['kingdom', 'empire', 'alliance'] as const);
    const list = NAMES[origin];
    s.teacherCandidates.push({ id: `t${s.nextId++}`, name: rng.pick(rng.chance(0.5) ? list.male : list.female), skill, points: RANK_POINTS[rank], salary });
  }
}

export function hireTeacher(s: GameState, id: string): boolean {
  const t = s.teacherCandidates.find((x) => x.id === id);
  if (!t) return false;
  s.teacherCandidates = s.teacherCandidates.filter((x) => x.id !== id);
  s.teachers.push(t);
  chronicle(s, `講師${t.name}（${SKILL_NAMES[t.skill]}）を雇った`, 'school');
  return true;
}
export function fireTeacher(s: GameState, id: string): void { s.teachers = s.teachers.filter((t) => t.id !== id); }

export function monthlySalaries(s: GameState): string[] {
  const out: string[] = [];
  for (const t of [...s.teachers]) {
    if (s.money >= t.salary) { s.money -= t.salary; }
    else { s.teachers = s.teachers.filter((x) => x !== t); out.push(`給料が払えず、講師の${t.name}が去っていった`); notify(s, `講師の${t.name}が去った（給料不足）`); }
  }
  return out;
}

export type FacilityId = 'training' | 'library' | 'stable' | 'chapel' | 'dining' | 'range';
export function facilityCost(s: GameState, f: FacilityId): number | null {
  const lv = s.facilities[f] ?? 0;
  if (lv >= 3) return null;
  return B.facilities[f].cost[lv];
}
export function upgradeFacility(s: GameState, f: FacilityId): boolean {
  if (f === 'range' && !s.world.gunUnlocked) return false;
  const c = facilityCost(s, f);
  if (c === null || s.money < c) return false;
  s.money -= c;
  s.facilities[f] = (s.facilities[f] ?? 0) + 1;
  chronicle(s, `${B.facilities[f].name}を段階${s.facilities[f]}に整備`, 'school');
  return true;
}

export function buyWeapon(s: GameState, weaponId: string, price: number): boolean {
  if (s.money < price) return false;
  s.money -= price;
  s.armory.push({ uid: `w${s.nextId++}`, weaponId });
  return true;
}
export function buyItem(s: GameState, kind: 'vulnerary' | 'elixir'): boolean {
  const price = B_ITEM_PRICE[kind];
  if (s.money < price) return false;
  s.money -= price; s.items[kind] += 1;
  return true;
}
export const B_ITEM_PRICE = B.itemPrice;
