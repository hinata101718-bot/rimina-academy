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

/** 今の兵種で使える技か（兵種の武器に合う・兵種の技なら今の兵種のもの） */
export function techUsable(st: Pick<Student, 'classId'>, t: TechDef): boolean {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  if (t.cls) return t.cls.includes(st.classId);
  if (st.classId === 'novice') return true;
  const fit = new Set<SkillId>(c.weapons.map((w) => WT_SKILL[w]));
  if (c.moveType === 'cavalry') fit.add('riding');
  if (c.moveType === 'flying') fit.add('flying');
  if (c.moveType === 'armor') fit.add('heavy');
  return fit.has(t.skill);
}
function knownTechs(st: Pick<Student, 'skills' | 'classId' | 'techs'>): TechDef[] {
  return (st.techs ?? techsFor(st).map((t) => t.id)).map((id) => TECH_BY_ID[id]).filter((t): t is TechDef => !!t);
}
/** おまかせの選び方（兵種の武器に合う技から、癒しを先に、覚えるのが遅い（強い）順に4つまで） */
export function autoBattleTechs(st: Pick<Student, 'skills' | 'classId' | 'techs'>): TechDef[] {
  const list = knownTechs(st).filter((t) => techUsable(st, t));
  list.sort((a, b) => Number(!!b.heal) - Number(!!a.heal) || b.at - a.at);
  return list.slice(0, TECH_MAX);
}

/** 戦いに持っていく技。25夜目①：自分で選んだ技（techPick）を先に。選んでいない子はおまかせ。
 *  選んだ技が兵種を変えて使えなくなったら、その数だけおまかせで埋める */
export function battleTechs(st: Pick<Student, 'skills' | 'classId' | 'techs'> & { techPick?: string[] }): TechDef[] {
  const auto = autoBattleTechs(st);
  if (!st.techPick?.length) return auto;
  const known = new Set(knownTechs(st).map((t) => t.id));
  const picked = st.techPick.map((id) => TECH_BY_ID[id]).filter((t): t is TechDef => !!t && known.has(t.id) && techUsable(st, t)).slice(0, TECH_MAX);
  if (!picked.length) return auto;
  const lost = Math.min(TECH_MAX, st.techPick.length) - picked.length;
  const out = [...picked];
  for (const t of auto) { if (out.length >= picked.length + lost || out.length >= TECH_MAX) break; if (!out.includes(t)) out.push(t); }
  return out;
}
/** 自分で選んでいるか（おまかせでないか） */
export function techPicked(st: Pick<Student, 'techPick'>): boolean { return !!st.techPick?.length; }

export type TechToggle = { ok: true } | { ok: false; why: 'unusable' | 'full' | 'last' };
/** 「戦いで使う」をつけ外し。4つ選んでいて5つ目を選ぶと full（入れ替える技を選ぶ）。replace を渡すとその技と入れ替え */
export function toggleBattleTech(st: Student, id: string, replace?: string): TechToggle {
  const t = TECH_BY_ID[id];
  if (!t || !(st.techs ?? []).includes(id) || !techUsable(st, t)) return { ok: false, why: 'unusable' };
  const now = battleTechs(st).map((x) => x.id);
  if (now.includes(id)) {
    if (now.length <= 1) return { ok: false, why: 'last' };
    st.techPick = now.filter((x) => x !== id);
    return { ok: true };
  }
  if (replace && now.includes(replace)) { st.techPick = now.map((x) => (x === replace ? id : x)); return { ok: true }; }
  if (now.length >= TECH_MAX) return { ok: false, why: 'full' };
  st.techPick = [...now, id];
  return { ok: true };
}
/** おまかせに戻す */
export function autoPickTechs(st: Student): void { delete st.techPick; }
