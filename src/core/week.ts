// 生徒の育ち方の共通部分（授業の倍率・技能・才能の判明・やる気・面談・退学の予兆・月の始め）。
// 7夜目：授業は日ごとの授業カード（lessons.ts）に。週末・個人指導はなくなった
import { B, SKILLS } from '../data/balance';
import { talentDiscovery, rollSides } from './discovery';
import { TRAITS, TALENTS, DREAMS, SKILL_NAMES, PERSONALITIES, COUNTRY_NAMES } from '../data/people';
import { CLASSES } from '../data/classes';
import type { SkillId, CountryId } from './types';
import type { GameState, Student, TalkLog } from './state';
import { Rng } from './rng';
import { rankLetter, clamp, rankOf } from './util';
import { enrolled, available, notify, addRep, chronicle } from './game';
import { addSupport, addTrust, addRecent } from './support';
import { learnSpells, learnedText } from './spells';
import { buildInterview, consultFlag, specialInterview } from './interview';
import type { InterviewTopic } from '../data/talks/interviews';
import { examCandidates } from './exam';
import { viceOf, viceTargets } from './instructor';

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

export function facilityMulOf(s: GameState, k: SkillId): number {
  let m = 1;
  for (const [fid, def] of Object.entries(B.facilities)) {
    if ((def.skills as SkillId[]).includes(k)) m += def.skillUp[s.facilities[fid] ?? 0];
  }
  return m;
}
export function fatigueMul(st: Student): number { return st.fatigue >= B.fatigue.slowAt ? B.fatigue.slowMul : 1; }
export function talentMulOf(st: Student, k: SkillId): number {
  if (!st.talent) return 1;
  const t = TALENTS[st.talent];
  if (t.hero) return 1.2;
  return t.skill === k ? t.skillMul ?? 1 : 1;
}
export function traitLessonMulOf(st: Student): number {
  let m = 1;
  for (const t of st.traits) m *= TRAITS[t].lessonMul ?? 1;
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

export function expBonusOf(s: GameState): number { return Math.min(B.talent.expBonusMax, s.instructor.experience / B.talent.expDiv); }

export function changeMotivation(st: Student, d: number): void { st.motivation = clamp(st.motivation + d, 0, 4); }

/** 月の始め：「自動で決める」の子の目標技能（担任のいる学年は担任の方針で） */
export function autoMonthTargets(s: GameState): void {
  for (const st of enrolled(s)) {
    if (!st.targetsAuto) continue;
    const v = viceOf(s, st.grade);
    st.targets = v ? viceTargets(s, st, v.v.policy, v.st, autoTargets) : autoTargets(s, st);
  }
}

/** 週の初め（月曜日）：誕生日の週 */
export function startWeekStudents(s: GameState): string[] {
  const lines: string[] = [];
  for (const st of enrolled(s).filter((x) => x.birthday && x.birthday.month === s.month && x.birthday.week === s.week)) {
    changeMotivation(st, B.birthday.motivation);
    addTrust(st, B.birthday.trust);
    lines.push(`今週は${st.given}の誕生日。みんなで小さなお祝いをした（やる気↑）`);
  }
  return lines;
}

/** 週の終わり（金曜の授業のあと）：けがの回復・やる気・退学の予兆・次の週の相談 */
export function endOfWeek(s: GameState, rng: Rng): string[] {
  const lines: string[] = [];
  for (const st of enrolled(s)) {
    if (st.sickWeeks > 0) { st.sickWeeks -= 1; if (st.sickWeeks === 0) lines.push(`${st.given}の体調が戻った`); }
    if (st.injuredWeeks > 0) { st.injuredWeeks -= 1; if (st.injuredWeeks === 0) lines.push(`${st.given}のけがが治った`); }
    if (st.fatigue >= B.fatigue.warnAt) notify(s, `${st.given}の体力が${Math.round(100 - st.fatigue)}`, st.id);
    st.lowMotivWeeks = st.motivation === 0 ? st.lowMotivWeeks + 1 : 0;
  }
  lines.push(...processDropout(s, rng));
  rollConsults(s, rng);
  return lines;
}

export function interviewStudent(s: GameState, rng: Rng, st: Student, consult: boolean, force?: InterviewTopic): { lines: string[]; talk: TalkLog | null } {
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
  } else if (force === 'career' || st.grade === 3 && rng.chance(0.6)) {
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

export type { CountryId };
