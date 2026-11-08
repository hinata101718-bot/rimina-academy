// 支援値（生徒どうし）・信頼（教官へ）・支援会話の組み立て
import { budHinted, goodOf } from './aptitude';
import { B } from '../data/balance';
import { TRAITS, PERSONALITIES, COUNTRY_NAMES, DREAMS, SKILL_NAMES, TALENTS } from '../data/people';
import { CLASSES } from '../data/classes';
import { ORIGIN_FLAVOR, HOUSE_FLAVOR, SEASON_WORDS, SEASON_SCENE } from '../data/talks/flavor';
import { tensionStage } from './world';
import { TALKS, PHRASES } from '../data/talks';
import { WHOLE_TALKS } from '../data/talks/whole_index';
import { TONE_OF, type WholeTalk, type WholeLine } from '../data/talks/whole';
import type { TalkCond, TalkDef, TalkSay, TalkSideCond, PersonalityId, SkillId } from './types';
import type { GameState, Student, Support, TalkLog } from './state';
import { Rng } from './rng';
import { pairKey, clamp } from './util';

export function getSupport(s: GameState, a: string, b: string): Support {
  const k = pairKey(a, b);
  let sp = s.supports[k];
  if (!sp) {
    const [x, y] = a < b ? [a, b] : [b, a];
    sp = s.supports[k] = { a: x, b: y, value: 0, kind: 'none', seen: [], lastRank: '' };
  }
  return sp;
}
export function supportValue(s: GameState, a: string, b: string): number {
  return s.supports[pairKey(a, b)]?.value ?? 0;
}
export function supportRank(v: number): '' | 'C' | 'B' | 'A' {
  if (v >= B.support.A) return 'A';
  if (v >= B.support.B) return 'B';
  if (v >= B.support.C) return 'C';
  return '';
}
function supportMul(st: Student): number {
  let m = 1;
  for (const t of st.traits) m *= TRAITS[t].supportMul ?? 1;
  return m;
}
export function loveOf(s: GameState, id: string): string | null {
  for (const sp of Object.values(s.supports)) if (sp.kind === 'love' && (sp.a === id || sp.b === id)) return sp.a === id ? sp.b : sp.a;
  return null;
}

/** 支援値を増やす。段階が上がったら会話を返す */
export function addSupport(s: GameState, rng: Rng, a: string, b: string, amount: number, mul = 1): TalkLog | null {
  if (a === b) return null;
  const A = s.students[a], Bs = s.students[b];
  if (!A || !Bs) return null;
  const sp = getSupport(s, a, b);
  const before = supportRank(sp.value);
  const amt = amount * mul * Math.sqrt(supportMul(A) * supportMul(Bs));
  sp.value = clamp(Math.round((sp.value + amt) * 10) / 10, 0, B.support.max);
  const after = supportRank(sp.value);
  if (after !== before && after !== '') {
    if (after === 'C' && sp.kind === 'none') sp.kind = decideKind(rng, A, Bs);
    if (after === 'B' && sp.kind !== 'love' && canLove(s, A, Bs) && rng.chance(B.support.loveChance * loveAffinity(A, Bs))) sp.kind = 'love';
    if (sp.lastRank !== after) {
      sp.lastRank = after;
      return buildTalk(s, rng, sp, after);
    }
  }
  return null;
}

function decideKind(rng: Rng, a: Student, b: Student): 'friend' | 'rival' {
  const pa = PERSONALITIES[a.personality], pb = PERSONALITIES[b.personality];
  let rival = 0.25;
  if (pa.rivals.includes(b.personality) || pb.rivals.includes(a.personality)) rival += 0.35;
  if (pa.likes.includes(b.personality) || pb.likes.includes(a.personality)) rival -= 0.15;
  if (a.recent.some((e) => e.type === 'ev_spar' && e.with === b.id)) rival += 0.1;
  return rng.chance(rival) ? 'rival' : 'friend';
}
function canLove(s: GameState, a: Student, b: Student): boolean {
  return a.age >= 18 && b.age >= 18 && !loveOf(s, a.id) && !loveOf(s, b.id);
}
function loveAffinity(a: Student, b: Student): number {
  let m = 1;
  if (PERSONALITIES[a.personality].likes.includes(b.personality)) m += 0.3;
  if (a.gender !== b.gender) m += 0.4; else m -= 0.3;
  return Math.max(0.2, m);
}

// ---------- 支援会話 ----------

function sideOk(s: GameState | null, st: Student, c: TalkSideCond | undefined, other: Student): boolean {
  if (!c) return true;
  if (c.hasDream !== undefined && (st.dream !== 'none') !== c.hasDream) return false;
  if (c.house && st.house !== c.house) return false;
  if (c.personality && st.personality !== c.personality) return false;
  if (c.personalities && !c.personalities.includes(st.personality)) return false;
  if (c.group && PERSONALITIES[st.personality].group !== c.group) return false;
  if (c.trait && !st.knownTraits.includes(c.trait)) return false;
  if (c.origin && st.origin !== c.origin) return false;
  if (c.dream && !c.dream.includes(st.dream)) return false;
  if (c.recent && !(s && st.recent.some((e) => e.type === c.recent && s.absWeek - e.week <= 12))) return false;
  if (c.talent !== undefined && budHinted(st) !== c.talent) return false; // 10夜目：才能のヒント→芽の兆し
  if (c.senior !== undefined && (st.grade > other.grade && other.grade > 0) !== c.senior) return false;
  if (c.tired !== undefined && (st.fatigue >= 50) !== c.tired) return false;
  if (c.lowMood !== undefined && (st.motivation <= 1) !== c.lowMood) return false;
  if (c.highMood !== undefined && (st.motivation >= 3) !== c.highMood) return false;
  if (c.hasFriend !== undefined && (!!(s && bestFriend(s, st))) !== c.hasFriend) return false;
  if (c.grade !== undefined && st.grade !== c.grade) return false;
  if (c.peaceBorn !== undefined && (!!s && peaceBorn(s, st)) !== c.peaceBorn) return false;
  return true;
}
/** 平和な時代に入学した子（戦争を知らない。7夜目）：いまが平和な時代で、最後のエンディングより後に入学した */
export function peaceBorn(s: GameState, st: Student): boolean {
  if (s.world.era !== 'peace') return false;
  const last = (s.endings ?? [])[(s.endings ?? []).length - 1];
  return !!last && st.enrollYear > last.year;
}
/** いちばん支援値の高い仲間（支援C以上・在校生） */
export function bestFriend(s: GameState, st: Student): Student | null {
  let best: Student | null = null, v = B.support.C - 0.01;
  for (const sp of Object.values(s.supports)) {
    if (sp.a !== st.id && sp.b !== st.id) continue;
    const o = s.students[sp.a === st.id ? sp.b : sp.a];
    if (o && o.status === 'enrolled' && sp.value > v) { v = sp.value; best = o; }
  }
  return best;
}
let talkFlags: Set<string> = new Set();
/** 会話を組み立てる間だけ使う目印 */
export function withTalkFlags<T>(flags: string[], fn: () => T): T {
  const keep = talkFlags; talkFlags = new Set(flags);
  try { return fn(); } finally { talkFlags = keep; }
}
export function condOk(c: TalkCond | undefined, a: Student, b: Student, sp: Support | null, s: GameState | null = null): boolean {
  if (!c) return true;
  if (!sideOk(s, a, c.a, b) || !sideOk(s, b, c.b, a)) return false;
  if (c.sameCountry !== undefined && (a.origin === b.origin) !== c.sameCountry) return false;
  if (c.sameHouse !== undefined && (a.house === b.house) !== c.sameHouse) return false;
  if (c.sameGrade !== undefined && (a.grade === b.grade) !== c.sameGrade) return false;
  if (c.kind && sp?.kind !== c.kind) return false;
  if (c.stage && (!s || tensionStage(s.world.tension) !== c.stage)) return false;
  if (c.flag && !talkFlags.has(c.flag)) return false;
  if (c.notFlag && talkFlags.has(c.notFlag)) return false;
  return true;
}

function recentEvent(a: Student, b: Student, type: string, now: number) {
  // 出来事の当事者を a（話を切り出す側）とする
  return a.recent.find((e) => e.type === type && now - e.week <= 10 && (!e.with || e.with === b.id))
    ?? a.recent.find((e) => e.type === type && now - e.week <= 10 && !e.with);
}

/** 性格に合う文面がなく、他の性格の文面を使った回数（テスト用） */
export const phraseFallbacks = { count: 0, keys: new Set<string>() };
export function phrase(rng: Rng, id: string, p: PersonalityId | 'default'): string {
  const e = PHRASES[id];
  if (!e) return `（${id}）`;
  let v = (p === 'default' ? undefined : e[p]) ?? e.default;
  // 分岐で使わない性格の文面は空にしてある。万一のときは他の性格の文面を使う
  if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) { phraseFallbacks.count++; phraseFallbacks.keys.add(`${id}.${p}`); v = Object.values(e).find((x) => x && (!Array.isArray(x) || x.length)); }
  if (Array.isArray(v)) return rng.pick(v);
  return v ?? `（${id}）`;
}

function hashId(t: string): number { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
export function flavorOf(st: Student) { const list = ORIGIN_FLAVOR[st.origin]; return list[hashId(st.id) % list.length]; }
function bestSkill(st: Student): SkillId {
  return (Object.keys(st.skills) as SkillId[]).filter((k) => k !== 'gun' || st.skills.gun > 0).sort((a, b) => st.skills[b] - st.skills[a])[0];
}

export function fillText(text: string, s: GameState, me: Student | null, you: Student | null, detail: string): string {
  const dreamText = (st: Student | null) => (st && DREAMS.find((d) => d.id === st.dream)?.text) || '自分の道を見つけること';
  const traitName = (st: Student | null) => (!st ? '' : st.knownTraits[0] ? TRAITS[st.knownTraits[0]].name : PERSONALITIES[st.personality].name);
  const f = (st: Student | null, k: keyof ReturnType<typeof flavorOf>) => (st ? flavorOf(st)[k] : '');
  // 面談用：恋人の名前・生きている卒業生（同じ出身を優先、新しい期から）・先代の先生
  const loveName = (st: Student | null) => { if (!st) return ''; const o = s.students[loveOf(s, st.id) ?? '']; return o && o.status !== 'dead' ? o.given : '大切な人'; };
  const seniorName = (st: Student | null) => {
    if (!st) return '';
    const g = Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive && !x.career.instructor && x.id !== s.instructor.studentId).sort((a, b) => b.cohort - a.cohort || (a.id < b.id ? -1 : 1));
    return (g.find((x) => x.origin === st.origin) ?? g[0])?.given ?? '先輩';
  };
  const rep = (st: Student | null, prefix: string, t: string) => t
    .replace(new RegExp(`\\{${prefix}Dream\\}`, 'g'), dreamText(st))
    .replace(new RegExp(`\\{${prefix}Country\\}`, 'g'), st ? COUNTRY_NAMES[st.origin] : '')
    .replace(new RegExp(`\\{${prefix}Trait\\}`, 'g'), traitName(st))
    .replace(new RegExp(`\\{${prefix}Home\\}`, 'g'), f(st, 'home'))
    .replace(new RegExp(`\\{${prefix}Food\\}`, 'g'), f(st, 'food'))
    .replace(new RegExp(`\\{${prefix}Sight\\}`, 'g'), f(st, 'sight'))
    .replace(new RegExp(`\\{${prefix}Fest\\}`, 'g'), f(st, 'fest'))
    .replace(new RegExp(`\\{${prefix}Cold\\}`, 'g'), f(st, 'cold'))
    .replace(new RegExp(`\\{${prefix}House\\}`, 'g'), st ? HOUSE_FLAVOR[st.house].home : '')
    .replace(new RegExp(`\\{${prefix}Duty\\}`, 'g'), st ? HOUSE_FLAVOR[st.house].duty : '')
    .replace(new RegExp(`\\{${prefix}Skill\\}`, 'g'), st ? SKILL_NAMES[bestSkill(st)] : '')
    .replace(new RegExp(`\\{${prefix}Class\\}`, 'g'), st ? CLASSES[st.classId]?.name ?? '' : '')
    .replace(new RegExp(`\\{${prefix}Friend\\}`, 'g'), () => (st ? bestFriend(s, st)?.given ?? '仲間' : ''))
    .replace(new RegExp(`\\{${prefix}TalentSkill\\}`, 'g'), st ? SKILL_NAMES[(budHinted(st) && st.bud?.skill) || goodOf(st)[0] || bestSkill(st)] : '')
    .replace(new RegExp(`\\{${prefix}Love\\}`, 'g'), () => loveName(st))
    .replace(new RegExp(`\\{${prefix}Senior\\}`, 'g'), () => seniorName(st))
    .replace(new RegExp(`\\{${prefix}Hint\\}`, 'g'), st && st.bud?.skill ? `${SKILL_NAMES[st.bud.skill]}が少しずつ分かってきた` : st && st.bud?.gold ? '何をやらせても伸びる' : '');
  let out = rep(me, 'my', rep(you, 'your', me ? adaptPronoun(text, me) : text));
  out = out
    .replace(/\{me\}/g, me?.given ?? '').replace(/\{you\}/g, you?.given ?? '')
    .replace(/\{event\}/g, detail || 'あのこと')
    .replace(/\{season\}/g, SEASON_WORDS[s.month] ?? '').replace(/\{scene\}/g, SEASON_SCENE[s.month] ?? '中庭')
    .replace(/\{teacher\}/g, s.instructor.name).replace(/\{prevTeacher\}/g, s.pastInstructors?.[s.pastInstructors.length - 1]?.name ?? '先代の').replace(/\{school\}/g, 'リミナ分校')
    .replace(/ことのため/g, 'ため'); // 「騎士になることのため」→「騎士になるため」
  return out;
}

/** 一人称を話す人の性別・性格に合わせる（文面は「俺」「僕」「わたし」で書いてある） */
const MALE_I: Partial<Record<PersonalityId, string>> = { hot: '俺', competitive: '俺', calm: '俺', cynic: '僕', whimsical: 'ぼく', timid: 'ぼく', shy: 'ぼく', gentle: 'ぼく', cheerful: 'ぼく' };
export function adaptPronoun(text: string, me: Student): string {
  if (me.gender === 'f') return text.replace(/俺/g, me.personality === 'hot' || me.personality === 'competitive' ? 'あたし' : 'わたし').replace(/僕/g, 'わたし');
  const i = MALE_I[me.personality];
  return i ? text.replace(/わたし/g, i) : text;
}

export const TOPIC_TITLE: Record<string, string> = {
  dream: '夢の話', origin: '故郷の話', house: '生まれの話', trait: 'お互いの癖', ev_cover: 'かばってくれた日',
  ev_samekill: '息の合った一撃', ev_exam: '試験のあと', ev_loss: '去った仲間', ev_homewar: '故郷の知らせ',
  ev_festival: '収穫祭の夜', ev_spar: '手合わせのあと', ev_injury: 'けがのあと', rel_friend: '友として',
  rel_rival: '好敵手', rel_love: '打ち明け話', daily: 'なにげない話',
  food: '好きな食べもの', study: '授業のこと', teacher: '先生のこと', family: '家族の話', hobby: '休みの日',
  war: '戦争のこと', future: '卒業したら', fear: '怖いもの',
};

/** TALKS の行を、話す人の性格の文面にして並べる */
export function renderLines(s: GameState, rng: Rng, lines: TalkDef['lines'], a: Student, b: Student, sp: Support | null, detail: string): TalkLog['lines'] {
  const resolve = (say: TalkSay): string => (typeof say === 'string' ? say : condOk(say.if, a, b, sp, s) ? resolve(say.then) : resolve(say.else));
  const out: TalkLog['lines'] = [];
  for (const l of lines) {
    const key = resolve(l.say);
    if (!key) continue; // 空の分岐は行ごと省く
    if (l.by === 'n') { out.push({ by: 'narr', text: fillText(phrase(rng, key, 'default'), s, a, b, detail) }); continue; }
    const me = l.by === 'a' ? a : b, you = l.by === 'a' ? b : a;
    out.push({ by: me.id, text: fillText(phrase(rng, key, me.personality), s, me, you, detail) });
  }
  return out;
}

export function buildTalk(s: GameState, rng: Rng, sp: Support, rank: 'C' | 'B' | 'A'): TalkLog | null {
  let a = s.students[sp.a], b = s.students[sp.b];
  if (!a || !b) return null;
  const cands: { t: TalkDef | WholeTalk; w: number; swap: boolean; detail: string; whole: boolean }[] = [];
  const consider = (t: TalkDef | WholeTalk, whole: boolean) => {
    if (t.rank !== rank || sp.seen.includes(t.id)) return;
    for (const swap of [false, true]) {
      const x = swap ? b : a, y = swap ? a : b;
      if (whole) { const wt = t as WholeTalk; if (TONE_OF[x.personality] !== wt.ga || TONE_OF[y.personality] !== wt.gb) continue; }
      if (!condOk(t.when, x, y, sp, s)) continue;
      let w = 1; let detail = '';
      if (t.topic.startsWith('ev_')) {
        const ev = recentEvent(x, y, t.topic, s.absWeek);
        if (!ev) continue;
        w = 4; detail = ev.detail;
      } else if (t.topic.startsWith('rel_')) {
        const kind = t.topic.slice(4);
        if (sp.kind !== kind) continue;
        w = rank === 'A' ? 5 : 3;
      } else if (t.topic === 'trait' && x.knownTraits.length === 0) continue;
      // まるごと書いた会話（7夜目）は出やすく
      cands.push({ t, w: w * (whole ? B.talkWhole.weight : 1), swap, detail, whole });
    }
  };
  for (const t of TALKS) consider(t, false);
  for (const t of WHOLE_TALKS) consider(t, true);
  if (!cands.length) {
    // すべて見た場合は、見たものから選び直す
    if (sp.seen.length) { sp.seen = []; return buildTalk(s, rng, sp, rank); }
    return null;
  }
  const c = rng.weighted(cands, (x) => x.w);
  if (c.swap) [a, b] = [b, a];
  sp.seen.push(c.t.id);
  const lines = c.whole ? renderWhole(s, (c.t as WholeTalk).lines, a, b, c.detail) : renderLines(s, rng, (c.t as TalkDef).lines, a, b, sp, c.detail);
  const t: TalkLog = { a: a.id, b: b.id, rank, title: TOPIC_TITLE[c.t.topic] ?? '会話', lines, kind: 'support' };
  archiveTalk(s, t);
  return t;
}

/** まるごと書いた会話の行を並べる（差し込みは固有の言葉だけ） */
export function renderWhole(s: GameState, lines: WholeLine[], a: Student, b: Student, detail: string): TalkLog['lines'] {
  return lines.map((l) => {
    if (l.by === 'n') return { by: 'narr', text: fillText(l.t, s, a, b, detail) };
    const me = l.by === 'a' ? a : b, you = l.by === 'a' ? b : a;
    return { by: me.id, text: fillText(l.p?.[me.personality] ?? l.t, s, me, you, detail) };
  });
}
// ---------- 会話の記録 ----------

/** 会話を記録に残す（生徒ごとに新しいもの30件まで） */
export function archiveTalk(s: GameState, t: TalkLog): TalkLog {
  s.archive ??= {};
  t.id ??= `k${s.nextId++}`;
  t.year = s.year; t.month = s.month;
  s.archive[t.id] = t;
  for (const id of [t.a, t.b]) {
    const st = s.students[id];
    if (!st) continue;
    st.archive ??= [];
    st.archive.push(t.id);
    while (st.archive.length > B.archive.perStudent) {
      const old = st.archive.shift()!;
      const o = s.archive[old];
      const still = o && [o.a, o.b].some((x) => x !== id && s.students[x]?.archive?.includes(old));
      if (!still) delete s.archive[old];
    }
  }
  return t;
}
/** 年度末：学校を離れた生徒の記録を減らす（セーブが重くなりすぎないように） */
export function pruneArchive(s: GameState): void {
  if (!s.archive) return;
  for (const st of Object.values(s.students)) {
    if (st.status === 'enrolled' || !st.archive?.length) continue;
    const left = st.diedYear ?? (st.enrollYear + 3);
    const keep = s.year - left >= B.archive.departedYears ? 0 : B.archive.departedKeep;
    // 面談より支援会話を残す
    const ids = st.archive.filter((id) => s.archive[id]);
    const support = ids.filter((id) => s.archive[id].kind === 'support' || !s.archive[id].kind);
    st.archive = support.slice(-keep);
    if (!keep) st.archive = [];
  }
  const used = new Set<string>();
  for (const st of Object.values(s.students)) for (const id of st.archive ?? []) used.add(id);
  for (const id of Object.keys(s.archive)) if (!used.has(id)) delete s.archive[id];
}
export function archiveOf(s: GameState, st: Student): TalkLog[] {
  return (st.archive ?? []).map((id) => s.archive?.[id]).filter((x): x is TalkLog => !!x);
}

/** 信頼を増やす */
export function addTrust(st: Student, d: number): void {
  st.trust = clamp(st.trust + d, 0, B.trust.max);
}

export function addRecent(s: GameState, st: Student, type: string, detail: string, withId?: string): void {
  st.recent.push({ type, week: s.absWeek, detail, with: withId });
  if (st.recent.length > 8) st.recent.shift();
}
