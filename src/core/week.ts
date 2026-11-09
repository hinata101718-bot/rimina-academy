// 生徒の育ち方の共通部分（授業の倍率・技能・才能の判明・やる気・面談・退学の予兆・月の始め）。
// 7夜目：授業は日ごとの授業カード（lessons.ts）に。週末・個人指導はなくなった
import { B, SKILLS } from '../data/balance';
import { rollSides } from './discovery';
import { aptMul, goodOf, isBad, budKnown, budHinted, revealBud } from './aptitude';
import { RANK_POINTS, LEAD_SKILLS as LEAD } from '../data/balance';
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
import { fx } from './mentor';

export type Policy = 'balance' | 'talent' | 'dream' | 'combat';

export function skillUnlocked(s: GameState, k: SkillId): boolean { return k !== 'gun' || s.world.gunUnlocked; }

/** 自動で目標技能を決める */
export function autoTargets(s: GameState, st: Student, policy: Policy = 'balance'): [SkillId, SkillId] {
  const dream = DREAMS.find((d) => d.id === st.dream)!;
  const sk = SKILLS.filter((k) => skillUnlocked(s, k));
  const byPoints = [...sk].sort((a, b) => st.skills[b] - st.skills[a]);
  // 10夜目：得意な技能を考えに入れる（夢に沿う得意 → いちばん高い得意）。芽が見えている子は、その技能を2つ目に
  const good = goodOf(st).filter((k) => skillUnlocked(s, k));
  const goodSkill = good.find((k) => dream.skills.includes(k)) ?? [...good].sort((a, b) => st.skills[b] - st.skills[a])[0];
  const bud = budKnown(st) && st.bud?.skill && skillUnlocked(s, st.bud.skill) ? st.bud.skill : undefined;
  const cls = CLASSES[st.classId];
  let first: SkillId;
  if (policy === 'talent' && goodSkill) first = goodSkill;
  else if (policy === 'dream' && dream.skills[0]) first = dream.skills[0];
  else if (policy === 'combat') first = byPoints.find((k) => !LEAD.includes(k)) ?? byPoints[0];
  else first = (dream.skills[0] && !isBad(st, dream.skills[0]) ? dream.skills[0] : undefined) ?? goodSkill ?? byPoints[0];
  if (bud && bud !== first && policy !== 'combat') return [first, bud];
  // 10夜目：統率・軍略が得意な子は、それを2つ目に（采配の道へ）
  const lead = good.find((k) => LEAD.includes(k) && k !== first);
  if (lead && policy !== 'combat' && policy !== 'dream') return [first, lead];
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

/** 技能の伸びの倍率（10夜目：得意×1.5・苦手×0.5。金の芽が開花した子は全部少し） */
export function talentMulOf(st: Student, k: SkillId): number {
  return aptMul(st, k) * (st.bud?.gold && st.bud.done ? 1.15 : 1);
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

/** 判明度を上げる（10夜目：隠れた才能はなくなり、眠った芽の判明度と、隠れた特徴に使う） */
export function revealTalent(s: GameState, st: Student, amount: number, lines?: string[]): void {
  st.talentReveal = clamp(st.talentReveal + amount * s.settings.mods.reveal, 0, 100);
  const after = st.talentReveal;
  const msg = (text: string) => { notify(s, text, st.id); lines?.push(text); };
  const out: string[] = [];
  revealBud(s, st, amount, out);
  for (const x of out) msg(x);
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
    st.dropoutSign.talksNeeded -= fx(s, 'retainOne') > 0 ? 99 : 1;
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
  } else if (budHinted(st) && rng.chance(0.6)) {
    topic = 'class';
    revealTalent(s, st, B.tutoring.talkReveal, out);
    out.push(`面談：${st.given}と兵種の話をした`);
  } else {
    out.push(`面談：${st.given}と近況について話した`);
    revealTalent(s, st, 3, out);
  }
  changeMotivation(st, 1);
  addTrust(st, (B.tutoring.talkTrust + (consult ? 3 : 0)) * (1 + fx(s, 'interviewTrust')));
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
    // 退学は「去った仲間」（亡くなった前提の会話）にはしない（7夜目）
    if (sp && sp.value >= B.support.C) changeMotivation(o, -1);
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
    // 10夜目：他国からの引き抜きは、開花した子・得意の技能がBランク以上の子
    else if ((st.bud?.done || goodOf(st).some((k) => st.skills[k] >= RANK_POINTS.B)) && rng.chance(B.dropout.poachChancePerMonth)) startDropoutSign(s, rng, st, 'poach');
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
  // 15夜目：「声をかける」はおまかせ（月のはじめに自動で）
  for (const sp of s.spotlight) sp.res = doSpotlight(s, rng, sp.id);
  // 在校生の家族の便り（たまに）
  for (const st of list) if (rng.chance(B.familyLetterChance)) familyLetter(s, rng, st);
  // 誕生日の月：家族からのお祝いの便り
  // 15夜目：誕生日の便りは「今月の誕生日 〇人」の1通にまとめる
  const bdays = list.filter((st) => st.birthday?.month === s.month && rng.chance(B.letters.birthdayChance));
  if (bdays.length) birthdayLetters(s, rng, bdays);
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

function birthdayLetters(s: GameState, rng: Rng, sts: Student[]): void {
  const parts = sts.map((st) => {
    const who = st.house === 'orphan' ? '孤児院のみんな' : rng.pick(['母', '父', '兄', '姉', '祖母', '家族一同']);
    const body = st.house === 'orphan'
      ? `${s.instructor.name}先生へ。今月は${st.given}の誕生日ですね。院の子どもたちが、${st.given}のために小さな絵を描きました。同封いたしますので、どうか渡してあげてください。—${who}`
      : `${s.instructor.name}先生へ。今月、${st.given}は${st.age + 1}歳になります。遠く離れていて祝ってやれないのが残念です。${COUNTRY_NAMES[st.origin]}の家から、ささやかな贈り物を送ります。—${st.given}の${who}`;
    return { studentId: st.id, from: `${st.given}の${st.house === 'orphan' ? '孤児院' : '家族'}`, body };
  });
  const one = sts.length === 1;
  s.mail.unshift({ id: `m${s.nextId++}`, year: s.year, month: s.month, from: one ? parts[0].from : `${sts.map((x) => x.given).join('・')}の家族`, title: one ? '誕生日のお祝い' : `今月の誕生日 ${sts.length}人`, body: one ? parts[0].body : parts.map((x) => x.body).join('\n'), read: false, studentId: sts[0].id, ...(one ? {} : { parts }) });
  if (s.mail.length > 120) s.mail.length = 120;
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
