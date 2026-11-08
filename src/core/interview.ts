// 先生との面談を「会話の場面」として組み立てる。支援会話と同じ「話題×流れ×口調」の仕組み
import { FOLLOW_SAY, FOLLOW_TEACHER } from '../data/talks/follow';
import { B } from '../data/balance';
import { INTERVIEWS, IV_NARR, TEACHER_PHRASES, type InterviewDef, type InterviewTopic, type TeacherBg } from '../data/talks/interviews';
import type { TalkLine } from './types';
import type { GameState, Student, TalkLog, TalkLineLog } from './state';
import { Rng } from './rng';
import { condOk, fillText, phrase, withTalkFlags, archiveTalk, addTrust, bestFriend, loveOf } from './support';
import { tensionStage } from './world';
import { WHOLE_INTERVIEWS } from '../data/talks/whole_index';
import { TONE_OF, type WholeInterview } from '../data/talks/whole';
import { clamp } from './util';

function bgOf(s: GameState): TeacherBg {
  const b = s.instructor.background as TeacherBg;
  return b in TEACHER_PHRASES.t_r_open ? b : 'wanderer';
}

function renderIv(s: GameState, rng: Rng, lines: TalkLine[], st: Student): TalkLineLog[] {
  const bg = bgOf(s);
  const resolve = (say: TalkLine['say']): string => (typeof say === 'string' ? say : condOk(say.if, st, st, null, s) ? resolve(say.then) : resolve(say.else));
  const out: TalkLineLog[] = [];
  for (const l of lines) {
    const key = resolve(l.say);
    if (!key) continue;
    if (l.by === 'n') out.push({ by: 'narr', text: fillText(IV_NARR[key] ?? phrase(rng, key, 'default'), s, st, null, '') });
    else if (l.by === 't') out.push({ by: 'teacher', text: fillText(TEACHER_PHRASES[key]?.[bg] ?? `（${key}）`, s, null, st, '') });
    else out.push({ by: st.id, text: fillText(phrase(rng, key, st.personality), s, st, null, '') });
  }
  return out;
}

/** 面談で自動でつく目印（話題の出しわけと、先生のセリフの分岐に使う） */
export const IV_AUTO_FLAGS = ['alumni_teacher', 'gen2', 'has_love', 'has_alumni', 'unrest'] as const;
export function interviewFlags(s: GameState, st: Student): string[] {
  const out: string[] = [];
  // 教官がこの学校の卒業生（2代目以降で、生徒から教官になった）
  if (s.instructor.studentId) out.push('alumni_teacher');
  if (s.instructor.generation > 1) out.push('gen2');
  const love = s.students[loveOf(s, st.id) ?? ''];
  if (love && love.status !== 'dead') out.push('has_love');
  if (Object.values(s.students).some((x) => x.status === 'graduated' && x.career?.alive && !x.career.instructor && x.id !== s.instructor.studentId)) out.push('has_alumni');
  if (tensionStage(s.world.tension) !== 'peace') out.push('unrest');
  return out;
}

/** 決まった面談の流れを、この生徒で組み立てて記録に残す */
export function buildInterviewDef(s: GameState, rng: Rng, st: Student, def: InterviewDef, flags: string[] = []): TalkLog {
  const all = [...new Set([...flags, ...interviewFlags(s, st)])];
  return withTalkFlags(all, () => {
    const t: TalkLog = {
      a: st.id, b: 'teacher', rank: '', title: def.title, kind: def.topic.startsWith('x') ? 'special' : 'interview',
      lines: renderIv(s, rng, def.lines, st),
    };
    if (def.choice) {
      t.choice = {
        prompt: def.choice.prompt,
        options: def.choice.options.map((o) => ({ label: o.label, effect: { ...o.effect }, lines: renderIv(s, rng, o.lines, st) })),
      };
    }
    archiveTalk(s, t);
    return t;
  });
}

/** この生徒に今出せる面談の流れ（when の条件を満たすもの。なければ条件なしのもの） */
export function interviewCandidates(s: GameState, st: Student, topic: InterviewTopic, flags: string[] = []): InterviewDef[] {
  const defs = INTERVIEWS.filter((d) => d.topic === topic);
  const all = [...new Set([...flags, ...interviewFlags(s, st)])];
  const ok = withTalkFlags(all, () => defs.filter((d) => condOk(d.when, st, st, null, s)));
  return ok.length ? ok : defs.filter((d) => !d.when);
}

/** 面談の会話を組み立てて、記録に残す */
export function buildInterview(s: GameState, rng: Rng, st: Student, topic: InterviewTopic, flags: string[] = []): TalkLog | null {
  // 10夜目：同じ子に同じ面談は二度出さない（退学を引き止める面談は、状況が変わるたびに出てよい）
  const repeatOk = topic === 'retain';
  const seen = new Set(st.seenTalks ?? []);
  const isNew = (title: string) => repeatOk || !seen.has(title);
  // まるごと書いた面談（7夜目）：生徒の性格のまとまりに合うもの
  const all = [...new Set([...flags, ...interviewFlags(s, st)])];
  const whole = withTalkFlags(all, () => WHOLE_INTERVIEWS.filter((d) => d.topic === topic && d.g === TONE_OF[st.personality] && condOk(d.when, st, st, null, s)));
  const wholeFresh = whole.filter((d) => isNew(d.title));
  const cands = interviewCandidates(s, st, topic, flags);
  const fresh = cands.filter((d) => isNew(d.title));
  let t: TalkLog | null = null;
  if (wholeFresh.length && (rng.chance(B.talkWhole.interviewChance) || !fresh.length)) t = buildWholeInterview(s, st, rng.pick(wholeFresh), all);
  else if (fresh.length) t = buildInterviewDef(s, rng, st, rng.pick(fresh), flags);
  // 出せる新しい面談がない：前に話したことの続き（短い会話）。それも出し切ったら出さない
  else t = followUp(s, st, topic);
  if (t) { markTalk(s, st, t.title, repeatOk); t.def ??= t.title; if (repeatOk) t.again = true; }
  return t;
}

/** 見た会話を覚える（同じ子に同じ会話を二度出さないため。10夜目） */
function markTalk(s: GameState, st: Student, title: string, repeatOk: boolean): void {
  st.seenTalks ??= [];
  if (!repeatOk && st.seenTalks.includes(title)) talkCount.repeats += 1;
  talkCount.shown += 1;
  if (!st.seenTalks.includes(title)) st.seenTalks.push(title);
  void s;
}
/** シミュレーション用：会話を出した数と、同じ子に同じ会話が出た数 */
export const talkCount = { shown: 0, repeats: 0 };

/** 前に話したことの続き（10夜目）：「前に〇〇のことで話したよな。あれからどうだ？」 */
function followUp(s: GameState, st: Student, topic: InterviewTopic): TalkLog | null {
  const prev = (st.archive ?? []).map((id) => s.archive?.[id]).filter((x): x is TalkLog => !!x && x.b === 'teacher' && x.kind === 'interview' && !x.title.endsWith('（その後）'));
  const last = prev[prev.length - 1];
  if (!last || topic.startsWith('x')) return null;
  const n = (st.seenTalks ?? []).filter((x) => x.startsWith(`${last.title}（その後）`)).length;
  const sayList = FOLLOW_SAY[st.personality] ?? FOLLOW_SAY.serious;
  if (n >= sayList.length) return null;
  const title = `${last.title}（その後）${n ? n + 1 : ''}`;
  if ((st.seenTalks ?? []).includes(title)) return null;
  const t: TalkLog = { a: st.id, b: 'teacher', rank: '', title, kind: 'interview', lines: [
    { by: 'teacher', text: FOLLOW_TEACHER[(n + st.given.length) % FOLLOW_TEACHER.length].replace('{t}', last.title) },
    { by: st.id, text: sayList[n] },
  ] };
  archiveTalk(s, t);
  return t;
}

/** まるごと書いた面談を組み立てる */
export function buildWholeInterview(s: GameState, st: Student, def: WholeInterview, flags: string[] = []): TalkLog {
  const bg = bgOf(s);
  return withTalkFlags(flags, () => {
    const lines: TalkLineLog[] = def.lines.map((l) => {
      if (l.by === 'n') return { by: 'narr', text: fillText(typeof l.t === 'string' ? l.t : l.t.knight ?? '', s, st, null, '') };
      if (l.by === 't') { const t = typeof l.t === 'string' ? l.t : l.t[bg] ?? l.t.knight ?? Object.values(l.t)[0] ?? ''; return { by: 'teacher', text: fillText(t, s, null, st, '') }; }
      return { by: st.id, text: fillText(l.p?.[st.personality] ?? (typeof l.t === 'string' ? l.t : l.t.knight ?? ''), s, st, null, '') };
    });
    const t: TalkLog = { a: st.id, b: 'teacher', rank: '', title: def.title, kind: def.topic.startsWith('x') ? 'special' : 'interview', lines };
    archiveTalk(s, t);
    return t;
  });
}

/** 面談の返事を選んだ（効果は小さく、正解はない） */
export function chooseReply(s: GameState, t: TalkLog, k: number): void {
  const rec = t.id ? s.archive?.[t.id] : undefined;
  const target = rec ?? t;
  if (!target.choice || target.chosen !== undefined) { if (t.chosen === undefined) t.chosen = target.chosen; return; }
  const opt = target.choice.options[k];
  if (!opt) return;
  target.chosen = k; t.chosen = k;
  const st = s.students[target.a];
  if (!st) return;
  const e = opt.effect;
  if (e.trust) addTrust(st, e.trust);
  if (e.motivation) st.motivation = clamp(st.motivation + e.motivation, 0, 4);
}

/** 相談の中身（疲れ・勉強・仲間・故郷） */
export function consultFlag(rng: Rng, s: GameState, st: Student): string {
  const opts = ['s_study', 's_home', ...(bestFriend(s, st) ? ['s_friend'] : [])];
  return rng.pick(opts);
}

/** 信頼が40・70・90に届いた子の特別な面談（1週に1人まで） */
export function specialInterview(s: GameState, rng: Rng, list: Student[]): TalkLog | null {
  for (const th of B.trust.specialAt) {
    const st = list.find((x) => x.trust >= th && !(x.trustTalks ?? []).includes(th));
    if (!st) continue;
    st.trustTalks = [...(st.trustTalks ?? []), th];
    const t = buildInterview(s, rng, st, `x${th}` as InterviewTopic);
    if (t) {
      addTrust(st, 2);
      st.motivation = clamp(st.motivation + 1, 0, 4);
      st.history.push({ year: s.year, text: `先生と「${t.title}」について語り合った` });
    }
    return t;
  }
  return null;
}
