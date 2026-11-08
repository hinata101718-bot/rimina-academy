// ゲームの流れ：週→月末の戦闘→月の終わり→年度末→入学試験
import { B } from '../data/balance';
import { BACKGROUNDS, COUNTRIES, COUNTRY_SHORT, COUNTRY_NAMES, SKILL_NAMES } from '../data/people';
import { WEAPONS } from '../data/weapons';
import type { CountryId, SkillId } from './types';
import type { GameState, Quest, Student, GrowthEntry } from './state';
import { Rng } from './rng';
import { enrolled, addMoney, addRep, chronicle, notify, enrollCohort, capacity, mail, available } from './game';
import { resolveWeek, startMonthStudents, changeMotivation, revealTalent, addSkill } from './week';
import { rollQuests } from './quests';
import { addSupport, addRecent, getSupport, pruneArchive } from './support';
import { gainExp, startGrowthLog, stopGrowthLog, snapGrowth, diffGrowth } from './growth';
import { learnSpells } from './spells';
import { createBattle, unitFromStudent, defaultWeaponFor, type Deploy } from './battle/setup';
import { startPlayerPhase, setReinforcementFactory, weaponSkillId } from './battle/engine';
import { monthlyWorld, yearlyWorld, questWorldEffect, tensionStage, activeAlumni } from './world';
import { simulateAlumni, aidMoney, titleOf } from './alumni';
import { prepareCareers, graduate, type CareerPlan } from './career';
import { generateStudent } from './student';
import { rollTeacherCandidates, monthlySalaries, yearlyRaises } from './teachers';
import { absMonth, MONTH_NAMES } from './util';
import { retireCheck, viceOf, cleanVice } from './instructor';
import { checkEndings, peaceEraYear } from './ending';
import { TRAITS } from '../data/people';
import type { BattleCtx } from './battle/engine';
import { supportValue } from './support';

export function rng(s: GameState): Rng { return new Rng(s); }

export function battleCtx(s: GameState): BattleCtx {
  return {
    support: (a, b) => supportValue(s, a, b),
    trust: (id) => s.students[id]?.trust ?? 0,
    luckInjury: (id) => (s.students[id]?.traits ?? []).reduce((a, t) => a + (TRAITS[t].injuryBonus ?? 0), 0),
    deathMul: s.settings.mods.death,
  };
}

/** 「次の週へ」 */
export function nextWeek(s: GameState): void {
  if (s.pending.length || s.battle || s.gameOver) return;
  const r = rng(s);
  const res = resolveWeek(s, r);
  s.pending.push({ type: 'weekSummary', lines: res.lines.length ? res.lines : ['穏やかな一週間だった'], talks: res.talks, growth: res.growth });
  s.absWeek += 1;
  if (s.week >= 4) {
    s.quests = rollQuests(s);
    s.pending.push({ type: 'questBoard' });
  } else s.week += 1;
  if (s.guideStep < 99 && s.year === 1 && s.month === 0) s.guideStep += 1;
}

/** 戦闘を始める */
export function startBattle(s: GameState, questId: string, deploys: Deploy[]): void {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) return;
  const r = rng(s);
  s.battle = createBattle(s, q, deploys, r.int(1, 2 ** 30));
  setReinforcementFactory((b) => {
    const st = b.reinforcement ? s.students[b.reinforcement] : null;
    if (!st) return null;
    const u = unitFromStudent(st, 'ally', `ally_${st.id}`, 0, 0, [defaultWeaponFor(st)]);
    u.name = `${st.given}（卒業生）`;
    return u;
  });
  startPlayerPhase(s.battle);
  s.pending = s.pending.filter((p) => p.type !== 'questBoard');
}

export function ensureReinforcementFactory(s: GameState): void {
  setReinforcementFactory((b) => {
    const st = b.reinforcement ? s.students[b.reinforcement] : null;
    if (!st) return null;
    const u = unitFromStudent(st, 'ally', `ally_${st.id}`, 0, 0, [defaultWeaponFor(st)]);
    u.name = `${st.given}（卒業生）`;
    return u;
  });
}

function gradeFor(score: number): string { return score >= 9 ? 'S' : score >= 5 ? 'A' : score >= 2 ? 'B' : 'C'; }

/** 戦闘の結果を学校に反映する */
export function finishBattle(s: GameState): void {
  const b = s.battle;
  if (!b || b.phase !== 'done') return;
  const r = rng(s);
  const q = s.quests.find((x) => x.id === b.questId);
  const win = b.result === 'win';
  const lines: string[] = [];
  const grades: { id: string; grade: string; note: string }[] = [];
  const expMul = b.real ? 1 : B.battle.drillExpMul;
  lines.push(win ? `勝利！「${b.title}」` : `敗北……「${b.title}」`);
  if (win) s.stats.battlesWon++; else s.stats.battlesLost++;
  const growth: GrowthEntry[] = [];
  startGrowthLog();

  for (const u of b.units) {
    if (!u.studentId || u.side === 'enemy' && !u.persuadable) continue;
    const st = s.students[u.studentId];
    if (!st) continue;
    if (st.status === 'graduated') {
      const f = b.fallen.find((x) => x.studentId === st.id);
      if (f && st.career) {
        if (f.outcome === 'dead') { st.career.alive = false; st.diedYear = s.year; st.deathNote = '戦場で戦死'; chronicle(s, `卒業生の${st.given}が戦場で倒れた`, 'student'); lines.push(`卒業生の${st.given}が戦死した……`); }
        else { st.career.injuredYears = 1; lines.push(`卒業生の${st.given}は重傷を負った`); }
        if (u.persuadable && st.career.country) { s.world.friendship[st.career.country] = Math.max(-50, s.world.friendship[st.career.country] - 10); }
      }
      if (u.side === 'ally' && !u.persuadable) st.history.push({ year: s.year, text: `「${b.title}」で後輩たちと共に戦った` });
      continue;
    }
    if (st.status !== 'enrolled') continue;
    const snap = snapGrowth(st);
    st.battles += 1;
    st.kills += u.kills;
    for (const [w, n] of Object.entries(u.usedWeapon)) {
      st.weaponUse[w] = (st.weaponUse[w] ?? 0) + n;
      const def = WEAPONS[w];
      if (def) addSkill(st, weaponSkillId(def.type) as SkillId, n * 4 * B.motivationMul[st.motivation]);
      if (def && st.talent) revealTalent(s, st, B.talent.battleReveal / 2);
    }
    const ups = gainExp(s, r, st, u.expGain * expMul);
    growth.push(diffGrowth(st, snap, learnSpells(s, st)));
    for (const up of ups) lines.push(`${st.given}がLv${up.level}に上がった（${Object.entries(up.gains).map(([k, v]) => `${k}+${v}`).join(' ') || '変化なし'}）`.replace(/hp/g, 'HP').replace(/str/g, '力').replace(/mag/g, '魔力').replace(/skl/g, '技').replace(/spd/g, '速さ').replace(/lck/g, '幸運').replace(/def/g, '守備').replace(/res/g, '魔防').replace(/cha/g, '魅力'));
    const f = b.fallen.find((x) => x.studentId === st.id);
    const score = u.kills * 3 + u.hits + u.dmgDealt / 12 - (f ? 3 : 0) + (u.expGain >= 40 ? 1 : 0);
    const g = gradeFor(score);
    st.bestGrade = !st.bestGrade || 'SABC'.indexOf(g) < 'SABC'.indexOf(st.bestGrade) ? g : st.bestGrade;
    const note = f?.outcome === 'dead' ? '帰らぬ人となった' : f?.outcome === 'injured' ? '重傷を負ったが、命はとりとめた' : u.kills >= 2 ? '見事な戦いぶりだった' : u.hits ? '堅実に役目を果たした' : '次はもっと活躍できるはず';
    grades.push({ id: st.id, grade: g, note });
    if (g === 'S' || g === 'A') changeMotivation(st, 1);
    if (q?.kind === 'exhibition') { st.exhibitionScore += score; }
    if (f?.outcome === 'dead') killStudent(s, st, `「${b.title}」で戦死`);
    else if (f?.outcome === 'injured') {
      st.injuredWeeks = r.int(...B.battle.injuryWeeks);
      addRecent(s, st, 'ev_injury', b.title);
      lines.push(`${st.given}は重傷（${st.injuredWeeks}週間休み）`);
    }
    if (u.hp < u.maxHp / 2 && !f) {
      const helper = b.units.find((o) => o !== u && o.studentId && !o.dead && o.side === 'player' && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) <= 1);
      if (helper?.studentId) addRecent(s, st, 'ev_cover', helper.name, helper.studentId);
    }
  }
  stopGrowthLog();
  // 支援：隣接して戦った組
  for (const [k, n] of Object.entries(b.adjacencyPairs)) {
    const [a, c] = k.split('|');
    if (s.students[a]?.status === 'enrolled' && s.students[c]?.status === 'enrolled') {
      const t = addSupport(s, r, a, c, B.support.adjacentBattle * Math.min(3, n));
      if (t) s.pending.push({ type: 'talk', talk: t });
    }
  }
  // 同じ敵を倒した
  for (const [eid, hitters] of Object.entries(b.hitBy)) {
    const e = b.units.find((x) => x.uid === eid);
    if (!e?.dead || hitters.length < 2) continue;
    const ids = hitters.map((h) => b.units.find((x) => x.uid === h)?.studentId).filter((x): x is string => !!x && s.students[x]?.status === 'enrolled');
    if (ids.length >= 2) { addRecent(s, s.students[ids[0]], 'ev_samekill', e.name, ids[1]); addRecent(s, s.students[ids[1]], 'ev_samekill', e.name, ids[0]); }
  }
  // 手に入れた武器
  for (const w of b.visitedChestLog ?? []) { s.armory.push({ uid: `w${s.nextId++}`, weaponId: w }); lines.push(`武器庫に「${WEAPONS[w].name}」が加わった`); }
  // 報酬・評判・戦況
  if (q) {
    if (q.kind === 'exhibition') {
      addRep(s, win ? r.int(...B.reputation.exhibition) : 1);
      const ranked = [...grades].sort((a, c) => 'SABC'.indexOf(a.grade) - 'SABC'.indexOf(c.grade));
      for (const gr of ranked.slice(0, 3)) {
        const st = s.students[gr.id];
        const c: CountryId = r.weighted(COUNTRIES, (x) => 10 + Math.max(0, s.world.friendship[x]) + (s.world.vassal === x ? 30 : 0));
        if (!st.offers.includes(c)) st.offers.push(c);
        lines.push(`観覧席の${COUNTRY_SHORT[c]}の関係者が、${st.given}に声をかけた`);
      }
    } else if (q.kind === 'schoolDefense') {
      s.world.schoolDefensePending = false;
      if (win) { addRep(s, B.reputation.schoolDefenseWin); s.world.defenseWonYear = s.year; chronicle(s, '学校防衛戦に勝利', 'school'); lines.push(`学校を守り抜いた！ 評判+${B.reputation.schoolDefenseWin}`); }
      else { addRep(s, -5); s.money = Math.round(s.money * 0.7); chronicle(s, '学校防衛戦に敗れ、校舎が荒らされた', 'school'); lines.push('校舎が荒らされた……（お金−30%、評判−5）'); }
    } else if (q.real) {
      if (win) {
        const bg = BACKGROUNDS.find((x) => x.id === s.instructor.background);
        const reward = Math.round(q.reward * (bg?.realRewardMul ?? 1));
        const before = s.money; addMoney(s, reward);
        const rep = B.reputation.questWinByDanger[q.danger] ?? 1;
        addRep(s, rep);
        lines.push(`報酬 ${s.money - before}G、評判+${rep}`);
        lines.push(...questWorldEffect(s, q.clientCountry, q.enemyCountry, true));
      } else { addRep(s, B.reputation.questLose); lines.push(`依頼は失敗。評判${B.reputation.questLose}`); }
    }
  }
  s.pending.push({ type: 'battleResult', lines, grades, win, growth });
  s.battle = null;
  if (q?.kind === 'schoolDefense' && win) checkEndings(s, r, 'month');
  endMonth(s);
}

export function killStudent(s: GameState, st: Student, note: string): void {
  st.status = 'dead'; st.diedYear = s.year; st.deathNote = note;
  s.stats.deaths += 1;
  addRep(s, B.reputation.deathInSchool);
  chronicle(s, `${st.given}が${note}`, 'student');
  s.pinned = s.pinned.filter((x) => x !== st.id);
  for (const o of enrolled(s)) {
    const v = supportValue(s, o.id, st.id);
    if (v >= B.support.C || o.grade === st.grade) { changeMotivation(o, -1); addRecent(s, o, 'ev_loss', st.given); }
  }
}

/** 月の終わり（戦闘のあと） */
export function endMonth(s: GameState): void {
  const r = rng(s);
  if (s.month === 11) {
    // 3月：進路決定へ
    prepareCareers(s, r);
    if (enrolled(s).some((x) => x.grade === 3)) s.pending.push({ type: 'career' });
    else yearEnd(s, []);
    return;
  }
  s.month += 1; s.week = 1;
  startMonth(s);
}

export function startMonth(s: GameState): void {
  const r = rng(s);
  const lines: string[] = [];
  lines.push(...monthlySalaries(s));
  lines.push(...monthlyWorld(s, r));
  checkEndings(s, r, 'month');
  lines.push(...startMonthStudents(s, r));
  s.quests = rollQuests(s);
  // 月の始めの自動の重点科目（未設定なら前月のまま）
  for (const g of [1, 2, 3]) if (!s.focus[g]) s.focus[g] = ['sword', 'lance'];
  // 副教官（担任）が担当学年の重点科目を決める（教官はその月の間いつでも変えられる）
  cleanVice(s);
  for (const g of [1, 2, 3]) {
    const v = viceOf(s, g);
    if (!v) continue;
    const list = enrolled(s).filter((x) => x.grade === g);
    const count: Record<string, number> = {};
    for (const st of list) for (const k of st.targets) count[k] = (count[k] ?? 0) + 1;
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]).map((x) => x[0] as SkillId);
    if (top.length >= 2) s.focus[g] = [top[0], top[1]];
    else if (top.length === 1) s.focus[g] = [top[0], v.t.skill === top[0] ? (s.focus[g]?.[1] ?? 'sword') : v.t.skill];
  }
  if (s.month === 3) notify(s, '7月は夏の合宿：授業の伸びと疲労が1.5倍');
  if (s.month === 5) notify(s, '9月は公開演武会：月末の戦闘で活躍すると各国から声がかかる');
  if (s.month === 8) notify(s, '12月は冬の収穫祭：週末の交流が1回多く、支援が上がりやすい');
  if (s.month === 11) notify(s, '3月は卒業の月：3年生の進路を決めよう');
}

/** 年度末（卒業式のあと） */
export function finishCareers(s: GameState, plans: CareerPlan[]): void {
  const r = rng(s);
  const cohort = enrolled(s).find((x) => x.grade === 3)?.cohort ?? 0;
  const lines = graduate(s, r, plans);
  s.pending = s.pending.filter((p) => p.type !== 'career');
  s.pending.push({ type: 'graduation', cohort, lines });
  yearEnd(s, lines.map((l) => l.id));
}

export function yearEnd(s: GameState, graduated: string[]): void {
  const r = rng(s);
  // 2. 進級
  for (const st of enrolled(s)) { st.grade += 1; st.age += 1; }
  // 3. 卒業生
  const news = simulateAlumni(s, r);
  // 4. 戦況
  const world = yearlyWorld(s, r);
  // お金：援助金と寄付
  const aid = aidMoney(s);
  const aidTotal = COUNTRIES.reduce((a, c) => a + aid[c], 0);
  const donation = Math.round(s.reputation * B.school.donationPerRep);
  const before = s.money;
  addMoney(s, aidTotal + donation);
  // 評判：卒業生の昇進
  const promo = news.filter((n) => n.text.includes('昇進')).length;
  if (promo) addRep(s, Math.min(B.reputation.promotionMax, promo));
  // 友好度：その国にいる卒業生が少ないと、少しずつ下がる（三国と均等に付き合うほど高く保てる）
  for (const c of COUNTRIES) {
    const D = B.school.friendshipDrift;
    const target = Math.min(100, D.base + D.perAlumni * activeAlumni(s, c).length);
    if (s.world.friendship[c] > target) s.world.friendship[c] -= (s.world.friendship[c] - target) * D.rate;
  }
  // 評判は放っておくと少しずつ落ち着く（高いほど維持が難しい）
  if (s.reputation > B.reputation.decayFloor) addRep(s, -(s.reputation - B.reputation.decayFloor) * B.reputation.yearlyDecay);
  // 6. 教官の加齢（50歳から年度末に引退を選べる。65歳で必ず引退）
  s.instructor.age += 1;
  if (s.instructor.studentId && s.students[s.instructor.studentId]) s.students[s.instructor.studentId].age = s.instructor.age;
  const rc = retireCheck(s);
  pruneArchive(s);
  yearlyRaises(s);
  // 8. 廃校期限
  const deadline: string[] = [];
  if (s.year === B.school.deadlineYear && !s.world.vassal && !s.noDeadline) {
    if (s.reputation >= B.school.deadlineRep) { deadline.push('評判が目標に届き、廃校の危機を乗り越えた！'); chronicle(s, '廃校の危機を乗り越えた', 'school'); }
    else {
      const best = [...COUNTRIES].sort((a, c) => s.world.friendship[c] - s.world.friendship[a] || activeAlumni(s, c).length - activeAlumni(s, a).length)[0];
      s.world.vassal = best;
      for (const c of COUNTRIES) if (c !== best) s.world.friendship[c] = Math.max(-50, s.world.friendship[c] + B.school.vassalOtherFriendship);
      deadline.push(`評判が目標に届かず、学校は${COUNTRY_NAMES[best]}の傘下に入って存続することになった。`);
      chronicle(s, `${COUNTRY_SHORT[best]}の傘下に入る`, 'school');
      s.pending.push({ type: 'event', title: '傘下入り', lines: [deadline[0], '傘下の国以外からの依頼や声かけが減る。評判を70以上にすれば、年度末に独立を取り戻せる。'] });
    }
  } else if (s.world.vassal && s.reputation >= B.school.independenceRep) {
    const v = s.world.vassal;
    s.world.friendship[v] = Math.max(-50, s.world.friendship[v] + B.school.independencePenalty);
    s.world.vassal = null;
    deadline.push('学校は独立を宣言し、中立を取り戻した！');
    chronicle(s, '独立を取り戻した', 'school');
    s.pending.push({ type: 'event', title: '独立の宣言', lines: [`評判が十分に高まり、学校は${COUNTRY_NAMES[v]}の傘下から抜けて中立に戻った。`] });
  }
  // 三国からの書簡
  for (const c of COUNTRIES) {
    if (s.world.friendship[c] <= B.pressureAt) mail(s, `${COUNTRY_NAMES[c]}の使者`, '警告の書簡', `貴校は我が国と敵対する国に肩入れしすぎている。このままでは援助を打ち切り、貴校の卒業生の受け入れも考え直さざるを得ない。—${COUNTRY_NAMES[c]}`);
    const others = COUNTRIES.filter((o) => o !== c);
    if (!s.world.vassal && others.every((o) => s.world.friendship[c] - s.world.friendship[o] >= B.vassalInviteGap)) mail(s, `${COUNTRY_NAMES[c]}の使者`, '傘下への誘い', `貴校と我が国の縁は深い。我が国の傘下に入れば、十分な援助を約束しよう。考えておいてほしい。—${COUNTRY_NAMES[c]}`);
  }
  // 5. 新聞
  const headline = world.find((x) => !x.startsWith('大陸は')) ?? world[0] ?? '大陸は静かな一年だった';
  const paper = {
    id: `news${s.nextId++}`, year: s.year, month: 11, headline: `${s.year}年度 年度末特別号：${headline}`,
    body: [
      ...world,
      `三国の国力：王国${Math.round(s.world.power.kingdom)}・帝国${Math.round(s.world.power.empire)}・同盟${Math.round(s.world.power.alliance)}`,
      `学校の収入：援助金${aidTotal}G・寄付${donation}G（所持金 ${before}G → ${s.money}G）`,
      ...deadline,
    ],
    alumni: news.filter((n) => n.big).slice(0, 12).map((n) => ({ id: n.id, text: n.text })),
    tension: Math.round(s.world.tension),
  };
  s.news.unshift(paper);
  s.pending.push({ type: 'newspaper', id: paper.id });
  s.world.epidemic = false; s.world.famine = false;
  // エンディングの判定（年度末）。平和な時代は、まれに再び戦の気配
  peaceEraYear(s, r);
  checkEndings(s, r, 'year');
  // 9. 新年度
  s.year += 1; s.month = 0; s.week = 1;
  for (const st of Object.values(s.students)) if (st.status === 'enrolled') st.offers = st.grade === 3 ? st.offers : st.offers;
  if (rc.can) s.pending.push({ type: 'retire', forced: rc.forced });
  prepareEntrance(s);
  rollTeacherCandidates(s, r);
  startMonth(s);
  void graduated; void MONTH_NAMES; void absMonth; void tensionStage; void titleOf; void mail; void SKILL_NAMES; void getSupport; void available;
}

/** 入学試験の志願者 */
export function prepareEntrance(s: GameState): void {
  const r = rng(s);
  const cap = capacity(s);
  const n = Math.max(cap, Math.round(cap * (1 + s.reputation / 40)));
  const quality = Math.min(1, s.reputation / 100);
  const stage = tensionStage(s.world.tension);
  const orphanBias = (stage === 'tension' ? 10 : stage === 'war' ? 25 : 0) + (s.world.famine ? 20 : 0);
  s.applicants = [];
  // 卒業生の子
  for (const h of s.heirs.filter((x) => x.year === s.year)) {
    const a = s.students[h.a], b = s.students[h.b];
    if (a && b) { const c = generateStudent(s, r, { parents: [a, b], quality }); c.age = 18; c.birthYear = s.year - 18; s.applicants.push(c); a.children.push(c.id); b.children.push(c.id); }
  }
  const vassalOrigin = s.world.vassal;
  while (s.applicants.length < n) {
    const origin = vassalOrigin && r.chance(0.35) ? vassalOrigin : undefined;
    s.applicants.push(generateStudent(s, r, { quality, orphanBias, origin }));
  }
  s.pending.push({ type: 'entrance' });
}

export function admit(s: GameState, ids: string[]): void {
  const cap = capacity(s);
  const chosen = s.applicants.filter((a) => ids.includes(a.id)).slice(0, cap);
  enrollCohort(s, chosen);
  for (const c of chosen) {
    for (const pid of c.parents) { const p = s.students[pid]; if (p) p.history.push({ year: s.year, text: `子の${c.given}がリミナ分校に入学` }); }
  }
  chronicle(s, `${s.cohortCount}期生 ${chosen.length}人が入学`, 'school');
  s.applicants = [];
  s.pending = s.pending.filter((p) => p.type !== 'entrance');
}

export function autoAdmitIds(s: GameState): string[] {
  const score = (st: Student) => Object.values(st.stats).reduce((a, b) => a + b, 0) + (st.parents.length ? 50 : 0);
  return [...s.applicants].sort((a, b) => score(b) - score(a)).slice(0, capacity(s)).map((x) => x.id);
}

export type { Quest };
