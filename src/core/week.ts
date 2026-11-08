// 1週間の処理：授業・個人指導・週末の交流・疲労・やる気・才能の判明・退学の予兆
import { B, SKILLS } from '../data/balance';
import { talentDiscovery, rollSides } from './discovery';
import { TRAITS, TALENTS, DREAMS, SKILL_NAMES, PERSONALITIES, COUNTRY_NAMES } from '../data/people';
import { CLASSES } from '../data/classes';
import type { SkillId, CountryId } from './types';
import type { GameState, Student, TalkLog, WeekendAction, GrowthEntry } from './state';
import { Rng } from './rng';
import { rankLetter, clamp, rankOf } from './util';
import { enrolled, available, notify, addRep, chronicle } from './game';
import { addSupport, addTrust, addRecent, getSupport, buildTalk, supportRank } from './support';
import { gainExp, startGrowthLog, stopGrowthLog, snapGrowth, diffGrowth } from './growth';
import { learnSpells, learnedText } from './spells';
import { buildInterview, consultFlag, specialInterview } from './interview';
import type { InterviewTopic } from '../data/talks/interviews';
import { examCandidates } from './exam';
import { growTeachers, viceOf, viceTargets, viceWeekend, viceTutorPicks } from './instructor';

export type Policy = 'balance' | 'talent' | 'dream' | 'combat';

export function skillUnlocked(s: GameState, k: SkillId): boolean { return k !== 'gun' || s.world.gunUnlocked; }

/** 自動で目標技能を決める */
export function autoTargets(s: GameState, st: Student, policy: Policy = 'balance'): [SkillId, SkillId] {
  const dream = DREAMS.find((d) => d.id === st.dream)!;
  const sk = SKILLS.filter((k) => skillUnlocked(s, k));
  const byPoints = [...sk].sort((a, b) => st.skills[b] - st.skills[a]);
  const talentSkill = st.talent && st.talentReveal >= B.talent.hint1 ? TALENTS[st.talent].skill : undefined;
  const cls = CLASSES[st.classId];
  let first: SkillId;
  if (policy === 'talent' && talentSkill) first = talentSkill;
  else if (policy === 'dream' && dream.skills[0]) first = dream.skills[0];
  else if (policy === 'combat') first = byPoints[0];
  else first = talentSkill ?? dream.skills[0] ?? byPoints[0];
  // 2つ目：今の兵種の次の試験に必要な技能、なければ2番目に高い技能
  let second: SkillId | undefined;
  const next = Object.values(CLASSES).find((c) => c.prereq.includes(cls.id) && c.tier <= 3 && Object.keys(c.req).includes(first) && Object.keys(c.req).length > 1);
  if (next) second = (Object.keys(next.req) as SkillId[]).find((k) => k !== first);
  if (!second || !skillUnlocked(s, second)) second = (policy === 'dream' && dream.skills[1]) || byPoints.find((k) => k !== first) || 'sword';
  if (second === first) second = byPoints.find((k) => k !== first) ?? 'lance';
  return [first, second as SkillId];
}

export function tutoringSlots(s: GameState): number {
  let n = B.tutoring.baseSlots;
  if (s.instructor.age >= B.tutoring.oldTiredAge && s.week === 1 && ((s.absWeek * 7919) % 100) / 100 < B.tutoring.oldTiredChance) n -= 1;
  return clamp(n, 1, B.tutoring.maxSlots);
}
export function weekendSlots(s: GameState): number {
  return B.weekend.baseActions + (s.month === 8 ? B.weekend.festivalExtra : 0) + 1; // 基本2回（1〜2回のうち多いほう）
}

/** 担当者の技能ランクによる倍率 */
export function teacherMul(s: GameState, k: SkillId): number {
  let best = s.instructor.skills[k] ?? 0;
  for (const t of s.teachers) if (t.skill === k) best = Math.max(best, t.points);
  if (best <= 0 && k === 'gun') return B.lesson.noTeacherMul;
  const letter = rankLetter(best);
  return B.lesson.teacherRankMul[letter] ?? 1;
}
export function bestTeacher(s: GameState, k: SkillId): string {
  let name = s.instructor.name, best = s.instructor.skills[k] ?? 0;
  for (const t of s.teachers) if (t.skill === k && t.points > best) { best = t.points; name = t.name; }
  if (best <= 0 && k === 'gun') return '担当なし';
  return `${name}（${rankOf(best)}）`;
}

function facilityMul(s: GameState, k: SkillId): number {
  let m = 1;
  for (const [fid, def] of Object.entries(B.facilities)) {
    if ((def.skills as SkillId[]).includes(k)) m += def.skillUp[s.facilities[fid] ?? 0];
  }
  return m;
}
export function fatigueMul(st: Student): number { return st.fatigue >= B.fatigue.slowAt ? B.fatigue.slowMul : 1; }
function talentMul(st: Student, k: SkillId): number {
  if (!st.talent) return 1;
  const t = TALENTS[st.talent];
  if (t.hero) return 1.2;
  return t.skill === k ? t.skillMul ?? 1 : 1;
}
function traitLessonMul(st: Student, tutoring: boolean): number {
  let m = 1;
  for (const t of st.traits) { const d = TRAITS[t]; m *= tutoring ? d.tutorMul ?? 1 : d.lessonMul ?? 1; }
  return m;
}

export function addSkill(st: Student, k: SkillId, pts: number): number {
  const before = st.skills[k];
  st.skills[k] = clamp(Math.round((before + pts) * 10) / 10, 0, B.lesson ? 700 : 700);
  return st.skills[k] - before;
}

export function revealTalent(s: GameState, st: Student, amount: number, lines?: string[]): void {
  if (!st.talent) {
    // 才能がない子も判明度は進む（「目立った才能はなさそう」と分かる）
    const before = st.talentReveal;
    st.talentReveal = clamp(st.talentReveal + amount * s.settings.mods.reveal, 0, 100);
    if (before < 100 && st.talentReveal >= 100) { st.growthKnown = true; lines?.push(`${st.given}の成長の傾向が分かった`); }
    return;
  }
  const t = TALENTS[st.talent];
  const before = st.talentReveal;
  st.talentReveal = clamp(st.talentReveal + amount * s.settings.mods.reveal, 0, 100);
  const after = st.talentReveal;
  const msg = (text: string) => { notify(s, text, st.id); lines?.push(text); };
  if (before < B.talent.hint1 && after >= B.talent.hint1) msg(`才能のヒント：${st.given}は「${t.hint1}」`);
  if (before < B.talent.hint2 && after >= B.talent.hint2) msg(`才能のヒント：${st.given}は「${t.hint2}」`);
  talentDiscovery(s, st, before, after);
  if (before < B.talent.full && after >= B.talent.full) {
    st.growthKnown = true;
    msg(`才能が判明：${st.given}は「${t.name}」だった！`);
    chronicle(s, `${st.given}の才能「${t.name}」が判明`, 'student');
  }
  // 隠れていた特徴タグも、判明度に応じて見えてくる
  if (after >= 50) for (const tr of st.traits) if (!st.knownTraits.includes(tr)) { st.knownTraits.push(tr); msg(`${st.given}の特徴「${TRAITS[tr].name}」が分かった`); break; }
}

function expBonus(s: GameState): number { return Math.min(B.talent.expBonusMax, s.instructor.experience / B.talent.expDiv); }

export function changeMotivation(st: Student, d: number): void { st.motivation = clamp(st.motivation + d, 0, 4); }

function addFatigue(s: GameState, st: Student, amount: number): void {
  const mul = s.month === 3 ? B.fatigue.campMul : 1;
  st.fatigue = clamp(st.fatigue + amount * mul, 0, s.world.epidemic ? B.fatigue.epidemicCap + 20 : 100);
}

// ---------- 自動設定 ----------

export function autoPlan(s: GameState, rng: Rng): void {
  const list = enrolled(s).filter(available);
  for (const st of enrolled(s)) {
    if (!st.targetsAuto) continue;
    const v = viceOf(s, st.grade);
    st.targets = v ? viceTargets(s, st, v.v.policy, v.st, autoTargets) : autoTargets(s, st);
  }
  const slots = tutoringSlots(s);
  if (s.plan.tutoring.length === 0) {
    // 相談 → 退学の予兆 → やる気の低い子 → 注目されていない子
    const chosen: string[] = [];
    const push = (st: Student, kind: 'skill' | 'talk' | 'consult') => {
      if (chosen.length >= slots || chosen.includes(st.id) || !available(st)) return;
      chosen.push(st.id);
      s.plan.tutoring.push({ studentId: st.id, kind, skill: kind === 'skill' ? st.targets[0] : undefined });
    };
    for (const id of s.consults) if (s.students[id]) push(s.students[id], 'consult');
    for (const st of list) if (st.dropoutSign) push(st, 'talk');
    for (const st of list) if (st.motivation <= 1) push(st, 'talk');
    for (const st of [...list].sort((a, b) => a.lastAttention - b.lastAttention)) push(st, 'skill');
  }
  if (s.plan.weekend.length === 0) {
    const avgFat = list.reduce((a, st) => a + st.fatigue, 0) / Math.max(1, list.length);
    const n = weekendSlots(s);
    // 副教官（担任）が担当学年の週末を組む
    for (const g of [1, 2, 3]) {
      const v = viceOf(s, g);
      if (!v || s.plan.weekend.length >= n) continue;
      const w = viceWeekend(s, rng, g, v.v.policy, v.st);
      if (w && !(w.kind === 'rest' && s.plan.weekend.some((x) => x.kind === 'rest'))) s.plan.weekend.push(w);
    }
    for (let i = s.plan.weekend.length; i < n; i++) {
      if (avgFat >= 40 && !s.plan.weekend.some((w) => w.kind === 'rest')) { s.plan.weekend.push({ kind: 'rest' }); continue; }
      const roll = rng.int(0, 2);
      if (roll === 0 && list.length >= 2) {
        const ids = rng.shuffle(list.map((x) => x.id)).slice(0, Math.min(3, list.length));
        s.plan.weekend.push({ kind: 'tea', ids });
      } else if (roll === 1 && list.length >= 2) {
        const [a, b] = rng.shuffle(list.map((x) => x.id));
        s.plan.weekend.push({ kind: 'spar', ids: [a, b], skill: s.students[a].targets[0] });
      } else {
        const grades = [...new Set(list.map((x) => x.grade))];
        if (grades.length) s.plan.weekend.push({ kind: 'dinner', grade: rng.pick(grades) });
        else s.plan.weekend.push({ kind: 'rest' });
      }
    }
  }
}

// ---------- 1週間の解決 ----------

export interface WeekResult { lines: string[]; talks: TalkLog[]; growth: GrowthEntry[] }

export function resolveWeek(s: GameState, rng: Rng): WeekResult {
  const lines: string[] = [];
  const talks: TalkLog[] = [];
  autoPlan(s, rng);
  const camp = s.month === 3;
  const festival = s.month === 8;
  const before = new Map(enrolled(s).map((st) => [st.id, { skills: { ...st.skills }, level: st.level, mot: st.motivation }]));
  const snaps = new Map(enrolled(s).map((st) => [st.id, snapGrowth(st)]));
  const tutored = new Map<string, string>();
  startGrowthLog();

  // 誕生日の週
  const bdays = enrolled(s).filter((st) => st.birthday && st.birthday.month === s.month && st.birthday.week === s.week);
  for (const st of bdays) {
    changeMotivation(st, B.birthday.motivation);
    addTrust(st, B.birthday.trust);
    lines.push(`今週は${st.given}の誕生日。みんなで小さなお祝いをした（やる気↑）`);
  }

  // 授業
  for (const st of enrolled(s)) {
    if (!available(st)) continue;
    const focus = s.focus[st.grade] ?? ['sword', 'lance'];
    const gains: Partial<Record<SkillId, number>> = {};
    for (const k of focus) if (skillUnlocked(s, k)) gains[k] = (gains[k] ?? 0) + B.lesson.focusPoints;
    for (const k of st.targets) if (skillUnlocked(s, k)) gains[k] = (gains[k] ?? 0) + B.lesson.targetPoints;
    for (const [k, base] of Object.entries(gains) as [SkillId, number][]) {
      const mul = teacherMul(s, k) * facilityMul(s, k) * B.motivationMul[st.motivation] * fatigueMul(st) * talentMul(st, k) * traitLessonMul(st, false) * (camp ? B.lesson.campMul : 1);
      addSkill(st, k, base * mul);
    }
    gainExp(s, rng, st, B.lesson.expPerWeek);
    addFatigue(s, st, B.fatigue.lesson);
    revealTalent(s, st, B.talent.weeklyReveal + B.talent.libraryReveal[s.facilities.library ?? 0] + expBonus(s), lines);
  }

  // 個人指導
  for (const t of s.plan.tutoring) {
    const st = s.students[t.studentId];
    if (!st || !available(st)) continue;
    st.lastAttention = s.absWeek;
    tutored.set(st.id, t.kind === 'skill' ? '個人指導' : t.kind === 'consult' ? '相談' : '面談');
    if (t.kind === 'skill') {
      const k = t.skill ?? st.targets[0];
      const mul = teacherMul(s, k) * facilityMul(s, k) * B.motivationMul[st.motivation] * fatigueMul(st) * talentMul(st, k) * traitLessonMul(st, true);
      const g = addSkill(st, k, B.tutoring.skillPoints * mul);
      revealTalent(s, st, B.tutoring.reveal + expBonus(s), lines);
      addFatigue(s, st, B.fatigue.tutoring);
      gainExp(s, rng, st, B.tutoring.exp);
      addTrust(st, B.tutoring.trust);
      const dream = DREAMS.find((d) => d.id === st.dream)!;
      if (dream.skills.includes(k) && rng.chance(0.3)) changeMotivation(st, 1);
      lines.push(`個人指導：${st.given}の${SKILL_NAMES[k]}が+${Math.round(g)}`);
    } else {
      const r = interview(s, rng, st, t.kind === 'consult');
      lines.push(...r.lines);
      if (r.talk) talks.push(r.talk);
    }
  }
  // 副教官（担任）の個人指導（副教官1人につき1回、伸びは教官より小さい）
  const taken = new Set(s.plan.tutoring.map((x) => x.studentId));
  for (const p of viceTutorPicks(s, taken)) {
    const st = p.st, k = p.k;
    st.lastAttention = s.absWeek;
    const mul = teacherMul(s, k) * facilityMul(s, k) * B.motivationMul[st.motivation] * fatigueMul(st) * talentMul(st, k) * traitLessonMul(st, true) * B.vice.tutorMul;
    const g = addSkill(st, k, B.tutoring.skillPoints * mul);
    revealTalent(s, st, B.tutoring.reveal * B.vice.tutorMul, lines);
    addFatigue(s, st, B.fatigue.tutoring);
    gainExp(s, rng, st, B.tutoring.exp * B.vice.tutorMul);
    tutored.set(st.id, `担任（${p.teacher.name}）の指導`);
    lines.push(`担任の${p.teacher.name}が${st.given}に${SKILL_NAMES[k]}を指導（+${Math.round(g)}）`);
  }
  // 教官・講師の技能は教えるほど上がる
  growTeachers(s, s.plan.tutoring.filter((x) => x.kind === 'skill').map((x) => x.skill ?? s.students[x.studentId]?.targets[0]).filter(Boolean) as SkillId[], lines);
  s.consults = [];
  // 信頼が深まった子との特別な面談
  const sp = specialInterview(s, rng, enrolled(s).filter(available));
  if (sp) { talks.push(sp); lines.push(`${s.students[sp.a]?.given}と「${sp.title}」について語り合った（特別な面談）`); }

  // 週末
  for (const w of s.plan.weekend) talks.push(...doWeekend(s, rng, w, lines, festival));

  // 回復・体調
  for (const st of enrolled(s)) {
    const rec = B.fatigue.naturalRecovery + B.fatigue.chapelRecovery[s.facilities.chapel ?? 0];
    if (st.sickWeeks > 0) { st.sickWeeks -= 1; if (st.sickWeeks === 0) lines.push(`${st.given}の体調が戻った`); continue; }
    if (st.injuredWeeks > 0) { st.injuredWeeks -= 1; st.fatigue = Math.max(0, st.fatigue - rec); if (st.injuredWeeks === 0) lines.push(`${st.given}のけがが治った`); continue; }
    st.fatigue = clamp(st.fatigue - rec, 0, 100);
    const cap = s.world.epidemic ? B.fatigue.epidemicCap : B.fatigue.sickAt;
    if (st.fatigue >= cap) {
      st.sickWeeks = 1; st.fatigue = B.fatigue.sickReset;
      lines.push(`${st.given}が体調を崩した（1週間休み）`);
      notify(s, `${st.given}が体調不良で休み`, st.id);
    }
    // やる気：疲れが続くと下がる
    if (st.fatigue >= B.fatigue.slowAt && rng.chance(0.25) && !rng.chance(B.diningMotivationKeep[s.facilities.dining ?? 0])) changeMotivation(st, -1);
    if (st.fatigue >= B.fatigue.warnAt) notify(s, `${st.given}の疲労が${Math.round(st.fatigue)}`, st.id);
    st.lowMotivWeeks = st.motivation === 0 ? st.lowMotivWeeks + 1 : 0;
  }

  // 退学の予兆
  lines.push(...processDropout(s, rng));

  // まとめ：技能ランクの変化・覚えた魔法・成長の記録
  const growth: GrowthEntry[] = [];
  for (const st of enrolled(s)) {
    const b = before.get(st.id); if (!b) continue;
    let rankUp = false;
    for (const k of SKILLS) {
      const r0 = rankOf(b.skills[k]), r1 = rankOf(st.skills[k]);
      if (r0 !== r1) { lines.push(`${st.given}の${SKILL_NAMES[k]}が${r1}に上がった`); rankUp = true; }
    }
    const learned = learnSpells(s, st);
    for (const id of learned) lines.push(learnedText(st, id));
    if (st.level > b.level) lines.push(`${st.given}がLv${st.level}になった`);
    const snap = snaps.get(st.id);
    if (snap && (tutored.has(st.id) || rankUp || st.level > b.level || learned.length)) {
      const why = tutored.get(st.id) ?? (st.level > b.level ? 'レベルアップ' : learned.length ? '魔法' : 'ランクアップ');
      growth.push(diffGrowth(st, snap, learned, why));
    }
    if (st.motivation < b.mot && st.motivation <= 1) { lines.push(`${st.given}のやる気が下がっている`); notify(s, `${st.given}のやる気が「${B.motivationLabel[st.motivation]}」`, st.id); }
  }

  stopGrowthLog();
  // 次の週の相談
  rollConsults(s, rng);
  s.plan = { tutoring: [], weekend: [] };
  return { lines, talks, growth };
}

function interview(s: GameState, rng: Rng, st: Student, consult: boolean): { lines: string[]; talk: TalkLog | null } {
  const out: string[] = [];
  let topic: InterviewTopic = 'recent';
  const flags: string[] = [];
  if (st.dropoutSign) {
    st.dropoutSign.talksNeeded -= 1;
    topic = 'retain';
    flags.push(`reason_${st.dropoutSign.reason}`);
    if (st.dropoutSign.talksNeeded <= 0) {
      out.push(`面談：${st.given}は「もう少しここで頑張ってみます」と言った（退学の予兆が消えた）`);
      st.dropoutSign = null;
      flags.push('cleared');
    } else out.push(`面談：${st.given}の迷いはまだ晴れない。もう一度話をしよう`);
  } else if (consult) {
    topic = 'consult';
    flags.push(consultFlag(rng, s, st));
    out.push(`相談：${st.given}の話を聞いた`);
    revealTalent(s, st, 3, out);
  } else if (st.motivation <= 1) {
    topic = 'worry';
    out.push(`面談：${st.given}の悩みを聞いた`);
  } else if (st.grade === 3 && rng.chance(0.6)) {
    topic = 'career';
    const d = DREAMS.find((x) => x.id === st.dream)!;
    out.push(`面談：${st.given}と進路の話をした${d.text ? `（夢は${d.text}）` : ''}`);
  } else if (st.talent && st.talentReveal >= B.talent.hint1 && rng.chance(0.6)) {
    topic = 'class';
    revealTalent(s, st, B.tutoring.talkReveal, out);
    out.push(`面談：${st.given}と兵種の話をした`);
  } else {
    out.push(`面談：${st.given}と近況について話した`);
    revealTalent(s, st, 3, out);
  }
  changeMotivation(st, 1);
  addTrust(st, B.tutoring.talkTrust + (consult ? 3 : 0));
  st.lastAttention = s.absWeek;
  const talk = buildInterview(s, rng, st, topic, flags);
  return { lines: out, talk };
}

function doWeekend(s: GameState, rng: Rng, w: WeekendAction, lines: string[], festival: boolean): TalkLog[] {
  const talks: TalkLog[] = [];
  const sm = festival ? 1.5 : 1;
  const push = (t: TalkLog | null) => { if (t) talks.push(t); };
  if (w.kind === 'rest') {
    for (const st of enrolled(s)) st.fatigue = clamp(st.fatigue - B.fatigue.rest, 0, 100);
    lines.push('週末：みんなでゆっくり休んだ');
  } else if (w.kind === 'tea') {
    const ids = w.ids.filter((id) => s.students[id] && available(s.students[id]));
    // 誕生日の子がいるお茶会は、支援が上がりやすい
    const bd = ids.some((id) => { const b = s.students[id].birthday; return b && b.month === s.month && b.week === s.week; });
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) push(addSupport(s, rng, ids[i], ids[j], B.weekend.teaSupport, sm * (bd ? B.birthday.teaMul : 1)));
    if (bd) lines.push('お茶会は誕生日のお祝いも兼ねて、いつもよりにぎやかだった');
    for (const id of ids) { const st = s.students[id]; changeMotivation(st, 1); st.fatigue = clamp(st.fatigue - B.fatigue.tea, 0, 100); if (festival) addRecent(s, st, 'ev_festival', '収穫祭'); }
    lines.push(`週末：お茶会（${ids.map((id) => s.students[id].given).join('・')}）`);
    // 会話が起きやすい
    if (!talks.length && ids.length >= 2 && rng.chance(B.weekend.teaTalkChance + B.diningEventUp[s.facilities.dining ?? 0])) {
      const [a, b] = rng.shuffle([...ids]);
      const sp = getSupport(s, a, b);
      const r = supportRank(sp.value);
      if (r) push(buildTalk(s, rng, sp, r));
    }
  } else if (w.kind === 'spar') {
    const [a, b] = w.ids;
    const A = s.students[a], Bs = s.students[b];
    if (A && Bs && available(A) && available(Bs)) {
      push(addSupport(s, rng, a, b, B.weekend.sparSupport, sm));
      for (const st of [A, Bs]) { addSkill(st, w.skill, B.weekend.sparSkill * B.motivationMul[st.motivation]); addFatigue(s, st, B.fatigue.spar); }
      addRecent(s, A, 'ev_spar', SKILL_NAMES[w.skill], b); addRecent(s, Bs, 'ev_spar', SKILL_NAMES[w.skill], a);
      lines.push(`週末：${A.given}と${Bs.given}が${SKILL_NAMES[w.skill]}で手合わせ`);
    }
  } else if (w.kind === 'dinner') {
    const list = enrolled(s).filter((st) => st.grade === w.grade && available(st));
    for (const st of list) if (rng.chance(B.weekend.dinnerMotivationChance)) changeMotivation(st, 1);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) push(addSupport(s, rng, list[i].id, list[j].id, 1.5, sm));
    lines.push(`週末：${w.grade}年生の食事会。にぎやかな夜になった`);
  }
  return talks;
}

function rollConsults(s: GameState, rng: Rng): void {
  s.consults = [];
  const list = enrolled(s).filter(available);
  const n = rng.int(...B.tutoring.consultPerWeek);
  // 退学の予兆があって信頼が高い子は必ず相談に来る
  for (const st of list) if (st.dropoutSign && st.trust >= B.trust.consultBeforeDropAt && !s.consults.includes(st.id)) s.consults.push(st.id);
  for (let i = 0; i < n; i++) {
    if (!rng.chance(B.tutoring.consultChance) || !list.length) continue;
    const st = rng.weighted(list, (x) => 1 + (4 - x.motivation) + (s.absWeek - x.lastAttention) / 4);
    if (!s.consults.includes(st.id)) s.consults.push(st.id);
  }
}

/** 相談を断る */
export function declineConsult(s: GameState, id: string): void {
  const st = s.students[id];
  s.consults = s.consults.filter((x) => x !== id);
  s.plan.tutoring = s.plan.tutoring.filter((t) => !(t.studentId === id && t.kind === 'consult'));
  if (st) changeMotivation(st, -1);
}

function processDropout(s: GameState, rng: Rng): string[] {
  const out: string[] = [];
  for (const st of enrolled(s)) {
    if (!st.dropoutSign && st.lowMotivWeeks >= B.dropout.lowMotivationWeeks) startDropoutSign(s, rng, st, 'motivation');
    if (st.dropoutSign) {
      st.dropoutSign.weeksLeft -= 1;
      if (st.dropoutSign.weeksLeft <= 0) {
        out.push(`${st.given}が学校を去った……`);
        dropOut(s, st);
      }
    }
  }
  return out;
}

export function startDropoutSign(s: GameState, rng: Rng, st: Student, reason: 'motivation' | 'family' | 'poach' | 'homewar'): void {
  if (st.dropoutSign || st.status !== 'enrolled') return;
  const talks = st.trust >= B.dropout.highTrust ? B.dropout.talksHighTrust : B.dropout.talksLowTrust;
  st.dropoutSign = { reason, weeksLeft: rng.int(...B.dropout.signWeeks), talksNeeded: talks };
  const why = { motivation: '元気がない', family: '家の事情で悩んでいる', poach: '他国から誘いを受けている', homewar: '故郷が戦場になり帰りたがっている' }[reason];
  notify(s, `退学の予兆：${st.given}（${why}）。面談で話を聞こう`, st.id);
  if (reason === 'homewar') addRecent(s, st, 'ev_homewar', COUNTRY_NAMES[st.origin]);
}

export function dropOut(s: GameState, st: Student): void {
  st.status = 'dropped';
  addRep(s, B.reputation.dropout);
  chronicle(s, `${st.given}が退学`, 'student');
  s.pinned = s.pinned.filter((x) => x !== st.id);
  for (const o of enrolled(s)) {
    const sp = s.supports[[o.id, st.id].sort().join('|')];
    if (sp && sp.value >= B.support.C) { changeMotivation(o, -1); addRecent(s, o, 'ev_loss', st.given, undefined); }
  }
  for (const p of s.photos) void p;
}

/** 毎月の始めの処理（生徒関連） */
export function startMonthStudents(s: GameState, rng: Rng): string[] {
  const out: string[] = [];
  const list = enrolled(s);
  // 同じ学年の支援+1
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++)
    if (list[i].grade === list[j].grade) addSupport(s, rng, list[i].id, list[j].id, B.support.sameGradeMonthly);
  // 夢と目標技能
  for (const st of list) {
    const d = DREAMS.find((x) => x.id === st.dream)!;
    if (!d.skills.length) continue;
    const match = st.targets.some((k) => d.skills.includes(k));
    if (match && rng.chance(B.lesson.dreamMatchUpChance)) changeMotivation(st, 1);
    if (!match && rng.chance(B.lesson.dreamMismatchDownChance)) changeMotivation(st, -1);
  }
  // 退学のまれな理由
  for (const st of list) {
    if (rng.chance(B.dropout.familyChancePerMonth)) startDropoutSign(s, rng, st, 'family');
    else if (st.talentReveal >= 100 && st.talent && rng.chance(B.dropout.poachChancePerMonth)) startDropoutSign(s, rng, st, 'poach');
    else if (s.world.tension > B.world.warAbove && st.origin !== 'frontier' && rng.chance(B.dropout.homeWarChancePerMonth)) startDropoutSign(s, rng, st, 'homewar');
  }
  // 今月の主役
  s.spotlight = [];
  const n = list.length >= 12 ? 2 : 1;
  const cands = [...list].sort((a, b) => a.spotlightCount - b.spotlightCount || a.lastAttention - b.lastAttention);
  for (const st of cands.slice(0, n)) {
    st.spotlightCount += 1;
    const text = spotlightText(rng, st);
    s.spotlight.push({ id: st.id, text, done: false });
    if (text.includes('手紙')) familyLetter(s, rng, st);
  }
  // 在校生の家族の便り（たまに）
  for (const st of list) if (rng.chance(B.familyLetterChance)) familyLetter(s, rng, st);
  // 誕生日の月：家族からのお祝いの便り
  for (const st of list) if (st.birthday?.month === s.month && rng.chance(B.letters.birthdayChance)) birthdayLetter(s, rng, st);
  // 試験を受けられる子
  const ex = examCandidates(s);
  if (ex.length) notify(s, `兵種試験を受けられる生徒が${ex.length}人`);
  return out;
}

function familyLetter(s: GameState, rng: Rng, st: Student): void {
  const who = st.house === 'orphan' ? '育ててくれた孤児院の院長' : rng.pick(['母', '父', '兄', '姉', '祖母']);
  const body = st.house === 'orphan'
    ? `${s.instructor.name}先生へ。${st.given}は元気にしておりますか。院の子どもたちは、${st.given}の話を聞くのを楽しみにしています。どうかよろしくお願いいたします。—${who}`
    : `${s.instructor.name}先生へ。いつも${st.given}がお世話になっております。${COUNTRY_NAMES[st.origin]}の家では、みな元気です。${st.given}は手紙ではいつも学校のことばかり書いてきます。どうかよろしくお願いいたします。—${st.given}の${who}`;
  s.mail.unshift({ id: `m${s.nextId++}`, year: s.year, month: s.month, from: `${st.given}の${st.house === 'orphan' ? '孤児院' : '家族'}`, title: '家族からの便り', body, read: false, studentId: st.id });
}

function birthdayLetter(s: GameState, rng: Rng, st: Student): void {
  const who = st.house === 'orphan' ? '孤児院のみんな' : rng.pick(['母', '父', '兄', '姉', '祖母', '家族一同']);
  const body = st.house === 'orphan'
    ? `${s.instructor.name}先生へ。今月は${st.given}の誕生日ですね。院の子どもたちが、${st.given}のために小さな絵を描きました。同封いたしますので、どうか渡してあげてください。—${who}`
    : `${s.instructor.name}先生へ。今月、${st.given}は${st.age + 1}歳になります。遠く離れていて祝ってやれないのが残念です。${COUNTRY_NAMES[st.origin]}の家から、ささやかな贈り物を送ります。—${st.given}の${who}`;
  s.mail.unshift({ id: `m${s.nextId++}`, year: s.year, month: s.month, from: `${st.given}の${st.house === 'orphan' ? '孤児院' : '家族'}`, title: '誕生日のお祝い', body, read: false, studentId: st.id });
}

const SPOT = [
  { kind: 'letter', text: (st: Student) => `${st.given}に故郷の家族から手紙が届いたようだ。` },
  { kind: 'worry', text: (st: Student) => `${st.given}が何か悩んでいるようだ。` },
  { kind: 'train', text: (st: Student) => `${st.given}が「特訓に付き合ってほしい」と申し出てきた。` },
  { kind: 'dream', text: (st: Student) => `${st.given}が夜遅くまで自分の夢について考えているようだ。` },
];
function spotlightText(rng: Rng, st: Student): string {
  return rng.pick(SPOT).text(st) + `（${PERSONALITIES[st.personality].name}）`;
}

/** 今月の主役に声をかける（指導枠を使わない小さな出来事） */
export function doSpotlight(s: GameState, rng: Rng, id: string): string {
  const sp = s.spotlight.find((x) => x.id === id);
  const st = s.students[id];
  if (!sp || !st || sp.done) return '';
  sp.done = true;
  st.lastAttention = s.absWeek;
  changeMotivation(st, 1);
  addTrust(st, 5);
  const k = st.targets[0];
  addSkill(st, k, 10);
  const learned = learnSpells(s, st);
  revealTalent(s, st, 8);
  const res = rng.pick([
    `${st.given}は少し照れくさそうに笑った。`,
    `${st.given}は「ありがとうございます」と頭を下げた。`,
    `${st.given}の表情が明るくなった。`,
  ]);
  return `${res}（やる気↑・信頼↑・${SKILL_NAMES[k]}+10）${learned.map((id) => learnedText(st, id)).join('')}`;
}

export function hasFocusOverlap(s: GameState, st: Student): boolean {
  const f = s.focus[st.grade] ?? [];
  return st.targets.some((k) => f.includes(k));
}
export type { CountryId };
