// 連携技（18夜目）：支援B以上の2人にできる、2人だけの合体の札。DOMに依存しない
import { B } from '../data/balance';
import { ARTS, ART_LIST } from '../data/arts';
import { COMBO_HEAD, COMBO_TAIL, COMBO_AFFIX, COMBO_TASTE, COMBO_KIND, type ComboKind } from '../data/combos';
import type { GameState, Student, Support } from './state';
import type { SkillId } from './types';
import { pairKey } from './util';

export interface ComboRec {
  a: string; b: string; name: string; kind: ComboKind;
  /** 先輩と後輩のとき、先輩の id */
  senior?: string;
  made: { year: number; month: number };
  used: number;
  /** どちらかが戦死した（年鑑に残る。もう使えない） */
  lost?: { year: number; month: number; by: string };
}
/** いちばん得意な技能（技能ポイントがいちばん多いもの） */
function topSkill(st: Student): SkillId {
  const ks = Object.entries(st.skills ?? {}) as [SkillId, number][];
  return ks.sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'sword';
}
function relKind(sp: Support): ComboKind {
  return sp.kind === 'love' || sp.kind === 'rival' || sp.kind === 'senpai' ? sp.kind : 'friend';
}
/** 2人の連携技の名前（2人の得意な技能と性格から。ほかの連携技・技の名前と重ならない） */
export function comboName(s: GameState, a: Student, b: Student, kind: ComboKind): string {
  const used = new Set([...Object.values(s.combos ?? {}).map((c) => c.name), ...ART_LIST.map((x) => x.name)]);
  const ha = COMBO_HEAD[topSkill(a)] ?? COMBO_HEAD.sword;
  const tb = COMBO_TAIL[topSkill(b)] ?? COMBO_TAIL.sword;
  const af = COMBO_AFFIX[kind];
  // 同じ子の連携技が同じ言葉ばかりにならないよう、相手の性格・名前でも変える
  const i0 = ((COMBO_TASTE[a.personality] ?? 0) + (COMBO_TASTE[b.personality] ?? 0) + b.given.length) % 3, j0 = ((COMBO_TASTE[b.personality] ?? 0) + a.given.length) % 3;
  for (let k = 0; k < 27; k++) {
    const i = (i0 + k) % 3, j = (j0 + Math.floor(k / 3)) % 3, f = (i0 + j0 + Math.floor(k / 9)) % 3;
    const n = `${af[f]}${ha[i]}${tb[j]}`;
    if (!used.has(n)) return n;
  }
  for (let k = 2; ; k++) { const n = `${af[0]}${ha[i0]}${tb[j0]}・${'弐参肆伍陸漆捌玖'[(k - 2) % 8]}${k > 9 ? k : ''}`; if (!used.has(n)) return n; }
}
/** 支援がB以上になったら、連携技を作る（もうあれば作らない）。作ったら返す */
export function ensureCombo(s: GameState, sp: Support): ComboRec | null {
  if (sp.value < B.support.B) return null;
  const A = s.students[sp.a], Bs = s.students[sp.b];
  if (!A || !Bs || A.status === 'dead' || Bs.status === 'dead') return null;
  const k = pairKey(sp.a, sp.b);
  s.combos ??= {};
  if (s.combos[k]) return null;
  const kind = relKind(sp);
  // 先輩と後輩：先輩（学年が上・先に入学した子）が先
  let [x, y] = [A, Bs];
  if (kind === 'senpai' && (y.cohort ?? 0) < (x.cohort ?? 0)) [x, y] = [y, x];
  const rec: ComboRec = { a: x.id, b: y.id, name: comboName(s, x, y, kind), kind, senior: kind === 'senpai' ? x.id : undefined, made: { year: s.year, month: s.month }, used: 0 };
  s.combos[k] = rec;
  return rec;
}
/** 2人の連携技（使えるものだけ） */
export function comboOf(s: GameState, a: string, b: string): ComboRec | null {
  const c = s.combos?.[pairKey(a, b)];
  return c && !c.lost ? c : null;
}
/** その子の連携技（失われたものも。年鑑・個人ページ） */
export function combosOf(s: GameState, id: string): ComboRec[] {
  return Object.values(s.combos ?? {}).filter((c) => c.a === id || c.b === id);
}
/** 相手の id */
export function partnerOf(c: ComboRec, id: string): string { return c.a === id ? c.b : c.a; }
/** 戦死した子の連携技は、年鑑に残る（もう使えない） */
export function loseCombos(s: GameState, id: string): void {
  for (const c of combosOf(s, id)) if (!c.lost) c.lost = { year: s.year, month: s.month, by: id };
}
/** 発見の演出の文（支援会話のあと） */
export function comboFindText(s: GameState, c: ComboRec): string {
  const a = s.students[c.a]?.given ?? '', b = s.students[c.b]?.given ?? '';
  return `${a}と${b}の連携技「${c.name}」ができた！　同じターンに2人の札を続けて出すと、2枚が合わさって発動します（${COMBO_KIND[c.kind].label}）`;
}
/** 古いセーブ：もう支援B以上の組に、連携技を作る。作った数 */
export function migrateCombos(s: GameState): number {
  let n = 0;
  for (const sp of Object.values(s.supports ?? {})) if (ensureCombo(s, sp)) n++;
  return n;
}
void ARTS;
