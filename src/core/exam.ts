// 兵種試験
import { B, RANK_POINTS } from '../data/balance';
import { CLASSES, CLASS_LIST, type ClassDefX } from '../data/classes';
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
import { checkEquip } from './equip';

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

/** 22夜目：次の段階の兵種（枝分かれの先でなくてもよい）。風花雪月のように、技能の条件で開く。
 *  最上級は出来事の条件も要る（卒業後）。隠れた兵種は、今までどおり出来事で開く */
function nextTierPool(s: GameState, st: Student): ClassDefX[] {
  const cur = CLASSES[st.classId];
  const tier = cur?.tier ?? 0;
  const out = CLASS_LIST.filter((c) => {
    if (c.id === st.classId) return false;
    if (c.hidden) return hiddenOpen(s, st, c);
    if (c.tier !== tier + 1) return false;
    if (c.tier > SCHOOL_MAX_TIER && st.status !== 'graduated') return false;
    if (c.tier === 4) return !!c.deed && (st.deeds?.[c.deed] ?? 0) >= (c.need ?? 1);
    return true;
  });
  // 23夜目④：中級より上は、同じ段階の兵種へも試験で移れる（「同じ段階」として並ぶ）
  if (tier >= 2 && !cur?.hidden) for (const c of CLASS_LIST) if (c.tier === tier && c.id !== st.classId && !c.hidden) out.push(c);
  // 隠れた兵種の子が、同じ段階より下の兵種に戻ることはない
  return out.filter((c) => !(cur?.hidden && !c.hidden && c.tier <= (cur?.tier ?? 0)));
}
/** 23夜目④：同じ段階の兵種か */
export function sameTier(st: Student, c: ClassDef): boolean { return !c.hidden && c.tier === (CLASSES[st.classId]?.tier ?? 0); }
/** 枝分かれの先（おすすめの道） */
export function onPath(st: Student, c: ClassDef): boolean { return c.prereq.includes(st.classId); }

/** 受けられる兵種：技能の条件を満たすものだけ（レベル・学年・出撃の回数は、まだ足りなくてもよい） */
export function nextClasses(s: GameState, st: Student): ClassDef[] {
  return sortExamOptions(s, st, nextTierPool(s, st).filter((c) => c.hidden || meetsSkillReq(st, c)));
}
/** 技能の条件がまだ足りない、おすすめの道の兵種（「あと少し」の案内用） */
export function pathClassesMissing(s: GameState, st: Student): ClassDef[] {
  return nextTierPool(s, st).filter((c) => !c.hidden && onPath(st, c) && !meetsSkillReq(st, c));
}

/** 22夜目：先生の勧めの点数（枝分かれの先・夢・得意・宿敵の弱点・技能のゆとり） */
export function recommendScore(s: GameState, st: Student, c: ClassDef): number {
  const E = B.exam.rec;
  const req = Object.keys(c.req) as SkillId[];
  const dream = DREAMS.find((d) => d.id === st.dream);
  let v = 0;
  if (onPath(st, c)) v += E.path;
  for (const k of req) {
    if (dream?.skills.includes(k)) v += E.dream;
    if (st.apt?.good.includes(k)) v += E.good;
    if (st.apt?.bad.includes(k)) v -= E.bad;
    v += Math.min(E.spareMax, Math.max(0, (st.skills[k] ?? 0) - RANK_POINTS[c.req[k]!]) / E.spareDiv);
  }
  // 宿敵の弱点を突ける兵種
  const atk = (c as ClassDefX).atk ?? [];
  for (const rv of Object.values(s.rivalries ?? {})) {
    if (rv.sid !== st.id) continue;
    const o = (s.officers ?? []).find((x) => x.id === rv.oid && x.status === 'active');
    if (o && (o.knownWeak ?? []).some((t) => atk.includes(t as never))) { v += E.nemesis; break; }
  }
  if (c.hidden) v += E.hidden;
  return v;
}
/** 先生の勧め（受けられる兵種のうち、いちばん勧めたいもの） */
export function recommendClass(s: GameState, st: Student, opts?: ClassDef[]): ClassDef | null {
  const list = (opts ?? nextClasses(s, st)).filter((c) => !c.hidden && !sameTier(st, c));
  if (!list.length) return null;
  return [...list].sort((a, b) => recommendScore(s, st, b) - recommendScore(s, st, a))[0];
}
/** 並べる順：①先生の勧め ②枝分かれの先（おすすめの道）③そのほか */
function sortExamOptions(s: GameState, st: Student, list: ClassDef[]): ClassDef[] {
  const rec = recommendClass(s, st, list);
  const rank = (c: ClassDef) => (c === rec ? 0 : c.hidden ? 1 : onPath(st, c) ? 2 : sameTier(st, c) ? 4 : 3);
  return [...list].sort((a, b) => rank(a) - rank(b) || recommendScore(s, st, b) - recommendScore(s, st, a));
}

/** 22夜目：生徒が自分で選ぶ兵種（夢・得意・執念・性格から）。先生の勧めと同じなら null */
export function ownChoice(s: GameState, st: Student, picked: ClassDef, opts: ClassDef[]): ClassDef | null {
  const dream = DREAMS.find((d) => d.id === st.dream);
  const others = opts.filter((c) => c.id !== picked.id && !c.hidden && meetsReq(st, c) && sameTier(st, c) === sameTier(st, picked));
  if (!others.length) return null;
  const like = (c: ClassDef) => {
    const req = Object.keys(c.req) as SkillId[];
    let v = req.filter((k) => dream?.skills.includes(k)).length * 2 + req.filter((k) => st.apt?.good.includes(k)).length - req.filter((k) => st.apt?.bad.includes(k)).length * 2;
    if ((st.mind?.grudge ?? 0) >= 60) v += recommendScore(s, st, c) >= recommendScore(s, st, picked) ? 1 : 0;
    return v;
  };
  const best = [...others].sort((a, b) => like(b) - like(a))[0];
  return like(best) > like(picked) ? best : null;
}
/** 先生の勧めを聞く見込み（信頼が高いほど聞く。性格・夢・執念で違う道を選ぶ子も） */
export function followChance(st: Student, picked: ClassDef, own: ClassDef): number {
  const E = B.exam.follow;
  const dream = DREAMS.find((d) => d.id === st.dream);
  let p = E.base + (st.trust ?? 0) * E.perTrust;
  p += E.personality[st.personality] ?? 0;
  const dreamIn = (c: ClassDef) => (Object.keys(c.req) as SkillId[]).some((k) => dream?.skills.includes(k));
  if (dreamIn(own) && !dreamIn(picked)) p -= E.dream;
  if ((st.mind?.grudge ?? 0) >= 70) p -= E.grudge;
  return Math.max(E.min, Math.min(1, p));
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
  return Object.values(s.students).filter((st) => canTakeExam(s, st) && nextClasses(s, st).some((c) => !sameTier(st, c) && classUnlocked(s, c) && meetsReq(st, c)));
}

export function takeExam(s: GameState, rng: Rng, st: Student, classId: string, opt: { force?: boolean } = {}): { ok: boolean; rate: number; text: string; classId?: string; own?: boolean } {
  let c: ClassDef = CLASSES[classId];
  const opts = nextClasses(s, st);
  if (!c || !canTakeExam(s, st) || !classUnlocked(s, c) || !meetsReq(st, c) || !opts.some((x) => x.id === c.id)) return { ok: false, rate: 0, text: '受験できません' };
  // 22夜目：先生が勧め、生徒が決める（信頼が高いほど勧めを聞く）
  let own: ClassDef | null = null;
  if (!c.hidden && !opt.force) {
    const o2 = ownChoice(s, st, c, opts);
    if (o2 && !rng.chance(followChance(st, c, o2))) own = o2;
  }
  const picked = c;
  if (own) c = own;
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
    // 22夜目：兵種が変わって使えなくなった武器は外す（お知らせ）
    checkEquip(s, st);
    if (own) {
      st.history.push({ year: s.year, text: `先生の勧め（${picked.name}）ではなく、自分で選んだ${c.name}の道へ` });
      notify(s, `${st.given}は、先生の勧めた${picked.name}ではなく、自分で選んだ${c.name}になった`, st.id);
      return { ok, rate, text: `合格！ ${st.given}は少し考えてから、「先生、わたしは${c.name}の道を行きます」と言った。先生の勧めた${picked.name}ではなく、${c.name}になった`, classId: c.id, own: true };
    }
    notify(s, `${st.given}が兵種試験に合格し、${c.name}になった`, st.id);
    return { ok, rate, text: `合格！ ${st.given}は${c.name}になった`, classId: c.id };
  }
  st.motivation = Math.max(0, st.motivation - 1);
  return { ok, rate, text: `不合格……。${st.given}は来月また挑戦できる` };
}

/** オートプレイ・自動用：受けられる試験のうち一番良いものを受ける */
export function autoExam(s: GameState, rng: Rng, st: Student): string | null {
  const opts = nextClasses(s, st).filter((c) => classUnlocked(s, c) && meetsReq(st, c));
  if (!opts.length || !canTakeExam(s, st)) return null;
  // 22夜目：先生の勧め（条件を満たす兵種から）。隠れた兵種は選ばない（自分で選ぶ）
  const best = recommendClass(s, st, opts);
  if (!best || passRate(st, best) < 70) return null;
  return takeExam(s, rng, st, best.id).text;
}

// ---------------------------------------------------------------
// 23夜目④：初級どうしは試験なしで移れる（個人ページの兵種の欄から。月に1回まで）
// ---------------------------------------------------------------
/** 初級どうしで移れる兵種（技能の条件を満たすもの） */
export function sideClasses(st: Student): ClassDef[] {
  const cur = CLASSES[st.classId];
  if (!cur || cur.tier !== 1 || st.status !== 'enrolled') return [];
  return CLASS_LIST.filter((c) => c.tier === 1 && c.id !== cur.id && !c.hidden && meetsSkillReq(st, c));
}
/** 今月、初級どうしで移れるか */
export function canSideChange(s: GameState, st: Student): boolean { return sideClasses(st).length > 0 && st.sideMonth !== absMonth(s.year, s.month); }
/** 初級どうしで移る。前の兵種の特技は残らない（覚えた技は残る）。使えなくなった武器は外す */
export function sideChange(s: GameState, st: Student, classId: string): { ok: boolean; text: string } {
  const c = CLASSES[classId];
  if (!c || !canSideChange(s, st) || !sideClasses(st).some((x) => x.id === classId)) return { ok: false, text: '今は変えられません' };
  const from = CLASSES[st.classId]?.name ?? '';
  st.classId = c.id;
  st.sideMonth = absMonth(s.year, s.month);
  st.lastClassWeek = s.absWeek;
  markClassSeen(s, c.id);
  learnTechs(s, st);
  checkEquip(s, st);
  st.history.push({ year: s.year, text: `${from}から${c.name}に移った` });
  notify(s, `${st.given}が${from}から${c.name}に移った`, st.id);
  return { ok: true, text: `${st.given}は${c.name}になった（${from}の特技はなくなり、覚えた技は残る）` };
}
/** おまかせ：得意な技能と兵種が合っていない子だけ、初級のうちに移す */
export function autoSideChange(s: GameState, st: Student): string | null {
  const good = st.apt?.good ?? [];
  const cur = CLASSES[st.classId];
  if (!good.length || !cur || cur.tier !== 1 || !canSideChange(s, st)) return null;
  const fits = (c: ClassDef) => (Object.keys(c.req) as SkillId[]).some((k) => good.includes(k));
  if (fits(cur)) return null;
  const opts = sideClasses(st).filter(fits).sort((a, b) => recommendScore(s, st, b) - recommendScore(s, st, a));
  if (!opts.length) return null;
  return sideChange(s, st, opts[0].id).text;
}
