// 得意技能・苦手技能・眠った芽と才能開花（10夜目）。隠れた才能の代わり。DOMに依存しない
import { B, ARM_SKILLS, RANK_POINTS, SKILLS } from '../data/balance';
import { DREAMS, COUNTRY_FAVOR_SKILLS, SKILL_NAMES, TALENTS } from '../data/people';
import { CLASSES } from '../data/classes';
import type { SkillId, PersonalityId, CountryId } from './types';
import type { GameState, Student } from './state';
import { Rng } from './rng';

/** 性格ごとに向きやすい技能 */
const PERS_SKILLS: Record<PersonalityId, SkillId[]> = {
  hot: ['axe', 'command', 'riding'], calm: ['bow', 'tactics', 'magic'], timid: ['faith', 'bow'], cynic: ['tactics', 'magic', 'bow'],
  gentle: ['faith', 'heavy'], serious: ['lance', 'command', 'tactics'], cheerful: ['flying', 'riding', 'command'], shy: ['magic', 'bow'],
  competitive: ['sword', 'axe', 'command'], whimsical: ['flying', 'magic'],
};

export function goodOf(st: Student): SkillId[] { return st.apt?.good ?? []; }
export function badOf(st: Student): SkillId[] { return st.apt?.bad ?? []; }
export function isGood(st: Student, k: SkillId): boolean { return goodOf(st).includes(k); }
export function isBad(st: Student, k: SkillId): boolean { return badOf(st).includes(k); }
/** 技能の伸び：得意×1.5、苦手×0.5 */
export function aptMul(st: Student, k: SkillId): number {
  if (isGood(st, k)) return B.apt.goodMul;
  // 芽が見えた苦手は、育てればふつうに伸びる（狙って育てられる）
  if (isBad(st, k)) return st.bud && !st.bud.done && st.bud.skill === k && st.bud.reveal >= B.apt.known ? B.apt.budMul : B.apt.badMul;
  return 1;
}

/** 向きの点（得意・苦手の決め方）：夢・出身・性格・家柄・入学時の技能ランク */
function aptScore(st: Student): Record<SkillId, number> {
  const sc = Object.fromEntries(SKILLS.map((k) => [k, 0])) as Record<SkillId, number>;
  const dream = DREAMS.find((d) => d.id === st.dream);
  for (const k of dream?.skills ?? []) sc[k] += 3;
  if (st.origin !== 'frontier') for (const k of COUNTRY_FAVOR_SKILLS[st.origin as CountryId]) sc[k] += 1.5;
  for (const k of PERS_SKILLS[st.personality] ?? []) sc[k] += 1.5;
  if (st.house === 'noble') { sc.command += 1; sc.riding += 1; }
  if (st.house === 'orphan') { sc.sword += 0.5; sc.bow += 0.5; }
  for (const k of SKILLS) sc[k] += (st.skills[k] ?? 0) / 15;
  return sc;
}

/** 得意2〜3個・苦手1〜2個を決める（夢に沿う技能は苦手にしない） */
export function assignApt(st: Student, rng: Rng, mustGood: SkillId[] = []): void {
  const sc = aptScore(st);
  const pool: SkillId[] = SKILLS.filter((k) => k !== 'gun');
  const good: SkillId[] = [...new Set(mustGood.filter((k) => pool.includes(k)))];
  const n = rng.chance(B.apt.good3) ? 3 : 2;
  while (good.length < n) good.push(rng.weighted(pool.filter((k) => !good.includes(k)), (k) => 0.6 + Math.max(0, sc[k]) ** 1.4));
  const dream = DREAMS.find((d) => d.id === st.dream)?.skills ?? [];
  const rest = pool.filter((k) => !good.includes(k) && !dream.includes(k));
  const bad: SkillId[] = [];
  const nb = rng.chance(B.apt.bad2) ? 2 : 1;
  while (bad.length < nb && rest.length) { const k = rng.weighted(rest.filter((x) => !bad.includes(x)), (x) => 1 / (1 + Math.max(0, sc[x]))); bad.push(k); }
  st.apt = { good, bad };
}

/** 3割ほどの子に、苦手のどれか1つに眠った芽。ごくまれに金の芽（英雄への道） */
export function assignBud(st: Student, rng: Rng, gold = false): void {
  if (gold || rng.chance(B.apt.goldChance)) { st.bud = { gold: true, reveal: 0 }; return; }
  const bad = badOf(st);
  if (bad.length && rng.chance(B.apt.budChance)) st.bud = { skill: rng.pick(bad), reveal: 0 };
}

/** 芽が見えているか（苦手の印に芽の印） */
export function budKnown(st: Student): boolean { return !!st.bud && !st.bud.done && st.bud.reveal >= B.apt.known; }
export function budHinted(st: Student): boolean { return !!st.bud && !st.bud.done && st.bud.reveal >= B.apt.hint; }
export function budName(st: Student): string { return st.bud?.gold ? '金の芽' : st.bud?.skill ? `${SKILL_NAMES[st.bud.skill]}の芽` : ''; }

/** 芽の判明度を上げる（授業・面談・書庫・戦い）。ヒント→芽の印の発見の演出 */
export function revealBud(s: GameState, st: Student, amount: number, lines?: string[]): void {
  const b = st.bud;
  if (!b || b.done || st.status !== 'enrolled') return;
  const before = b.reveal;
  b.reveal = Math.max(0, Math.min(100, b.reveal + amount * (s.settings.mods.reveal ?? 1)));
  const after = b.reveal;
  const what = b.gold ? 'まだ誰も知らない大きな器' : `${SKILL_NAMES[b.skill!]}`;
  if (before < B.apt.hint && after >= B.apt.hint) {
    const text = b.gold ? `……${st.given}には、何をやらせても伸びていく、底の知れないところがある。` : `……もしかすると、${st.given}は${what}に眠っているものがあるかもしれない。`;
    lines?.push(text);
    pushOnce(s, { type: 'discovery', studentId: st.id, stage: 1, title: 'ひらめきの兆し', text });
  }
  if (before < B.apt.known && after >= B.apt.known) {
    const text = b.gold ? `${st.given}の中に、金色の芽が見えた。大きく育てれば、英雄への道が開けるかもしれない。` : `${st.given}の苦手な${what}に、小さな芽が見えた。${what}を目標技能にして育てれば、花が開くかもしれない。`;
    lines?.push(`${st.given}に${budName(st)}が見えた`);
    pushOnce(s, { type: 'discovery', studentId: st.id, stage: 3, title: b.gold ? '金の芽' : '眠っていた芽', text, name: budName(st) });
  }
}
function pushOnce(s: GameState, p: Extract<GameState['pending'][number], { type: 'discovery' }>): void {
  if (s.pending.some((x) => x.type === 'discovery' && x.studentId === p.studentId && x.stage === p.stage)) return;
  s.pending.push(p);
}

/** 開花する技能の兵種（その技能を求める兵種の名前） */
export function bloomClasses(k: SkillId): string[] {
  return Object.values(CLASSES).filter((c) => !c.hidden && c.req[k] && c.tier >= 1 && c.tier <= 3).map((c) => c.name).slice(0, 3);
}

/** 開花の条件を見る（技能が伸びたあとに呼ぶ）。開花したら演出を積む */
export function checkBloom(s: GameState, st: Student): boolean {
  const b = st.bud;
  if (!b || b.done || st.status !== 'enrolled') return false;
  if (b.gold) {
    const best = Math.max(...goodOf(st).map((k) => st.skills[k] ?? 0), 0);
    if (b.reveal < B.apt.known || st.level < B.apt.goldLevel || best < RANK_POINTS[B.apt.goldRank]) return false;
    b.done = true; b.year = s.year; b.ability = 'bloom_gold';
    s.pending.push({ type: 'bloom', studentId: st.id, gold: true });
    st.history.push({ year: s.year, text: '金の芽が開き、英雄への道が見えた' });
    return true;
  }
  const k = b.skill!;
  if ((st.skills[k] ?? 0) < RANK_POINTS[B.apt.bloomRank] || !st.targets.includes(k)) return false;
  b.done = true; b.year = s.year; b.ability = `bloom_${k}`;
  b.reveal = 100;
  if (st.apt) { st.apt.bad = st.apt.bad.filter((x) => x !== k); if (!st.apt.good.includes(k)) st.apt.good.push(k); }
  s.pending.push({ type: 'bloom', studentId: st.id, skill: k });
  bloomHook?.(s, st);
  st.history.push({ year: s.year, text: `苦手だった${SKILL_NAMES[k]}の才能が開花した` });
  return true;
}

/** 開花したとき（12夜目：固有の戦技を覚える。循環を避けるため、あとから差しこむ） */
let bloomHook: ((s: GameState, st: Student) => void) | null = null;
export function setBloomHook(f: (s: GameState, st: Student) => void): void { bloomHook = f; }

/** 開花した子の技（兵種の固有スキルに足す） */
export function bloomAbility(st: Student): string | null { return st.bud?.done ? st.bud.ability ?? null : null; }

// ---------- 古いセーブ（9夜目まで）の変換 ----------
/** 9夜目までの成長率（1つ7〜30%ほど）を新しい基準（20〜65%）へ。高い・低いの順は保ち、5%きざみ */
export function liftGrowth(st: Student): void {
  const r5 = (v: number) => Math.round(v / 5) * 5;
  for (const k of Object.keys(st.growth) as (keyof Student['growth'])[]) {
    const v = st.growth[k];
    st.growth[k] = k === 'hp' ? Math.max(40, Math.min(65, r5(25 + v * 1.15))) : Math.max(20, Math.min(65, r5(12 + v * 1.6)));
  }
  fitTotal(st.growth);
}
/** 全能力の合計（本人）を330〜420%に収める */
export function fitTotal(g: Student['growth']): void {
  const keys = (Object.keys(g) as (keyof Student['growth'])[]).filter((k) => k !== 'hp');
  let total = () => (Object.values(g) as number[]).reduce((a, b) => a + b, 0);
  let guard = 0;
  while (total() < B.student.growthTotal[0] && guard++ < 40) { const k = keys.filter((x) => g[x] < 65).sort((a, b) => g[a] - g[b])[guard % 3] ?? keys[0]; g[k] += 5; }
  while (total() > B.student.growthTotal[1] && guard++ < 80) { const k = keys.filter((x) => g[x] > 20).sort((a, b) => g[b] - g[a])[guard % 3] ?? keys[0]; g[k] -= 5; }
  void total;
}
/** 隠れた才能→得意（判明前の才能もそのまま得意に）。英雄の器は金の芽。軍師の才は軍略、隠れた統率者は統率 */
export function talentToApt(st: Student, rng: Rng, enrolled: boolean): void {
  const t = st.talent ? TALENTS[st.talent] : null;
  const must: SkillId[] = [];
  if (t?.skill) must.push(t.skill);
  if (st.talent === 'strategist') must.push('tactics');
  if (st.talent === 'leader') { must.push('command'); st.bornLeader = true; }
  if (!st.apt) assignApt(st, rng, must);
  if (enrolled && !st.bud) assignBud(st, rng, st.talent === 'hero');
  if (st.talent === 'hero' && !enrolled) st.bud = { gold: true, reveal: 100, done: (CLASSES[st.classId]?.hidden ?? false) };
  st.talent = null;
  st.growthKnown = true;
  void ARM_SKILLS;
}
