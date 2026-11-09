// 卒業生の毎年のシミュレーション
import { nextClasses, recommendedOf, decideClass, deedOk } from './exam';
import { cohortName } from './util';
import { renown } from './renown';
import type { SkillId } from './types';
import { ARM_SKILLS } from '../data/balance';
import { regionMul } from './regions';
import { B } from '../data/balance';
import { CLASSES, CLASS_LIST } from '../data/classes';
import { COUNTRY_SHORT, RANK_TITLES, COUNTRIES } from '../data/people';
import type { CountryId } from './types';
import type { GameState, Student } from './state';
import { Rng } from './rng';
import { gainExp, markClassSeen } from './growth';
import { effectiveStats, chronicle, mail, addFriendship, notify } from './game';
import { tensionStage, atWar } from './world';
import { loveOf } from './support';
import { fx } from './mentor';
import { DEEDS } from '../data/deeds';

export function titleOf(st: Student): string {
  if (!st.career) return '';
  const c = st.career;
  if (!c.alive) return '故人';
  if (c.instructor) return `リミナ分校の教官（${CLASSES[st.classId]?.name ?? ''}）`;
  if (c.retired) return '退役';
  const cls = CLASSES[st.classId]?.name ?? '';
  if (c.kind === 'stay') return `講師（${cls}）`;
  if (c.kind === 'home') return `故郷で暮らす（${cls}）`;
  if (c.kind === 'merc') return `流れの傭兵（${cls}）`;
  const t = RANK_TITLES[c.path];
  return `${COUNTRY_SHORT[c.country!]}・${t[Math.min(c.rank, t.length - 1)]}（${cls}）`;
}

export interface AlumniNews { id: string; text: string; big: boolean }

/** いちばん高い武器の技能（勇士の道） */
function bestArmSkill(st: Student): SkillId { return ARM_SKILLS.filter((k) => k !== 'gun' || st.skills.gun > 0).sort((a, b) => (st.skills[b] ?? 0) - (st.skills[a] ?? 0))[0]; }

/** 20夜目：卒業後の戦いで、最上級の条件の出来事を成し遂げる（上級の卒業生だけ。戦時ほど多い） */
function alumniDeed(s: GameState, rng: Rng, st: Student, clsId: string, news: AlumniNews[]): void {
  const next = CLASS_LIST.find((k) => k.prereq.includes(clsId) && k.tier === 4);
  const D = next?.deed ? DEEDS[next.deed] : null;
  const c = st.career;
  if (!next || !D || !c) return;
  const have = st.deeds?.[D.id] ?? 0;
  if (have >= (next.need ?? 1)) return;
  if (D.kind === 'school') { if (c.kind === 'stay' || c.instructor) { (st.deeds ??= {})[D.id] = 1; st.history.push({ year: s.year, text: D.alumni[0] }); } return; }
  const fighting = c.kind === 'army' || c.kind === 'merc';
  if (!fighting) return;
  const war = !!c.country && COUNTRIES.some((o) => o !== c.country && atWar(s, c.country!, o));
  let p = D.odds * (war || c.kind === 'merc' ? 1 : 1 / 3) * B.alumni.deedMul;
  if (D.id === 'ledArmy' && !(c.kind === 'army' && c.path === 'warrior' && c.rank >= 2)) p *= 0.3;
  if (D.kind === 'spy' && c.path === 'strategist') p *= 2;
  if (!rng.chance(Math.min(0.9, p))) return;
  (st.deeds ??= {})[D.id] = have + 1;
  const text = rng.pick(D.alumni).replace('{a}', c.country ? COUNTRY_SHORT[c.country] : '雇い主');
  if (D.kind === 'count') { if (have + 1 >= (next.need ?? 1)) st.history.push({ year: s.year, text }); return; }
  st.history.push({ year: s.year, text });
  news.push({ id: st.id, text: `${st.given}（${cohortName(st.cohort)}）が${text}`, big: false });
}

/** 20夜目：卒業生の兵種が上がる（最上級は、なる条件の出来事を成し遂げた子だけ） */
function classUp(s: GameState, rng: Rng, st: Student, news: AlumniNews[], big: (st: Student, text: string) => void): void {
  // 兵種：中級・上級は、レベルがそろえば上がる。最上級は、なる条件の出来事を成し遂げた子だけ（20夜目）
  const cls = CLASSES[st.classId];
  if (cls && cls.tier === 3) alumniDeed(s, rng, st, cls.id, news);
  if (cls && cls.tier < 3 && st.level >= (B.exam.levelReq[cls.tier + 1] ?? 99)) {
    // 22夜目：技能の条件を満たす次の段階の兵種から（枝分かれの先でなくても）。先生の勧めは手紙で届き、本人が決める
    const kids = nextClasses(s, st).filter((k) => !k.hidden);
    if (kids.length && rng.chance(0.5)) { const rec = recommendedOf(st, kids) ?? kids[0].id; const next = CLASSES[decideClass(st, rng, rec, kids).id]; st.classId = next.id; markClassSeen(s, next.id); st.history.push({ year: s.year, text: `${next.name}になった` }); }
  } else if (cls && cls.tier === 3 && st.level >= B.alumni.tier4Level) {
    // 最上級：今までどおり、なる条件の出来事も要る（22夜目：ほかの枝の最上級も、技能と出来事がそろえば）
    const own = CLASS_LIST.find((k) => k.prereq.includes(cls.id) && k.tier === 4);
    const next = (own && deedOk(st, own) ? own : null) ?? (nextClasses(s, st).find((k) => k.tier === 4) as typeof own);
    if (next?.deed && (st.deeds?.[next.deed] ?? 0) >= (next.need ?? 1)) {
      st.classId = next.id;
      markClassSeen(s, next.id);
      big(st, `が「${next.unlock}」を成し遂げ、最上級の兵種「${next.name}」になった`);
      chronicle(s, `卒業生の${st.given}が最上級の${next.name}に（${next.unlock}）`, 'student');
      notify(s, `卒業生の${st.given}が最上級の${next.name}になった`, st.id);
      if (st.trust >= 30) mail(s, `${st.given}（${cohortName(st.cohort)}）`, '昇格のお知らせ', promotionLetter(rng, st, next.name, false, false), st.id);
    }
  }
}

export function simulateAlumni(s: GameState, rng: Rng): AlumniNews[] {
  const news: AlumniNews[] = [];
  const stage = tensionStage(s.world.tension);
  const big = (st: Student, text: string) => { news.push({ id: st.id, text: `${st.given}（${cohortName(st.cohort)}）${text}`, big: true }); st.history.push({ year: s.year, text }); };
  for (const st of Object.values(s.students)) {
    if (st.status !== 'graduated' || !st.career || !st.career.alive || st.career.retired) continue;
    if (st.career.instructor) { st.age = s.instructor.age; classUp(s, rng, st, news, big); continue; } // 教官になった教え子は教官として年をとる
    const c = st.career;
    st.age += 1;
    if (c.injuredYears > 0) c.injuredYears -= 1;
    // 経験・レベル
    const key = c.kind === 'army' ? c.path : c.kind;
    const exp = (B.alumni.yearlyExp[key] ?? 60) * (1 + c.growthMul) * (c.front ? 1.2 : 1) * (0.7 + rng.next() * 0.6);
    const before = st.level;
    gainExp(s, rng, st, exp, false);
    if (st.level >= before + 3 && rng.chance(0.2)) st.history.push({ year: s.year, text: `Lv${st.level}に成長` });
    classUp(s, rng, st, news, big);
    if (c.kind === 'army') {
      c.rankYears += 1;
      const max = RANK_TITLES[c.path].length - 1;
      const e = effectiveStats(st);
      let p = B.alumni.promoteBase + (st.level - B.alumni.promoteLevel - c.rank * 7) * 0.02 + c.rankYears * 0.03;
      // 22夜目：文官の出世は人望（平静・信頼・家柄・二つ名）で
      if (c.path === 'civil') p += (renown(st) - B.renown.promoteBase) * B.renown.civilPromote;
      // 10夜目：将は統率、参謀は軍略のランクが出世に大きく効く。勇士は隊長どまりになりやすい
      const A = B.alumni;
      if (c.path === 'warrior') p += ((st.skills.command ?? 0) - A.rankSkillBase) * A.rankSkill;
      if (c.path === 'strategist') p += ((st.skills.tactics ?? 0) - A.rankSkillBase) * A.rankSkill;
      if (c.path === 'champion' && c.rank >= 1) p *= A.championRankMul;
      if (c.country === 'kingdom') p += st.house === 'noble' ? 0.08 : -0.06;
      if (c.country === 'empire') p += 0.05;
      if (c.country === 'alliance') p += (renown(st) - B.renown.promoteBase) * B.renown.allianceMul;
      p += c.growthMul;
      if (c.rank < max && rng.chance(Math.max(0.02, Math.min(0.7, p)))) {
        c.rank += 1; c.rankYears = 0;
        const t = RANK_TITLES[c.path][c.rank];
        const where = c.path === 'warrior' ? `（${rng.pick(['北方軍', '東部方面軍', '第三軍', '国境警備軍', '近衛軍'])}を率いる将に）` : c.path === 'strategist' ? `（${rng.pick(['第三軍', '本営', '北方軍', '西部方面軍'])}の参謀に）` : '';
        if (c.rank >= 2) big(st, `が${COUNTRY_SHORT[c.country!]}の${t}に昇進${where}`); else st.history.push({ year: s.year, text: `${t}に昇進` });
        if (c.rank === max) chronicle(s, `${st.given}が${COUNTRY_SHORT[c.country!]}の${t}に`, 'student');
      }
    }
    // 10夜目：道に合った技能が毎年少しずつ伸びる。統率の低い将の失敗・勇士の武勲
    if (c.kind === 'army' || c.kind === 'merc') {
      const A = B.alumni;
      const k: SkillId = c.path === 'warrior' ? 'command' : c.path === 'strategist' ? 'tactics' : c.path === 'champion' ? bestArmSkill(st) : 'command';
      if (c.path !== 'civil') st.skills[k] = Math.min(700, (st.skills[k] ?? 0) + A.pathSkillYear * (0.7 + rng.next() * 0.6));
      if (c.kind === 'army' && c.path === 'warrior' && c.rank >= 2 && (st.skills.command ?? 0) < A.lowCommandAt && rng.chance(A.lowCommandFail)) { c.rankYears = 0; st.history.push({ year: s.year, text: '兵がついてこず、戦で手痛い目にあった' }); news.push({ id: st.id, text: `${st.given}（${cohortName(st.cohort)}）の隊は、兵がついてこず苦しい戦いになった`, big: false }); }
      if (c.path === 'champion' && stage !== 'peace' && rng.chance(A.championDeed)) big(st, rng.pick(['が単騎で敵陣を破った', 'が一騎打ちで敵の名のある将を退けた', 'が先陣を切って砦の門を破った']));
    }
    // 出来事
    const fighting = c.kind === 'army' || c.kind === 'merc';
    let death = 0;
    if (fighting) {
      death = B.alumni.deathRate[stage] * (c.path === 'warrior' ? 1 : c.path === 'champion' ? 1.1 : 0.4) * (c.front ? B.alumni.frontDeathMul : B.alumni.rearDeathMul);
      // 経験を積んだ卒業生ほど生き残りやすい
      death *= Math.max(B.alumni.veteranMin, 1 - st.level / B.alumni.veteranLevel);
      if (c.country === 'empire' && c.front) death += B.alumni.empireFrontExtra * (stage === 'peace' ? 0.3 : 1);
      if (c.country && COUNTRIES.every((o) => o === c.country || !atWar(s, c.country!, o))) death *= 0.5;
      death *= s.settings.mods.death;
    }
    if (rng.chance(death)) {
      c.alive = false; st.diedYear = s.year;
      st.deathNote = c.country ? `${COUNTRY_SHORT[c.country]}の戦場で戦死` : '戦場で戦死';
      big(st, `が戦死した`);
      chronicle(s, `卒業生の${st.given}が戦死`, 'student');
      if (st.keepsake && rng.chance(0.4)) {
        const w = Object.entries(CLASSES).length ? findWeaponIdByName(st.keepsake) : null;
        if (w) { s.armory.push({ uid: `w${s.nextId++}`, weaponId: w, engraved: st.given }); news.push({ id: st.id, text: `${st.given}の${st.keepsake}が遺品として学校に戻ってきた`, big: true }); }
      }
      continue;
    }
    if (fighting && rng.chance(B.alumni.injuryRate * (stage === 'peace' ? 0.5 : 1.2))) { c.injuredYears = 1; st.history.push({ year: s.year, text: '負傷して療養' }); }
    if (c.kind === 'army' && rng.chance(B.alumni.transferRate)) { c.front = !c.front; st.history.push({ year: s.year, text: c.front ? '前線に転属' : '後方に転属' }); }
    if (c.kind === 'army' && st.trust < 30 && c.country && rng.chance(B.alumni.betrayRate)) {
      const others = COUNTRIES.filter((o) => o !== c.country);
      const to: CountryId = rng.pick(others);
      big(st, `が${COUNTRY_SHORT[c.country]}を離れ、${COUNTRY_SHORT[to]}へ寝返った`);
      c.country = to; c.rank = Math.max(0, c.rank - 1);
    }
    // 結婚
    const love = loveOf(s, st.id);
    if (love && !st.spouse) {
      const p = s.students[love];
      if (p && p.status === 'graduated' && p.career?.alive && !p.spouse && (p.career.country === c.country || rng.chance(0.3)) && rng.chance(B.alumni.marriageRate)) {
        st.spouse = p.id; p.spouse = st.id;
        big(st, `と${p.given}が結婚した`);
        p.history.push({ year: s.year, text: `${st.given}と結婚` });
      }
    }
    if (st.spouse && st.id < st.spouse && st.age <= 42 && rng.chance(B.alumni.childRate / 2)) {
      const p = s.students[st.spouse];
      if (p?.career?.alive) {
        s.heirs.push({ a: st.id, b: p.id, year: s.year + B.alumni.childEnrollAge });
        st.history.push({ year: s.year, text: '子どもが生まれた' }); p.history.push({ year: s.year, text: '子どもが生まれた' });
        news.push({ id: st.id, text: `${st.given}と${p.given}に子どもが生まれた`, big: false });
      }
    }
    // 引退
    const retireAge = B.alumni.retireAge[0] + ((st.id.charCodeAt(st.id.length - 1) * 7) % (B.alumni.retireAge[1] - B.alumni.retireAge[0] + 1));
    if (st.age >= retireAge) { c.retired = true; big(st, 'が引退した'); continue; }
    // 手紙
    if (st.trust >= B.trust.letterAt && rng.chance(B.alumni.letterRate)) mail(s, `${st.given}（${cohortName(st.cohort)}）`, '先生へ', letterBody(rng, st, s), st.id);
    // 後輩への差し入れ（傷薬が届く）
    else if (st.trust >= B.trust.letterAt && rng.chance(B.letters.careChance)) {
      s.items.vulnerary += 2;
      mail(s, `${st.given}（${cohortName(st.cohort)}）`, '後輩たちへの差し入れ', `先生、${c.country ? `${COUNTRY_SHORT[c.country]}の` : ''}町で良い傷薬を見つけたので、少し送ります。後輩たちが無事に帰ってこられますように。—${st.given}（${cohortName(st.cohort)}）（傷薬が2つ武器庫に届いた）`, st.id);
    }
  }
  return news;
}

function findWeaponIdByName(name: string): string | null {
  // 循環参照を避けるため遅延読み込み
  return WEAPON_NAME_INDEX()[name] ?? null;
}
import { WEAPONS } from '../data/weapons';
let _idx: Record<string, string> | null = null;
function WEAPON_NAME_INDEX(): Record<string, string> {
  if (!_idx) { _idx = {}; for (const w of Object.values(WEAPONS)) _idx[w.name] = w.id; }
  return _idx;
}

function promotionLetter(rng: Rng, st: Student, cls: string, nation: boolean, hero: boolean): string {
  const c = st.career!;
  const where = c.country ? COUNTRY_SHORT[c.country] : '';
  const head = hero ? `先生、信じられないかもしれませんが……わたしは「${cls}」と呼ばれるようになりました。` : nation ? `先生、${where}の${cls}に任じられました！ ${where}でも、なれる人はほんのひと握りだそうです。` : `先生、ついに${cls}になりました。`;
  const tail = rng.pick(['学校で最初に剣を握った日のことを、今でも覚えています。', '先生に教わった基本を、毎朝欠かさず続けてきたおかげです。', '後輩たちにも、あきらめなければ届くと伝えてください。']);
  return `${head}${tail}—${st.given}（${cohortName(st.cohort)}）`.replace(/わたし/g, st.gender === 'm' ? '僕' : 'わたし');
}

function letterBody(rng: Rng, st: Student, s?: GameState): string {
  const c = st.career!;
  const where = c.kind === 'army' ? `${COUNTRY_SHORT[c.country!]}で${RANK_TITLES[c.path][Math.min(c.rank, RANK_TITLES[c.path].length - 1)]}をしています` : c.kind === 'home' ? '故郷で元気にやっています' : c.kind === 'merc' ? '傭兵としてあちこちを回っています' : '学校で後輩たちに教えています';
  const extra = rng.pick([
    c.country === 'kingdom' ? '北は寒いです。' : c.country === 'empire' ? '帝都はいつも騒がしいです。' : c.country === 'alliance' ? '港町の市場はにぎやかです。' : '空がきれいです。',
    '後輩たちにもよろしく伝えてください。',
    'ときどき、学校の食堂の味を思い出します。',
    '先生も体に気をつけてください。',
    ...(s && s.world.era === 'peace' ? ['戦のない毎日に、まだ少しとまどっています。でも、悪くないです。'] : s && s.world.tension > B.world.warAbove ? ['前線は厳しいですが、先生の「生きて帰れ」を毎晩思い出しています。'] : []),
    ...(s && s.instructor.generation > 1 ? [`新しい先生にもよろしくお伝えください。${s.instructor.name}先生なら、きっと大丈夫です。`] : []),
  ]);
  return `先生、お元気ですか。${where}。${extra}—${st.given}（${cohortName(st.cohort)}）`;
}

export function aidMoney(s: GameState): Record<CountryId, number> {
  const out = { kingdom: 0, empire: 0, alliance: 0 } as Record<CountryId, number>;
  for (const c of COUNTRIES) {
    const pts = Object.values(s.students).filter((st) => st.status === 'graduated' && st.career?.alive && !st.career.retired && st.career.kind === 'army' && st.career.country === c)
      .reduce((a, st) => a + (B.alumni.rankPoints[st.career!.path][Math.min(st.career!.rank, B.alumni.rankPoints[st.career!.path].length - 1)] ?? 0), 0);
    // 13夜目：地域の多い国ほど豊か（名産）。援助金も少し多い
    let v = (pts * B.school.aidPerRankPoint + s.world.friendship[c] * B.school.aidPerFriendship) * regionMul(s, c);
    if (s.world.friendship[c] <= -20) v = 0;
    if (s.world.vassal === c) v *= B.school.vassalAidMul[c];
    if (s.world.famine) v *= B.world.events.famineAidMul;
    v *= 1 + fx(s, 'aidMul');
    // 十分に潤っている学校への援助は減らされる
    if (s.money > B.school.aidRichFrom) v *= Math.max(B.school.aidRichMin, 1 - (s.money - B.school.aidRichFrom) / B.school.aidRichSpan);
    out[c] = Math.max(0, Math.round(v));
  }
  return out;
}
export { addFriendship };
