// 兵種試験
import { B, RANK_POINTS } from '../data/balance';
import { CLASSES, CLASS_LIST } from '../data/classes';
import type { ClassDef, SkillId, Rank } from './types';
import type { GameState, Student } from './state';
import { Rng } from './rng';
import { absMonth } from './util';
import { markClassSeen } from './growth';
import { available, chronicle, notify } from './game';
import { addRecent } from './support';
import { SKILL_NAMES, DREAMS } from '../data/people';
import { rankOf } from './util';
import { learnTechs } from './techs';
import { checkEquips } from './equip';

/** 学校で受けられる段階（設計書：上級まで。1夜目は中級までを主対象にするが、上級もデータ上は受験可） */
export const SCHOOL_MAX_TIER = 3;

export function classUnlocked(s: GameState, c: ClassDef): boolean {
  void s;
  if (c.hidden) return true; // 隠れた兵種：道が開いた子だけが nextClasses に出る
  if (c.tier > SCHOOL_MAX_TIER) return false;
  return true;
}

/** 19夜目：その段階に上がれる学年と、出撃の回数（宿敵戦は2回に数える） */
export function sortieCount(st: Student): number { return st.battles + (st.nemBattles ?? 0); }
export function gradeOk(st: Student, c: ClassDef): boolean {
  const E = B.exam;
  if (c.hidden) return true;
  if (c.tier === 2) return st.grade >= E.tier2Grade || st.status === 'graduated';
  if (c.tier === 3) return st.grade >= E.tier3Grade || st.status === 'graduated';
  if (c.tier === 4) return st.status === 'graduated';
  return true;
}
export function sortiesNeed(c: ClassDef): number { return c.hidden ? 0 : B.exam.sorties[c.tier] ?? 0; }
/** 隠れた兵種の道が開いたか（出来事で横道が開く） */
export function hiddenOpen(s: GameState, st: Student, c: ClassDef): boolean {
  void s;
  switch (c.id) {
    // 宿敵に片目を奪われる（弓・密偵の系統、どの段階でも）
    case 'oneeye': return (st.scars ?? []).some((x) => x.text.includes('目')) && ['bow', 'dagger'].includes((CLASSES[st.classId] as { line?: string })?.line ?? '');
    // 呪いで蘇った味方
    case 'cursechild': return !!st.revivedBy;
    default: return false;
  }
}

/** 隠し兵種「英雄」：才能「英雄の器」の子が上級から（在学中は Lv20 以上で受験できる） */
/** 10夜目：金の芽が開花した子（古いセーブの「英雄の器」もここに） */
export function heroOpen(st: Student): boolean { return (st.talent === 'hero' || (!!st.bud?.gold && !!st.bud.done)) && (CLASSES[st.classId]?.tier ?? 0) === 3; }

/** 受験に必要なレベル（段階ごと） */
export function levelReq(c: ClassDef): number { return c.hidden ? 0 : B.exam.levelReq[c.tier] ?? 0; }

export function meetsSkillReq(st: Student, c: ClassDef): boolean {
  return Object.entries(c.req).every(([k, r]) => st.skills[k as SkillId] >= RANK_POINTS[r as Rank]);
}
/** 技能ランクとレベルの両方を満たすか */
export function meetsReq(st: Student, c: ClassDef): boolean {
  return st.level >= levelReq(c) && meetsSkillReq(st, c) && gradeOk(st, c) && sortieCount(st) >= sortiesNeed(c);
}

/** 足りない条件を、やさしい文で返す（例「Lv10から受験できます（あと3）」「槍 C が必要（いま D+）」） */
export function missingReqs(s: GameState, st: Student, c: ClassDef): string[] {
  const out: string[] = [];
  const lv = levelReq(c);
  if (st.level < lv) out.push(`Lv${lv}から受験できます（あと${lv - st.level}）`);
  for (const [k, r] of Object.entries(c.req)) {
    if (st.skills[k as SkillId] < RANK_POINTS[r as Rank]) out.push(`${SKILL_NAMES[k as SkillId]} ${r} が必要（いま ${rankOf(st.skills[k as SkillId])}）`);
  }
  if (!gradeOk(st, c)) out.push(c.tier === 2 ? '1年目の終わり（2年生）から' : c.tier === 3 ? '3年生から' : '卒業してから');
  const need = sortiesNeed(c);
  if (sortieCount(st) < need) out.push(`出撃 ${need}回から（いま ${sortieCount(st)}回。宿敵戦は2回に数える）`);
  void s;
  return out;
}

/** 22夜目：枝分かれの先（図鑑の「おすすめの道」） */
export function onBranch(st: Student, c: ClassDef): boolean { return c.prereq.includes(st.classId); }
/** 22夜目：次の段階の兵種（枝分かれの先でなくても）。隠れた兵種は出来事で開いたものだけ */
function nextTierPool(s: GameState, st: Student): ClassDef[] {
  const cur = CLASSES[st.classId];
  const tier = cur?.tier ?? 0;
  return CLASS_LIST.filter((c) => c.id !== st.classId && (c.hidden ? hiddenOpen(s, st, c) : c.tier === tier + 1 && (c.tier <= SCHOOL_MAX_TIER || st.status === 'graduated'))
    && !(cur?.hidden && !c.hidden && c.tier <= (cur?.tier ?? 0)));
}
/** 次の段階があるか（試験のボタンを出すか） */
export function hasNextTier(s: GameState, st: Student): boolean {
  return nextTierPool(s, st).length > 0 || branchAhead(st).length > 0;
}
/** 枝分かれの先のうち、いまの立場で受けられる段階のもの（在学中は上級まで） */
export function branchAhead(st: Student): ClassDef[] {
  return CLASS_LIST.filter((c) => onBranch(st, c) && !c.hidden && (c.tier <= SCHOOL_MAX_TIER || st.status === 'graduated'));
}
/** 最上級：その兵種の、なる条件の出来事を成し遂げたか */
export function deedOk(st: Student, c: ClassDef): boolean {
  const x = c as ClassDef & { deed?: string; need?: number };
  return c.tier !== 4 || !x.deed || (st.deeds?.[x.deed] ?? 0) >= (x.need ?? 1);
}
/** 22夜目：先生の勧め。技能が条件をどれだけ上回っているか・兵種の伸びが本人の伸びやすさに合うか・枝分かれの先か、で決める */
export function teacherScore(st: Student, c: ClassDef): number {
  const E = B.exam;
  let v = 0;
  for (const [k, r] of Object.entries(c.req)) v += (st.skills[k as SkillId] - RANK_POINTS[r as Rank]) / 100;
  for (const [k, g] of Object.entries(c.growth)) v += ((st.growth as Record<string, number>)[k] ?? 30) * (g as number) * E.recGrowthW;
  if (onBranch(st, c)) v += E.recBranch;
  return v;
}
/** 22夜目：生徒の好み。夢に沿う技能・執念（強く攻める兵種へ）・性格で、先生の勧めと違う道を選ぶ子も */
export function studentScore(st: Student, c: ClassDef): number {
  const E = B.exam;
  const dream = DREAMS.find((d) => d.id === st.dream);
  let v = teacherScore(st, c) * 0.5;
  const req = Object.keys(c.req) as SkillId[];
  if (dream) v += req.filter((k) => dream.skills.includes(k)).length * E.prefDream;
  if ((st.mind?.grudge ?? 0) >= E.grudgeAt && ((c.bonus.str ?? 0) + (c.bonus.mag ?? 0)) >= 4) v += E.prefGrudge;
  // 同じ子なら、いつも同じ好み（ゲームの乱数の流れを変えない）
  let h = 7; for (const ch of st.id + c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return v + (h % 100) / 100 * E.prefNoise;
}
/** 受けられる兵種。22夜目：技能の条件を満たすものだけ。並ぶ順は ①先生の勧め ②枝分かれの先（おすすめの道）③そのほか */
export function nextClasses(s: GameState, st: Student): ClassDef[] {
  const pool = nextTierPool(s, st).filter((c) => meetsSkillReq(st, c) && deedOk(st, c));
  const rec = recommendedOf(st, pool);
  return pool.sort((a, b) => Number(b.id === rec) - Number(a.id === rec) || Number(onBranch(st, b)) - Number(onBranch(st, a)) || teacherScore(st, b) - teacherScore(st, a));
}
/** 先生の勧め（受けられる兵種のうちの1つ） */
export function recommendedOf(st: Student, opts: ClassDef[]): string | null {
  const ok = opts.filter((c) => !c.hidden);
  const list = ok.length ? ok : opts;
  return list.slice().sort((a, b) => teacherScore(st, b) - teacherScore(st, a))[0]?.id ?? null;
}
export function recommendedClass(s: GameState, st: Student): string | null { return recommendedOf(st, nextClasses(s, st).filter((c) => meetsReq(st, c))); }
/** 生徒がいちばん行きたい兵種 */
export function studentWish(st: Student, opts: ClassDef[]): string | null {
  return opts.slice().sort((a, b) => studentScore(st, b) - studentScore(st, a))[0]?.id ?? null;
}
/** 先生の勧めを聞く見込み（％）。信頼が高いほど聞く。執念が強い子・負けず嫌い・気まぐれは自分の道を選びやすい */
export function followChance(st: Student): number {
  const E = B.exam;
  let p = E.followBase + st.trust * E.followPerTrust;
  if ((st.mind?.grudge ?? 0) >= E.grudgeAt) p -= E.followGrudge;
  if (['competitive', 'whimsical', 'hot'].includes(st.personality)) p -= E.followStubborn;
  return Math.round(Math.max(E.followMin, Math.min(E.followMax, p)));
}
/** 先生が勧め、生徒が決める。勧めと好みが同じなら、そのまま */
export function decideClass(st: Student, rng: Rng, advised: string, opts: ClassDef[]): { id: string; own: boolean } {
  const wish = studentWish(st, opts.filter((c) => c.id === advised || !c.hidden));
  if (!wish || wish === advised) return { id: advised, own: false };
  return rng.next() * 100 < followChance(st) ? { id: advised, own: false } : { id: wish, own: true };
}

export function passRate(st: Student, c: ClassDef): number {
  let over = Infinity;
  for (const [k, r] of Object.entries(c.req)) over = Math.min(over, st.skills[k as SkillId] - RANK_POINTS[r as Rank]);
  if (over === Infinity) over = 0;
  // 8夜目（ヒナタさん指定）：条件（Lv・技能ランク）を満たしていれば必ず合格
  return over < 0 ? 0 : 100;
}

export function canTakeExam(s: GameState, st: Student): boolean {
  // 8夜目：不合格がなくなったので、月に1回の制限もなし
  void s; return st.status === 'enrolled' && available(st);
}

export function examCandidates(s: GameState): Student[] {
  return Object.values(s.students).filter((st) => canTakeExam(s, st) && nextClasses(s, st).some((c) => classUnlocked(s, c) && meetsReq(st, c)));
}

/** 兵種試験。22夜目：先生が勧めた兵種（classId）を、生徒が受けるか決める（decide=false なら勧めのまま） */
export function takeExam(s: GameState, rng: Rng, st: Student, classId: string, decide = true): { ok: boolean; rate: number; text: string; classId?: string; own?: boolean } {
  const ready = () => nextClasses(s, st).filter((x) => classUnlocked(s, x) && meetsReq(st, x));
  if (!CLASSES[classId] || !canTakeExam(s, st) || !ready().some((x) => x.id === classId)) return { ok: false, rate: 0, text: '受験できません' };
  const pick = decide ? decideClass(st, rng, classId, ready()) : { id: classId, own: false };
  const c = CLASSES[pick.id];
  const advised = CLASSES[classId];
  const rate = passRate(st, c);
  st.examMonth = absMonth(s.year, s.month);
  const ok = rng.next() * 100 < rate;
  if (ok) {
    st.classId = c.id;
    st.lastClassWeek = s.absWeek;
    if (markClassSeen(s, c.id)) s.pending.push({ type: 'rankup', items: [{ icon: 'book', title: '兵種図鑑', from: '？', to: c.name, p0: 0.3, p1: 1, studentId: st.id, note: `初めての兵種！ ${st.given}が${c.name}になり、図鑑に載った` }] });
    addRecent(s, st, 'ev_exam', c.name);
    st.motivation = Math.min(4, st.motivation + 1);
    if (c.tier >= 2) chronicle(s, `${st.given}が${c.name}に`, 'student');
    if (c.hidden) { st.growthKnown = true; chronicle(s, `${st.given}が隠れた兵種「${c.name}」への道を選んだ`, 'student'); }
    learnTechs(s, st);
    notify(s, `${st.given}が兵種試験に合格し、${c.name}になった`, st.id);
    checkEquips(s); // 22夜目⑤：新しい兵種で使えない武器は外す
    if (pick.own) {
      st.history.push({ year: s.year, text: `先生の勧めた${advised.name}ではなく、自分で選んだ${c.name}の道へ` });
      return { ok, rate, classId: c.id, own: true, text: `「先生、ありがとうございます。でも、${st.gender === 'm' ? '僕' : 'わたし'}は${c.name}の道を行きたいんです」——${st.given}は自分で道を選び、${c.name}になった` };
    }
    return { ok, rate, classId: c.id, text: `合格！ ${st.given}は${c.name}になった` };
  }
  st.motivation = Math.max(0, st.motivation - 1);
  return { ok, rate, text: `不合格……。${st.given}は来月また挑戦できる` };
}

/** オートプレイ・自動用：受けられる試験のうち一番良いものを受ける */
export function autoExam(s: GameState, rng: Rng, st: Student): string | null {
  const opts = nextClasses(s, st).filter((c) => classUnlocked(s, c) && meetsReq(st, c));
  if (!opts.length || !canTakeExam(s, st)) return null;
  // 22夜目：先生の勧め（条件を満たす兵種から）を、生徒が受けるか決める
  const best = recommendedOf(st, opts) ?? opts[0].id;
  if (passRate(st, CLASSES[best]) < 70) return null;
  return takeExam(s, rng, st, best).text;
}
