// 19夜目：技（育つほど増える。技能のランクで覚える）。DOMに依存しない
import { TECHS, TECH_BY_ID, TECH_MAX, type TechDef } from '../data/tactics';
import { CLASSES } from '../data/classes';
import type { GameState, Student } from './state';
import type { SkillId, WeaponType } from './types';

/** 技を覚える技能の点：0点の技（ファイア・ライブ）も、その技能を少し学んでから（E+） */
const MIN_POINTS = 20;
const WT_SKILL: Record<WeaponType, SkillId> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'magic', holy: 'faith', staff: 'faith', gun: 'gun' };

/** その子が覚えられる技（技能の点が届いたもの） */
export function techsFor(st: Pick<Student, 'skills'> & { classId?: string }): TechDef[] {
  return TECHS.filter((t) => (t.cls ? !!st.classId && t.cls.includes(st.classId) && (st.skills[t.skill] ?? 0) >= t.at : (st.skills[t.skill] ?? 0) >= Math.max(MIN_POINTS, t.at)));
}
/** 技能のランクが上がったら覚える。新しく覚えた技の id を返す。show のとき演出を積む */
export function learnTechs(s: GameState | null, st: Student, show = true): string[] {
  const have = new Set(st.techs ?? []);
  const got: string[] = [];
  for (const t of techsFor(st)) if (!have.has(t.id)) { have.add(t.id); got.push(t.id); }
  st.techs = [...have];
  if (s && show && got.length && st.status === 'enrolled') s.pending.push({ type: 'art', studentId: st.id, ids: got });
  return got;
}
export function learnedText(st: Student, id: string): string { return `${st.given}は「${TECH_BY_ID[id]?.name ?? id}」を覚えた！`; }

/** 戦いに持っていく技（兵種の武器に合うものを先に。多すぎると札が並ばないので4つまで） */
export function battleTechs(st: Pick<Student, 'skills' | 'classId' | 'techs'>): TechDef[] {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  const fit = new Set<SkillId>(c.weapons.map((w) => WT_SKILL[w]));
  if (c.moveType === 'cavalry') fit.add('riding');
  if (c.moveType === 'flying') fit.add('flying');
  if (c.moveType === 'armor') fit.add('heavy');
  const known = (st.techs ?? techsFor(st).map((t) => t.id)).map((id) => TECH_BY_ID[id]).filter((t): t is TechDef => !!t);
  const list = known.filter((t) => (t.cls ? t.cls.includes(st.classId) : fit.has(t.skill) || st.classId === 'novice'));
  // 強い技（覚えるのが遅い技）を先に
  list.sort((a, b) => Number(!!b.heal) - Number(!!a.heal) || b.at - a.at);
  return list.slice(0, TECH_MAX);
}
