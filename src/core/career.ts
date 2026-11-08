// 進路（声かけ・希望・推薦の三者）と卒業式
import { ARM_SKILLS } from '../data/balance';
import { B } from '../data/balance';
import { careerTitleOnly } from './discovery';
import { titleOf } from './alumni';
import { COUNTRIES, COUNTRY_SHORT, DREAMS, COUNTRY_FAVOR_SKILLS, COUNTRY_FAVOR_HOUSE, PATH_NAMES, SKILL_NAMES } from '../data/people';
import { CLASSES } from '../data/classes';
import { WEAPONS } from '../data/weapons';
import type { CountryId, Path, SkillId } from './types';
import type { GameState, Student, CareerInfo } from './state';
import { Rng } from './rng';
import { effectiveStats, chronicle, addFriendship, enrolled } from './game';
import { addTrust } from './support';
import { bestSkillOf } from './teachers';
import { fx } from './mentor';

export type CareerChoice = CountryId | 'stay' | 'home' | 'merc';
export const CHOICE_NAMES: Record<CareerChoice, string> = {
  kingdom: '王国の軍', empire: '帝国の軍', alliance: '同盟の軍', stay: '学校に残る', home: '故郷に帰る', merc: '流れの傭兵',
};

/** 声かけ（演武会・実戦の活躍・兵種・魅力・友好度） */
export function computeOffers(s: GameState, rng: Rng, st: Student): CountryId[] {
  const out = new Set<CountryId>(st.offers);
  const tier = CLASSES[st.classId]?.tier ?? 0;
  const es = effectiveStats(st);
  for (const c of COUNTRIES) {
    let p = B.career.offerBase + st.exhibitionScore * 0.03 + tier * 0.08 + es.cha * 0.01 + s.world.friendship[c] * 0.004 + st.battles * 0.01;
    if (COUNTRY_FAVOR_SKILLS[c].some((k) => (st.skills[k] ?? 0) >= 140)) p += 0.1;
    if (COUNTRY_FAVOR_HOUSE[c] && COUNTRY_FAVOR_HOUSE[c] === st.house) p += 0.1;
    if (st.origin === c) p += 0.15;
    if (s.world.vassal && s.world.vassal !== c) p *= 0.4;
    if (s.world.friendship[c] <= -20) p *= 0.5;
    if (rng.chance(Math.min(0.95, p))) out.add(c);
  }
  return [...out];
}

/** 本人の希望の順位 */
export function hopes(s: GameState, st: Student): CareerChoice[] {
  const d = DREAMS.find((x) => x.id === st.dream)!;
  const score: Record<CareerChoice, number> = { kingdom: 0, empire: 0, alliance: 0, stay: -2, home: -1, merc: -3 };
  if (d.country === 'home' && st.origin !== 'frontier') score[st.origin as CountryId] += 6;
  else if (d.country && d.country !== 'home') score[d.country] += 6;
  if (d.career) score[d.career] += 7;
  if (st.origin !== 'frontier') score[st.origin as CountryId] += 3; else score.home += 2;
  for (const c of COUNTRIES) {
    if (COUNTRY_FAVOR_HOUSE[c] === st.house) score[c] += 2;
    score[c] += s.world.friendship[c] / 40;
  }
  if (st.personality === 'competitive' || st.personality === 'hot') score.empire += 1;
  if (st.personality === 'serious') score.kingdom += 1;
  if (st.personality === 'gentle' || st.personality === 'calm') score.alliance += 1;
  if (st.trust >= 70) score.stay += 3;
  return (Object.keys(score) as CareerChoice[]).sort((a, b) => score[b] - score[a]);
}

/** 向いている道（10夜目：強さの2つの軸。采配＝統率→将・軍略→参謀、個の武→勇士、魅力→文官） */
export function pathScores(st: Student): Record<Path, number> {
  const e = effectiveStats(st);
  const cmd = st.skills.command ?? 0, tac = st.skills.tactics ?? 0;
  const arms = Math.max(...ARM_SKILLS.map((k) => st.skills[k] ?? 0));
  // 自分のいちばん高い武器の技能と比べる（采配の技能が武器に近いほど、将・参謀に向く）
  return {
    civil: e.cha * 10 + (st.house === 'noble' ? 30 : 0),
    warrior: cmd * 3.5 + e.cha * 6,
    strategist: tac * 3.5 + (e.skl + e.mag) * 1.5,
    champion: arms,
  };
}
export function suitablePath(st: Student): Path {
  const sc = pathScores(st);
  return (Object.keys(sc) as Path[]).sort((a, b) => sc[b] - sc[a])[0];
}

export interface CareerPlan { studentId: string; recommend: CareerChoice; path: Path }

export function availableChoices(st: Student): CareerChoice[] {
  return [...st.offers, 'stay', 'home', 'merc'];
}

export function acceptRate(st: Student, s?: GameState): number { return Math.min(100, B.career.acceptBase + st.trust * B.career.acceptPerTrust + fx(s, 'careerAccept')); }

export function prepareCareers(s: GameState, rng: Rng): void {
  for (const st of enrolled(s).filter((x) => x.grade === 3)) st.offers = computeOffers(s, rng, st);
}

/** 進路を決めて卒業させる。卒業式のひとことを返す */
export function graduate(s: GameState, rng: Rng, plans: CareerPlan[]): { id: string; text: string }[] {
  const lines: { id: string; text: string }[] = [];
  const third = enrolled(s).filter((x) => x.grade === 3);
  const cohort = third[0]?.cohort ?? s.cohortCount;
  for (const st of third) {
    const plan = plans.find((p) => p.studentId === st.id) ?? { studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) };
    const hope = hopes(s, st).filter((h) => availableChoices(st).includes(h));
    const top = hope[0] ?? 'home';
    let choice: CareerChoice; let mood: 'match' | 'forced' | 'own';
    if (plan.recommend === top) { choice = top; mood = 'match'; }
    else if (rng.next() * 100 < acceptRate(st, s)) { choice = plan.recommend; mood = 'forced'; }
    else { choice = top; mood = 'own'; }
    const growthMul = mood === 'match' ? B.career.matchGrowth : mood === 'forced' ? B.career.forcedGrowth : 0;
    const kind: CareerInfo['kind'] = choice === 'stay' || choice === 'home' || choice === 'merc' ? choice : 'army';
    const country = kind === 'army' ? (choice as CountryId) : kind === 'home' && st.origin !== 'frontier' ? (st.origin as CountryId) : null;
    st.career = {
      kind, country, path: plan.path, rank: 0, rankYears: 0, growthMul, alive: true, retired: false, injuredYears: 0,
      front: kind === 'army' && (country === 'empire' ? rng.chance(0.6) : rng.chance(0.3)),
    };
    st.status = 'graduated'; st.grade = 0;
    // 一番使った武器を持っていく（魔法は本人のものなので、剣・槍・斧・弓などの武器だけ）
    const fav = Object.entries(st.weaponUse).filter(([id]) => WEAPONS[id] && !WEAPONS[id].spell).sort((a, b) => b[1] - a[1])[0];
    st.keepsake = fav ? WEAPONS[fav[0]]?.name ?? null : null;
    if (country && kind === 'army') addFriendship(s, country, B.career.friendshipPerGrad);
    if (mood === 'match') addTrust(st, 5);
    st.farewell = farewell(s, rng, st, choice, mood);
    st.seenTitle = careerTitleOnly(titleOf(st)); st.seenClass = st.classId;
    st.history.push({ year: s.year, text: `リミナ分校を卒業（${st.cohort}期生）。進路：${CHOICE_NAMES[choice]}${kind === 'army' ? `（${PATH_NAMES[plan.path]}）` : ''}` });
    lines.push({ id: st.id, text: st.farewell });
    // 10夜目：気づかずに卒業した芽（年鑑と個人ページに「実は〇〇の芽があった」）
    if (st.bud && !st.bud.done) st.history.push({ year: s.year, text: st.bud.gold ? '実は、金の芽（英雄の器）を持っていた' : `実は、${SKILL_NAMES[st.bud.skill!]}に眠った芽があった` });
    s.stats.graduates += 1;
    if (kind === 'stay') becomeTeacher(s, st);
  }
  // 卒業写真
  const members = Object.values(s.students).filter((x) => x.cohort === cohort);
  s.photos.push({ cohort, year: s.year, ids: members.filter((x) => x.status === 'graduated').map((x) => x.id), empty: members.filter((x) => x.status === 'dead' || x.status === 'dropped').map((x) => x.id) });
  chronicle(s, `${cohort}期生 ${third.length}人が卒業`, 'school');
  s.instructor.experience += third.length;
  return lines;
}

export function autoRecommend(s: GameState, st: Student): CareerChoice {
  const h = hopes(s, st).filter((x) => availableChoices(st).includes(x));
  return h[0] ?? 'home';
}

function farewell(s: GameState, rng: Rng, st: Student, choice: CareerChoice, mood: 'match' | 'forced' | 'own'): string {
  if (st.trust < 20) return '（何も言わずに、静かに去っていった）';
  const d = DREAMS.find((x) => x.id === st.dream)!;
  const where = CHOICE_NAMES[choice];
  const dreamOk = (d.country && (d.country === choice || (d.country === 'home' && st.origin === choice))) || (d.career && d.career === choice);
  if (mood === 'own') return rng.pick([`……先生の勧めとは違う道ですが、${where}へ行きます。見ていてください。`, `自分で決めた道を行きます。${where}で頑張ります。`]);
  if (mood === 'forced') {
    const want = hopes(s, st)[0];
    return `……${CHOICE_NAMES[want]}に行きたかったです。でも、行ってきます。`;
  }
  if (dreamOk && d.text) return rng.pick([`${d.text.replace(/こと$/, '')}、その一歩を踏み出せます。先生のおかげです。`, `夢に近づけました。${where}でも、先生の教えを忘れません。`]);
  if (st.trust >= 70) return rng.pick(['先生に出会えて、本当によかった。いつか恩返しをさせてください。', 'ここで過ごした三年間は、一生の宝物です。']);
  return rng.pick([`${where}へ行きます。お世話になりました。`, `お元気で、先生。${where}で頑張ります。`]);
}

function becomeTeacher(s: GameState, st: Student): void {
  const k: SkillId = bestSkillOf(st);
  s.teachers.push({ id: `t${s.nextId++}`, name: st.given, skill: k, points: st.skills[k], salary: Math.round(250 * B.teachers.alumniSalaryMul), alumniId: st.id, since: s.year });
  chronicle(s, `卒業生の${st.given}が講師として学校に残った`, 'school');
}

export { COUNTRY_SHORT };
