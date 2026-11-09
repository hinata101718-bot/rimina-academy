// 日ごとの授業カード（7夜目）：全学年いっしょ・1日1回。毎日5種類＋休講から1つ選ぶ。DOMに依存しない
import { firstLessonDay } from './tutorial';
import { isGood, budKnown, checkBloom } from './aptitude';
import { B, SKILLS, STATS } from '../data/balance';
import { LESSONS, REST, LESSON_BY_ID, PRACTICE_EVENTS, type LessonDef } from '../data/lessons';
import { TALENTS, DREAMS, SKILL_NAMES, STAT_NAMES, PERSONALITIES } from '../data/people';
import type { SkillId, StatId } from './types';
import type { GameState, Student, LessonCard, LessonDay, LessonRow, LessonEvent, TalkLog, GrowthEntry, TalkLineLog } from './state';
import { Rng } from './rng';
import { clamp, rankOf, pairKey } from './util';
import { enrolled, available, notify } from './game';
import { addSupport, addTrust, getSupport, supportRank, supportValue, buildTalk, addRecent } from './support';
import { gainExp, startGrowthLog, stopGrowthLog, snapGrowth, diffGrowth, growthRates } from './growth';
import { learnTechs, learnedText } from './techs';
import { teacherMul, facilityMulOf, talentMulOf, traitLessonMulOf, addSkill, revealTalent, changeMotivation, skillUnlocked, interviewStudent, endOfWeek, expBonusOf, startWeekStudents } from './week';
import { growTeacherSkill } from './instructor';
import { viceOf } from './instructor';
import { fx, lessonXp, gainMentorXp } from './mentor';

export const DAY_NAMES = ['月', '火', '水', '木', '金'];

export function absDay(s: GameState): number { return s.absWeek * 5 + ((s.day ?? 1) - 1); }
/** 授業を受けられる子（けがの子は休み）。7夜目：生徒の体力・体調不良はなくした */
export function attends(st: Student): boolean { return available(st); }

// ---------- 先生の体力（7夜目：体力は先生だけ） ----------
/** 先生の最大体力（年をとると少し下がる。疫病の年は下がる） */
export function teacherMax(s: GameState): number {
  const T = B.teacher;
  const age = Math.max(0, s.instructor.age - T.ageFrom) * T.agePerYear * (1 - fx(s, 'ageSlow'));
  return Math.max(T.minMax, T.max + fx(s, 'maxStamina') - age - (s.world.epidemic ? T.epidemic : 0));
}
export function teacherStamina(s: GameState): number { s.instructor.stamina ??= teacherMax(s); return Math.min(teacherMax(s), s.instructor.stamina); }
/** 先生が寝込んでいる（その日は自動で休講） */
export function teacherSick(s: GameState): boolean { return (s.instructor.sickDays ?? 0) > 0; }
/** 体力が低いと授業の効果が少し落ちる */
export function teacherStaminaMul(s: GameState): number { return teacherStamina(s) < B.teacher.lowAt ? B.teacher.lowMul : 1; }
/** その授業で使う先生の体力（夏の合宿は多め） */
export function lessonCost(s: GameState, l: LessonDef): number {
  if (l.stamina < 0) return Math.round(l.stamina * (s.month === 3 ? B.fatigue.campMul : 1) * Math.max(0.2, 1 + fx(s, 'staminaCost')));
  return Math.round((l.stamina + (l.special === 'rest' ? B.teacher.chapelRest[s.facilities.chapel ?? 0] : 0)) * (l.special === 'rest' ? 1 + fx(s, 'restMul') : 1));
}

function lessonAvailable(s: GameState, l: LessonDef, list: Student[]): boolean {
  if (l.needGun && !s.world.gunUnlocked) return false;
  if (l.special === 'career' && !list.some((x) => x.grade === 3)) return false;
  return true;
}
/** 授業の重み（月・行事・古いセーブの持ち越しで変わる） */
function lessonWeight(s: GameState, l: LessonDef, list: Student[]): number {
  let w = l.weight;
  if (l.group === 'social' && s.month === 8) w *= B.day.festivalSocial;
  if (l.special === 'career' && s.month >= 6) w *= B.day.careerAutumn;
  // 生徒の目標技能が多い授業は出やすい（それでも毎日ばらつく）
  if (l.skills && list.length) {
    const n = list.filter((st) => Object.keys(l.skills!).some((k) => st.targets.includes(k as SkillId))).length;
    w *= 0.6 + (n / list.length) * 2.2;
  }
  return w;
}

/** その子がこのカードの顔に出やすいか */
function faceWeight(s: GameState, st: Student, l: LessonDef): number {
  let w = 1;
  const ks = Object.keys(l.skills ?? {}) as SkillId[];
  if (ks.some((k) => st.targets[0] === k)) w += 3;
  if (ks.some((k) => st.targets[1] === k)) w += 1.5;
  if (ks.some((k) => isGood(st, k))) w += 1.5; // 10夜目：得意な技能の授業は顔が出やすい
  if (budKnown(st) && st.bud?.skill && ks.includes(st.bud.skill)) w += 1;
  const d = DREAMS.find((x) => x.id === st.dream);
  if (d && ks.some((k) => d.skills.includes(k))) w += 1;
  if (l.likes?.includes(st.personality)) w += 1.5;
  if (l.stats) {
    const g = growthRates(st);
    const top = [...STATS].sort((a, b) => g[b] - g[a]).slice(0, 3);
    if (Object.keys(l.stats).some((k) => top.includes(k as StatId))) w += 1;
  }
  if (l.special === 'interview') w += (4 - st.motivation) * 1.5 + (st.dropoutSign ? 8 : 0) + Math.min(4, (s.absWeek - st.lastAttention) / 3);
  if (l.special === 'tea' && st.birthday && st.birthday.month === s.month && st.birthday.week === s.week) w += 6;
  if (l.special === 'rest') w = 0;
  return w;
}

/** 今日の授業カードを作る（同じ日には同じカード） */
export function rollDay(s: GameState, r: Rng): LessonDay {
  const key = absDay(s);
  const list = enrolled(s).filter(attends);
  const pool = LESSONS.filter((l) => lessonAvailable(s, l, list));
  const rain = r.chance(0.18);
  const picked: LessonDef[] = [];
  // 古いセーブの重点科目・週末の予定は、最初の日のカードに出す
  if (s.carry) {
    for (const k of s.carry.skills) { const l = pool.find((x) => x.skills && Object.keys(x.skills)[0] === k && !picked.includes(x)); if (l && picked.length < 2) picked.push(l); }
    for (const id of s.carry.social) { const l = pool.find((x) => x.special === id); if (l && !picked.includes(l) && picked.length < 4) picked.push(l); }
    s.carry = null;
  }
  // 相談・退学の予兆がある子がいれば、面談は必ず出る
  const needTalk = enrolled(s).filter((st) => attends(st) && (st.dropoutSign || s.consults.includes(st.id)));
  if (needTalk.length && !picked.some((l) => l.special === 'interview')) picked.push(LESSON_BY_ID.interview);
  if (rain && !picked.some((l) => l.special === 'field')) picked.push(LESSON_BY_ID.field);
  let guard = 0;
  // 14夜目：最初の1日目は、武器と体の授業の札3枚だけ（休講なし。どれを選んでも伸びる）
  const first = firstLessonDay(s);
  if (first) picked.length = 0;
  const nCards = first ? B.tutorial.firstCards : B.day.cards + fx(s, 'cards');
  while (picked.length < nCards && guard++ < 200) {
    const cand = pool.filter((l) => !picked.includes(l) && l.special !== 'field' && (!first || ((l.group === 'weapon' || l.group === 'body') && !l.special)));
    if (!cand.length) break;
    picked.push(r.weighted(cand, (l) => lessonWeight(s, l, list)));
  }
  // 顔：1人の子は1日に1枚のカードだけ
  const used = new Set<string>();
  const cards: LessonCard[] = picked.map((l) => {
    const n = (l.special === 'tea' || l.special === 'interview' ? r.int(2, 3) : 1 + pickIndex(r, B.day.faces)) + fx(s, 'faces');
    const faces: string[] = [];
    let pool2 = list.filter((st) => !used.has(st.id) && (l.special !== 'career' || st.grade === 3));
    if (l.special === 'interview') for (const st of needTalk) if (!used.has(st.id) && faces.length < 3) { faces.push(st.id); used.add(st.id); }
    while (faces.length < n) {
      pool2 = pool2.filter((st) => !used.has(st.id));
      if (!pool2.length) break;
      const st = r.weighted(pool2, (x) => faceWeight(s, x, l));
      faces.push(st.id); used.add(st.id);
    }
    const card: LessonCard = { id: l.id, faces, tags: tagsOf(s, faces) };
    if (l.special === 'interview') card.consult = faces.filter((id) => s.consults.includes(id) || s.students[id]?.dropoutSign);
    return card;
  });
  // 並び：武器・体・頭・交流・特別の順
  const order = ['weapon', 'body', 'mind', 'social', 'special'];
  cards.sort((a, b) => order.indexOf(LESSON_BY_ID[a.id].group) - order.indexOf(LESSON_BY_ID[b.id].group));
  if (!first) cards.push({ id: 'rest', faces: [], tags: [] });
  return { key, cards, rain: first ? false : rain };
}
function pickIndex(r: Rng, ws: number[]): number { let x = r.next() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x < 0) return i; } return ws.length - 1; }

/** 友情タッグ：支援C以上・恋人・ライバルの組 */
export function tagsOf(s: GameState, faces: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const sp = s.supports[pairKey(faces[i], faces[j])];
    if (sp && (sp.value >= B.support.C - fx(s, 'tagEase') || sp.kind === 'love' || sp.kind === 'rival')) out.push([faces[i], faces[j]]);
  }
  return out;
}

/** 今日のカード（なければ作る） */
export function todayCards(s: GameState): LessonDay {
  s.day ??= 1;
  if (!s.today || s.today.key !== absDay(s)) s.today = rollDay(s, new Rng(s));
  return s.today;
}


// ---------- 伸び ----------

function lessonMul(s: GameState, st: Student, k: SkillId): number {
  const camp = s.month === 3 ? B.lesson.campMul : 1;
  const vice = viceOf(s, st.grade) ? B.day.viceMul : 1;
  return teacherMul(s, k) * facilityMulOf(s, k) * B.motivationMul[st.motivation] * teacherStaminaMul(s) * talentMulOf(st, k) * traitLessonMulOf(st) * camp * vice * (s.settings.mods.skill ?? 1);
}
/** レベルが上がるほど、授業の経験値は少なくなる */
export function expDamp(level: number): number { const d = B.day.expDamp; return clamp(d.base - level * d.perLevel, d.min, d.max); }
export interface Boost { face: boolean; tag: boolean }
/** 先輩後輩のタッグで、この子が先輩か（11夜目） */
function seniorInTag(s: GameState, card: LessonCard, id: string): boolean {
  const st = s.students[id];
  return card.tags.some((t) => { if (!t.includes(id)) return false; const o = s.students[t[0] === id ? t[1] : t[0]]; return !!o && s.supports[pairKey(t[0], t[1])]?.kind === 'senpai' && st.grade > o.grade; });
}
function boostOf(card: LessonCard, id: string): Boost {
  return { face: card.faces.includes(id), tag: card.tags.some((t) => t.includes(id)) };
}
function pointsFor(s: GameState, st: Student, k: SkillId, w: number, b: Boost): number {
  const D = B.day;
  const target = st.targets[0] === k ? D.targetMul : st.targets[1] === k ? D.target2Mul : 1;
  // 7夜目：ランクが高いほど伸びにくい（学校が育った後半に、在学中にSまで届きすぎないように）
  const high = Math.max(D.highMin, 1 - st.skills[k] / D.highDiv);
  return D.skillPts * w * lessonMul(s, st, k) * faceMulOf(s, b) * target * tagMulOf(s, b) * high;
}

/** 顔の子の倍率（先生の「名講義」「熱血指導」で上がる。8夜目） */
export function faceMulOf(s: GameState, b: Boost): number { return (b.face ? B.day.faceMul * (1 + fx(s, 'faceMul')) : 1) * (1 + fx(s, 'allMul')); }
/** 友情タッグの倍率（先生の「仲人の勘」で上がる） */
export function tagMulOf(s: GameState, b: Boost): number { return b.tag ? B.day.tagMul * (1 + fx(s, 'tagMul')) : 1; }

/** 鍛錬ゲージ：たまって満タンで+1 */
function addTrain(s: GameState, st: Student, k: StatId, amount: number): { g0: number; g1: number; up: number } {
  st.train ??= {};
  const g0 = st.train[k] ?? 0;
  let g = g0 + amount;
  let up = 0;
  const school = st.status === 'enrolled';
  const cap = k === 'hp' ? (school ? B.student.hpCapSchool : B.student.hpCapGrad) : school ? B.student.statCapSchool : B.student.statCapGrad;
  while (g >= B.day.trainFull) {
    g -= B.day.trainFull;
    if (st.stats[k] < cap) { st.stats[k] += 1; up += 1; st.trainGain ??= {}; st.trainGain[k] = (st.trainGain[k] ?? 0) + 1; }
  }
  st.train[k] = Math.round(g * 10) / 10;
  void s;
  return { g0, g1: st.train[k]!, up };
}

export interface DayOutcome { lesson: string; faces: string[]; tags: [string, string][]; rows: LessonRow[]; events: LessonEvent[]; growth: GrowthEntry[]; lines: string[]; talks: TalkLog[]; others: number; xp: number }

/**
 * 今日の授業を受ける。idx＝今日のカードの番号、talkWith＝面談で話す子（顔の子から）
 * 結果は返すだけ（画面に出すのは呼び出し側）
 */
export function resolveLesson(s: GameState, r: Rng, idx: number, talkWith?: string): DayOutcome {
  const day = todayCards(s);
  // 先生が寝込んでいる日は、自動で休講
  const sickRest = teacherSick(s);
  const card = sickRest ? { id: 'rest', faces: [], tags: [] } : day.cards[Math.max(0, Math.min(day.cards.length - 1, idx))];
  const l = LESSON_BY_ID[card.id] ?? REST;
  const D = B.day;
  const lines: string[] = [];
  const talks: TalkLog[] = [];
  const events: LessonEvent[] = [];
  const list = enrolled(s).filter(attends);
  const snaps = new Map(list.map((st) => [st.id, snapGrowth(st)]));
  const rows = new Map<string, LessonRow>();
  const trainUps = new Map<string, StatId[]>();
  const camp = s.month === 3;
  const why = new Map<string, string>();
  startGrowthLog();
  // 月曜日：誕生日の週
  if ((s.day ?? 1) === 1) lines.push(...startWeekStudents(s));

  const row = (st: Student): LessonRow => { let x = rows.get(st.id); if (!x) { const b = boostOf(card, st.id); x = { id: st.id, face: b.face, tag: b.tag, target: false, skills: [], train: [] }; rows.set(st.id, x); } return x; };
  const skillUp = (st: Student, k: SkillId, pts: number) => {
    if (!skillUnlocked(s, k) || pts <= 0) return;
    const p0 = st.skills[k];
    addSkill(st, k, pts);
    const rw = row(st);
    const e = rw.skills.find((x) => x.k === k);
    if (e) e.p1 = st.skills[k]; else rw.skills.push({ k, p0, p1: st.skills[k] });
    if (st.targets[0] === k) rw.target = true;
  };
  const trainUp = (st: Student, k: StatId, amt: number) => {
    const t = addTrain(s, st, k, amt);
    const rw = row(st);
    rw.train.push({ k, ...t });
    if (t.up) trainUps.set(st.id, [...(trainUps.get(st.id) ?? []), k]);
  };

  for (const st of list) {
    const b = boostOf(card, st.id);
    // 11夜目：先輩後輩のタッグ：後輩はよく伸び、先輩は教えることで人を動かす力（魅力）が少し育つ
    if (b.tag && seniorInTag(s, card, st.id)) { b.tag = false; trainUp(st, 'skl', B.support.senpaiChaTrain); }
    const faceM = faceMulOf(s, b);
    const tagM = tagMulOf(s, b);
    // 技能
    for (const [k, w] of Object.entries(l.skills ?? {}) as [SkillId, number][]) skillUp(st, k, pointsFor(s, st, k, w, b));
    if (l.special === 'field') skillUp(st, st.targets[0], pointsFor(s, st, st.targets[0], D.field.skill, b));
    if (l.special === 'spar') for (const k of SKILLS) if (k !== 'gun' || s.world.gunUnlocked) skillUp(st, k, pointsFor(s, st, k, D.spar.skill, b));
    // 鍛錬ゲージ
    for (const [k, w] of Object.entries(l.stats ?? {}) as [StatId, number][]) trainUp(st, k, D.trainPts * w * faceM * tagM * (camp ? B.lesson.campMul : 1) * B.motivationMul[st.motivation]);
    // 経験値（授業の経験値。交流は紅白戦だけ）
    const expUnits = (l.exp ?? (l.skills ? 1 : 0)) * (l.special === 'spar' ? 1 + fx(s, 'sparExp') : 1);
    if (expUnits > 0) gainExp(s, r, st, D.exp * expUnits * faceM * tagM * (camp ? B.lesson.campMul : 1) * expDamp(st.level));
    // 才能の判明
    const rev = ((l.reveal ?? (l.group === 'social' || l.group === 'rest' ? 0.4 : 1)) * D.reveal * faceM + (B.talent.libraryReveal[s.facilities.library ?? 0] + expBonusOf(s)) / 5) * (1 + fx(s, 'reveal'));
    revealTalent(s, st, rev, lines);
    if (b.face) st.lastAttention = s.absWeek;
  }

  // 11夜目：同じ授業のカードに顔が並んだ、学年の違う子どうしは少し親しくなる（先輩と後輩のはじまり）
  {
    const fs = card.faces.map((id) => s.students[id]).filter((x): x is Student => !!x && x.status === 'enrolled');
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) if (fs[i].grade !== fs[j].grade) { const t = addSupport(s, r, fs[i].id, fs[j].id, B.support.crossFace); if (t) talks.push(t); }
  }
  // 交流・休講
  const faces = card.faces.map((id) => s.students[id]).filter((x): x is Student => !!x && attends(x));
  const push = (t: TalkLog | null) => { if (t) talks.push(t); };
  if (l.special === 'rest') {
    lines.push(sickRest ? `${s.instructor.name}先生が寝込んでしまい、今日は休講になった` : `今日は休講。先生もゆっくり休んだ（先生の体力+${lessonCost(s, l)}）`);
  } else if (l.special === 'tea') {
    const bd = faces.some((st) => st.birthday && st.birthday.month === s.month && st.birthday.week === s.week);
    const fest = s.month === 8 ? 1.5 : 1;
    const teaM = 1 + fx(s, 'teaSupport');
    for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) push(addSupport(s, r, faces[i].id, faces[j].id, D.tea.support, fest * teaM * (bd ? B.birthday.teaMul : 1)));
    for (const st of faces) { changeMotivation(st, D.tea.motivation); if (s.month === 8) addRecent(s, st, 'ev_festival', '収穫祭'); }
    if (bd) lines.push('お茶会は誕生日のお祝いも兼ねて、いつもよりにぎやかだった');
    lines.push(`お茶会（${faces.map((x) => x.given).join('・')}）。話がはずんだ`);
    if (!talks.length && faces.length >= 2 && (fx(s, 'teaTalk') > 0 || r.chance(D.tea.talkChance + B.diningEventUp[s.facilities.dining ?? 0]))) {
      const [a, c] = r.shuffle(faces.map((x) => x.id));
      const sp = getSupport(s, a, c);
      const rk = supportRank(sp.value);
      if (rk) push(buildTalk(s, r, sp, rk));
    }
  } else if (l.special === 'dinner') {
    for (const st of list) if (r.chance(D.dinner.motivationChance) || faces.includes(st)) changeMotivation(st, 1);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].grade === list[j].grade || faces.includes(list[i]) || faces.includes(list[j])) push(addSupport(s, r, list[i].id, list[j].id, D.dinner.support));
    lines.push('全学年の食事会。にぎやかな夜になった（やる気↑）');
  } else if (l.special === 'interview') {
    const st = (talkWith && faces.find((x) => x.id === talkWith)) || faces.find((x) => x.dropoutSign) || faces.find((x) => s.consults.includes(x.id)) || faces[0];
    if (st) {
      const res = interviewStudent(s, r, st, s.consults.includes(st.id));
      s.consults = s.consults.filter((x) => x !== st.id);
      lines.push(...res.lines);
      if (res.talk) talks.push(res.talk);
      why.set(st.id, '面談');
      for (const o of faces) if (o !== st) addTrust(o, D.interview.faceTrust);
    }
  } else if (l.special === 'career') {
    for (const st of list.filter((x) => x.grade === 3)) addTrust(st, D.career.trust);
    for (const st of faces) { addTrust(st, D.career.faceTrust); changeMotivation(st, 1); }
    const st = faces[0];
    if (st) {
      const d = DREAMS.find((x) => x.id === st.dream);
      lines.push(`進路指導：${faces.map((x) => x.given).join('・')}と進路の話をした${d?.text ? `（${st.given}の夢は${d.text}）` : ''}`);
      const res = interviewStudent(s, r, st, false, 'career');
      if (res.talk) talks.push(res.talk);
      why.set(st.id, '進路指導');
    }
  } else if (l.special === 'spar') {
    lines.push('全学年で紅白戦。本番さながらの打ち合いになった');
    // 顔の子どうしで手合わせ（支援会話「手合わせのあと」の種）
    if (faces.length >= 2) { const [x, y] = faces; addRecent(s, x, 'ev_spar', '紅白戦', y.id); addRecent(s, y, 'ev_spar', '紅白戦', x.id); push(addSupport(s, r, x.id, y.id, D.spar.support)); }
  } else if (l.special === 'field') {
    lines.push('雨の中の野外演習。泥だらけになりながら、実戦の勘を磨いた');
  }

  // 練習中の出来事
  if (faces.length && l.special !== 'rest' && l.special !== 'interview' && r.chance(D.eventChance)) {
    const ev = practiceEvent(s, r, card, l, faces);
    if (ev) events.push(ev);
  }

  // 雇った講師・卒業生講師は、自分の科目の授業の日に自動で少しずつ上がる（教官は8夜目から経験ポイントで上げる）
  for (const k of Object.keys(l.skills ?? {}) as SkillId[]) growTeacherSkill(s, k, D.teacherGrow, lines);
  // 14夜目：卒業生の講師が、自分の技を教える

  // 一日の終わり：先生の体力（授業で減り、休講で回復。0になると数日寝込む）
  const T = B.teacher;
  const ins = s.instructor;
  if (sickRest) {
    ins.sickDays = Math.max(0, (ins.sickDays ?? 0) - 1);
    ins.stamina = Math.min(teacherMax(s), teacherStamina(s) + T.sickRecover);
    if (!ins.sickDays) lines.push(`${ins.name}先生の体調が戻った`);
  } else {
    ins.stamina = clamp(teacherStamina(s) + lessonCost(s, l) + T.natural + T.chapel[s.facilities.chapel ?? 0], 0, teacherMax(s));
    if (ins.stamina <= 0) {
      ins.sickDays = T.sickDays; ins.stamina = 0;
      lines.push(`${ins.name}先生が無理をしすぎて寝込んでしまった（${T.sickDays}日休講）`);
      notify(s, `${ins.name}先生が寝込んでしまった。しばらく休講`);
    } else if (ins.stamina < T.lowAt) lines.push(`${ins.name}先生の体力が残り少ない（${Math.round(ins.stamina)}）。休講で休もう`);
  }

  // 成長の記録（顔の子・ランクアップ・レベルアップ・魔法・鍛錬ゲージの+1）
  const growth: GrowthEntry[] = [];
  for (const st of list) {
    const snap = snaps.get(st.id)!;
    const learned = learnTechs(s, st);
    for (const id of learned) lines.push(learnedText(st, id));
    checkBloom(s, st);
    const rankUp = SKILLS.some((k) => rankOf(snap.skills[k]) !== rankOf(st.skills[k]));
    for (const k of SKILLS) if (rankOf(snap.skills[k]) !== rankOf(st.skills[k])) lines.push(`${st.given}の${SKILL_NAMES[k]}が${rankOf(st.skills[k])}に上がった`);
    if (st.level > snap.level) lines.push(`${st.given}がLv${st.level}になった`);
    const tu = trainUps.get(st.id) ?? [];
    for (const k of tu) lines.push(`${st.given}の${STAT_NAMES[k]}が鍛錬で+1`);
    if (rankUp || st.level > snap.level || learned.length || tu.length || why.has(st.id)) {
      const g = diffGrowth(st, snap, learned, why.get(st.id) ?? (st.level > snap.level ? 'レベルアップ' : learned.length ? '魔法' : rankUp ? 'ランクアップ' : tu.length ? '鍛錬' : undefined));
      if (tu.length) g.train = tu;
      growth.push(g);
    }
  }
  stopGrowthLog();
  // 先生の経験ポイント（8夜目）：顔の子が多い・友情タッグ・ランクアップやレベルアップした子がいると多め
  const grew = growth.filter((g) => g.lv1 > g.lv0 || g.skills.some((k) => rankOf(k.p0) !== rankOf(k.p1))).length;
  const xp = sickRest ? 0 : lessonXp({ faces: faces.length, tags: card.tags.length, grew, social: l.group === 'social', rest: l.special === 'rest' });
  gainMentorXp(s, xp);
  const out = [...rows.values()];
  const shown = out.filter((x) => x.face || x.skills.some((k) => rankOf(k.p0) !== rankOf(k.p1)) || x.train.some((t) => t.up));
  return { lesson: l.id, faces: card.faces, tags: card.tags, rows: shown.length ? shown : out.slice(0, 3), events, growth, lines, talks, others: Math.max(0, list.length - shown.length), xp };
}

function practiceEvent(s: GameState, r: Rng, card: LessonCard, l: LessonDef, faces: Student[]): LessonEvent | null {
  const cands: { kind: string; w: number; ids: Student[] }[] = [];
  for (const [a, b] of card.tags) {
    const A = s.students[a], Bs = s.students[b];
    if (!A || !Bs) continue;
    const sp = s.supports[pairKey(a, b)];
    if (sp?.kind === 'senpai') { const [hi, lo] = A.grade > Bs.grade ? [A, Bs] : [Bs, A]; cands.push({ kind: 'senpai', w: 4, ids: [hi, lo] }); continue; }
    cands.push({ kind: sp?.kind === 'love' ? 'love' : sp?.kind === 'rival' ? 'rival' : 'tag', w: 4, ids: [A, Bs] });
  }
  const f = faces[0];
  // 11夜目：紅白戦で学年の違う顔がそろうと、学年対抗に
  if (l.special === 'spar') { const g2 = faces.find((x) => faces[0] && x.grade !== faces[0].grade); if (g2) cands.push({ kind: 'gradewar', w: 3, ids: [faces[0], g2] }); }
  if (l.skills || l.stats) cands.push({ kind: 'teacher', w: 2, ids: [r.pick(faces)] });
  if (l.skills) cands.push({ kind: 'extra', w: 1.5, ids: [r.pick(faces)] });
  const sp = faces.find((x) => x.bud && !x.bud.done && x.bud.skill && x.bud.reveal < B.apt.known && l.skills && Object.keys(l.skills).includes(x.bud.skill));
  if (sp) cands.push({ kind: 'spark', w: 3, ids: [sp] });
  if (!cands.length || !f) return null;
  const c = r.weighted(cands, (x) => x.w);
  const tpl = r.pick(PRACTICE_EVENTS[c.kind]);
  const [a, b] = c.ids;
  const teacherName = s.instructor.name;
  const fill = (x: string) => x.replace(/\{a\}/g, a.given).replace(/\{b\}/g, b?.given ?? '').replace(/\{t\}/g, `${teacherName}先生`).replace(/\{l\}/g, l.name);
  const lines: TalkLineLog[] = [{ by: 'narr', text: fill(tpl.narr) }];
  const speaker = c.kind === 'tag' || c.kind === 'rival' || c.kind === 'love' || c.kind === 'senpai' ? (b ?? a) : a;
  lines.push({ by: speaker.id, text: fill(tpl.say[speaker.personality] ?? tpl.say.default) });
  // 小さな効果
  if (c.kind === 'tag' || c.kind === 'love') addSupport(s, r, a.id, b.id, 3);
  if (c.kind === 'rival') { addSupport(s, r, a.id, b.id, 2); for (const x of c.ids) for (const k of Object.keys(l.skills ?? {}) as SkillId[]) addSkill(x, k, B.day.skillPts); }
  if (c.kind === 'teacher') addTrust(a, 1);
  if (c.kind === 'extra') for (const k of Object.keys(l.skills ?? {}) as SkillId[]) addSkill(a, k, B.day.skillPts * 1.5);
  if (c.kind === 'spark') revealTalent(s, a, 8);
  void PERSONALITIES; void supportValue;
  return { kind: c.kind, ids: c.ids.map((x) => x.id), lines };
}

/** 曜日を進める。金曜のあとは週の終わり、4週目の金曜のあとは月末の依頼 */
export function advanceDay(s: GameState, r: Rng, lines: string[]): { weekEnded: boolean; monthEnd: boolean } {
  s.day ??= 1;
  if (s.day < 5) { s.day += 1; return { weekEnded: false, monthEnd: false }; }
  lines.push(...endOfWeek(s, r));
  s.day = 1;
  s.absWeek += 1;
  if (s.week >= 4) return { weekEnded: true, monthEnd: true };
  s.week += 1;
  return { weekEnded: true, monthEnd: false };
}

// ---------- おすすめ（今週はおまかせ・オートプレイ） ----------

/** カードの点数：伸びる見込み（目標技能・顔・タッグ）と体力・やる気・面談の必要 */
export function cardScore(s: GameState, card: LessonCard, list: Student[] = enrolled(s).filter(attends)): number {
  const l = LESSON_BY_ID[card.id];
  if (!list.length) return 0;
  // 先生の体力：減ってきたら休講、底をつきそうな授業は避ける
  const st0 = teacherStamina(s);
  const tired = st0 < B.teacher.restAt;
  if (l.special === 'rest') return st0 < B.teacher.lowAt ? 99 : tired ? 12 : 0;
  if (st0 + lessonCost(s, l) <= 0) return -1;
  let v = 0;
  for (const st of list) {
    const face = card.faces.includes(st.id) ? B.day.faceMul : 1;
    for (const k of Object.keys(l.skills ?? {}) as SkillId[]) v += (st.targets[0] === k ? 3 : st.targets[1] === k ? 1.6 : 0.25) * face;
    if (l.special === 'field' || l.special === 'spar') v += 1.4 * face;
    if (l.stats) v += 0.25 * face * Object.keys(l.stats).length;
    if (l.exp) v += 0.25 * l.exp * face;
  }
  v /= Math.max(1, list.length) / 6;
  if (l.special === 'interview') v = 8 + card.faces.reduce((a, id) => { const st = s.students[id]; return a + (st?.dropoutSign ? 40 : 0) + (s.consults.includes(id) ? 12 : 0) + (st && st.motivation <= 1 ? 8 : 0); }, 0);
  if (l.special === 'tea') v = 6 + card.tags.length * 3 + card.faces.length * 2 + (tired ? 4 : 0);
  if (l.special === 'dinner') v = 4 + list.filter((x) => x.motivation <= 1).length * 4;
  if (l.special === 'career') v = 5 + (s.month >= 6 ? 6 : 0);
  // 先生が疲れているときは体力を使う授業を避ける
  if (l.stamina < -6 && tired) v *= 0.6;
  v += card.tags.length * 1.5;
  return v;
}
export function recommendCard(s: GameState): number {
  const day = todayCards(s);
  let best = 0, bv = -Infinity;
  const list = enrolled(s).filter(attends);
  day.cards.forEach((c, i) => { const v = cardScore(s, c, list); if (v > bv) { bv = v; best = i; } });
  return best;
}
