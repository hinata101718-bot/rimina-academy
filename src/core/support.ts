// 支援値（生徒どうし）・信頼（教官へ）・支援会話の組み立て
import { B } from '../data/balance';
import { TRAITS, PERSONALITIES, COUNTRY_NAMES, DREAMS } from '../data/people';
import { TALKS, PHRASES } from '../data/talks';
import type { TalkCond, TalkDef, TalkSay, TalkSideCond, PersonalityId } from './types';
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

function sideOk(st: Student, c: TalkSideCond | undefined): boolean {
  if (!c) return true;
  if (c.hasDream !== undefined && (st.dream !== 'none') !== c.hasDream) return false;
  if (c.house && st.house !== c.house) return false;
  if (c.personality && st.personality !== c.personality) return false;
  if (c.trait && !st.knownTraits.includes(c.trait)) return false;
  return true;
}
function condOk(c: TalkCond | undefined, a: Student, b: Student, sp: Support): boolean {
  if (!c) return true;
  if (!sideOk(a, c.a) || !sideOk(b, c.b)) return false;
  if (c.sameCountry !== undefined && (a.origin === b.origin) !== c.sameCountry) return false;
  if (c.kind && sp.kind !== c.kind) return false;
  return true;
}

function recentEvent(a: Student, b: Student, type: string, now: number) {
  // 出来事の当事者を a（話を切り出す側）とする
  return a.recent.find((e) => e.type === type && now - e.week <= 10 && (!e.with || e.with === b.id))
    ?? a.recent.find((e) => e.type === type && now - e.week <= 10 && !e.with);
}

export function phrase(rng: Rng, id: string, p: PersonalityId): string {
  const e = PHRASES[id];
  if (!e) return `（${id}）`;
  const v = e[p] ?? e.default ?? Object.values(e)[0];
  if (Array.isArray(v)) return rng.pick(v);
  return v ?? `（${id}）`;
}

export function fillText(text: string, s: GameState, me: Student, you: Student, detail: string): string {
  const dreamText = (st: Student) => DREAMS.find((d) => d.id === st.dream)?.text || '自分の道を見つけること';
  const traitName = (st: Student) => (st.knownTraits[0] ? TRAITS[st.knownTraits[0]].name : PERSONALITIES[st.personality].name);
  return text
    .replace(/\{me\}/g, me.given).replace(/\{you\}/g, you.given)
    .replace(/\{myDream\}/g, dreamText(me)).replace(/\{yourDream\}/g, dreamText(you))
    .replace(/\{myCountry\}/g, COUNTRY_NAMES[me.origin]).replace(/\{yourCountry\}/g, COUNTRY_NAMES[you.origin])
    .replace(/\{myTrait\}/g, traitName(me)).replace(/\{yourTrait\}/g, traitName(you))
    .replace(/\{event\}/g, detail || 'あのこと')
    .replace(/\{teacher\}/g, s.instructor.name).replace(/\{school\}/g, 'リミナ分校');
}

const TOPIC_TITLE: Record<string, string> = {
  dream: '夢の話', origin: '故郷の話', house: '生まれの話', trait: 'お互いの癖', ev_cover: 'かばってくれた日',
  ev_samekill: '息の合った一撃', ev_exam: '試験のあと', ev_loss: '去った仲間', ev_homewar: '故郷の知らせ',
  ev_festival: '収穫祭の夜', ev_spar: '手合わせのあと', ev_injury: 'けがのあと', rel_friend: '友として',
  rel_rival: '好敵手', rel_love: '打ち明け話', daily: 'なにげない話',
};

export function buildTalk(s: GameState, rng: Rng, sp: Support, rank: 'C' | 'B' | 'A'): TalkLog | null {
  let a = s.students[sp.a], b = s.students[sp.b];
  if (!a || !b) return null;
  const cands: { t: TalkDef; w: number; swap: boolean; detail: string }[] = [];
  for (const t of TALKS) {
    if (t.rank !== rank || sp.seen.includes(t.id)) continue;
    for (const swap of [false, true]) {
      const x = swap ? b : a, y = swap ? a : b;
      if (!condOk(t.when, x, y, sp)) continue;
      let w = 1; let detail = '';
      if (t.topic.startsWith('ev_')) {
        const ev = recentEvent(x, y, t.topic, s.absWeek);
        if (!ev) continue;
        w = 4; detail = ev.detail;
      } else if (t.topic.startsWith('rel_')) {
        const kind = t.topic.slice(4);
        if (sp.kind !== kind) continue;
        w = 3;
      } else if (t.topic === 'trait' && x.knownTraits.length === 0) continue;
      cands.push({ t, w, swap, detail });
    }
  }
  if (!cands.length) {
    // すべて見た場合は、見たものから選び直す
    if (sp.seen.length) { sp.seen = []; return buildTalk(s, rng, sp, rank); }
    return null;
  }
  const c = rng.weighted(cands, (x) => x.w);
  if (c.swap) [a, b] = [b, a];
  sp.seen.push(c.t.id);
  const resolve = (say: TalkSay): string => (typeof say === 'string' ? say : condOk(say.if, a, b, sp) ? say.then : say.else);
  const lines = c.t.lines.map((l) => {
    const me = l.by === 'a' ? a : b, you = l.by === 'a' ? b : a;
    return { by: me.id, text: fillText(phrase(rng, resolve(l.say), me.personality), s, me, you, c.detail) };
  });
  return { a: a.id, b: b.id, rank, title: TOPIC_TITLE[c.t.topic] ?? '会話', lines };
}

/** 信頼を増やす */
export function addTrust(st: Student, d: number): void {
  st.trust = clamp(st.trust + d, 0, B.trust.max);
}

export function addRecent(s: GameState, st: Student, type: string, detail: string, withId?: string): void {
  st.recent.push({ type, week: s.absWeek, detail, with: withId });
  if (st.recent.length > 8) st.recent.shift();
}
