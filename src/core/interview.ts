// 先生との面談を「会話の場面」として組み立てる。支援会話と同じ「話題×流れ×口調」の仕組み
import { B } from '../data/balance';
import { INTERVIEWS, IV_NARR, TEACHER_PHRASES, type InterviewTopic, type TeacherBg } from '../data/talks/interviews';
import type { TalkLine } from './types';
import type { GameState, Student, TalkLog, TalkLineLog } from './state';
import { Rng } from './rng';
import { condOk, fillText, phrase, withTalkFlags, archiveTalk, addTrust, bestFriend } from './support';
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

/** 面談の会話を組み立てて、記録に残す */
export function buildInterview(s: GameState, rng: Rng, st: Student, topic: InterviewTopic, flags: string[] = []): TalkLog | null {
  const defs = INTERVIEWS.filter((d) => d.topic === topic);
  if (!defs.length) return null;
  const def = rng.pick(defs);
  return withTalkFlags(flags, () => {
    const t: TalkLog = {
      a: st.id, b: 'teacher', rank: '', title: def.title, kind: topic.startsWith('x') ? 'special' : 'interview',
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
  if (e.fatigue) st.fatigue = clamp(st.fatigue + e.fatigue, 0, 100);
}

/** 相談の中身（疲れ・勉強・仲間・故郷） */
export function consultFlag(rng: Rng, s: GameState, st: Student): string {
  if (st.fatigue >= 50) return 's_tired';
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
