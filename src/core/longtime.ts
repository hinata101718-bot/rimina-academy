// 19夜目⑧：長い時間（蘇り・敵の組織の出来事・先生の代替わり・敵に回る教え子・全盛期と衰え）。DOMに依存しない
import { B } from '../data/balance';
import { REVIVE_WHY, CURSE_WHY, EPITHET_WORDS } from '../data/nemesis';
import { FACTION_NAMES } from '../data/officers';
import { COUNTRY_SHORT } from '../data/people';
import type { GameState, EnemyOfficer } from './state';
import type { CountryId } from './types';
import { Rng } from './rng';
import { officers, officerName, newOfficer, ensureRivalry, alumniOfficer, activeOf } from './officers';
import { memoryOf, setEpithet, pushReunion, reunionLines, moveMind } from './nemesis';
import { chronicle, mail, notify, enrolled, addRep } from './game';
import { decline } from './growth';
import { retireInstructor } from './instructor';
import { makeAlly, yearlyAllies } from './bonds';

/** 年度末にまとめて */
export function yearlyLong(s: GameState, r: Rng, report: string[]): void {
  const L = B.long;
  // ---- 蘇り（名前のある敵だけ・理由つき・一度だけ） ----
  for (const o of officers(s)) {
    if (o.status !== 'dead' || o.kind === 'monster' || o.noRevive) continue;
    if (o.presumed === 'dead' && !o.revived && r.chance(L.revive)) revive(s, r, o, r.pick(REVIVE_WHY), false, report);
    else if (!o.presumed && !o.revived && (o.endYear ?? 0) >= s.year - 8 && Object.values(s.rivalries ?? {}).some((rv) => rv.oid === o.id && rv.stage >= 2) && r.chance(L.curse)) revive(s, r, o, r.pick(CURSE_WHY), true, report);
  }
  // ---- 味方にも：戦死したと思った教え子が、捕らわれて生きていた ----
  for (const st of Object.values(s.students)) {
    const sa = st.secretAlive;
    if (!sa || sa.year > s.year || st.status !== 'dead') continue;
    st.secretAlive = undefined;
    st.status = 'graduated'; st.grade = 0;
    st.career = { kind: 'home', country: null, path: 'warrior', rank: 0, rankYears: 0, growthMul: 0, front: false, alive: true, retired: false, injuredYears: 1 };
    st.diedYear = null; st.deathNote = null;
    (st.scars ??= []).push({ year: s.year, text: '捕らわれていたときの傷' });
    const o = officers(s).find((x) => x.id === sa.by);
    const t = `死んだと思っていた${st.given}が、生きていた！ ${o ? `${officerName(o)}に` : '敵に'}捕らわれていたのだ`;
    st.history.push({ year: s.year, text: t });
    chronicle(s, t, 'student'); report.push(t);
    s.pending.push({ type: 'scene', title: `${st.given}は生きていた`, lines: [{ by: 'narr', text: t, faces: [st.id] }, { by: 'narr', text: 'やせて、目の色が少し変わっていた。それでも、帰ってきた。' }] });
  }
  // ---- 敵の組織：処刑・追放（落ちぶれ）、二代目 ----
  for (const o of officers(s)) {
    if (o.status !== 'active' || o.kind === 'monster' || o.alumniId) continue;
    const m = memoryOf(o);
    if (m.shame.length >= L.exileShame && o.faction !== 'bandit' && r.chance(L.exile)) {
      // 20夜目④：国に追われた宿敵が、正面から戦い続けた学校の味方になることがある
      const bondedNow = Object.values(s.rivalries ?? {}).some((rv) => rv.oid === o.id && !rv.settled && rv.stage >= 1);
      if (bondedNow && o.heart !== 'mad' && r.chance(0.5)) { makeAlly(s, o, 'betrayed', report); continue; }
      const from = FACTION_NAMES[o.faction];
      o.faction = 'bandit'; o.kind = 'bandit'; o.country = null; o.rank = 2; o.heart = 'fallen';
      const ep = setEpithet(s, o, r.pick(EPITHET_WORDS.fallen), `${from}を追われた`, 'fallen');
      const t = `${officerName(o)}は、学校に負け続けた責めを負い、${from}を追われた。盗賊に身を落としても、執念は消えていない`;
      chronicle(s, t, 'world'); report.push(t); if (ep) report.push(ep);
    }
    if (o.age >= B.prime.declineAt) { const st = { age: o.age, stats: { hp: 0, str: o.level, mag: 0, skl: 0, spd: 0, def: 0, res: 0 } }; if (decline(st, r).length) o.level = Math.max(1, o.level - 1); }
  }
  for (const o of officers(s)) {
    if (o.status !== 'dead' || o.endYear !== s.year || o.presumed || o.kind === 'monster' || o.alumniId) continue;
    const bonded = Object.values(s.rivalries ?? {}).some((rv) => rv.oid === o.id && (rv.stage >= 1 || rv.settled));
    if (!bonded || !r.chance(L.heir)) continue;
    const h = newOfficer(s, r, o.faction, Math.min(2, o.rank + 1));
    h.family = o.family; h.heirOf = o.id; h.age = Math.max(20, h.age - 8);
    const killer = o.meets[o.meets.length - 1]?.foes?.[0];
    memoryOf(h).lost.push({ name: o.given, by: killer ?? '', year: s.year });
    if (killer && s.students[killer]) { h.grudge = killer; ensureRivalry(s, killer, h.id).stage = 1; }
    officers(s).push(h);
    const t = `${officerName(o)}の${h.gender === 'f' ? '娘' : '息子'}、${officerName(h)}が名のりをあげた。${killer && s.students[killer] ? `父の仇、${s.students[killer].given}を討つと誓って` : '父の仇を討つと誓って'}`;
    chronicle(s, t, 'world'); report.push(t);
    mail(s, '旅の行商人', `うわさ：${h.given}`, t, killer, false);
  }
  // ---- 20夜目④：恩のある宿敵・国に裏切られた宿敵が、味方になる ----
  yearlyAllies(s, r, report);
  // ---- 全盛期と衰え（卒業生） ----
  for (const st of Object.values(s.students)) if (st.status === 'graduated' && st.career?.alive) decline(st, r);
  // ---- 敵に回る教え子（育て方しだい：信頼・進路の勧め・故郷の事情） ----
  turnAlumni(s, r, report);
}

/** 蘇り。curse＝呪いで蘇る（たまに。姿や名前が少し変わる） */
export function revive(s: GameState, r: Rng, o: EnemyOfficer, why: string, curse: boolean, report: string[]): void {
  o.status = 'active'; o.presumed = null; o.revived = (o.revived ?? 0) + 1; o.reviveNote = why; o.endNote = undefined;
  (o.wounds ??= []).push({ text: curse ? '死の淵から戻った痕' : 'あのときの致命傷の痕', year: s.year });
  if (curse) { o.heart = 'mad'; o.cursed = true; }
  setEpithet(s, o, r.pick(EPITHET_WORDS.revived), curse ? '呪いで蘇った' : '死んだはずが生きていた', 'revived');
  s.nextNemesis = o.id;
  const t = `死んだはずの${officerName(o)}が生きていた。${why}`;
  chronicle(s, t, 'world'); report.push(t);
  const ids = Object.values(s.rivalries ?? {}).filter((rv) => rv.oid === o.id && s.students[rv.sid]?.status === 'enrolled').map((rv) => rv.sid);
  for (const rv of Object.values(s.rivalries ?? {})) if (rv.oid === o.id && rv.settled === 'kill') { rv.settled = null; rv.log.push({ year: s.year, month: s.month, text: '蘇った' }); }
  pushReunion(s, o, ids, 'revived', [t, ...reunionLines(s, o)]);
}

/** 卒業生が敵の将になる（1学年に1人くらい。信頼が低く、勧めを振り切った子・故郷が戦争中の子ほど）
 *  20夜目：軍に入った子だけでなく、故郷へ帰った子・傭兵になった子も、宿敵の陣に加わることがある */
function turnAlumni(s: GameState, r: Rng, report: string[]): void {
  const L = B.long;
  const bonded = Object.values(s.rivalries ?? {}).map((rv) => officers(s).find((o) => o.id === rv.oid)).filter((o): o is EnemyOfficer => !!o && o.status === 'active' && !!o.country && !o.alumniId && !o.allied);
  const cands = Object.values(s.students).filter((st) => st.status === 'graduated' && st.career?.alive && !st.career.retired && !st.career.instructor && ['army', 'home', 'merc'].includes(st.career.kind) && !officers(s).some((o) => o.alumniId === st.id) && s.year - (st.enrollYear + 3) <= L.turnYears);
  for (const st of cands) {
    const k = st.career!.kind;
    // 軍に入った子はその国、故郷へ帰った子は故郷の国、傭兵は宿敵の陣（因縁のある宿敵の国）に
    const home = st.origin !== 'frontier' ? (st.origin as CountryId) : null;
    const nem = bonded.length ? r.pick(bonded) : null;
    const c = (k === 'army' ? st.career!.country : k === 'home' ? home ?? nem?.country : nem?.country ?? home) as CountryId | null;
    if (!c) continue;
    if (activeOf(s, c).filter((o) => o.alumniId).length >= L.turnMax) continue;
    const forced = st.history.some((h) => h.text.includes('勧めを振り切'));
    const mul = k === 'army' ? 1 : k === 'home' ? L.turnHomeMul : L.turnMercMul;
    const p = (L.turnBase + Math.max(0, 50 - st.trust) * L.turnPerDistrust + (forced ? L.turnForced : 0) + (st.betraySign ?? 0) * 0.05 - (st.trust >= 80 ? 0.08 : 0)) * mul;
    if (!r.chance(Math.max(0, p))) continue;
    const o = alumniOfficer(s, st, c, Math.max(0, 2 - Math.floor(st.career!.rank / 2)));
    officers(s).push(o);
    const why = k === 'army' ? `${COUNTRY_SHORT[c]}の将として` : k === 'home' ? `故郷の${COUNTRY_SHORT[c]}の兵を率いて` : `${nem && nem.country === c ? `${officerName(nem)}の陣に雇われ、` : `${COUNTRY_SHORT[c]}に雇われ、`}傭兵の将として`;
    if (k !== 'army') { st.career!.kind = 'army'; st.career!.country = c; st.career!.path = 'warrior'; }
    const t = `卒業生の${st.given}が、${why}学校の前に立ちはだかる`;
    st.history.push({ year: s.year, text: `${why}、学校と刃を交える道へ` });
    chronicle(s, t, 'student'); report.push(t); notify(s, t, st.id);
    addRep(s, B.reputation.turned); // 24夜目②：教え子が敵に回ると、学校の評判も下がる
    // 同級生との因縁（敵国の友・裏切った同級生）
    for (const kk of enrolled(s).concat(Object.values(s.students).filter((x) => x.status === 'graduated' && x.cohort === st.cohort))) if (kk.id !== st.id && kk.cohort === st.cohort) ensureRivalry(s, kk.id, o.id);
  }
}

/** 先生が戦場で倒れた：さらわれることがある（何年もあとに敵として現れることも） */
export function teacherFell(s: GameState, r: Rng, nemesisId: string | null): string | null {
  if (!nemesisId || !r.chance(B.long.teacherCaptured)) return null;
  const ins = s.instructor;
  const o = officers(s).find((x) => x.id === nemesisId);
  s.capturedTeacher = { name: ins.name, by: nemesisId, year: s.year, returnYear: s.year + r.int(...B.long.teacherReturn) };
  const t = `${ins.name}先生が、${o ? officerName(o) : '敵'}にさらわれた……`;
  chronicle(s, t, 'school');
  retireInstructor(s, r);
  for (const st of enrolled(s)) moveMind(st, 'grudge', 10);
  return t;
}
/** さらわれた先代が、敵として戻ってくる */
export function capturedReturns(s: GameState, r: Rng, report: string[]): void {
  const c = s.capturedTeacher;
  if (!c || c.returnYear > s.year || c.done) return;
  c.done = true;
  const o = newOfficer(s, r, (officers(s).find((x) => x.id === c.by)?.faction ?? 'empire') as EnemyOfficer['faction'], 1);
  o.given = c.name.split('・')[0]; o.family = ''; o.epithet = '元教官の'; o.age = 50; o.level += 6; o.heart = 'mad';
  officers(s).push(o);
  for (const st of Object.values(s.students)) if (st.status === 'enrolled' || (st.status === 'graduated' && st.career?.alive)) { if (st.cohort >= (s.year - 10)) ensureRivalry(s, st.id, o.id).stage = 1; }
  const t = `さらわれた先代の${c.name}先生が、${officerName(o)}として敵の陣にいるという`;
  chronicle(s, t, 'school'); report.push(t);
  s.nextNemesis = o.id;
  pushReunion(s, o, [], 'reunion', [t, '教えを受けた者たちは、言葉を失った。']);
}
