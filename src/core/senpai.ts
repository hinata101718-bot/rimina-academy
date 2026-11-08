// 先輩と後輩の続き（14夜目）：卒業した先輩からの手紙、戦場での再会（援軍・敵として後輩の名前を呼ぶ）、卒業式の一言に後輩の名前
import type { GameState, Student } from './state';
import type { PersonalityId } from './types';
import { Rng } from './rng';
import { mail } from './game';
import { COUNTRY_SHORT } from '../data/people';
import { SENPAI_LETTER, SENPAI_GRAD, SENPAI_ALLY, SENPAI_FOE } from '../data/senpai';

/** その子と「先輩と後輩」の相手（相手の状態でしぼる） */
export function senpaiPartners(s: GameState, st: Student, filter: (o: Student) => boolean): Student[] {
  return Object.values(s.supports).filter((sp) => sp.kind === 'senpai' && (sp.a === st.id || sp.b === st.id))
    .sort((x, y) => y.value - x.value)
    .map((sp) => s.students[sp.a === st.id ? sp.b : sp.a]).filter((o): o is Student => !!o && filter(o));
}
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
const pick = <T,>(r: Rng, p: Record<PersonalityId, T[]>, k: PersonalityId): T => r.pick(p[k] ?? p.serious);

/** 卒業式の一言に、いちばん親しい後輩の名前を足す */
export function gradWord(s: GameState, r: Rng, st: Student): string | null {
  const k = senpaiPartners(s, st, (o) => o.status === 'enrolled' && o.cohort > st.cohort)[0];
  if (!k) return null;
  return fill(pick(r, SENPAI_GRAD, st.personality), { k: k.given });
}

/** 卒業した先輩から在校の後輩への手紙（10月の初め。1年に1通まで、先輩ごとに） */
export function senpaiLetters(s: GameState, r: Rng): number {
  let n = 0;
  for (const st of Object.values(s.students)) {
    if (st.status !== 'graduated' || !st.career?.alive || st.career.retired) continue;
    if (s.year - (st.enrollYear + 3) > 3) continue; // 卒業して3年まで
    const k = senpaiPartners(s, st, (o) => o.status === 'enrolled')[0];
    if (!k || !r.chance(0.6)) continue;
    const where = st.career.kind === 'army' && st.career.country ? `${COUNTRY_SHORT[st.career.country]}の軍` : st.career.kind === 'stay' ? '学校' : st.career.kind === 'merc' ? '傭兵団' : '故郷';
    const body = fill(pick(r, SENPAI_LETTER, st.personality), { k: k.given, a: st.given, where });
    mail(s, `卒業生 ${st.given}`, `${k.given}へ`, body, st.id);
    k.history.push({ year: s.year, text: `卒業した${st.given}先輩から手紙が届いた` });
    n++;
  }
  return n;
}

/** 戦場で再会した先輩が、後輩の名前を呼ぶ一言（味方の援軍・敵として） */
export function reunionLine(s: GameState, r: Rng, alum: Student, deployedIds: string[], side: 'ally' | 'foe'): { text: string; kohai: string } | null {
  const k = senpaiPartners(s, alum, (o) => deployedIds.includes(o.id))[0];
  if (!k) return null;
  const p = side === 'ally' ? SENPAI_ALLY : SENPAI_FOE;
  return { text: fill(pick(r, p, alum.personality), { k: k.given }), kohai: k.id };
}
