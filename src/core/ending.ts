// エンディング（設計書 §15）：判定・場面・エンディングのあと・殿堂。DOMに依存しない
import { B } from '../data/balance';
import { COUNTRIES, COUNTRY_NAMES, COUNTRY_SHORT, PATH_NAMES } from '../data/people';
import type { CountryId } from './types';
import type { GameState, Student, SceneLine, EndingKind, FaceParts } from './state';
import { Rng } from './rng';
import { chronicle, enrolled } from './game';
import { activeAlumni, diplomats, recalcTension, PAIRS } from './world';
import { titleOf } from './alumni';
import { clamp } from './util';

export const ENDING_NAMES: Record<EndingKind, string> = { peace: '和平の円卓', unify: '統一', ceasefire: '疲弊の停戦', neutral: '学校の中立宣言' };
export const ENDING_SUB: Record<EndingKind, string> = { peace: '真エンド', unify: '勢力エンド', ceasefire: 'ふつうのエンド', neutral: '隠しエンド' };
export function endingTitle(kind: EndingKind, country?: CountryId | null): string {
  return kind === 'unify' && country ? `${COUNTRY_SHORT[country]}による統一` : ENDING_NAMES[kind];
}

// ---------------------------------------------------------------
// 戦いの疲れ（年度末）：長く戦うほど三国とも国力が削れ、やがて疲弊の停戦へ
// ---------------------------------------------------------------
export function yearlyExhaustion(s: GameState, stage: 'peace' | 'tension' | 'war'): void {
  const E = B.ending;
  const w = s.world;
  const d = stage === 'war' ? E.exhaustWar : stage === 'tension' ? E.exhaustTension : E.exhaustPeace;
  w.exhaustion = Math.max(0, (w.exhaustion ?? 0) + d * s.settings.mods.war);
  const over = w.exhaustion - E.exhaustDrainFrom;
  if (over > 0 && stage !== 'peace') for (const c of COUNTRIES) w.power[c] = clamp(w.power[c] - w.power[c] * E.exhaustDrainPer * over, 0, 100);
}

/** 年度末：統一の年数を数える */
export function yearlyUnifyCount(s: GameState): void {
  const w = s.world;
  w.unifyYears ??= {};
  for (const c of COUNTRIES) {
    const others = COUNTRIES.filter((o) => o !== c).reduce((a, o) => a + w.power[o], 0);
    w.unifyYears[c] = w.power[c] > others ? (w.unifyYears[c] ?? 0) + 1 : 0;
  }
}

/** 条件を満たしているエンディング（優先：和平→中立宣言→統一→停戦） */
export function endingReady(s: GameState, when: 'year' | 'month'): { kind: EndingKind; country?: CountryId } | null {
  const w = s.world;
  if (w.era === 'peace') return null;
  const done = new Set((s.endings ?? []).filter((e) => e.year >= (lastRelapse(s) ?? 0)).map((e) => e.kind));
  const E = B.ending;
  // 和平の円卓（和平会議の月にも）
  if (w.peaceRoundYear && !done.has('peace') && !(s.endings ?? []).some((e) => e.kind === 'peace')) return { kind: 'peace' };
  // 学校の中立宣言（学校防衛戦に勝った月にも）
  const grads = Object.values(s.students).filter((x) => x.status === 'graduated').length;
  if (!done.has('neutral') && w.defenseWonYear === s.year && s.reputation >= E.neutralRep && grads >= E.neutralGrads && !w.vassal && COUNTRIES.every((c) => w.friendship[c] >= E.neutralFriendship)) return { kind: 'neutral' };
  if (when !== 'year') return null;
  for (const c of COUNTRIES) if ((w.unifyYears?.[c] ?? 0) >= E.unifyYears && !done.has('unify')) return { kind: 'unify', country: c };
  if (!done.has('ceasefire') && (w.exhaustion ?? 0) >= E.ceasefireWarYears && COUNTRIES.every((c) => w.power[c] <= E.ceasefirePower)) return { kind: 'ceasefire' };
  return null;
}
function lastRelapse(s: GameState): number | null {
  const r = [...s.chronicle].reverse().find((c) => c.text.startsWith('再び戦の気配'));
  return r ? r.year : null;
}

/** 判定して、エンディングの場面を処理待ちに積む */
export function checkEndings(s: GameState, rng: Rng, when: 'year' | 'month'): EndingKind | null {
  if (s.pending.some((p) => p.type === 'ending')) return null;
  const r = endingReady(s, when);
  if (!r) return null;
  const year = s.year;
  s.endings = [...(s.endings ?? []), { kind: r.kind, year, country: r.country }];
  chronicle(s, `エンディング「${endingTitle(r.kind, r.country)}」`, 'world');
  s.pending.push({ type: 'scene', title: endingTitle(r.kind, r.country), lines: endingScene(s, rng, r.kind, r.country), after: 'ending' });
  s.pending.push({ type: 'ending', kind: r.kind, country: r.country });
  return r.kind;
}

// ---------------------------------------------------------------
// 場面
// ---------------------------------------------------------------
function aliveAlumni(s: GameState): Student[] { return Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive); }
function byImportance(list: Student[]): Student[] {
  return [...list].sort((a, b) => (b.career?.rank ?? 0) - (a.career?.rank ?? 0) || b.level - a.level || b.trust - a.trust);
}

/** 終戦に関わった教え子（5〜8人） */
export function keyStudents(s: GameState, kind: EndingKind, country?: CountryId): Student[] {
  const alive = aliveAlumni(s);
  let list: Student[] = [];
  if (kind === 'peace') {
    for (const c of COUNTRIES) list.push(...byImportance(activeAlumni(s, c).filter((x) => x.career!.path === 'civil')).slice(0, 2));
    list.push(...byImportance(alive.filter((x) => x.career?.path === 'strategist')).slice(0, 2));
  } else if (kind === 'unify' && country) {
    list.push(...byImportance(activeAlumni(s, country)).slice(0, 6));
    for (const c of COUNTRIES) if (c !== country) list.push(...byImportance(activeAlumni(s, c)).slice(0, 1));
  } else if (kind === 'neutral') {
    list.push(...s.teachers.map((t) => t.alumniId ? s.students[t.alumniId] : null).filter((x): x is Student => !!x));
    list.push(...[...alive].sort((a, b) => b.trust - a.trust).slice(0, 6));
  } else {
    list.push(...byImportance(alive.filter((x) => x.career?.kind === 'army')).slice(0, 4));
    list.push(...[...alive].filter((x) => x.career?.kind !== 'army').sort((a, b) => b.trust - a.trust).slice(0, 3));
  }
  const seen = new Set<string>();
  list = list.filter((x) => x && !seen.has(x.id) && (seen.add(x.id), true));
  if (list.length < 5) for (const x of byImportance(alive)) { if (list.length >= 5) break; if (!seen.has(x.id)) { seen.add(x.id); list.push(x); } }
  return list.slice(0, 8);
}

function epilogue(s: GameState, rng: Rng, st: Student, kind: EndingKind, country?: CountryId): string {
  const c = st.career!;
  const where = c.country ? COUNTRY_SHORT[c.country] : '';
  const head = `${st.given}（${st.cohort}期生・${titleOf(st).replace(/（.*）$/, '')}）`;
  const path = c.kind === 'army' ? PATH_NAMES[c.path] : '';
  if (c.instructor) return `${head}は、教官として教壇に立ち続けている。授業の最後には必ず「生きて帰れ」と言うのが口ぐせだ。`;
  if (c.kind === 'stay') return `${head}は、学校に残って後輩たちを教えている。卒業生が訪ねてくると、真っ先に駆け寄るのはいつも${st.given}だ。`;
  if (c.kind === 'home') return `${head}は故郷に戻り、戦のあとの町の立て直しに力を尽くした。今では子どもたちに読み書きを教えているという。`;
  if (c.kind === 'merc') return `${head}は傭兵をやめ、旅の護衛として大陸を回っている。どの国の道も、今は安全になった。`;
  if (kind === 'peace') {
    if (c.path === 'civil') return rng.pick([`${head}は、円卓の席で${where}の代表として最後まで粘り強く話し合いを続けた。和平の約束の文書には、${st.given}の署名がある。`, `${head}は、和平のあと三国を結ぶ街道と市場の再開に奔走した。「戦より、市場のほうがずっとにぎやかでいい」と笑う。`]);
    return `${head}は、${where}の${path}として停戦を見届けた。今は国境の見回りをしながら、かつての敵国の兵と酒を酌み交わすこともあるという。`;
  }
  if (kind === 'unify') {
    if (c.country === country) return rng.pick([`${head}は、${COUNTRY_SHORT[country!]}の${path}として統一の戦いを最後まで戦い抜いた。戴冠式では、王のすぐそばに${st.given}の姿があった。`, `${head}は、統一のあと新しい領地の治安を守る役目についた。厳しくも公平な人柄で、敵国だった町の人々からも慕われている。`]);
    return `${head}は、${where}が${COUNTRY_SHORT[country!]}に下ったあとも、故郷の人々を守るために残った。苦しい日々だが、学校で教わったことが支えになっている。`;
  }
  if (kind === 'neutral') return `${head}は、学校の中立宣言を聞いて真っ先に祝いの手紙を送ってきた。「先生、あの学校は僕たちの帰る場所です」`.replace('僕', st.gender === 'm' ? '僕' : 'わたし');
  return rng.pick([`${head}は、長い戦いの果てに剣を置いた。疲れきった兵たちを故郷へ帰す役目を、最後まで果たしたという。`, `${head}は、停戦の日、静かな戦場でひとり空を見上げていた。「やっと終わった」とだけ、手紙に書いてきた。`]);
}

const OPENING: Record<EndingKind, (s: GameState, country?: CountryId) => SceneLine[]> = {
  peace: (s) => {
    const reps = COUNTRIES.map((c) => byImportance(activeAlumni(s, c).filter((x) => x.career!.path === 'civil' && x.career!.rank >= 2))[0]).filter(Boolean);
    return [
      { by: 'narr', art: 'ending_peace', title: '和平の円卓', text: '同盟の都の大広間に、大きな円い卓が置かれた。上座も下座もない卓を、三国の代表が囲む。' },
      { by: 'narr', faces: reps.map((x) => x.id), text: `その三つの席すべてに、リミナ分校の教え子が座っていた。${reps.map((x) => `${COUNTRY_SHORT[x.career!.country!]}の${x.given}`).join('、')}。` },
      { by: 'narr', text: '長い話し合いの末、三国は戦を終わらせる約束を交わした。「辺境の小さな学校が、大陸の戦争を終わらせた」――新聞はそう書いた。' },
    ];
  },
  unify: (s, c) => [
    { by: 'narr', art: 'ending_unify', title: '戴冠式', text: `${COUNTRY_NAMES[c!]}の旗が、大陸の三つの都に掲げられた。長い戦争は、一つの国による統一で終わった。` },
    { by: 'narr', faces: byImportance(activeAlumni(s, c!)).slice(0, 5).map((x) => x.id), text: `戴冠式の列には、${COUNTRY_SHORT[c!]}に仕えるリミナ分校の教え子たちの姿があった。` },
    { by: 'narr', text: '敗れた国の人々にとっては、苦い終わりかもしれない。それでも、もう戦場で若者が倒れることはない。' },
  ],
  ceasefire: () => [
    { by: 'narr', art: 'ending_ceasefire', title: '静かな戦場', text: '誰も勝たなかった。三国とも、もう戦い続ける力が残っていなかった。' },
    { by: 'narr', text: 'ある朝、国境の戦場から、角笛の音が消えた。兵たちは武器を置き、それぞれの故郷へ歩き出した。' },
    { by: 'narr', text: '疲れきった大陸に、ようやく静かな日々が戻ってきた。リミナ分校の鐘だけが、いつもどおりに鳴っている。' },
  ],
  neutral: (s) => [
    { by: 'narr', art: 'ending_neutral', title: '学校の旗', text: '学校防衛戦に勝った年の春、リミナ分校の塔に新しい旗が掲げられた。どの国の色でもない、学校だけの旗だ。' },
    { by: 'teacher', text: `この学校は、どの国のものでもない。ここで学んだ者は、どの国へ行っても、ここへ帰ってきていい。――リミナ分校は、ここに中立を宣言する。` },
    { by: 'narr', faces: enrolled(s).slice(0, 8).map((x) => x.id), text: '三国の使者は顔を見合わせ、やがて深く頭を下げた。卒業生の多くが、それぞれの国で要職についていたからだ。辺境の学校は、大陸の真ん中に立つ「誰のものでもない場所」になった。' },
  ],
};

export function endingScene(s: GameState, rng: Rng, kind: EndingKind, country?: CountryId): SceneLine[] {
  const lines: SceneLine[] = [...OPENING[kind](s, country)];
  // ② 後日談
  const keys = keyStudents(s, kind, country);
  if (keys.length) lines.push({ by: 'narr', title: 'それから', text: '終戦に関わった教え子たちの、その後。', faces: keys.map((x) => x.id) });
  for (const st of keys) lines.push({ by: 'narr', faces: [st.id], text: epilogue(s, rng, st, kind, country) });
  // ③ 学校の年表を駆け足で
  const chron = s.chronicle.filter((c) => c.kind !== 'student' || c.text.includes('教官') || c.text.includes('元帥') || c.text.includes('宰相'));
  const pick = chron.filter((c, i) => i === 0 || /教官|入学|銃|和平|統一|独立|傘下|防衛戦|崩御|侵攻|英雄|飢饉|内紛|元帥|宰相|講師/.test(c.text)).slice(-24);
  for (let i = 0; i < pick.length; i += 6) lines.push({ by: 'narr', title: i === 0 ? '学校の年表' : undefined, text: pick.slice(i, i + 6).map((c) => `${c.year}年目　${c.text}`).join('\n') });
  // ④ エンドロール：卒業写真を一期ずつ、全卒業生の名前
  for (const p of s.photos) lines.push({ by: 'narr', photo: p.cohort, text: `${p.cohort}期生　${p.ids.length}人が巣立った。` });
  const all = Object.values(s.students).filter((x) => x.status === 'graduated' || x.status === 'dead').sort((a, b) => a.cohort - b.cohort);
  for (let i = 0; i < all.length; i += 60) lines.push({ by: 'narr', title: i === 0 ? '卒業生' : undefined, roll: all.slice(i, i + 60).map((x) => ({ name: x.given, dead: x.status === 'dead' || !x.career?.alive })), text: i + 60 >= all.length ? `リミナ分校の教え子 ${all.length}人（✝は戦場で倒れた者）` : '……' });
  // ⑤ 最後の一枚
  if (kind === 'peace') {
    const reps = COUNTRIES.map((c) => byImportance(activeAlumni(s, c).filter((x) => x.career!.path === 'civil'))[0]).filter(Boolean);
    lines.push({ by: 'narr', title: '最後の一枚', faces: reps.map((x) => x.id), text: '和平の約束のあと、三国の代表として並んだ教え子たちの写真。三人とも、学校の制服を着ていた頃と同じ顔で笑っている。' });
  } else if (kind === 'unify') {
    lines.push({ by: 'narr', title: '最後の一枚', faces: byImportance(activeAlumni(s, country!)).slice(0, 3).map((x) => x.id), text: `${COUNTRY_SHORT[country!]}の新しい時代の始まりに、教え子たちが並んだ一枚。` });
  } else if (kind === 'neutral') {
    lines.push({ by: 'narr', title: '最後の一枚', faces: enrolled(s).map((x) => x.id).slice(0, 10), text: '学校の旗の下で撮った、全校生徒の写真。' });
  } else {
    lines.push({ by: 'narr', title: '最後の一枚', faces: keys.slice(0, 4).map((x) => x.id), text: '停戦の知らせを聞いて学校に集まった卒業生たち。誰もが少し疲れて、少しほっとした顔をしている。' });
  }
  lines.push({ by: 'teacher', text: '戦争が終わる日まで――その日は、来た。' });
  return lines;
}

// ---------------------------------------------------------------
// エンディングのあと
// ---------------------------------------------------------------

/** 「この学校を続ける」：平和な時代へ（戦争の大事件なし、依頼は魔物退治・治安維持、まれに再び戦争） */
export function continueSchool(s: GameState): void {
  const w = s.world;
  w.era = 'peace';
  for (const p of PAIRS) w.relations[p.key] = Math.max(w.relations[p.key], B.ending.peaceEraRel);
  w.warYears = 0; w.exhaustion = 0; w.schoolDefensePending = false;
  w.unifyYears = {};
  recalcTension(s, 1);
  chronicle(s, '平和な時代が始まった', 'world');
  s.pending = s.pending.filter((p) => p.type !== 'ending');
}

/** 平和な時代の年度末：まれに再び戦の気配 */
export function peaceEraYear(s: GameState, rng: Rng): string | null {
  if (s.world.era !== 'peace') return null;
  if (!rng.chance(B.ending.relapseChance)) return null;
  s.world.era = null;
  for (const p of PAIRS) s.world.relations[p.key] -= 25;
  s.world.peaceRoundYear = null;
  chronicle(s, '再び戦の気配が大陸に漂いはじめた', 'world');
  return '再び戦の気配';
}

// ---------------------------------------------------------------
// 殿堂（前の学校の年鑑）
// ---------------------------------------------------------------
export interface HallStudent { id: string; given: string; family: string; gender: 'm' | 'f'; origin: Student['origin']; face: FaceParts; faceImage: string | null; cohort: number; title: string; dead: boolean; level: number; classId: string }
export interface HallEntry {
  id: string; savedAt: number; instructor: string; years: number;
  endings: { kind: EndingKind; year: number; country?: CountryId }[];
  instructors: { name: string; generation: number; from: number; to: number }[];
  graduates: HallStudent[];
  photos: { cohort: number; year: number; ids: string[] }[];
  chronicle: { year: number; text: string }[];
  stats: GameState['stats'];
}

export function buildHallEntry(s: GameState): HallEntry {
  const grads = Object.values(s.students).filter((x) => x.status === 'graduated' || x.status === 'dead');
  return {
    id: `hall${Date.now()}`, savedAt: Date.now(), instructor: s.pastInstructors?.[0]?.name ?? s.instructor.name, years: s.year,
    endings: [...(s.endings ?? [])],
    instructors: [...(s.pastInstructors ?? []).map((p) => ({ name: p.name, generation: p.generation, from: p.from, to: p.to })), { name: s.instructor.name, generation: s.instructor.generation, from: s.instructor.since ?? 1, to: s.year }],
    graduates: grads.map((x) => ({ id: x.id, given: x.given, family: x.family, gender: x.gender, origin: x.origin, face: x.face, faceImage: x.faceImage, cohort: x.cohort, title: x.status === 'dead' ? '在学中に戦死' : titleOf(x), dead: x.status === 'dead' || !x.career?.alive, level: x.level, classId: x.classId })),
    photos: s.photos.map((p) => ({ cohort: p.cohort, year: p.year, ids: p.ids })),
    chronicle: s.chronicle.filter((c) => c.kind !== 'student').map((c) => ({ year: c.year, text: c.text })).slice(-300),
    stats: { ...s.stats },
  };
}

/** 到達したエンディングの記録（殿堂の全学校の合計） */
export function reachedEndings(hall: HallEntry[], s?: GameState | null): Set<string> {
  const out = new Set<string>();
  for (const h of hall) for (const e of h.endings) out.add(e.kind);
  for (const e of s?.endings ?? []) out.add(e.kind);
  return out;
}
void diplomats;
