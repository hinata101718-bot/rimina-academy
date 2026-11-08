// 1年の振り返り（14夜目）。年度末（卒業式のあと）に、その年に見出しをつけて、タップで1枚ずつ見せる。DOM非依存
// 年鑑に「年ごとの振り返り」として残る。古いセーブは、年表と生徒の記録から、作れるところまで作る
import type { GameState, Student, YearReview, YearMark } from './state';
import { REGION_BY_ID, MAP_SIZE } from '../data/regions';
import { COUNTRY_SHORT } from '../data/people';
import { REVIEW_CLOSING, REVIEW_HEAD } from '../data/review';

const OWNER_SHORT: Record<string, string> = { ...COUNTRY_SHORT, school: '学校', wild: '無主地' };

/** 年のはじめの控え（数字の比べに使う） */
export function markYear(s: GameState): void {
  const levels: Record<string, number> = {};
  const honors: Record<string, number> = {};
  for (const st of Object.values(s.students)) if (st.status === 'enrolled') {
    levels[st.id] = st.level;
    honors[st.id] = Object.values(st.honors ?? {}).reduce((a, b) => a + b, 0);
  }
  s.yearMark = { year: s.year, won: s.stats.battlesWon, lost: s.stats.battlesLost, deaths: s.stats.deaths, levels, honors, classes: (s.classSeen ?? []).length };
}

function hash(t: string): number { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

/** その年の振り返りを作る（mark がなければ、年表と記録から作れるところまで） */
export function buildReview(s: GameState, year: number, mark: YearMark | null): YearReview {
  const ch = s.chronicle.filter((c) => c.year === year);
  const num = (re: RegExp) => ch.reduce((a, c) => { const m = c.text.match(re); return a + (m ? Number(m[1]) : 0); }, 0);
  const all = Object.values(s.students);
  const deadInSchool = all.filter((st) => st.status === 'dead' && st.diedYear === year && st.cohort > 0);
  const alumniDead = all.filter((st) => st.status === 'graduated' && st.diedYear === year);
  const photo = s.photos.find((p) => p.year === year);
  const grads = photo ? photo.ids : [];
  const blooms = all.filter((st) => (st.history ?? []).some((h) => h.year === year && (h.text.includes('才能が開花') || h.text.includes('金の芽が開き'))));
  const newClass = ch.filter((c) => c.kind === 'student' && /^[^\s]+が[^\s]+に$/.test(c.text) && !c.text.startsWith('卒業生の') && !c.text.includes('の') ).length;
  const nums: YearReview['nums'] = {
    enrolled: num(/期生 (\d+)人が入学/), graduated: num(/期生 (\d+)人が卒業/),
    blooms: blooms.length, deaths: deadInSchool.length, newClass,
  };
  if (mark) { nums.won = s.stats.battlesWon - mark.won; nums.lost = s.stats.battlesLost - mark.lost; nums.battles = nums.won + nums.lost; }
  // ---- 名場面（宿敵の決着・大事件・評価の名場面・敵将の討ち取り）
  const scenes: (YearReview['scenes'][number] & { w: number })[] = [];
  const add = (w: number, text: string, by?: string, kind = '') => { if (!scenes.some((x) => x.text === text)) scenes.push({ w, text, by, kind }); };
  for (const e of s.endings ?? []) if (e.year === year) add(100, `戦争が終わった。${ch.find((c) => c.text.startsWith('エンディング'))?.text.replace(/^エンディング「(.*)」$/, '「$1」') ?? ''}`, undefined, 'ending');
  const doneOfficers = new Set<string>();
  for (const rv of Object.values(s.rivalries ?? {}).sort((a, b) => b.stage - a.stage)) if (rv.settledYear === year && rv.settled) {
    const st = s.students[rv.sid]; const o = (s.officers ?? []).find((x) => x.id === rv.oid);
    if (!st || !o || doneOfficers.has(o.id)) continue;
    doneOfficers.add(o.id);
    const how = rv.settled === 'persuade' ? 'を説き伏せ、剣を置かせた' : rv.settled === 'spare' ? 'を見逃した' : rv.settled === 'duel' ? 'との一騎打ちに決着をつけた' : 'を討ち、因縁に決着をつけた';
    add(rv.stage >= 2 ? 60 + rv.stage * 5 : 22, `${st.given}が、${rv.stage >= 3 ? '生涯の宿敵' : rv.stage >= 2 ? '宿敵' : '因縁の敵将'}の${o.given}${how}`, st.id, rv.stage >= 2 ? 'rival' : 'bond');
  }
  for (const c of ch) {
    if (c.kind === 'world' && (c.text.startsWith('【大事件】') || c.text.includes('が始まった') || c.text.includes('統一'))) add(50, c.text.replace(/^【大事件】/, ''), undefined, 'event');
    if (c.text.includes('学校防衛戦に勝利')) add(55, '学校防衛戦に勝ち、学び舎を守り抜いた', undefined, 'defense');
    if (c.text.includes('隠された兵種')) add(45, c.text, undefined, 'class');
  }
  for (const st of all) for (const e of st.evalLog ?? []) if (e.year === year && e.scene && (e.grade === 'S' || (e.badges ?? []).length >= 2)) add(e.grade === 'S' ? 35 : 25, e.scene, st.id, 'eval');
  for (const c of ch) if (/(幹部|将軍|頭目)/.test(c.text) && c.text.includes('を討ち取った')) add(30, c.text, undefined, 'kill');
  for (const c of ch) if (c.text.includes('を討ち取った')) add(15, c.text, undefined, 'kill');
  scenes.sort((a, b) => b.w - a.w);
  // ---- いちばん伸びた子・MVP
  let grew: YearReview['grew'];
  let mvp: YearReview['mvp'];
  if (mark) {
    let best: { st: Student; d: number } | null = null;
    for (const [id, lv0] of Object.entries(mark.levels)) { const st = s.students[id]; if (!st || st.status === 'dropped') continue; const d = st.level - lv0; if (d > 0 && (!best || d > best.d)) best = { st, d }; }
    if (best) grew = { id: best.st.id, lv0: best.st.level - best.d, lv1: best.st.level };
    let top: { st: Student; d: number } | null = null;
    for (const [id, h0] of Object.entries(mark.honors)) { const st = s.students[id]; if (!st) continue; const d = Object.values(st.honors ?? {}).reduce((a, b) => a + b, 0) - h0; if (d > 0 && (!top || d > top.d)) top = { st, d }; }
    if (top) mvp = { id: top.st.id, honors: top.d };
  } else {
    // 古いセーブ：その年の評価の記録から
    const cnt: Record<string, number> = {};
    for (const st of all) for (const e of st.evalLog ?? []) if (e.year === year) cnt[st.id] = (cnt[st.id] ?? 0) + (e.badges ?? []).length;
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) mvp = { id: top[0], honors: top[1] };
  }
  // ---- 世界の動き
  const world: string[] = [];
  for (const l of s.world.regionLog ?? []) if (l.year === year) { const r = REGION_BY_ID[l.id]; if (r) world.push(`${r.name}が${OWNER_SHORT[l.to] ?? l.to}の手に（${OWNER_SHORT[l.from] ?? l.from}から）`); }
  for (const c of ch) if (c.kind === 'world' && (c.text.includes('将軍の座') || c.text.includes('の将軍に') || c.text.includes('予兆') || c.text.includes('紛争'))) world.push(c.text);
  // ---- 見出し
  const firstDeathEver = deadInSchool.length > 0 && !all.some((st) => st.status === 'dead' && st.cohort > 0 && (st.diedYear ?? 99999) < year);
  const firstGrad = nums.graduated > 0 && !s.photos.some((p) => p.year < year);
  const war = ch.find((c) => c.kind === 'world' && c.text.includes('が始まった'));
  const reg = (s.world.regionLog ?? []).filter((l) => l.year === year);
  const H = REVIEW_HEAD;
  let head: string;
  if ((s.endings ?? []).some((e) => e.year === year)) head = H.ending;
  else if (firstDeathEver) head = H.firstDeath;
  else if (war) head = H.war;
  else if (ch.some((c) => c.text.includes('学校防衛戦に勝利'))) head = H.defense;
  else if (reg.length >= 2) { const r = REGION_BY_ID[reg[0].id]; const d = r ? dirOf((r.y / MAP_SIZE.h) * 100, (r.x / MAP_SIZE.w) * 100) : ''; head = d ? H.border.replace('{dir}', d) : H.borderPlain; }
  else if (deadInSchool.length >= 2) head = H.loss;
  else if (firstGrad) head = H.firstGrad;
  else if (blooms.length >= 4) head = H.bloom;
  else if (scenes.some((x) => x.kind === 'rival')) head = H.rival;
  else if (nums.newClass >= 12) head = H.classes;
  else if (nums.enrolled >= 12) head = H.many;
  else if (year === 1) head = H.first;
  else if (mvp && s.students[mvp.id] && hash(`${year}`) % 2 === 0) head = H.name.replace('{a}', s.students[mvp.id].given);
  else head = H.quiet[hash(`${year}${s.createdAt}`) % H.quiet.length];
  const title = `第${year}年 ― ${head}`;
  const closing = REVIEW_CLOSING[deadInSchool.length ? 'loss' : (s.endings ?? []).some((e) => e.year === year) ? 'ending' : grads.length ? 'grad' : 'plain'];
  return {
    year, title, nums, scenes: scenes.slice(0, 3).map(({ text, by, kind }) => ({ text, by, kind })), grew, mvp,
    grads, dead: deadInSchool.map((st) => ({ id: st.id, note: st.deathNote ?? '' })), alumniDead: alumniDead.map((st) => st.id),
    world: world.slice(0, 4), closing: closing[hash(`${year}|${s.instructor.name}`) % closing.length],
    ...(mark ? {} : { rebuilt: true }),
  };
}
function dirOf(y: number, x: number): string { return y < 35 ? '北' : y > 65 ? '南' : x < 40 ? '西' : x > 60 ? '東' : ''; }

/** 年度末に振り返りを作って残す（同じ年は1つ） */
export function closeYear(s: GameState): YearReview {
  const mark = s.yearMark && s.yearMark.year === s.year ? s.yearMark : null;
  const rv = buildReview(s, s.year, mark);
  s.reviews = [...(s.reviews ?? []).filter((x) => x.year !== s.year), rv].sort((a, b) => a.year - b.year);
  return rv;
}

/** 古いセーブ：過去の年の振り返りを、年表から作れるところまで作る */
export function rebuildReviews(s: GameState): void {
  const have = new Set((s.reviews ?? []).map((x) => x.year));
  const out = [...(s.reviews ?? [])];
  for (let y = 1; y < s.year; y++) if (!have.has(y) && s.chronicle.some((c) => c.year === y)) out.push(buildReview(s, y, null));
  s.reviews = out.sort((a, b) => a.year - b.year);
}
