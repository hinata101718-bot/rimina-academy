// 教官：教えるほど上がる技能（③）、加齢・引退・後継（④）、副教官（⑤）。DOMに依存しない
import { goodOf } from './aptitude';
import { RANK_TITLES } from '../data/people';
import { B, SKILLS, RANK_POINTS } from '../data/balance';
import { skillRankUp } from './discovery';
import { BACKGROUNDS, COUNTRY_SHORT, SKILL_NAMES, PERSONALITIES, TALENTS, DREAMS } from '../data/people';
import { NAMES } from '../data/names';
import type { SkillId, CountryId } from './types';
import type { GameState, Student, Teacher, SceneLine, VicePolicy, Instructor } from './state';
import { Rng } from './rng';
import { rankOf, emptySkills, clamp } from './util';
import { chronicle, notify, enrolled, available, effectiveStats, addFriendship } from './game';
import { rankPoints } from './world';
import { CLASSES } from '../data/classes';
import { inheritAbilities } from './mentor';
import { MENTOR_BY_ID } from '../data/mentor';

// ---------------------------------------------------------------
// ③ 教官の技能が教えるほど上がる
// ---------------------------------------------------------------

/** 技能の上限（得意科目はS、それ以外はB）。まだなければ作る */
export function instructorCaps(s: GameState): Record<SkillId, number> {
  const ins = s.instructor;
  if (ins.caps) return ins.caps;
  const caps = emptySkills(RANK_POINTS[B.instructor.capOther]);
  const bg = BACKGROUNDS.find((b) => b.id === ins.background);
  const good = goodSkillsOf(s);
  if (!ins.studentId && bg && !Object.keys(bg.skills).length) for (const k of SKILLS) caps[k] = RANK_POINTS[B.instructor.capWanderer];
  for (const k of good) caps[k] = RANK_POINTS[B.instructor.capGood];
  for (const k of SKILLS) caps[k] = Math.max(caps[k], ins.skills[k] ?? 0);
  ins.caps = caps;
  return caps;
}

/** 教官の得意科目 */
export function goodSkillsOf(s: GameState): SkillId[] {
  const ins = s.instructor;
  if (ins.studentId) {
    const st = s.students[ins.studentId];
    if (st) return [...SKILLS].filter((k) => k !== 'gun' || st.skills.gun > 0).sort((a, b) => st.skills[b] - st.skills[a]).slice(0, 3);
  }
  const bg = BACKGROUNDS.find((b) => b.id === ins.background);
  return Object.keys(bg?.skills ?? {}) as SkillId[];
}

function growSkill(rec: { skills?: Record<SkillId, number>; points?: number }, k: SkillId, amount: number, cap: number): [string, string] | null {
  if (rec.skills) {
    const before = rec.skills[k] ?? 0;
    if (before >= cap) return null;
    const after = Math.min(cap, Math.round((before + amount) * 100) / 100);
    rec.skills[k] = after;
    return rankOf(before) !== rankOf(after) ? [rankOf(before), rankOf(after)] : null;
  }
  return null;
}

/**
 * 授業の日に呼ぶ：雇った講師・卒業生講師が、自分の科目の授業の日に少しずつ上がる（上限A）。
 * 教官は8夜目から、授業でたまる経験ポイントで技能を上げる（core/mentor.ts）。
 */
export function growTeacherSkill(s: GameState, k: SkillId, amount: number, lines?: string[]): void {
  if (k === 'gun' && !s.world.gunUnlocked) return;
  const I = B.instructor;
  const tcap = RANK_POINTS[I.teacherCap];
  for (const t of s.teachers) {
    if (t.skill !== k || t.points >= tcap) continue;
    const before = t.points;
    t.points = Math.min(tcap, Math.round((t.points + amount * I.teacherDayMul) * 100) / 100);
    if (rankOf(before) !== rankOf(t.points)) { skillRankUp(s, `講師の${t.name}`, t.skill, before, t.points); const text = `講師の${t.name}の${SKILL_NAMES[t.skill]}が ${rankOf(t.points)} になった`; notify(s, text); lines?.push(text); }
  }
}

// ---------------------------------------------------------------
// ④ 加齢・引退・後継
// ---------------------------------------------------------------

/** 年度末：引退を選べるか（50歳以上）、必ず引退か（65歳） */
export function retireCheck(s: GameState): { can: boolean; forced: boolean } {
  const age = s.instructor.age;
  return { can: age >= B.instructor.retireMin, forced: age >= B.instructor.retireMax };
}

export interface SuccessorCand { st: Student; chance: number; kind: 'teacher' | 'vice' | 'alumni'; recall: string | null }

/** 後継の候補：卒業生なら誰でも */
export function successorCandidates(s: GameState): SuccessorCand[] {
  const out: SuccessorCand[] = [];
  const declined = new Set(s.declinedSuccessors ?? []);
  for (const st of Object.values(s.students)) {
    if (st.status !== 'graduated' || !st.career || !st.career.alive) continue;
    if (declined.has(st.id) || st.id === s.instructor.studentId) continue;
    if (st.age >= B.instructor.retireMax - 3) continue;
    const t = s.teachers.find((x) => x.alumniId === st.id);
    const vice = t && (s.vice ?? []).some((v) => v.teacherId === t.id);
    if (t) { out.push({ st, chance: 100, kind: vice ? 'vice' : 'teacher', recall: null }); continue; }
    const chance = Math.round(clamp(B.instructor.acceptBase + st.trust * B.instructor.acceptPerTrust - (st.career.retired ? 10 : 0), 5, B.instructor.acceptMax));
    const c = st.career;
    const recall = c.kind === 'army' && !c.retired && c.country && c.rank >= B.instructor.recallRank ? `${COUNTRY_SHORT[c.country]}の${titleShort(st)}を呼び戻すと、${COUNTRY_SHORT[c.country]}の国力が下がり、友好度も少し下がります` : null;
    out.push({ st, chance, kind: 'alumni', recall });
  }
  return out.sort((a, b) => b.chance - a.chance || b.st.trust - a.st.trust || b.st.level - a.st.level);
}
function titleShort(st: Student): string {
  const c = st.career!;
  const t = RANK_TITLES[c.path] ?? RANK_TITLES.warrior;
  return t[Math.min(c.rank, t.length - 1)];
}

/** 引退を決める：歴代の教官に記録し、別れの場面を作る。後継選びへ */
export function retireInstructor(s: GameState, rng: Rng): void {
  const ins = s.instructor;
  s.pastInstructors ??= [];
  s.pastInstructors.push({ name: ins.name, background: ins.background, generation: ins.generation, from: ins.since ?? 1, to: s.year, age: ins.age, studentId: ins.studentId, taught: ins.experience });
  chronicle(s, `${ins.generation}代目教官 ${ins.name}が引退（${ins.age}歳・教えた生徒 延べ${ins.experience}人）`, 'school');
  const prev = ins.studentId ? s.students[ins.studentId] : undefined;
  if (prev) { prev.history.push({ year: s.year, text: `教官を引退（${ins.age}歳）` }); if (prev.career) { prev.career.instructor = false; prev.career.retired = true; } }
  s.pending = s.pending.filter((p) => p.type !== 'retire');
  s.pending.unshift({ type: 'successor' });
  s.pending.unshift({ type: 'scene', title: `${ins.name}先生の引退`, lines: farewellScene(s, rng) });
}

/** 別れの場面：教え子からの言葉 */
export function farewellScene(s: GameState, rng: Rng): SceneLine[] {
  const ins = s.instructor;
  const years = s.year - (ins.since ?? 1);
  const lines: SceneLine[] = [];
  lines.push({ by: 'narr', title: '最後の授業', text: `${s.year}年目の春。${years}年のあいだリミナ分校で教えてきた${ins.name}先生が、教壇を降りる日が来た。` });
  const enrolledList = enrolled(s);
  const alumni = Object.values(s.students).filter((x) => x.status === 'graduated' && x.career?.alive);
  const pickBy = (list: Student[], n: number) => [...list].sort((a, b) => b.trust - a.trust).slice(0, n);
  const speakers = [...pickBy(alumni, 3), ...pickBy(enrolledList, 2)];
  lines.push({ by: 'narr', text: '講堂には、在校生だけでなく、各地から駆けつけた卒業生たちの姿もあった。', faces: speakers.map((x) => x.id) });
  for (const st of speakers) {
    const words = st.status === 'graduated'
      ? rng.pick([
        `先生に教わったことは、今でも毎日思い出します。${st.career?.country ? `${COUNTRY_SHORT[st.career.country]}でも、` : ''}先生の教え子だと胸を張っています。`,
        `${st.cohort}期生の${st.given}です。あの頃、先生がかけてくれた言葉がなければ、今のわたしはいません。`,
        '先生、本当にお疲れさまでした。今度は、わたしたちが先生の教えを伝えていきます。',
      ])
      : rng.pick(['先生の最後の生徒になれて、うれしいです。', 'まだまだ教わりたいことがあったのに……。でも、先生の言葉は忘れません。', '新しい先生のもとでも、ちゃんと頑張ります。見ていてください。']);
    lines.push({ by: st.id, text: words.replace(/わたし/g, st.gender === 'm' ? (['hot', 'competitive', 'cynic'].includes(st.personality) ? '俺' : '僕') : 'わたし') });
  }
  lines.push({ by: 'teacher', text: `……ありがとう。ここで君たちと過ごした${years}年は、私の誇りだ。戦争が終わる日まで、この学校を頼んだよ。` });
  lines.push({ by: 'narr', text: `こうして、${ins.generation}代目教官 ${ins.name}は学校を去った。その名は年鑑の「歴代の教官」に刻まれた。` });
  return lines;
}

/** 卒業生に後継を頼む。引き受けたら新しい教官になる */
export function askSuccessor(s: GameState, rng: Rng, id: string): { ok: boolean; text: string } {
  const cand = successorCandidates(s).find((c) => c.st.id === id);
  if (!cand) return { ok: false, text: '頼めません' };
  if (rng.next() * 100 >= cand.chance) {
    s.declinedSuccessors = [...(s.declinedSuccessors ?? []), id];
    const st = cand.st;
    return { ok: false, text: `${st.given}は「ありがたいお話ですが……今の務めを離れるわけにはいきません」と断った。` };
  }
  becomeInstructor(s, rng, cand.st);
  return { ok: true, text: `${cand.st.given}が引き受けてくれた！` };
}

/** 卒業生の教え子が教官になる */
export function becomeInstructor(s: GameState, rng: Rng, st: Student): void {
  const c = st.career!;
  // 呼び戻し：その国から重要人物が抜ける
  if (c.kind === 'army' && !c.retired && c.country && c.rank >= B.instructor.recallRank) {
    s.world.power[c.country] = clamp(s.world.power[c.country] - B.instructor.recallPower * Math.max(1, rankPoints(st) / 6), 0, 100);
    addFriendship(s, c.country, B.instructor.recallFriendship);
    chronicle(s, `${COUNTRY_SHORT[c.country]}の${titleShort(st)}だった${st.given}が、教官になるため学校へ戻った`, 'world');
  }
  const country: CountryId | null = c.country ?? (st.origin !== 'frontier' ? st.origin as CountryId : null);
  // 講師だったなら講師の席を空ける
  const t = s.teachers.find((x) => x.alumniId === st.id);
  if (t) { s.teachers = s.teachers.filter((x) => x !== t); s.vice = (s.vice ?? []).filter((v) => v.teacherId !== t.id); }
  c.kind = 'stay'; c.country = null; c.retired = false; c.front = false; c.instructor = true;
  const bg = backgroundFor(st, country);
  const skills = { ...st.skills };
  const prev = s.instructor;
  const ins: Instructor = {
    name: st.given, background: bg, age: st.age, experience: 0, skills,
    cha: effectiveStats(st).cha, generation: s.instructor.generation + 1, studentId: st.id, since: s.year,
  };
  s.instructor = ins;
  ins.caps = undefined; instructorCaps(s);
  inheritAbilities(prev, ins, rng, true);
  if (country) addFriendship(s, country, B.instructor.newFriendship);
  st.history.push({ year: s.year, text: `リミナ分校の${ins.generation}代目教官になった` });
  chronicle(s, `${st.cohort}期生の${st.given}が${ins.generation}代目教官に就任`, 'school');
  afterSuccession(s, rng);
  void rng;
}

/** 卒業生の兵種・道・所属国から、教官の経歴（得意授業・言い回し）を決める */
export function backgroundFor(st: Student, country: CountryId | null): string {
  const cls = CLASSES[st.classId];
  const w = cls?.weapons ?? [];
  if (w.includes('magic') || w.includes('holy') || st.career?.path === 'strategist' || st.career?.path === 'civil' && country === 'alliance') return 'mage';
  if (country === 'kingdom' || w.includes('lance') || cls?.moveType === 'cavalry') return 'knight';
  if (country === 'empire' || w.includes('axe') || w.includes('gun')) return 'merc';
  return 'wanderer';
}

/** 外部の教官を迎える（候補がいないとき・頼まなかったとき） */
export function externalSuccessor(s: GameState, rng: Rng): void {
  const bg = BACKGROUNDS[3];
  const origin = rng.pick(['kingdom', 'empire', 'alliance'] as const);
  const male = rng.chance(0.5);
  const name = rng.pick(male ? NAMES[origin].male : NAMES[origin].female);
  const skills = emptySkills(RANK_POINTS.C);
  skills.gun = s.world.gunUnlocked ? RANK_POINTS.D : 0;
  const prev = s.instructor;
  s.instructor = { name, background: bg.id, age: rng.int(...B.instructor.externalAge), experience: 0, skills, cha: bg.cha, generation: s.instructor.generation + 1, since: s.year };
  instructorCaps(s);
  inheritAbilities(prev, s.instructor, rng, false);
  chronicle(s, `流れの旅人 ${name}が${s.instructor.generation}代目教官に就任`, 'school');
  afterSuccession(s, rng);
}

function afterSuccession(s: GameState, rng: Rng): void {
  s.pending = s.pending.filter((p) => p.type !== 'successor');
  s.declinedSuccessors = [];
  // 在校生の信頼は少し下がる（新しい先生とはこれから）。教え子が先生になったなら下がりにくい
  const ins = s.instructor;
  for (const st of enrolled(s)) st.trust = Math.round(st.trust * (ins.studentId ? 0.7 : 0.5));
  const idx = s.pending.findIndex((p) => p.type === 'entrance');
  const scene = { type: 'scene' as const, title: `${ins.generation}代目教官の初授業`, lines: firstLessonScene(s, rng) };
  if (idx >= 0) s.pending.splice(idx + 1, 0, scene); else s.pending.unshift(scene);
}

/** 二代目以降の初授業の場面 */
export function firstLessonScene(s: GameState, rng: Rng): SceneLine[] {
  const ins = s.instructor;
  const st = ins.studentId ? s.students[ins.studentId] : null;
  const list = enrolled(s);
  const lines: SceneLine[] = [];
  lines.push({ by: 'narr', title: '初めての授業', text: `新しい年度が始まった。教壇に立つのは、${ins.generation}代目教官の${ins.name}だ。`, faces: list.slice(0, 6).map((x) => x.id) });
  if (st) {
    lines.push({ by: 'teacher', text: `${st.cohort}期生の${st.given}です。……自分がこの教壇に立つなんて、入学した日には思ってもみなかった。` });
    lines.push({ by: 'teacher', text: `私がここで教わったのは、${SKILL_NAMES[goodSkillsOf(s)[0] ?? 'sword']}の腕だけじゃない。生きて帰ること、仲間を信じること。それをみんなにも伝えたい。` });
  } else {
    lines.push({ by: 'teacher', text: `${ins.name}だ。旅の途中で、この学校の噂を聞いてね。前の先生から、みんなのことを頼まれた。` });
    lines.push({ by: 'teacher', text: 'まだ分からないことばかりだが、一緒に学んでいこう。' });
  }
  const sp = list.length ? rng.pick(list) : null;
  if (sp) lines.push({ by: sp.id, text: rng.pick(['よろしくお願いします、先生！', '……新しい先生、か。どんな授業なんだろう。', '前の先生にも負けないくらい、いい授業をお願いしますね。']) });
  const inh = (ins.inherited ?? []).map((id) => MENTOR_BY_ID[id]?.name).filter(Boolean);
  if (inh.length) lines.push({ by: 'narr', text: `先代から受け継いだ心得：${inh.map((x) => `「${x}」`).join('・')}。` });
  lines.push({ by: 'narr', text: '教官は授業のたびに経験を積み、自分の技能や特殊能力を磨いていく。学校の歴史に、新しい一ページが加わった。' });
  return lines;
}

// ---------------------------------------------------------------
// ⑤ 副教官（学年の担任）
// ---------------------------------------------------------------

export const VICE_POLICY_NAMES: Record<VicePolicy, string> = { balance: 'バランス', talent: '才能を伸ばす', dream: '夢を優先', combat: '戦闘向け' };

/** 副教官になれる講師（学校に残った卒業生で、講師になって1年以上） */
export function viceEligible(s: GameState): Teacher[] {
  return s.teachers.filter((t) => t.alumniId && s.students[t.alumniId] && s.year - (t.since ?? s.year - 1) >= B.vice.minYears);
}
export function viceOf(s: GameState, grade: number): { v: NonNullable<GameState['vice']>[number]; t: Teacher; st: Student } | null {
  const v = (s.vice ?? []).find((x) => x.grade === grade);
  if (!v) return null;
  const t = s.teachers.find((x) => x.id === v.teacherId);
  const st = t?.alumniId ? s.students[t.alumniId] : undefined;
  if (!t || !st) return null;
  return { v, t, st };
}
export function setVice(s: GameState, teacherId: string, grade: number, policy: VicePolicy): boolean {
  if (!viceEligible(s).some((t) => t.id === teacherId)) return false;
  s.vice = (s.vice ?? []).filter((v) => v.teacherId !== teacherId && v.grade !== grade);
  if (s.vice.length >= B.vice.max) return false;
  s.vice.push({ teacherId, grade, policy });
  const t = s.teachers.find((x) => x.id === teacherId)!;
  chronicle(s, `講師の${t.name}が${grade}年生の副教官（担任）になった`, 'school');
  return true;
}
export function removeVice(s: GameState, grade: number): void { s.vice = (s.vice ?? []).filter((v) => v.grade !== grade); }
/** 講師がいなくなったら副教官も外す */
export function cleanVice(s: GameState): void { s.vice = (s.vice ?? []).filter((v) => s.teachers.some((t) => t.id === v.teacherId)); }

/** 担任の性格のまとまり */
function viceGroup(st: Student): 'loud' | 'quiet' | 'steady' { return PERSONALITIES[st.personality].group; }

/**
 * 担任が担当学年の生徒の目標技能を決める（「自動で決める」の生徒だけ）。
 * 方針に従い、担任の得意技能と性格で解釈が少し変わる。
 */
export function viceTargets(s: GameState, st: Student, policy: VicePolicy, vice: Student, auto: (s: GameState, st: Student, p: VicePolicy) => [SkillId, SkillId]): [SkillId, SkillId] {
  const base = auto(s, st, policy);
  // 10夜目：芽が見えている子は、その技能を目標のまま（狙って育てる）
  if (st.bud && !st.bud.done && st.bud.skill && st.bud.reveal >= B.apt.known && base.includes(st.bud.skill)) return base;
  const viceSkill = [...SKILLS].filter((k) => k !== 'gun' || s.world.gunUnlocked).sort((a, b) => vice.skills[b] - vice.skills[a])[0];
  const g = viceGroup(vice);
  // しっかり者の担任は、自分の得意科目を2つ目にすすめることがある（その子にも少し素質があるとき）
  if (g === 'steady' && policy !== 'dream' && st.skills[viceSkill] >= RANK_POINTS['E+'] && base[0] !== viceSkill) return [base[0], viceSkill];
  // にぎやかな担任は「戦闘向け」をより思い切って：一番伸びている技能を2つとも重く
  if (g === 'loud' && policy === 'combat') {
    const by = [...SKILLS].filter((k) => k !== 'gun' || s.world.gunUnlocked).sort((a, b) => st.skills[b] - st.skills[a]);
    return [by[0], by[1]];
  }
  // 静かな担任は「才能」の方針でも、才能が分からない子には夢を優先する
  if (g === 'quiet' && policy === 'talent' && !goodOf(st).length) return auto(s, st, 'dream');
  return base;
}



/** 古いセーブ用：講師の「学校に来た年」を卒業の年から推定 */
export function ensureTeacherSince(s: GameState): void {
  for (const t of s.teachers) {
    if (t.since !== undefined) continue;
    const st = t.alumniId ? s.students[t.alumniId] : undefined;
    t.since = st ? st.enrollYear + 3 : s.year - 1;
  }
}
