// 魔法の覚え方：入学時に「覚える魔法の一覧」を決め、技能ランクが E・D・C・B・A・S に届いたら1つずつ覚える
import { SPELL_LIST, SPELL_PLAN } from '../data/spells';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { RANK_POINTS } from '../data/balance';
import type { Rank, SkillId, WeaponDef, SpellSlot } from './types';
export type { SpellSlot };
import type { GameState, Student } from './state';
import { Rng } from './rng';
import { rankIndex } from './util';


function hash(s: string): number { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h | 0; }

export function spellSkill(w: WeaponDef): 'magic' | 'faith' { return w.type === 'magic' ? 'magic' : 'faith'; }

/**
 * 生徒ごとの「覚える魔法の一覧」。生徒のidから決まる（ゲームの乱数を消費しない）ので、
 * 古いセーブの在校生にも同じ方法で一覧を作れる。
 */
export function makeSpellPlan(st: Pick<Student, 'id' | 'given' | 'talent'>): SpellSlot[] {
  const rng = new Rng({ rng: hash(`${st.id}:${st.given}:spells`) });
  const out: SpellSlot[] = [];
  for (const skill of ['magic', 'faith'] as const) {
    const genius = st.talent === `genius_${skill}`;
    const pool = SPELL_LIST.filter((w) => spellSkill(w) === skill && (!w.rare || genius));
    const n = rng.int(...SPELL_PLAN.count);
    // どのランクで覚えるか：E は高い確率で入れ、残りは D〜S から選ぶ
    const ranks: Rank[] = [];
    if (rng.chance(SPELL_PLAN.firstSlotChance)) ranks.push('E');
    const rest = rng.shuffle(SPELL_PLAN.ranks.filter((r) => r !== 'E') as Rank[]);
    while (ranks.length < n && rest.length) ranks.push(rest.shift()!);
    ranks.sort((a, b) => rankIndex(a) - rankIndex(b));
    const used = new Set<string>();
    for (const r of ranks) {
      // 天才の子は A・S の枠に珍しい魔法
      let cand = pool.filter((w) => !used.has(w.id) && rankIndex(w.rank) <= rankIndex(r));
      if (genius && (r === 'A' || r === 'S')) { const rare = cand.filter((w) => w.rare); if (rare.length) cand = rare; }
      else cand = cand.filter((w) => !w.rare);
      if (!cand.length) continue;
      // 目安のランクが近いものほど選ばれやすい
      const w = rng.weighted(cand, (x) => 1 + 6 / (1 + rankIndex(r) - rankIndex(x.rank)) + (skill === 'faith' && x.type === 'staff' && r === 'E' ? 4 : 0));
      used.add(w.id);
      out.push({ id: w.id, rank: r, skill });
    }
  }
  return out;
}

export function ensureSpellPlan(st: Student): SpellSlot[] {
  if (!st.spellPlan) st.spellPlan = makeSpellPlan(st);
  st.spells ??= [];
  return st.spellPlan;
}

/** 技能ランクが届いた魔法を覚える。新しく覚えた魔法の id を返す */
export function learnSpells(s: GameState | null, st: Student): string[] {
  const plan = ensureSpellPlan(st);
  const got: string[] = [];
  for (const slot of plan) {
    if (st.spells.includes(slot.id)) continue;
    if ((st.skills[slot.skill] ?? 0) >= RANK_POINTS[slot.rank]) { st.spells.push(slot.id); got.push(slot.id); }
  }
  if (got.length && s) for (const id of got) st.history.push({ year: s.year, text: `${WEAPONS[id].name}を覚えた` });
  return got;
}

/** 次に覚える魔法（技能ごと） */
export function nextSpell(st: Student, skill: 'magic' | 'faith'): SpellSlot | null {
  return ensureSpellPlan(st).find((x) => x.skill === skill && !st.spells.includes(x.id)) ?? null;
}

/** 今の兵種で使える覚えた魔法 */
export function usableSpells(st: Pick<Student, 'spells' | 'classId'>): string[] {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  return (st.spells ?? []).filter((id) => { const w = WEAPONS[id]; return w && c.weapons.includes(w.type); });
}

export function learnedText(st: Student, id: string): string { return `${st.given}は ${WEAPONS[id]?.name ?? id} を覚えた！`; }
export type { SkillId };
