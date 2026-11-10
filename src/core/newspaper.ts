// 新聞（8夜目）：半年に一回の前期号（9月の終わり）・後期号（3月の年度末）と、大事件の月の号外。DOMに依存しない
import { COUNTRIES, COUNTRY_SHORT } from '../data/people';
import { POWER_UP, POWER_DOWN, REL_DOWN, REL_UP, TENSION_UP, TENSION_DOWN, QUIET, STANCE_NAMES, STANCE_TEXT, EVENT_TEXT, tensionLabel, peaceLabel, ORG_TAGS, NEXT_ISSUE, type Stance } from '../data/newspaper';
import type { CountryId } from './types';
import type { GameState, NewsPaper, ChronicleEntry } from './state';
import { Rng } from './rng';
import { clamp } from './util';
import { officerName, rankName, factionName } from './officers';
import { titleOf } from './alumni';

const PAIR_KEYS: { key: 'ke' | 'ea' | 'ak'; a: CountryId; b: CountryId }[] = [
  { key: 'ke', a: 'kingdom', b: 'empire' }, { key: 'ea', a: 'empire', b: 'alliance' }, { key: 'ak', a: 'alliance', b: 'kingdom' },
];
/** 地図の上の方角（王国は北、帝国は南西、同盟は南東） */
const DIR: Record<string, string> = { 'empire>kingdom': '北', 'empire>alliance': '東', 'kingdom>empire': '南', 'kingdom>alliance': '南東', 'alliance>empire': '西', 'alliance>kingdom': '北' };

/** 次の号のための控えを今の世の中で始める */
export function startNewsDesk(s: GameState): void {
  const w = s.world;
  const officers: Record<string, { st: string; rk: number; ep: string }> = {};
  for (const o of s.officers ?? []) officers[o.id] = { st: o.status, rk: o.rank, ep: o.epithet ?? '' };
  s.newsDesk = { year: s.year, month: s.month, power: { ...w.power }, relations: { ...w.relations }, tension: w.tension, reputation: s.reputation, officers, chron: s.chronicle.length };
}

function inPeriod(e: { year: number; month: number }, d: { year: number; month: number }): boolean {
  return e.year > d.year || (e.year === d.year && e.month >= d.month);
}

/** 和平への近さ（0〜100）：三国の関係が良いほど、緊張度が低いほど高い */
export function peaceMeter(s: GameState): number {
  const r = s.world.relations;
  const avg = (r.ke + r.ea + r.ak) / 3;
  return Math.round(clamp(50 + avg / 2 - (s.world.tension - 40) / 2, 0, 100));
}

/** 国の方針（国力・関係・戦況から） */
export function stanceOf(s: GameState, c: CountryId): Stance {
  const w = s.world;
  const rels = PAIR_KEYS.filter((p) => p.a === c || p.b === c).map((p) => w.relations[p.key]);
  const worst = Math.min(...rels);
  if (w.era === 'peace' || (worst > 10 && w.tension < 35)) return 'peace';
  if (w.power[c] >= 60 && worst < -30) return 'expand';
  if (worst < -40 || w.power[c] < 45) return 'defend';
  return 'watch';
}

interface Cand { w: number; head: string; text: string; cat?: string }

/** 24夜目⑤：年表の出来事を、新聞の話の種類と重みに。null は一面・二面に載せない（学校の話題などにだけ） */
export function classifyNews(e: Pick<ChronicleEntry, 'kind' | 'text'>, bondedNames: string[]): { cat: string; w: number } | null {
  const t = e.text;
  const bonded = bondedNames.some((n) => n && t.includes(n));
  if (/^エンディング/.test(t)) return { cat: 'ending', w: 20 };
  if (/平和な時代|停戦|和平が結ばれ|戦争が終わ|終戦/.test(t)) return { cat: 'war', w: 15 };
  if (/が始まった（火種|戦争が始まった|開戦/.test(t)) return { cat: 'war', w: 14 };
  if (/和平の席|仲立ち/.test(t)) return { cat: 'peace', w: 13 };
  if (/学校防衛戦/.test(t)) return { cat: 'defense', w: 13 };
  if (e.kind === 'school' && /を討ち取った$/.test(t)) return bonded ? { cat: 'nemesis', w: 12 } : null;
  if (/で戦死|が戦死/.test(t)) return { cat: 'death', w: 11 };
  if (/学校の前に立ちはだかる/.test(t)) return { cat: 'turned', w: 10 };
  if (/と呼ばれるようになった/.test(t)) return e.kind === 'world' && bonded ? { cat: 'nemOrg', w: 5 } : null;
  if (/死んだはずの|生きていた/.test(t)) return { cat: 'revive', w: bonded ? 11 : 9 };
  if (/領主になった/.test(t)) return { cat: 'ruler', w: 9 };
  if (/英雄/.test(t)) return { cat: 'feat', w: 9 };
  if (/最上級の/.test(t)) return { cat: 'feat', w: 8 };
  if (/偽の知らせ/.test(t)) return { cat: 'feat', w: 7 };
  if (/名高い勇士|の守りになった/.test(t)) return { cat: 'feat', w: 6 };
  if (/の手に（/.test(t)) return { cat: 'region', w: /教え子たち/.test(t) ? 8 : 6 };
  if (/大飢饉|疫病|国境紛争|戦火|銃の登場/.test(t)) return { cat: 'crisis', w: 8 };
  if (/^予兆/.test(t)) return { cat: 'crisis', w: 5 };
  // 敵将の二つ名・昇進・引退・跡目など：学校と因縁のある宿敵のときだけ二面に。ほかは「各国の動き」へ
  if (/と呼ばれるようになった|昇進|引退|将軍に就いた|頭目に|権力争い|名のりをあげた|を追われた|幹部に/.test(t)) return e.kind === 'world' && bonded ? { cat: 'nemOrg', w: 5 } : null;
  if (e.kind === 'world') return { cat: 'world', w: 6 };
  return null;
}
/** 学校と因縁のある宿敵（教え子と「因縁」より深い縁・仇討ちの誓い・好敵手・友情や恋。敵に回った教え子も） */
export function bondedIds(s: GameState): Set<string> {
  const ids = new Set<string>(Object.values(s.rivalries ?? {}).filter((rv) => rv.stage >= 2 || rv.vow || rv.oath || rv.heart).map((rv) => rv.oid));
  for (const o of s.officers ?? []) if (o.alumniId) ids.add(o.id);
  return ids;
}
/** 「各国の動き」の小さな欄：敵将の二つ名・昇進・抜擢・引退を、組織ごとに数えてまとめる */
export function summarizeMoves(list: { faction: string; tag: string; name: string }[]): string[] {
  const by = new Map<string, Map<string, string[]>>();
  for (const m of list) {
    const f = by.get(m.faction) ?? new Map<string, string[]>();
    f.set(m.tag, [...(f.get(m.tag) ?? []), m.name]);
    by.set(m.faction, f);
  }
  const word: Record<string, string> = { [ORG_TAGS.dead]: '討たれた将', [ORG_TAGS.promote]: '昇進', [ORG_TAGS.rise]: '新しく名を連ねた将', [ORG_TAGS.retire]: '引退', [ORG_TAGS.epithet]: '新しい二つ名' };
  return [...by.entries()].map(([f, tags]) => `${f}：${[...tags.entries()].map(([tag, names]) => `${word[tag] ?? tag}${names.length}人（${names.slice(0, 2).join('・')}${names.length > 2 ? 'ほか' : ''}）`).join('、')}`);
}
/** 敵将の二つ名・昇進・引退・跡目などの話 */
export const OFFICER_NEWS = /と呼ばれるようになった|昇進|引退|将軍に就いた|頭目に|権力争い|名のりをあげた|を追われた|幹部に/;
/** 1つの号に同じ種類の話は2つまで */
export const NEWS_SAME_MAX = 2;

/** 世の中の数字の動きを、見出しの言葉に */
function worldWords(s: GameState, r: Rng): Cand[] {
  const d = s.newsDesk!;
  const w = s.world;
  const out: Cand[] = [];
  const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  for (const c of COUNTRIES) {
    const dp = w.power[c] - (d.power[c] ?? w.power[c]);
    if (Math.abs(dp) < 3) continue;
    // 相手：関係がいちばん悪くなった国
    const pair = PAIR_KEYS.filter((p) => p.a === c || p.b === c).sort((x, y) => (w.relations[x.key] - d.relations[x.key]) - (w.relations[y.key] - d.relations[y.key]))[0];
    const other = pair.a === c ? pair.b : pair.a;
    const head = fill(r.pick(dp > 0 ? POWER_UP[c] : POWER_DOWN[c]), { dir: DIR[`${c}>${other}`] ?? '' });
    out.push({ cat: 'numbers', w: 4 + Math.abs(dp) / 2, head, text: `${COUNTRY_SHORT[c]}の国力は半年で${dp > 0 ? '大きく伸びた' : '目に見えて落ちた'}（${Math.round(d.power[c])}→${Math.round(w.power[c])}）。` });
  }
  for (const p of PAIR_KEYS) {
    const dr = w.relations[p.key] - d.relations[p.key];
    if (Math.abs(dr) < 8) continue;
    const head = fill(r.pick(dr < 0 ? REL_DOWN : REL_UP), { a: COUNTRY_SHORT[p.a], b: COUNTRY_SHORT[p.b] });
    out.push({ cat: 'numbers', w: 3 + Math.abs(dr) / 4, head, text: `${COUNTRY_SHORT[p.a]}と${COUNTRY_SHORT[p.b]}の関係は「${relWord(d.relations[p.key])}」から「${relWord(w.relations[p.key])}」へ。` });
  }
  const dt = w.tension - d.tension;
  if (Math.abs(dt) >= 6) out.push({ cat: 'numbers', w: 3 + Math.abs(dt) / 3, head: r.pick(dt > 0 ? TENSION_UP : TENSION_DOWN), text: `大陸の緊張は「${tensionLabel(d.tension)}」から「${tensionLabel(w.tension)}」へ。` });
  return out;
}
function relWord(v: number): string { return v <= -50 ? '戦争' : v < 0 ? '緊張' : v < 50 ? '友好' : '同盟'; }

/** 組織の移り変わり：前の号のときと比べた敵将の名簿の変化 */
function orgChanges(s: GameState, extraLines: string[], moves?: { faction: string; tag: string; name: string }[]): NonNullable<NewsPaper['orgs']> {
  const d = s.newsDesk!;
  const out: NonNullable<NewsPaper['orgs']> = [];
  const bonded = bondedIds(s);
  // 24夜目⑤：二つ名・昇進・抜擢・引退は、学校と因縁のある宿敵だけ。ほかの敵将は「各国の動き」の小さな欄にまとめる
  const push = (x: NonNullable<NewsPaper['orgs']>[number], o: { id: string; faction: string; given: string }) => {
    if (x.tag === ORG_TAGS.dead || x.tag === ORG_TAGS.strife || bonded.has(o.id)) out.push(x);
    else moves?.push({ faction: factionName(o.faction as never), tag: x.tag, name: o.given });
  };
  for (const o of s.officers ?? []) {
    if (o.kind === 'monster' || o.prospect) continue;
    const was = d.officers[o.id];
    const who = `${factionName(o.faction)}・${rankName(o)}`;
    const name = officerName(o);
    if (!was || (was.rk >= 3 && o.status === 'active' && o.rank <= 2)) { if (o.status === 'active' && o.rank <= 2) push({ tag: ORG_TAGS.rise, name, text: o.raisedYear ? `、一兵卒から${who}に抜擢される` : `、${who}に名を連ねる`, officerId: o.id }, o); continue; }
    if (was.st === 'active' && o.status === 'dead') { const v = o.meets[o.meets.length - 1]; push({ tag: ORG_TAGS.dead, name, text: `（${who}）、${v ? `${v.title}にて、リミナ分校の生徒に討たれる` : o.endNote ?? '戦場に散る'}`, officerId: o.id }, o); continue; }
    if (was.st === 'active' && (o.status === 'retired' || o.status === 'defeated')) { push({ tag: ORG_TAGS.retire, name, text: `（${who}）、${o.endNote ?? '戦場を去る'}`, officerId: o.id }, o); continue; }
    if (o.status !== 'active') continue;
    if (o.rank < was.rk) push({ tag: ORG_TAGS.promote, name, text: `${rankName({ ...o, rank: was.rk })}→${rankName(o)}。${factionName(o.faction)}の要に`, officerId: o.id }, o);
    // 23夜目⑤'：二つ名が変わった話は、1年に1人1回まで
    if (o.epithet && o.epithet !== was.ep && o.epithetNews !== s.year) { o.epithetNews = s.year; push({ tag: ORG_TAGS.epithet, name: `${o.given}`, text: `${factionName(o.faction)}の${o.given}、「${o.epithet}${o.given}」と呼ばれはじめる`, officerId: o.id }, o); }
  }
  for (const l of extraLines) {
    if (/権力争い|跡目|座を/.test(l) && out.length < 8) out.push({ tag: ORG_TAGS.strife, text: l });
  }
  const order = [ORG_TAGS.dead, ORG_TAGS.promote, ORG_TAGS.strife, ORG_TAGS.epithet, ORG_TAGS.rise, ORG_TAGS.retire, ORG_TAGS.move];
  out.sort((a, b) => order.indexOf(a.tag as typeof order[number]) - order.indexOf(b.tag as typeof order[number]));
  // 24夜目⑤：同じ種類（討死・二つ名など）は2つまで。あふれた分は「各国の動き」へ
  const n: Record<string, number> = {};
  const keep = out.filter((x) => {
    n[x.tag] = (n[x.tag] ?? 0) + 1;
    if (n[x.tag] <= NEWS_SAME_MAX) return true;
    const o = x.officerId ? (s.officers ?? []).find((y) => y.id === x.officerId) : null;
    if (o) moves?.push({ faction: factionName(o.faction), tag: x.tag, name: o.given });
    return false;
  });
  return keep.slice(0, 6);
}

/** 政治の動き：三国の方針と出来事 */
function politics(s: GameState, r: Rng, events: ChronicleEntry[]): NonNullable<NewsPaper['politics']> {
  const used = new Set<string>();
  return COUNTRIES.map((c) => {
    const st = stanceOf(s, c);
    const parts: string[] = [];
    // 24夜目⑤：敵将の二つ名・昇進・引退などは、政治の欄に入れない（各国の動きの欄へ）
    const ev = events.find((e) => e.text.includes(COUNTRY_SHORT[c]) && !OFFICER_NEWS.test(e.text));
    if (ev) parts.push(ev.text.replace(/^【[^】]*】/, ''));
    if (c === 'kingdom' && s.world.kingDied && events.some((e) => e.text.includes('王'))) parts.push(EVENT_TEXT.kingDied);
    if (s.world.famine) parts.push(EVENT_TEXT.famine);
    if (s.world.epidemic && !parts.length) parts.push(EVENT_TEXT.epidemic);
    const pool = STANCE_TEXT[st][c].filter((x) => !used.has(x));
    const t = r.pick(pool.length ? pool : STANCE_TEXT[st][c]);
    used.add(t);
    parts.push(t);
    return { country: c, stance: STANCE_NAMES[st], text: parts.slice(0, 2).join('。') };
  });
}

export interface IssueInput {
  /** 年度末の戦況の文（後期号） */
  world?: string[];
  /** 年度末の敵将の動き（後期号） */
  officers?: string[];
  /** 卒業生の大きな知らせ（後期号） */
  alumni?: { id: string; text: string }[];
  /** 学校の話題に足す文 */
  school?: string[];
}

/** 前期号・後期号を作って新聞に載せる（処理待ちにも出す） */
export function publishIssue(s: GameState, kind: 'first' | 'second', input: IssueInput = {}): NewsPaper {
  if (!s.newsDesk) startNewsDesk(s);
  const d = s.newsDesk!;
  const r = new Rng({ rng: (s.rng ^ (s.year * 977 + s.month * 31)) >>> 0 || 1 });
  // 24夜目⑤：前の号のあとに起きたことだけ（同じ月の、前の号に載った話をくり返さない）
  const period = d.chron !== undefined ? s.chronicle.slice(d.chron) : s.chronicle.filter((e) => inPeriod(e, d));
  const worldEv = period.filter((e) => e.kind === 'world');
  // 24夜目⑤：一面は大きな話から（宿敵戦の決着・教え子の活躍や戦死・戦争の始まりと終わり・和平の席・蘇り・敵に回った教え子・領主など）。
  // 敵将の二つ名・昇進・引退は、因縁のある宿敵だけ二面に。ほかは「各国の動き」へ
  const bonded = bondedIds(s);
  const bondedNames = (s.officers ?? []).filter((o) => bonded.has(o.id)).map((o) => o.given);
  const cands: Cand[] = [];
  const when = (e: ChronicleEntry) => `${e.year}年目${e.month < 9 ? e.month + 4 : e.month - 8}月、`;
  for (const e of period) {
    const c = classifyNews(e, bondedNames);
    if (!c) continue;
    let head = e.text.replace(/^【[^】]*】/, '');
    if (c.cat === 'nemesis') head = `リミナ分校、${head.replace(/を討ち取った$/, 'を討ち取る')}`;
    if (cands.some((x) => x.head === head)) continue;
    cands.push({ cat: c.cat, w: c.w + (e.kind === 'world' ? 0 : 0.5), head, text: `${when(e)}${head}。` });
  }
  cands.push(...worldWords(s, r));
  for (const l of input.world ?? []) if (!l.startsWith('大陸は') && !cands.some((c) => c.head === l)) cands.push({ cat: 'world', w: 5, head: l, text: `${l}。` });
  const moveList: { faction: string; tag: string; name: string }[] = [];
  const orgs = orgChanges(s, input.officers ?? [], moveList);
  cands.sort((a, b) => b.w - a.w);
  // 同じ種類の話は1つの号に2つまで（一面と二面を合わせて）
  const used: Record<string, number> = {};
  const take = (c: Cand) => { const k = c.cat ?? '?'; if ((used[k] ?? 0) >= NEWS_SAME_MAX) return false; used[k] = (used[k] ?? 0) + 1; return true; };
  const picked = cands.filter((c) => c.w >= 4 && take(c));
  const top = picked[0] ?? { w: 0, head: r.pick(QUIET), text: '三国はにらみ合いを続けているが、大きな戦は起きなかった。' };
  const subOk = (c: Cand) => c !== top && c.head !== top.head && c.w >= 6 && c.cat !== 'nemOrg';
  const sub = picked.find((c) => subOk(c) && c.cat !== top.cat) ?? picked.find(subOk);
  const body = [top.text];
  body.push(`大陸の緊張は「${tensionLabel(s.world.tension)}」。`);
  const second = picked.filter((c) => c !== top && c !== sub).slice(0, 4).map((c) => ({ head: c.head, text: c.text }));
  if (sub) body.push(sub.text);
  const moves = summarizeMoves(moveList).slice(0, 4);
  const pol = politics(s, r, worldEv);
  // 卒業生の消息
  let alumni = (input.alumni ?? []).slice(0, 6);
  // 学校の話題
  const school: string[] = [];
  if (!alumni.length) {
    const act = Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive && !x.career.retired);
    alumni = r.shuffle(act).slice(0, 3).map((x) => ({ id: x.id, text: `${x.given}（${x.cohort}期生）、${titleOf(x)}として務める` }));
    // 在校生の出来事（兵種の昇格・才能の判明など）は学校の話題へ
    for (const e of period.filter((x) => x.kind === 'student').slice(-3)) school.push(e.text);
  }
  const dr = Math.round(s.reputation - d.reputation);
  school.push(`評判 ${Math.round(d.reputation)} → ${Math.round(s.reputation)}${dr > 0 ? '（名が広まりつつある）' : dr < 0 ? '（少し陰りが見える）' : ''}`);
  for (const e of period.filter((x) => x.kind === 'school').slice(-4)) school.push(e.text);
  school.push(...(input.school ?? []));
  const label = kind === 'first' ? '前期号' : '後期号';
  const paper: NewsPaper = {
    id: `news${s.nextId++}`, year: s.year, month: s.month, kind,
    headline: `${s.year}年目 ${label}：${top.head}`,
    front: { head: top.head, sub: sub?.head, text: body.join(''), art: 'news_front' },
    orgs, politics: pol, second, moves,
    gauges: { tension: Math.round(s.world.tension), tensionLabel: tensionLabel(s.world.tension), peace: peaceMeter(s), peaceLabel: peaceLabel(peaceMeter(s)) },
    school: school.slice(0, 6),
    next: kind === 'first' ? NEXT_ISSUE.first : NEXT_ISSUE.second,
    body: [...body, ...pol.map((p) => `${COUNTRY_SHORT[p.country as CountryId]}：${p.stance}。${p.text}`), ...orgs.map((o) => `【${o.tag}】${o.name ?? ''}${o.text}`), ...school],
    alumni,
    tension: Math.round(s.world.tension),
  };
  s.news.unshift(paper);
  if (s.news.length > 60) s.news.length = 60;
  s.pending.push({ type: 'newspaper', id: paper.id });
  startNewsDesk(s);
  return paper;
}

/** 大事件の月の号外（1面だけ）。同じ月の2つ目の事件は、同じ号外の記事に足す */
export function extraEdition(s: GameState, title: string, lines: string[]): NewsPaper {
  const head = title.replace(/^【[^】]*】/, '');
  const same = s.news.find((n) => n.kind === 'extra' && n.year === s.year && n.month === s.month);
  if (same && same.front) {
    same.front.sub = same.front.sub ?? head;
    same.front.text += `　また、${lines.join('')}`;
    same.body.push(title, ...lines);
    return same;
  }
  const paper: NewsPaper = {
    id: `news${s.nextId++}`, year: s.year, month: s.month, kind: 'extra',
    headline: `号外：${head}`,
    front: { head, text: lines.join(''), art: 'news_extra' },
    gauges: { tension: Math.round(s.world.tension), tensionLabel: tensionLabel(s.world.tension), peace: peaceMeter(s), peaceLabel: peaceLabel(peaceMeter(s)) },
    body: [title, ...lines], alumni: [], tension: Math.round(s.world.tension),
  };
  s.news.unshift(paper);
  if (s.news.length > 60) s.news.length = 60;
  s.pending.push({ type: 'newspaper', id: paper.id });
  return paper;
}
