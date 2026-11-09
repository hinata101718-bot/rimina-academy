// 戦技と心得（12夜目）：技能ランクで覚える・付ける（おまかせ）・戦いで使う。DOMに依存しない
import { RANKS, RANK_POINTS } from '../data/balance';
import { ART_LIST, ARTS, ART_SLOTS, ART_CHANCE, ART_MILESTONES, ART_TASTE, type ArtDef } from '../data/arts';
import { CLASSES } from '../data/classes';
import { WEAPONS } from '../data/weapons';
import type { Rank, SkillId, WeaponType } from './types';
import type { GameState, Student, EnemyOfficer } from './state';
import type { Unit } from './battle/types';
import { Rng } from './rng';
import { setBloomHook } from './aptitude';

const rankIdx = (r: Rank) => RANKS.indexOf(r);
function hash(t: string): number { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h | 0; }
const slotKey = (skill: SkillId, rank: Rank | 'bloom') => `${skill}:${rank}`;
/**
 * 16夜目：その子の「覚える表」。技能×節目（E+・D・C・B・A・S）ごとに候補から1つ、開花の技も1つ。
 * 性格・夢・出身の国の流派・家柄の傾きで選ばれやすさが変わり、得意の技能だけ秘伝（rare）が入る。
 * 生徒のidから決まる（ゲームの乱数を使わない）ので、古いセーブの子にも同じ方法で作れる
 */
export function makeArtPlan(st: Pick<Student, 'id' | 'given' | 'personality' | 'origin' | 'house' | 'dream' | 'apt' | 'talent'>): Record<string, string> {
  const r = new Rng({ rng: hash(`${st.id}:${st.given}:arts`) });
  const taste = [...(ART_TASTE.personality[st.personality] ?? []), ...(ART_TASTE.origin[st.origin] ?? []), ...(ART_TASTE.house[st.house] ?? []), ...(ART_TASTE.dream[st.dream] ?? [])];
  const plan: Record<string, string> = {};
  const skills = [...new Set(ART_LIST.map((a) => a.skill))];
  for (const k of skills) {
    const good = !!st.apt?.good.includes(k) || st.talent === `genius_${k}`;
    const w = (a: ArtDef) => ART_TASTE.base + ART_TASTE.per * (a.style ?? []).filter((x) => taste.includes(x)).length;
    for (const rk of ART_MILESTONES) {
      const cand = ART_LIST.filter((a) => a.skill === k && a.rank === rk && !a.bloom && (!a.rare || good));
      if (cand.length) plan[slotKey(k, rk)] = r.weighted(cand, w).id;
    }
    const bl = ART_LIST.filter((a) => a.skill === k && a.bloom);
    if (bl.length) plan[slotKey(k, 'bloom')] = r.weighted(bl, w).id;
  }
  return plan;
}
export function ensureArtPlan(st: Student): Record<string, string> {
  if (!st.artPlan) st.artPlan = makeArtPlan(st);
  return st.artPlan;
}
/** この技が、その子の覚える表に入っているか（講師の手ほどきを受けた技も入る） */
export function inPlan(st: Student, a: ArtDef): boolean {
  if ((st.taught ?? []).includes(a.id)) return true;
  const p = ensureArtPlan(st);
  return p[slotKey(a.skill, a.bloom ? 'bloom' : a.rank)] === a.id;
}
/** その子がこの技をもう覚えられるか（覚える表の技だけ。得意の技能は1つ前のランクで覚える。開花の技は開花した子だけ） */
export function canLearn(st: Student, a: ArtDef): boolean {
  if (!inPlan(st, a)) return false;
  if (a.bloom) return !!st.bud?.done && st.bud.skill === a.skill;
  const need = needRank(st, a)!;
  return (st.skills[a.skill] ?? 0) >= RANK_POINTS[need];
}
/** その子がこの技を覚えるランク（得意・手ほどきで早まる）。開花の技は null */
export function needRank(st: Student, a: ArtDef): Rank | null {
  if (a.bloom) return null;
  // 節目（E+・D・C・B・A・S）を1つ前に
  const L: Rank[] = ['E', 'E+', 'D', 'C', 'B', 'A', 'S'];
  const i = L.indexOf(a.rank);
  // 14夜目：卒業生の講師に手ほどきを受けた技も、1つ前のランクで覚える（得意と重なれば2つ前）
  const step = (st.apt?.good.includes(a.skill) ? 1 : 0) + ((st.taught ?? []).includes(a.id) ? 1 : 0);
  return L[Math.max(0, i - step)] ?? a.rank;
}
/** 覚える表のうち、まだ覚えていない技（節目の順） */
export function plannedArts(st: Student): ArtDef[] {
  const p = ensureArtPlan(st);
  const have = new Set(artsOf(st));
  return Object.entries(p).filter(([k]) => !k.endsWith(':bloom')).map(([, id]) => ARTS[id]).filter((a) => a && !have.has(a.id)).sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank));
}
/** 16夜目：札が強くなる（覚えたランクから節目を2つ上がると「＋」） */
export function artPlus(st: Pick<Student, 'skills'> | null | undefined, a: ArtDef | undefined): boolean {
  if (!st || !a || a.bloom) return false;
  const L = ART_MILESTONES;
  const cur = (st.skills[a.skill] ?? 0);
  const i = L.indexOf(a.rank);
  const target = L[i + ART_TASTE.plusSteps];
  return !!target && cur >= RANK_POINTS[target];
}
/**
 * 古いセーブ（16夜目より前）：覚える表を作り、もう覚えた技は（表と違っていても）その節目の技として表に入れる。
 * こうすると、通り過ぎた節目で新しい技を急に覚えることがない
 */
export function migrateArtPlan(st: Student): void {
  const p = st.artPlan = makeArtPlan(st);
  for (const id of artsOf(st)) {
    const a = ARTS[id];
    if (!a) continue;
    p[slotKey(a.skill, a.bloom ? 'bloom' : a.rank)] = a.id;
  }
}
/**
 * 14夜目：卒業生の講師が、自分の覚えた戦技・心得を授業で教える。
 * その科目の授業の日、目標の技能が合う子は、講師の技の手ほどきを受け、1つ前のランクで覚えられるようになる
 */
export function alumniTeach(s: GameState, skills: SkillId[], list: Student[], lines: string[]): void {
  for (const t of s.teachers) {
    if (!t.alumniId || !skills.includes(t.skill)) continue;
    const me = s.students[t.alumniId];
    if (!me) continue;
    const mine = artsOf(me).map((id) => ARTS[id]).filter((a) => a && a.skill === t.skill && !a.bloom);
    if (!mine.length) continue;
    for (const st of list) {
      if (!st.targets.includes(t.skill)) continue;
      const a = mine.find((x) => !artsOf(st).includes(x.id) && !(st.taught ?? []).includes(x.id));
      if (!a) continue;
      (st.taught ??= []).push(a.id);
      const got = learnArts(s, st);
      lines.push(got.includes(a.id) ? `講師の${t.name}から「${a.name}」の手ほどきを受け、${st.given}がその場で覚えた` : `講師の${t.name}が、${st.given}に「${a.name}」の手ほどきをした（覚えやすくなった）`);
    }
  }
}
/** 覚えた技（戦技と心得） */
export function artsOf(st: Student): string[] { return st.arts ?? []; }
/** 技能ランクが上がったら覚える。show のとき、覚えた演出を積む */
export function learnArts(s: GameState | null, st: Student, show = true): string[] {
  const got: string[] = [];
  st.arts ??= [];
  for (const a of ART_LIST) if (!st.arts.includes(a.id) && canLearn(st, a)) { st.arts.push(a.id); got.push(a.id); }
  if (s && show && got.length && st.status === 'enrolled') s.pending.push({ type: 'art', studentId: st.id, ids: got });
  if (got.length) autoEquip(st);
  return got;
}
/** その子の今の兵種で使える武器の種類 */
function weaponTypes(st: Student): WeaponType[] { return (CLASSES[st.classId] ?? CLASSES.novice).weapons; }
/** 15夜目：魔法の id か（戦技・スキルと同じ「つけている」一覧に入る） */
export function isSpellId(id: string): boolean { return !!WEAPONS[id]?.spell; }
/** 今の兵種で使える覚えた魔法 */
function usable(st: Student): string[] { const ws = weaponTypes(st); return (st.spells ?? []).filter((id) => { const w = WEAPONS[id]; return w && ws.includes(w.type); }); }
/**
 * 15夜目：おまかせの組み合わせ。戦技と魔法を合わせて5つ、スキル（心得）を5つ。
 * 回復役は回復の魔法を必ず入れ、魔法で戦う子はいちばん強い攻撃の魔法を入れる。残りは強い戦技から、そのあと残りの魔法
 */
export function autoLoadout(st: Student): string[] {
  const ws = weaponTypes(st);
  const learned = artsOf(st).map((id) => ARTS[id]).filter(Boolean);
  const score = (a: ArtDef) => rankIdx(a.rank) * 10 + (a.bloom ? 25 : 0) + (st.apt?.good.includes(a.skill) ? 3 : 0);
  const arts = learned.filter((a) => a.kind === 'art' && (!a.weapons || a.weapons.some((w) => ws.includes(w)))).sort((x, y) => score(y) - score(x));
  const minds = learned.filter((a) => a.kind === 'mind' && (!a.ability?.wtype || a.ability.wtype.some((w) => ws.includes(w)))).sort((x, y) => score(y) - score(x)).slice(0, ART_SLOTS.mind);
  const sp = usable(st).map((id) => WEAPONS[id]);
  const staffs = sp.filter((w) => w.type === 'staff').sort((a, b) => b.might + (b.maxRange - 1) * 6 - (a.might + (a.maxRange - 1) * 6));
  const atk = sp.filter((w) => w.type !== 'staff').sort((a, b) => b.might - a.might);
  const pick: string[] = [];
  if (staffs[0]) pick.push(staffs[0].id);
  if (atk[0]) pick.push(atk[0].id);
  for (const a of arts) pick.push(a.id);
  for (const w of [...atk.slice(1), ...staffs.slice(1)]) pick.push(w.id);
  return [...pick.slice(0, ART_SLOTS.art), ...minds.map((a) => a.id)];
}
/** 付けかえはおまかせ（手で選んだときはそれを使う） */
export function autoEquip(st: Student): void {
  if (st.artsManual) return;
  st.artsOn = autoLoadout(st);
}
/** いまつけているもの（戦技・魔法・スキルの id）。おまかせの子は、今の兵種に合わせてその場で選び直す */
export function loadoutOf(st: Student): string[] { return st.artsManual ? (st.artsOn ?? []) : autoLoadout(st); }
/** 付けている技（戦技とスキル。戦いで使う） */
export function equippedOf(st: Student): ArtDef[] { return loadoutOf(st).map((id) => ARTS[id]).filter(Boolean); }
/** 付けている魔法（今の兵種で使えるものだけ）。手で全部外して武器もないときは、いちばん強い魔法を1つ */
export function equippedSpells(st: Student): string[] {
  const u = usable(st);
  const on = new Set(loadoutOf(st));
  return u.filter((id) => on.has(id));
}
/** 戦技と魔法を合わせた数（5つまで） */
export function battleCount(ids: string[]): number { return ids.filter((id) => isSpellId(id) || ARTS[id]?.kind === 'art').length; }
/** 手で付けかえる（上限まで）。魔法も同じ一覧で */
export function toggleArt(st: Student, id: string): void {
  const spell = isSpellId(id);
  const a = ARTS[id];
  if (spell ? !(st.spells ?? []).includes(id) : !a || !artsOf(st).includes(id)) return;
  const on = new Set(loadoutOf(st));
  if (on.has(id)) on.delete(id);
  else if (spell || a.kind === 'art' ? battleCount([...on]) < ART_SLOTS.art : [...on].filter((x) => ARTS[x]?.kind === 'mind').length < ART_SLOTS.mind) on.add(id);
  st.artsOn = [...on]; st.artsManual = true;
}

/** 敵将の戦技（武器の技能に合わせ、レベルと階級で1〜2つ。名前から決まる） */
export function officerArts(o: Pick<EnemyOfficer, 'id' | 'given' | 'classId' | 'level' | 'rank' | 'alumniId'>, s?: GameState): string[] {
  if (o.alumniId && s?.students[o.alumniId]) return equippedOf(s.students[o.alumniId]).filter((a) => a.kind === 'art').map((a) => a.id);
  const c = CLASSES[o.classId];
  const wt = c?.weapons.find((w) => w !== 'staff') ?? 'sword';
  const skill = (wt === 'holy' ? 'faith' : wt) as SkillId;
  const max: Rank = o.level >= 34 ? 'A' : o.level >= 24 ? 'B' : o.level >= 14 ? 'C' : 'D';
  const list = ART_LIST.filter((a) => a.kind === 'art' && !a.bloom && a.skill === skill && rankIdx(a.rank) <= rankIdx(max));
  const r = new Rng({ rng: [...(o.id + o.given)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) });
  return r.shuffle(list).slice(0, o.rank === 2 ? 1 : 2).map((a) => a.id);
}
/** 組織図・出撃前のヒント：「燕返しの使い手」 */
export function artsLabel(ids: string[]): string { return ids.length ? `${ARTS[ids[0]]?.name}の使い手` : ''; }

// ---------- 戦いの中で ----------
export interface ArtUse { id: string; hit: number; dmg: number; crit: number }
/** この一撃で戦技を使うか（使うなら補正を返す）。敵将・名のある相手や、相手が弱ったときに使いやすい */
export function pickArt(u: Unit, d: Unit, weaponType: WeaponType | undefined, baseDmg: number, roll: () => number, moveTypeOf: (x: Unit) => string): ArtUse | null {
  const list = (u.arts ?? []).map((id) => ARTS[id]).filter((a): a is ArtDef => !!a && a.kind === 'art' && (!a.card || a.card.type === 'atk') && (!a.weapons || (!!weaponType && a.weapons.includes(weaponType))));
  if (!list.length) return null;
  const bonus = (d.boss || d.studentId ? ART_CHANCE.leader : 0) + (d.hp <= d.maxHp / 2 ? ART_CHANCE.lowHp : 0);
  for (const a of list.sort((x, y) => rankIdx(y.rank) - rankIdx(x.rank))) {
    if (roll() * 100 >= Math.min(ART_CHANCE.max, (a.chance ?? 25) + bonus)) continue;
    const vs = a.vsMove?.includes(moveTypeOf(d) as never) ? ART_CHANCE.vsMoveDmg : 0;
    const dmg = Math.max(0, Math.round((baseDmg + (a.dmg ?? 0) + (a.pierce ?? 0) + vs) * (a.mul ?? 1)));
    return { id: a.id, hit: a.hit ?? 0, dmg, crit: a.crit ?? 0 };
  }
  return null;
}

// 開花したら、その技能の固有の戦技を覚える（演出は開花の場面にまとめる）
setBloomHook((_s, st) => { learnArts(null, st, false); });
