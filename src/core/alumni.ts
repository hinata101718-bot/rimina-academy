// 卒業生の毎年のシミュレーション
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

export function simulateAlumni(s: GameState, rng: Rng): AlumniNews[] {
  const news: AlumniNews[] = [];
  const stage = tensionStage(s.world.tension);
  const big = (st: Student, text: string) => { news.push({ id: st.id, text: `${st.given}（${st.cohort}期生）${text}`, big: true }); st.history.push({ year: s.year, text }); };
  for (const st of Object.values(s.students)) {
    if (st.status !== 'graduated' || !st.career || !st.career.alive || st.career.retired) continue;
    if (st.career.instructor) { st.age = s.instructor.age; continue; } // 教官になった教え子は教官として年をとる
    const c = st.career;
    st.age += 1;
    if (c.injuredYears > 0) c.injuredYears -= 1;
    // 経験・レベル
    const key = c.kind === 'army' ? c.path : c.kind;
    const exp = (B.alumni.yearlyExp[key] ?? 60) * (1 + c.growthMul) * (c.front ? 1.2 : 1) * (0.7 + rng.next() * 0.6);
    const before = st.level;
    gainExp(s, rng, st, exp, false);
    if (st.level >= before + 3 && rng.chance(0.2)) st.history.push({ year: s.year, text: `Lv${st.level}に成長` });
    // 最上級兵種
    const cls = CLASSES[st.classId];
    if (cls && cls.tier < 4 && st.level >= (B.exam.levelReq[cls.tier + 1] ?? B.alumni.tier4Level)) {
      const kids = CLASS_LIST.filter((k) => k.prereq.includes(cls.id) && (!k.needGun || s.world.gunUnlocked) && (!k.hidden || st.talent === 'hero') && (!k.nation || k.nation === c.country));
      if (kids.length && rng.chance(0.5)) {
        const nation = kids.filter((k) => k.nation);
        const next = nation.length && rng.chance(0.5) ? rng.pick(nation) : rng.pick(kids);
        st.classId = next.id;
        markClassSeen(s, next.id);
        if (next.tier >= 4) {
          big(st, `が${next.nation ? `${COUNTRY_SHORT[next.nation]}だけの兵種、` : next.hidden ? '伝説の兵種、' : '最上級の兵種、'}${next.name}になった`);
          notify(s, `卒業生の${st.given}が${next.name}に昇格した`, st.id);
          if (st.trust >= 30) mail(s, `${st.given}（${st.cohort}期生）`, '昇格のお知らせ', promotionLetter(rng, st, next.name, !!next.nation, !!next.hidden), st.id);
          if (next.hidden || next.nation) chronicle(s, `卒業生の${st.given}が${next.name}に`, 'student');
        }
        else st.history.push({ year: s.year, text: `${next.name}になった` });
      }
    }
    if (c.kind === 'army') {
      c.rankYears += 1;
      const max = RANK_TITLES[c.path].length - 1;
      const e = effectiveStats(st);
      let p = B.alumni.promoteBase + (st.level - B.alumni.promoteLevel - c.rank * 7) * 0.02 + c.rankYears * 0.03;
      if (c.path === 'civil') p += (e.cha - 10) * 0.015 + (st.house === 'noble' ? 0.05 : 0);
      if (c.path === 'strategist') p += (e.skl + e.mag - 20) * 0.008;
      if (c.country === 'kingdom') p += st.house === 'noble' ? 0.08 : -0.06;
      if (c.country === 'empire') p += 0.05;
      if (c.country === 'alliance') p += (e.cha - 10) * 0.01;
      p += c.growthMul;
      if (c.rank < max && rng.chance(Math.max(0.02, Math.min(0.7, p)))) {
        c.rank += 1; c.rankYears = 0;
        const t = RANK_TITLES[c.path][c.rank];
        if (c.rank >= 2) big(st, `が${COUNTRY_SHORT[c.country!]}の${t}に昇進`); else st.history.push({ year: s.year, text: `${t}に昇進` });
        if (c.rank === max) chronicle(s, `${st.given}が${COUNTRY_SHORT[c.country!]}の${t}に`, 'student');
      }
    }
    // 出来事
    const fighting = c.kind === 'army' || c.kind === 'merc';
    let death = 0;
    if (fighting) {
      death = B.alumni.deathRate[stage] * (c.path === 'warrior' ? 1 : 0.4) * (c.front ? B.alumni.frontDeathMul : B.alumni.rearDeathMul);
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
    if (st.trust >= B.trust.letterAt && rng.chance(B.alumni.letterRate)) mail(s, `${st.given}（${st.cohort}期生）`, '先生へ', letterBody(rng, st, s), st.id);
    // 後輩への差し入れ（傷薬が届く）
    else if (st.trust >= B.trust.letterAt && rng.chance(B.letters.careChance)) {
      s.items.vulnerary += 2;
      mail(s, `${st.given}（${st.cohort}期生）`, '後輩たちへの差し入れ', `先生、${c.country ? `${COUNTRY_SHORT[c.country]}の` : ''}町で良い傷薬を見つけたので、少し送ります。後輩たちが無事に帰ってこられますように。—${st.given}（${st.cohort}期生）（傷薬が2つ武器庫に届いた）`, st.id);
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
  return `${head}${tail}—${st.given}（${st.cohort}期生）`.replace(/わたし/g, st.gender === 'm' ? '僕' : 'わたし');
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
  return `先生、お元気ですか。${where}。${extra}—${st.given}（${st.cohort}期生）`;
}

export function aidMoney(s: GameState): Record<CountryId, number> {
  const out = { kingdom: 0, empire: 0, alliance: 0 } as Record<CountryId, number>;
  for (const c of COUNTRIES) {
    const pts = Object.values(s.students).filter((st) => st.status === 'graduated' && st.career?.alive && !st.career.retired && st.career.kind === 'army' && st.career.country === c)
      .reduce((a, st) => a + (B.alumni.rankPoints[st.career!.path][Math.min(st.career!.rank, B.alumni.rankPoints[st.career!.path].length - 1)] ?? 0), 0);
    let v = pts * B.school.aidPerRankPoint + s.world.friendship[c] * B.school.aidPerFriendship;
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
