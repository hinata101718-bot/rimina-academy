// 技の進化（18夜目）：熟練がたまり、2つの進化先から1つを選ぶ。DOMに依存しない
import { B, RANK_POINTS } from '../data/balance';
import { ARTS, ART_MILESTONES, type CardFx, type ArtStyle } from '../data/arts';
import { EVO_BRANCH, EVO_SECOND, EVO_OVERRIDE, EVO_TASTE, type EvoBranch } from '../data/evolve';
import { WEAPONS } from '../data/weapons';
import type { GameState, Student } from './state';
import type { BattleState } from './battle/types';

/** 進化できる技か（戦技と魔法。伝説の武器・道具・策は進化しない） */
export function evoBase(id: string): { name: string; fx: CardFx; style: ArtStyle[]; spell: boolean } | null {
  const a = ARTS[id];
  if (a?.card) return { name: a.name, fx: a.card, style: a.style ?? [], spell: false };
  const w = WEAPONS[id];
  if (w?.spell) return { name: w.name, fx: w.type === 'staff' ? { type: 'heal', heal: w.might } : { type: 'atk' }, style: w.type === 'staff' ? ['support'] : ['atk'], spell: true };
  return null;
}
/** その子の、この技の進化の道（選んだ順） */
export function evoPath(st: Pick<Student, 'evo'> | null | undefined, id: string): EvoBranch[] { return st?.evo?.[id] ?? []; }
function defaultOpts(f: CardFx, style: ArtStyle[]): [EvoBranch, EvoBranch] {
  const cost = f.cost ?? 1;
  if (f.type === 'guard') return f.cover ? ['cover', cost >= 2 ? 'thrift' : 'wall'] : f.counter ? ['counter', 'wall'] : ['wall', cost >= 2 ? 'thrift' : 'counter'];
  if (f.type === 'heal') return f.all ? ['more', cost >= 2 ? 'thrift' : 'ward'] : ['more', 'widen'];
  if (f.type === 'buff') return f.team ? ['rally', 'tempo'] : ['tempo', 'rally'];
  const strong = (f.mul ?? 1) * (f.hits ?? 1) >= 1.5 || cost >= 2;
  const first: EvoBranch = strong ? 'keen' : 'power';
  const want: EvoBranch[] = [];
  for (const s of style) {
    if (s === 'guard') want.push('guard');
    if (s === 'swift') want.push((f.hits ?? 1) > 1 || cost < 2 ? 'swift' : 'thrift');
    if (s === 'trick') want.push(f.stun || f.debuff ? 'break' : 'keen');
    if (s === 'heavy') want.push('break');
    if (s === 'atk' || s === 'support') want.push('wide');
    if (s === 'noble') want.push(strong ? 'power' : 'keen');
  }
  want.push('guard', 'wide');
  return [first, want.find((x) => x !== first)!];
}
/** 次の進化先の2つ（もう2段進化していたら null） */
export function evoOptions(id: string, path: EvoBranch[]): [EvoBranch, EvoBranch] | null {
  const base = evoBase(id);
  if (!base || path.length >= B.evo.need.length) return null;
  if (path.length === 0) return EVO_OVERRIDE[id]?.opts ?? defaultOpts(base.fx, base.style);
  const p = path[path.length - 1];
  const f = evoFx(base.fx, path);
  if (p === 'thrift' && (f.cost ?? 1) <= 1) return f.type === 'atk' ? ['power', 'keen'] : ['wall', 'counter'];
  return [p, EVO_SECOND[p]];
}
/** 進化した札の効き目 */
export function evoFx(f: CardFx, path: EvoBranch[]): CardFx {
  let g: CardFx = { ...f };
  for (const b of path) g = EVO_BRANCH[b].apply(g);
  return g;
}
/** 進化した技の名前（「燕返し・剛」「真・二段燕」） */
export function evoName(id: string, base: string, path: EvoBranch[]): string {
  if (!path.length) return base;
  const names = EVO_OVERRIDE[id]?.names ?? {};
  const n1 = names[path[0]] ?? `${base}・${EVO_BRANCH[path[0]].suf}`;
  if (path.length === 1) return n1;
  const key = path.slice(0, 2).join('/');
  if (names[key]) return names[key]!;
  if (path[1] === path[0]) return `真・${n1}`;
  return n1.includes('・') ? `${n1}${EVO_BRANCH[path[1]].suf}` : `${n1}・${EVO_BRANCH[path[1]].suf}`;
}
/** その子の、その技の名前（進化していれば進化した名前） */
export function artNameFor(st: Pick<Student, 'evo'> | null | undefined, id: string): string {
  const base = evoBase(id);
  const name = ARTS[id]?.name ?? WEAPONS[id]?.name ?? id;
  return base ? evoName(id, name, evoPath(st, id)) : name;
}
/** 熟練：使った回数など（mastery）に、覚えてから技能のランクが上がった分を足す（16夜目の「＋」のかわり） */
export function masteryOf(st: Pick<Student, 'mastery' | 'skills'>, id: string): number {
  const used = st.mastery?.[id] ?? 0;
  const a = ARTS[id];
  if (!a || !a.card) return used;
  const from = ART_MILESTONES.indexOf(a.bloom ? 'D' : a.rank);
  if (from < 0) return used;
  let steps = 0;
  for (let i = from + 1; i < ART_MILESTONES.length; i++) if ((st.skills[a.skill] ?? 0) >= RANK_POINTS[ART_MILESTONES[i]]) steps++;
  return used + steps * B.evo.perRank;
}
/** 次の進化に要る熟練（もう2段なら null） */
export function evoNeed(path: EvoBranch[]): number | null { return B.evo.need[path.length] ?? null; }
/** 進化できる（熟練が満ちて、まだ選んでいない） */
export function evoReady(st: Student, id: string): boolean {
  const path = evoPath(st, id);
  const need = evoNeed(path);
  return need !== null && !!evoOptions(id, path) && masteryOf(st, id) >= need;
}
/** 進化を選ぶ（一度きり。選び直せない） */
export function chooseEvo(s: GameState, st: Student, id: string, branch: EvoBranch): boolean {
  const opts = evoOptions(id, evoPath(st, id));
  if (!opts || !opts.includes(branch) || !evoReady(st, id)) return false;
  (st.evo ??= {})[id] = [...evoPath(st, id), branch];
  (st.evoLog ??= []).push({ id, branch, year: s.year, month: s.month });
  s.pending = s.pending.filter((p) => !(p.type === 'evolve' && p.studentId === st.id && p.id === id));
  return true;
}
/** おまかせ：その子の性格に合う方 */
export function autoEvo(st: Student, id: string): EvoBranch | null {
  const opts = evoOptions(id, evoPath(st, id));
  if (!opts) return null;
  const like = EVO_TASTE[st.personality] ?? [];
  const rank = (b: EvoBranch) => { const i = like.indexOf(b); return i < 0 ? 9 : i; };
  return rank(opts[1]) < rank(opts[0]) ? opts[1] : opts[0];
}
/** 進化できる技に、知らせ（処理待ち）を積む。もう積んであれば積まない */
export function queueEvolves(s: GameState, st: Student, ids: string[]): void {
  if (st.status !== 'enrolled') return;
  for (const id of ids) {
    if (!evoReady(st, id)) continue;
    if (s.pending.some((p) => p.type === 'evolve' && p.studentId === st.id && p.id === id)) continue;
    s.pending.push({ type: 'evolve', studentId: st.id, id });
  }
}
/** 戦いのあと：出した札の数だけ熟練がたまる（倒したら少し多く）。満ちた技は進化の知らせ */
export function gainMastery(s: GameState, b: BattleState, ids: string[]): void {
  const cs = b.auto?.cards;
  if (!cs) return;
  const got: Record<string, Record<string, number>> = {};
  for (const p of cs.played) {
    const c = cs.cards[p.card];
    const srcs = c ? [c.src, ...(c.src2 ? [c.src2] : [])] : [];
    const owners = c ? [c.owner, ...(c.partner ? [c.partner] : [])] : [];
    owners.forEach((uid, i) => {
      const u = b.units.find((x) => x.uid === uid);
      const src = srcs[i];
      if (!u?.studentId || !src || !evoBase(src)) return;
      const m = (got[u.studentId] ??= {});
      m[src] = (m[src] ?? 0) + B.evo.perUse + (p.kill ? B.evo.perKill : 0);
    });
  }
  for (const [sid, m] of Object.entries(got)) {
    const st = s.students[sid];
    if (!st || !ids.includes(sid)) continue;
    for (const [id, v] of Object.entries(m)) (st.mastery ??= {})[id] = (st.mastery[id] ?? 0) + Math.min(B.evo.perBattleMax, v);
    queueEvolves(s, st, Object.keys(m));
  }
}
/** 進化の段（0〜2）の印 */
export function evoStars(path: EvoBranch[]): string { return path.length ? '◆'.repeat(path.length) : ''; }
export { EVO_BRANCH };
