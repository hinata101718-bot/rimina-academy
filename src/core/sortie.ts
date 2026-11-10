// 19夜目：月末の出撃の顔ぶれ（教え子4人。ふつうの戦いは交代で全員が出る。宿敵戦には因縁のある子が必ず入る）。DOMに依存しない
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { B } from '../data/balance';
import type { SkillId } from './types';
import type { GameState, Student, Quest, SquadPlan } from './state';
import type { Deploy } from './tactics/types';
import { enrolled, available } from './game';
import { isStock, stockList, armScore } from './loot';
import { meetsRank } from './util';
import { officerForQuest } from './flow';
import { createTactics } from './tactics/setup';
import { calc } from './tactics/engine';

export function canEquip(st: Student, weaponId: string): boolean {
  const w = WEAPONS[weaponId];
  if (!w) return false;
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  if (!c.weapons.includes(w.type)) return false;
  const skill = (w.type === 'holy' || w.type === 'staff' ? 'faith' : w.type) as SkillId;
  return meetsRank(st.skills[skill] ?? 0, w.rank);
}
export function bestArmoryWeapon(s: GameState, st: Student, used: Set<string>): string | null {
  let best: { uid: string; score: number } | null = null;
  for (const a of [...s.armory, ...stockList(s)]) {
    if (used.has(a.uid)) continue;
    const w = WEAPONS[a.weaponId];
    if (!w || w.type === 'staff' || !canEquip(st, a.weaponId)) continue;
    const score = armScore(st, a);
    if (score < 0) continue;
    if (!best || score > best.score) best = { uid: a.uid, score };
  }
  return best?.uid ?? null;
}
/** 決めた子に、武器庫の武器と傷薬を持たせる */
export function deployFor(s: GameState, ids: string[]): Deploy[] {
  // 22夜目⑤：装備した武器があればそれで。装備のない子は、ほかの子が装備していない武器から自動で
  const used = new Set<string>(Object.values(s.students).filter((x) => x.status === 'enrolled' && x.equip).map((x) => x.equip!));
  let items = s.items.vulnerary;
  return ids.map((id) => s.students[id]).filter(Boolean).map((st) => {
    const own = st.equip && s.armory.some((a) => a.uid === st.equip) && canEquip(st, s.armory.find((a) => a.uid === st.equip)!.weaponId) ? st.equip : null;
    const w = own ?? bestArmoryWeapon(s, st, used);
    if (w && !isStock(w)) used.add(w);
    const item = items > 0 ? (items--, 'vulnerary' as const) : null;
    return { studentId: st.id, armoryUid: w, item };
  });
}

/** その依頼で、必ず入る子（宿敵と因縁のある子・勝手に向かった子） */
export function mustJoin(s: GameState, q: Quest): string[] {
  const out: string[] = [];
  if (q.rushBy && s.students[q.rushBy] && available(s.students[q.rushBy])) out.push(q.rushBy);
  const o = officerForQuest(s, q);
  if (!o || !q.nemesisId) return out;
  const rv = Object.values(s.rivalries ?? {}).filter((x) => x.oid === o.id && !x.settled && s.students[x.sid]?.status === 'enrolled' && available(s.students[x.sid]) && !healing(s, s.students[x.sid]))
    .sort((a, c) => Number(!!c.vow) - Number(!!a.vow) || c.stage - a.stage || c.battles - a.battles);
  for (const x of rv) if (!out.includes(x.sid) && out.length < 2) out.push(x.sid);
  return out;
}

/** おすすめの顔ぶれ：必ず入る子 → 癒し手1人 → 今年まだ出ていない子（交代で全員） → レベル */
/** 21夜目：宿敵の大技の一撃で、体力のほとんどを持っていかれる子（宿敵戦には出さない） */
export function fragileVsNemesis(s: GameState, q: Quest, list: Student[]): Set<string> {
  const out = new Set<string>();
  if (!q.nemesisId || !list.length) return out;
  try {
    const b = createTactics(s, q, list.slice(0, 9).map((st) => ({ studentId: st.id })), { nemesisId: q.nemesisId, officer: officerForQuest(s, q) });
    const nem = b.units.find((u) => u.nemesis);
    if (!nem) return out;
    for (const u of b.units) if (u.studentId && !u.teacher && u.side === 'me' && calc(b, nem, u, null, { rage: true }).total >= u.max * B.sortie.nemFragile) out.add(u.studentId);
  } catch { /* 試しに組めないときは、だれも外さない */ }
  return out;
}
/** 21夜目：深手の治りかけ（重傷から戻って間もない子） */
export function healing(s: GameState, st: Student): boolean { return (st.recent ?? []).some((e) => e.type === 'ev_injury' && s.absWeek - e.week <= B.sortie.nemRestWeeks); }
export function recommendDeploy(s: GameState, q: Quest, limit = B.sortie.members): string[] {
  // 21夜目：宿敵戦には、深手の治りかけの子を出さない（ほかに出せる子が足りないときだけ）
  const all = enrolled(s).filter(available);
  const frag = q.nemesisId ? fragileVsNemesis(s, q, all) : new Set<string>();
  const fresh = q.nemesisId ? all.filter((st) => !healing(s, st) && !frag.has(st.id)) : all;
  const list = fresh.length >= Math.min(limit, all.length) ? fresh : all.filter((st) => !healing(s, st)).length >= Math.min(limit, all.length) ? all.filter((st) => !healing(s, st)) : all;
  const out = mustJoin(s, q).filter((id) => id === q.rushBy || list.some((st) => st.id === id)).slice(0, limit);
  const yearBattles = (st: Student) => (st.evalLog ?? []).filter((e) => e.year === s.year).length;
  const healer = list.filter((st) => !out.includes(st.id) && (st.techs ?? []).some((t) => t === 'heal' || t === 'recover')).sort((a, c) => c.level - a.level)[0];
  if (healer && out.length < limit && q.danger >= 1) out.push(healer.id);
  const rest = list.filter((st) => !out.includes(st.id)).sort((a, c) => (q.danger >= 3 || q.nemesisId ? c.level - a.level : yearBattles(a) - yearBattles(c) || c.level - a.level));
  for (const st of rest) { if (out.length >= limit) break; out.push(st.id); }
  return out;
}
export function recommendSquad(s: GameState, q: Quest, manual = false): SquadPlan {
  return { questId: q.id, deploy: deployFor(s, recommendDeploy(s, q)), manual };
}
/** おすすめの依頼（宿敵の挑戦は断れない） */
export function recommendQuest(s: GameState): Quest | null {
  const must = s.quests.find((q) => q.mustGo);
  if (must) return must;
  const lv = enrolled(s).reduce((a, x) => a + x.level, 0) / Math.max(1, enrolled(s).length);
  const ok = s.quests.filter((q) => q.real && q.danger <= (lv > 8 ? 3 : 2));
  return ok.sort((a, b) => Number(!!b.nemesisId) - Number(!!a.nemesisId) || b.reward - a.reward)[0] ?? s.quests[0] ?? null;
}
