// ゲームの流れ：週→月末の戦闘→月の終わり→年度末→入学試験
import { gainMastery } from './evolve';
import { loseCombos } from './combo';
import { B } from '../data/balance';
import { BACKGROUNDS, COUNTRIES, COUNTRY_SHORT, COUNTRY_NAMES, SKILL_NAMES } from '../data/people';
import { WEAPONS } from '../data/weapons';
import type { CountryId, SkillId } from './types';
import type { GameState, Quest, Student, GrowthEntry, BattleFinding, TalkLog, SquadPlan, BattleReport } from './state';
import { SQUADS, STRAT } from '../data/stratagems';
import { checkStratUnlocks, addStrat, addCommand, awayJudgeRate } from './stratagems';
import { checkBloom } from './aptitude';
import { evaluateBattle } from './evaluate';
import { rollLoot, takeLoot, repGift } from './loot';
import { yearlyRegions, questRegionResult } from './regions';
import { rivalryOf } from './officers';
import { LESSON_BY_ID } from '../data/lessons';
import { specialInterview } from './interview';
const LESSON_NAME: Record<string, string> = Object.fromEntries(Object.values(LESSON_BY_ID).map((l) => [l.id, l.name]));
import { Rng } from './rng';
import { enrolled, addMoney, addRep, chronicle, notify, enrollCohort, capacity, mail, available, deployLimit } from './game';
import { startMonthStudents, changeMotivation, revealTalent, addSkill, autoMonthTargets } from './week';
import { resolveLesson, advanceDay, recommendCard, todayCards, type DayOutcome } from './lessons';
import { rollQuests } from './quests';
import { addSupport, addRecent, getSupport, pruneArchive } from './support';
import { gainExp, startGrowthLog, stopGrowthLog, snapGrowth, diffGrowth } from './growth';
import { learnSpells } from './spells';
import { createBattle, unitFromStudent, defaultWeaponFor, type Deploy } from './battle/setup';
import { startPlayerPhase, setReinforcementFactory, weaponSkillId } from './battle/engine';
import { startAutoBattle, setCardReinforce, isCardMode, defaultPlan, applyAutoResults, setupLeader, officerAfterBattle, officerForQuest, questSeed, skipAuto, type AutoPlan, type AwayCall } from './battle/auto';
import type { BattleState } from './battle/types';
import { ensureRosters, yearlyOfficers, revealOne } from './officers';
import { fx } from './mentor';
import { publishIssue } from './newspaper';
import { rollSides, deferShows } from './discovery';
import { monthlyWorld, yearlyWorld, questWorldEffect, tensionStage, activeAlumni } from './world';
import { simulateAlumni, aidMoney, titleOf } from './alumni';
import { prepareCareers, graduate, type CareerPlan } from './career';
import { generateStudent } from './student';
import { rollTeacherCandidates, monthlySalaries, yearlyRaises } from './teachers';
import { absMonth, MONTH_NAMES, rankOf } from './util';
import { retireCheck, viceOf, cleanVice } from './instructor';
import { checkEndings, peaceEraYear, seedHelp } from './ending';
import { TRAITS } from '../data/people';
import type { BattleCtx } from './battle/engine';
import { supportValue, bestFriend } from './support';
import { closeYear, markYear } from './review';
import { senpaiLetters } from './senpai';
import { yearlyLegends, unclaimedLegend, legendLoot } from './rarity';
import { tip, checkTips, firstTalk as tutorialTalk, tutorialMonth } from './tutorial';
import { NIGHT_AFTER_DEATH, FRIEND_GRIEF, TEACHER_GRIEF, KEEPSAKE, RECOVERY } from '../data/aftermath_war';

export function rng(s: GameState): Rng { return new Rng(s); }

/** 今月の依頼を並べる。先生の「斥候の心得」があれば、敵将の特徴が1つ見える（8夜目） */
export function freshQuests(s: GameState): void {
  s.quests = rollQuests(s);
  const n = fx(s, 'scout');
  if (!n) return;
  for (const q of s.quests) {
    if (!q.real) continue;
    const o = officerForQuest(s, q);
    if (!o) continue;
    for (let i = 0; i < n; i++) revealOne(o, new Rng({ rng: questSeed(s, q) ^ (0x51 + i) }));
  }
}

export function battleCtx(s: GameState): BattleCtx {
  return {
    support: (a, b) => supportValue(s, a, b),
    trust: (id) => s.students[id]?.trust ?? 0,
    luckInjury: (id) => (s.students[id]?.traits ?? []).reduce((a, t) => a + (TRAITS[t].injuryBonus ?? 0), 0) + fx(s, 'injury'),
    commandBonus: fx(s, 'command'),
    // 14夜目：最初の1時間の案内の依頼では、倒れても重傷まで（戦死しない）
    deathMul: s.quests.some((q) => q.tutorial) ? 0 : s.settings.mods.death,
  };
}

/**
 * 今日の授業を選ぶ（7夜目）。結果は「授業の結果」として画面に出す。
 * 金曜のあとは週の終わり、4週目の金曜のあとは月末の依頼
 */
export function chooseLesson(s: GameState, idx: number, talkWith?: string): void {
  if (s.pending.length || s.battle || s.gameOver) return;
  const r = rng(s);
  const from = s.pending.length;
  const day = s.day ?? 1;
  const res = resolveLesson(s, r, idx, talkWith);
  const ended = afterDay(s, r, res);
  s.pending.splice(from, 0, { type: 'lessonResult', lesson: res.lesson, day, faces: res.faces, tags: res.tags, rows: res.rows, events: res.events, growth: res.growth, lines: res.lines, talks: res.talks, others: res.others, xp: res.xp });
  checkStratUnlocks(s);
  deferShows(s, from);
  guideAfterDay(s, day, ended.weekEnded && s.week === 2);
  if (ended.monthEnd) { freshQuests(s); if (s.quests.some((q) => q.tutorial)) tip(s, 'quest'); s.pending.push({ type: 'questBoard' }); }
  else todayCards(s);
}

/** 14夜目：最初の1時間の案内（1日目の授業のあと・2日目の終わりの最初の面談・はじめて出たもの） */
function guideAfterDay(s: GameState, day: number, _newWeek: boolean): void {
  if (tutorialMonth(s) && s.week === 1) {
    if (day === 1) tip(s, 'lesson1');
    if (day === 2) { const t = tutorialTalk(s); if (t) { s.pending.push({ type: 'talk', talk: t }); tip(s, 'interview'); } }
  }
  checkTips(s);
}

function afterDay(s: GameState, r: Rng, res: DayOutcome): { weekEnded: boolean; monthEnd: boolean } {
  const ended = advanceDay(s, r, res.lines);
  if (ended.weekEnded) {
    const talked = new Set<string>();
    for (const t of res.talks) if (t.kind === 'interview' || t.kind === 'special') { talked.add(t.a); talked.add(t.b); }
    rollSides(s, r, talked, res.lines);
    // 信頼が深まった子との特別な面談（週に一度まで）
    const sp = specialInterview(s, r, enrolled(s).filter(available));
    if (sp) { res.talks.push(sp); res.lines.push(`${s.students[sp.a]?.given}と「${sp.title}」について語り合った（特別な面談）`); }
  }
  if (s.guideStep < 99 && s.year === 1 && s.month === 0) s.guideStep += 1;
  return ended;
}

/** 「今週はおまかせ」：先生のおすすめで金曜まで進める（結果は1つのまとめに） */
export function weekAuto(s: GameState): void {
  if (s.pending.length || s.battle || s.gameOver) return;
  const r = rng(s);
  const from = s.pending.length;
  const lines: string[] = [];
  const talks: TalkLog[] = [];
  const growth: GrowthEntry[] = [];
  const picked: string[] = [];
  let ended = { weekEnded: false, monthEnd: false };
  let guard = 0;
  while (!ended.weekEnded && guard++ < 6) {
    todayCards(s);
    const res = resolveLesson(s, r, recommendCard(s));
    picked.push(res.lesson);
    ended = afterDay(s, r, res);
    lines.push(...res.lines);
    talks.push(...res.talks);
    for (const g of res.growth) {
      const old = growth.find((x) => x.id === g.id);
      if (!old) { growth.push(g); continue; }
      // 同じ子は1つにまとめる（最初の値と最後の値）
      const skills = [...old.skills];
      for (const k of g.skills) { const e = skills.find((x) => x.k === k.k); if (e) e.p1 = k.p1; else skills.push({ ...k }); }
      Object.assign(old, { exp1: g.exp1, lv1: g.lv1, ups: [...old.ups, ...g.ups], skills, spells: [...old.spells, ...g.spells], train: [...(old.train ?? []), ...(g.train ?? [])] });
    }
  }
  const names = picked.map((id) => LESSON_NAME[id] ?? id);
  s.pending.splice(from, 0, { type: 'weekSummary', lines: [`今週の授業：${names.join('・')}`, ...lines], talks, growth });
  checkStratUnlocks(s);
  deferShows(s, from);
  if (tutorialMonth(s) && s.week === 2) { tip(s, 'lesson1'); const t = tutorialTalk(s); if (t) { s.pending.push({ type: 'talk', talk: t }); tip(s, 'interview'); } }
  checkTips(s);
  if (ended.monthEnd) { freshQuests(s); if (s.quests.some((q) => q.tutorial)) tip(s, 'quest'); s.pending.push({ type: 'questBoard' }); }
  else todayCards(s);
}

/** 「次の週へ」（6夜目までの呼び名。今は「今週はおまかせ」と同じ） */
export function nextWeek(s: GameState): void { weekAuto(s); }

// ---------- 月末の出撃：最大3部隊（9夜目） ----------
/** 今月出せる部隊の数（在籍20人を超えると2、30人で3。依頼の数まで） */
export function squadCount(s: GameState): number {
  const n = enrolled(s).length;
  const k = n >= SQUADS.three ? 3 : n > SQUADS.two ? 2 : 1;
  return Math.max(1, Math.min(k, s.quests.length));
}
/** 部隊ごとの人数の上限（2つ目からは少なめ） */
export function squadLimit(s: GameState, i: number): number { return i === 0 ? deployLimit(s) : Math.min(deployLimit(s), SQUADS.extraLimit); }

/** 部隊の順番に1つずつ戦う。教官はすべての部隊に同行する */
export function startSortie(s: GameState, squads: SquadPlan[]): void {
  const list = squads.filter((x) => x.deploy.length && s.quests.some((q) => q.id === x.questId));
  if (!list.length || s.battle) return;
  s.pending = s.pending.filter((p) => p.type !== 'questBoard');
  for (const sq of list) for (const x of sq.deploy) if (x.item) s.items[x.item] = Math.max(0, s.items[x.item] - 1);
  s.sortie = { squads: list, idx: 0, reports: [], pendFrom: s.pending.length };
  startSquad(s);
}
/** 教官が同行しない部隊か（10夜目：2つ目・3つ目の部隊は、はじめ同行しない） */
export function squadAway(sq: SquadPlan, idx: number): boolean { return idx > 0 && !sq.manual && sq.away !== false; }
/** これから戦う部隊のうち、教官が同行するものが残っているか */
export function moreEscorted(s: GameState): boolean {
  const so = s.sortie;
  if (!so) return false;
  return so.squads.some((sq, i) => i > so.idx && squadWatched(s, sq, i));
}
/** 16夜目：教官が同行して札を出す部隊か（同行しない部隊と、小さな依頼は結果だけ） */
export function squadWatched(s: GameState, sq: SquadPlan, idx: number): boolean {
  return !squadAway(sq, idx) && !(isCardMode() && !!s.quests.find((q) => q.id === sq.questId)?.small);
}
function startSquad(s: GameState): void {
  const so = s.sortie;
  if (!so) return;
  const sq = so.squads[so.idx];
  // 16夜目：いつも札の戦い（手で動かすマス目の戦いはなくした）
  if (sq.manual && !isCardMode()) startBattle(s, sq.questId, sq.deploy);
  else startAutoQuest(s, sq.questId, sq.deploy, sq.plan);
  // 16夜目：小さな依頼は、札の戦いでも結果だけ（部隊長がおまかせで札を出す）
  const small = isCardMode() && !!s.quests.find((q) => q.id === sq.questId)?.small;
  if ((squadAway(sq, so.idx) || small) && s.battle?.auto) {
    // 教官が同行しない部隊：部隊長がここぞの判断を下し、最後まで自動で進む
    const b = s.battle;
    const cap = sq.plan.captain ? s.students[sq.plan.captain] : null;
    const pl = sq.plan.planner ? s.students[sq.plan.planner] : null;
    const rate = awayJudgeRate(cap, pl);
    const r = new Rng({ rng: questSeed(s, s.quests.find((q) => q.id === sq.questId) ?? ({ id: sq.questId } as Quest)) ^ 0x2f17 });
    const calls: AwayCall[] = [];
    b.auto!.away = { calls };
    skipAuto(s, battleCtx(s), (c) => {
      const good = r.chance(rate);
      let i = c.recommended;
      if (!good && c.options.length > 1) { i = r.int(0, c.options.length - 2); if (i >= c.recommended) i += 1; }
      calls.push({ kind: c.kind, prompt: c.prompt.split('\n')[0], label: c.options[i].label, good: i === c.recommended, by: cap?.id });
      return i;
    });
    if (s.battle && s.battle.phase !== 'done') { s.battle.phase = 'done'; s.battle.result = 'lose'; }
    finishBattle(s);
  }
}

/** 援軍に来た卒業生（10夜目）：統率が高いと部隊の命中、軍略が高いと回避が少し上がる */
function alumniAid(b: { units: { side: string; mod?: { hit?: number; avo?: number } }[] }, st: Student): void {
  const cmd = st.skills.command ?? 0, tac = st.skills.tactics ?? 0;
  const hit = cmd >= 270 ? 5 : cmd >= 140 ? 3 : 0, avo = tac >= 270 ? 5 : tac >= 140 ? 3 : 0;
  if (!hit && !avo) return;
  for (const u of b.units) if (u.side === 'player') { u.mod ??= {}; u.mod.hit = (u.mod.hit ?? 0) + hit; u.mod.avo = (u.mod.avo ?? 0) + avo; }
}

/** 戦闘を始める */
export function startBattle(s: GameState, questId: string, deploys: Deploy[]): void {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) return;
  const r = rng(s);
  s.battle = createBattle(s, q, deploys, r.int(1, 2 ** 30));
  setupLeader(s, q, s.battle);
  setReinforcementFactory((b) => {
    const st = b.reinforcement ? s.students[b.reinforcement] : null;
    if (!st) return null;
    const u = unitFromStudent(st, 'ally', `ally_${st.id}`, 0, 0, [defaultWeaponFor(st)]);
    u.name = `${st.given}（卒業生）`;
    alumniAid(b, st);
    return u;
  });
  startPlayerPhase(s.battle);
  s.pending = s.pending.filter((p) => p.type !== 'questBoard');
}

/**
 * 16夜目：古い形の戦い（マス目の戦い・場面の戦い）の途中のセーブは、同じ依頼・同じ顔ぶれ・同じ計画で、
 * 札の戦いとしてはじめからやり直す（敵も同じ種から作る。持たせた道具は出撃のときに引いてあるので、そのまま）
 */
export function restartBattleAsCards(s: GameState): boolean {
  const b = s.battle;
  if (!b || b.auto?.cards) return false;
  const q = s.quests.find((x) => x.id === b.questId);
  const members = b.units.filter((u) => u.side === 'player' && u.studentId && s.students[u.studentId]?.status === 'enrolled');
  s.battle = null;
  if (!q || !members.length) {
    // 依頼が見つからない：戦いはなかったことにして、出撃の続きへ
    if (s.sortie) { s.sortie.idx += 1; if (s.sortie.idx < s.sortie.squads.length) { startSquad(s); return true; } s.sortie = null; endMonth(s); }
    return false;
  }
  const sq = s.sortie?.squads[s.sortie.idx];
  const deploys: Deploy[] = sq && sq.questId === q.id ? sq.deploy : members.map((u) => ({ studentId: u.studentId!, armoryUid: u.armoryUid ?? null, item: u.item, staffUid: null }));
  const a = b.auto;
  const plan: AutoPlan = sq && sq.questId === q.id ? sq.plan : a ? { tactic: a.tactic, roles: a.roles, planner: a.plan?.planner, captain: a.plan?.captain, rows: a.plan?.rows, strats: [...(a.strats ?? []).map((x) => x.id), ...(a.held ?? [])] } : defaultPlan(s, q, deploys);
  if (sq) { sq.manual = undefined; startSquad(s); return true; }
  ensureReinforcementFactory(s);
  startAutoBattle(s, q, deploys, plan, battleCtx(s));
  return true;
}

/** 自動の戦闘を始める（5夜目） */
export function startAutoQuest(s: GameState, questId: string, deploys: Deploy[], plan: AutoPlan): void {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) return;
  ensureReinforcementFactory(s);
  s.pending = s.pending.filter((p) => p.type !== 'questBoard');
  startAutoBattle(s, q, deploys, plan, battleCtx(s));
}

export function ensureReinforcementFactory(s: GameState): void {
  const f = (b: BattleState) => {
    const st = b.reinforcement ? s.students[b.reinforcement] : null;
    if (!st) return null;
    const u = unitFromStudent(st, 'ally', `ally_${st.id}`, 0, 0, [defaultWeaponFor(st)]);
    u.name = `${st.given}（卒業生）`;
    alumniAid(b, st);
    return u;
  };
  setReinforcementFactory(f);
  setCardReinforce(f);
}

function gradeFor(score: number): string { return score >= 9 ? 'S' : score >= 5 ? 'A' : score >= 2 ? 'B' : 'C'; }

/** 戦闘の結果を学校に反映する */
export function finishBattle(s: GameState): void {
  const b = s.battle;
  if (!b || b.phase !== 'done') return;
  const r = rng(s);
  const pendFrom = s.pending.length;
  const q = s.quests.find((x) => x.id === b.questId);
  const win = b.result === 'win';
  const lines: string[] = [];
  const grades: { id: string; grade: string; note: string }[] = [];
  const expMul = b.real ? 1 : B.battle.drillExpMul;
  lines.push(win ? `勝利！「${b.title}」` : `敗北……「${b.title}」`);
  if (win) s.stats.battlesWon++; else s.stats.battlesLost++;
  const growth: GrowthEntry[] = [];
  startGrowthLog();
  // 自動の戦闘：初陣などの出来事で増える経験値
  for (const e of b.auto?.effects ?? []) if (e.kind === 'exp') { const u = b.units.find((x) => x.studentId === e.id && x.side === 'player'); if (u) u.expGain += e.v; }
  // 14夜目：最初の依頼では、いちばん活躍した子のレベルが一度は上がるように（レベルアップの演出を見せる）
  if (q?.tutorial) { const top = b.units.filter((u) => u.side === 'player' && u.studentId).sort((a, c) => c.kills - a.kills || c.dmgDealt - a.dmgDealt)[0]; const st = top ? s.students[top.studentId!] : null; if (top && st) top.expGain = Math.max(top.expGain, (B.tutorial.mvpExp - st.exp) / expMul / Math.max(B.battle.expDamp.min, Math.min(1, B.battle.expDamp.base - st.level * B.battle.expDamp.perLevel)) / (s.settings.mods.exp || 1) + 1); }

  // 評価のための控え（9夜目）：戦う前の宿敵の段階・出撃の回数
  const L0 = (b.auto?.leader ?? b.leader);
  const rivalsBefore: Record<string, number> = {};
  const battlesBefore: Record<string, number> = {};
  const evalIds: string[] = [];
  // 15夜目：持たせて使わなかった道具は、学校に戻す（道具は毎月自動で補充するので、使ったぶんだけ減る）
  for (const u of b.units) if (u.side === 'player' && u.studentId && u.item) s.items[u.item] = (s.items[u.item] ?? 0) + 1;
  for (const u of b.units) if (u.side === 'player' && u.studentId && s.students[u.studentId]?.status === 'enrolled') {
    evalIds.push(u.studentId);
    battlesBefore[u.studentId] = s.students[u.studentId].battles;
    if (L0?.officerId) rivalsBefore[u.studentId] = rivalryOf(s, u.studentId, L0.officerId)?.stage ?? 0;
  }
  for (const u of b.units) {
    if (!u.studentId || u.side === 'enemy' && !u.persuadable) continue;
    const st = s.students[u.studentId];
    if (!st) continue;
    if (st.status === 'graduated') {
      const f = b.fallen.find((x) => x.studentId === st.id);
      if (f && st.career) {
        if (f.outcome === 'dead') { st.career.alive = false; st.diedYear = s.year; loseCombos(s, st.id); st.deathNote = '戦場で戦死'; chronicle(s, `卒業生の${st.given}が戦場で倒れた`, 'student'); lines.push(`卒業生の${st.given}が戦死した……`); }
        else { st.career.injuredYears = 1; lines.push(`卒業生の${st.given}は重傷を負った`); }
        if (u.persuadable && st.career.country) { s.world.friendship[st.career.country] = Math.max(-50, s.world.friendship[st.career.country] - 10); }
      }
      if (u.side === 'ally' && !u.persuadable) st.history.push({ year: s.year, text: `「${b.title}」で後輩たちと共に戦った` });
      continue;
    }
    if (st.status !== 'enrolled') continue;
    const snap = snapGrowth(st);
    st.battles += 1;
    // 14夜目：武器庫の武器を使った回数（卒業のとき、愛用の武器を持っていく）
    if (u.armoryUid) { const a = s.armory.find((x) => x.uid === u.armoryUid); if (a) (a.uses ??= {})[st.id] = (a.uses[st.id] ?? 0) + 1; }
    st.kills += u.kills;
    for (const [w, n] of Object.entries(u.usedWeapon)) {
      st.weaponUse[w] = (st.weaponUse[w] ?? 0) + n;
      const def = WEAPONS[w];
      if (def) addSkill(st, weaponSkillId(def.type) as SkillId, n * B.battle.skillPerUse * B.motivationMul[st.motivation] * (s.settings.mods.skill ?? 1));
      if (def) revealTalent(s, st, B.talent.battleReveal / 4); // 10夜目：戦いでも芽の判明度が少し上がる
    }
    const damp = Math.max(B.battle.expDamp.min, Math.min(1, B.battle.expDamp.base - st.level * B.battle.expDamp.perLevel));
    const ups = gainExp(s, r, st, u.expGain * expMul * damp);
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
    if (f?.outcome === 'dead') { killStudent(s, st, `「${b.title}」で戦死`); warAfterScene(s, r, st, 'dead', u.weaponId); }
    else if (f?.outcome === 'injured') {
      st.injuredWeeks = r.int(...B.battle.injuryWeeks);
      addRecent(s, st, 'ev_injury', b.title);
      lines.push(`${st.given}は重傷（${st.injuredWeeks}週間休み）`);
      // 11夜目：傷跡が残る（年表に）。療養の場面
      st.history.push({ year: s.year, text: `「${b.title}」で${r.pick(['左の肩', '右の脇腹', '額', '左の腿', '背中', '右の腕'])}に深い傷を負った` });
      warAfterScene(s, r, st, 'injured', u.weaponId);
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
  for (const w of b.visitedChestLog ?? []) { s.armory.push({ uid: `w${s.nextId++}`, weaponId: w, got: { kind: 'drop', year: s.year, text: '宝箱から' } }); lines.push(`武器庫に「${WEAPONS[w].name}」が加わった`); }
  // 10夜目：戦利品（自動の戦闘は決着の場面で決まっている）
  const loot = takeLoot(s, rollLoot(s, b, q, (uid) => b.units.find((u) => u.uid === uid)?.name ?? '敵兵'));
  for (const x of loot) lines.push(`戦利品：${x.named?.name ?? WEAPONS[x.weaponId]?.name}（${x.from}）`);
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
        const rep = q.small ? 1 : B.reputation.questWinByDanger[q.danger] ?? 1;
        addRep(s, rep);
        lines.push(`報酬 ${s.money - before}G、評判+${rep}`);
        // 小さな依頼（9夜目）は戦況を動かさない
        if (!q.small) { seedHelp(s, q.clientCountry); lines.push(...questWorldEffect(s, q.clientCountry, q.enemyCountry, true)); }
        const rg = questRegionResult(s, q, true, r); if (rg) lines.push(rg);
      } else { const lose = q.small ? Math.round(B.reputation.questLose / 2) : B.reputation.questLose; addRep(s, lose); lines.push(`依頼は失敗。評判${lose}`); const rg = questRegionResult(s, q, false, r); if (rg) lines.push(rg); }
    }
  }
  const auto = applyAutoResults(s, b, r, lines, {
    addSupport: (a, c, v) => { const t = addSupport(s, r, a, c, v); if (t) s.pending.push({ type: 'talk', talk: t }); },
    reveal: (st, v) => revealTalent(s, st, v),
    motivation: (st, d) => changeMotivation(st, d),
  });
  const officerFind = officerAfterBattle(s, b, r, lines);
  // 策を立てた子は軍略が少し身につく（9夜目）
  const planner = b.auto?.plan?.planner;
  if (planner && s.students[planner]?.status === 'enrolled' && (b.auto?.strats ?? []).length) addStrat(s.students[planner], STRAT.plannerGain);
  // 10夜目：部隊長を務めた子は統率が身につく
  const captain = b.auto?.plan?.captain;
  if (captain && s.students[captain]?.status === 'enrolled') addCommand(s.students[captain], STRAT.captainGain);
  for (const id of evalIds) if (s.students[id]) checkBloom(s, s.students[id]);
  // 18夜目：出した札の熟練。満ちた技は、進化の知らせ
  gainMastery(s, b, evalIds);
  const evals = evaluateBattle(s, b, q, evalIds, auto.mvp ?? null, rivalsBefore, battlesBefore);
  // 個人ページの記録：称号の数・最近の評価・重傷の回数
  for (const e of evals) {
    const st = s.students[e.id];
    if (!st) continue;
    for (const bd of e.badges) (st.honors ??= {})[bd] = (st.honors[bd] ?? 0) + 1;
    (st.evalLog ??= []).push({ year: s.year, month: s.month, title: b.title, grade: e.grade, badges: e.badges, scene: e.scene });
    if (st.evalLog.length > 12) st.evalLog.splice(0, st.evalLog.length - 12);
    if (e.outcome === 'injured') st.wounds = (st.wounds ?? 0) + 1;
  }
  const sortie = s.sortie;
  const talkFrom = sortie ? Math.min(sortie.pendFrom, s.pending.length) : 0;
  const firstTalk = s.pending.findIndex((p, i) => i >= talkFrom && p.type === 'talk');
  const findings = [...battleFindings(s, growth, lines, s.pending.slice(firstTalk >= 0 ? firstTalk : s.pending.length)), ...officerFind];
  const report: BattleReport = { lines, grades, win, growth, mvp: auto.mvp ?? undefined, review: auto.review, title: b.title, findings, officerId: (b.auto?.leader ?? b.leader)?.officerId,
    loot: loot.length ? loot : undefined,
    away: b.auto?.away ? true : undefined, calls: b.auto?.away?.calls, moments: b.auto?.away ? awayMoments(b) : undefined,
    evals, stratReview: auto.stratReview.length ? auto.stratReview : undefined, captain: b.auto?.plan?.captain, fallen: b.fallen.filter((f) => f.outcome !== 'out' && s.students[f.studentId] && evalIds.includes(f.studentId)).map((f) => ({ id: f.studentId, outcome: f.outcome as 'dead' | 'injured' })) };
  s.battle = null;
  if (q?.kind === 'schoolDefense' && win) checkEndings(s, r, 'month');
  checkStratUnlocks(s);
  if (sortie) {
    // 部隊の順番に次の戦いへ。最後の部隊のあと、結果をまとめて1枚に（9夜目）
    report.squad = sortie.idx;
    sortie.reports.push(report);
    sortie.idx += 1;
    if (sortie.idx < sortie.squads.length && !s.gameOver) { startSquad(s); return; }
    const from = Math.min(sortie.pendFrom, s.pending.length);
    s.pending.splice(from, 0, sortie.reports.length > 1 ? { type: 'sortieResult', reports: sortie.reports } : { type: 'battleResult', ...sortie.reports[0] });
    s.sortie = null;
    deferShows(s, from);
    afterBattleGuide(s, q);
    endMonth(s);
    return;
  }
  s.pending.splice(firstTalk >= 0 ? firstTalk : s.pending.length, 0, { type: 'battleResult', ...report });
  deferShows(s, pendFrom);
  afterBattleGuide(s, q);
  endMonth(s);
}

/** 14夜目：最初の依頼のあとの案内と、はじめて出たもの */
function afterBattleGuide(s: GameState, q: Quest | undefined): void {
  if (q?.tutorial) tip(s, 'afterBattle');
  checkTips(s);
}

/** 同行しない部隊の大事な出来事（宿敵・一騎打ち・抜擢・敵将の口上）。結果の画面で短い場面に（10夜目） */
function awayMoments(b: NonNullable<GameState['battle']>): { by: string; text: string }[] {
  const out: { by: string; text: string }[] = [];
  for (const sc of b.auto?.scenes ?? []) {
    const big = !!sc.duo || sc.title === '宿命の対決';
    for (const l of sc.lines) {
      if (big || l.by.startsWith('raise:') || (l.by === 'leader' && out.filter((x) => x.by === 'leader').length < 1)) out.push({ by: l.by.startsWith('raise:') ? 'narr' : l.by, text: l.text });
    }
  }
  return out.slice(0, 6);
}

/** 戦闘のあとの「この戦いで伸びた・分かったこと」（レベル・技能ランク・魔法・才能・特徴・支援） */
export function battleFindings(s: GameState, growth: GrowthEntry[], lines: string[], talks: GameState['pending']): BattleFinding[] {
  const out: BattleFinding[] = [];
  for (const g of growth) {
    const st = s.students[g.id];
    if (!st) continue;
    if (g.lv1 > g.lv0) out.push({ id: st.id, icon: 'star', text: `${st.given}　Lv${g.lv0} → Lv${g.lv1}` });
    for (const k of g.skills) { const r0 = rankOf(k.p0), r1 = rankOf(k.p1); if (r0 !== r1) out.push({ id: st.id, icon: 'lesson', text: `${st.given}　${SKILL_NAMES[k.k]} ${r0} → ${r1}` }); }
    for (const sp of g.spells) out.push({ id: st.id, icon: 'tome', text: `${st.given}　${WEAPONS[sp]?.name ?? sp}を覚えた` });
  }
  for (const l of lines) if (l.includes('才能') || l.includes('特徴')) { const st = Object.values(s.students).find((x) => x.status === 'enrolled' && l.startsWith(`戦場で${x.given}`) || l.startsWith(`${x.given}の特徴`)); out.push({ id: st?.id, icon: 'lantern', text: l }); }
  for (const p of talks) if (p.type === 'talk') { const a = s.students[p.talk.a], c = s.students[p.talk.b]; if (a && c) out.push({ id: a.id, icon: 'heart', text: `${a.given}と${c.given}の支援が${p.talk.rank}に` }); }
  return out;
}

/** 戦いのあとの場面（11夜目）：戦死はその夜の学校・仲間の言葉・遺品、重傷は療養。戦の描写が「ふつう」のときは出さない */
function warAfterScene(s: GameState, r: Rng, st: Student, kind: 'dead' | 'injured', weaponId: string | null | undefined): void {
  if ((s.settings.battleProse ?? 'dense') === 'normal') return;
  const fr = bestFriend(s, st) ?? enrolled(s).find((x) => x.id !== st.id && x.grade === st.grade) ?? null;
  const fill = (t: string) => t.replace(/\{a\}/g, st.given).replace(/\{f\}/g, fr?.given ?? '仲間').replace(/\{w\}/g, weaponId && WEAPONS[weaponId] ? WEAPONS[weaponId].name : '剣');
  const L: import('./state').SceneLine[] = [];
  if (kind === 'dead') {
    for (const t of r.pick(NIGHT_AFTER_DEATH)) L.push({ by: 'narr', text: fill(t) });
    if (fr) L.push({ by: fr.id, text: fill(r.pick(FRIEND_GRIEF[fr.personality] ?? FRIEND_GRIEF.serious)) });
    L.push({ by: 'narr', text: fill(r.pick(TEACHER_GRIEF)) });
    if (weaponId && WEAPONS[weaponId] && !WEAPONS[weaponId].spell) L.push({ by: 'narr', text: fill(r.pick(KEEPSAKE)) });
    s.pending.push({ type: 'scene', title: `${st.given}を弔う夜`, lines: L.map((l, i) => (i === 0 ? { ...l, faces: [st.id] } : l)) });
  } else {
    // 療養の場面は、月末に1つまで（けがの多い月に場面が続きすぎないように）
    if (s.pending.some((p) => p.type === 'scene' && p.title.endsWith('の療養'))) return;
    for (const t of r.pick(RECOVERY)) L.push({ by: 'narr', text: fill(t) });
    s.pending.push({ type: 'scene', title: `${st.given}の療養`, lines: L.map((l, i) => (i === 0 ? { ...l, faces: [st.id] } : l)) });
  }
}

export function killStudent(s: GameState, st: Student, note: string): void {
  st.status = 'dead'; st.diedYear = s.year; st.deathNote = note;
  loseCombos(s, st.id); // 18夜目：連携技は年鑑に残る（もう使えない）
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
  // 8夜目：9月の終わりに新聞の前期号
  if (s.month === 5) publishIssue(s, 'first');
  s.month += 1; s.week = 1; s.day = 1; s.today = null;
  startMonth(s);
}

export function startMonth(s: GameState): void {
  const r = rng(s);
  const lines: string[] = [];
  lines.push(...monthlySalaries(s));
  lines.push(...monthlyWorld(s, r));
  checkEndings(s, r, 'month');
  lines.push(...startMonthStudents(s, r));
  ensureRosters(s, r);
  freshQuests(s);
  // 月の始め：目標技能（7夜目。「自動で決める」の子は担任の方針・おすすめで）
  autoMonthTargets(s);
  if (enrolled(s).length) notify(s, `${MONTH_NAMES[s.month]}の目標技能を決めよう（今は自動。学校の画面の「今月の目標技能」から変えられます）`);
  // 6夜目までの重点科目（今は使わない。古いセーブのために残す）
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
  todayCards(s);
  if (s.month === 6) senpaiLetters(s, r); // 14夜目：卒業した先輩から後輩への手紙
  if (s.month === 3) notify(s, '7月は夏の合宿：授業の伸びと体力の減りが1.5倍');
  if (s.month === 5) notify(s, '9月は公開演武会：月末の戦闘で活躍すると各国から声がかかる');
  if (s.month === 8) notify(s, '12月は冬の収穫祭：交流の授業が出やすく、支援が上がりやすい');
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
  const pendFrom = s.pending.length;
  // 2. 進級
  for (const st of enrolled(s)) { st.grade += 1; st.age += 1; }
  // 3. 卒業生
  const news = simulateAlumni(s, r);
  // 4. 戦況
  const world = yearlyWorld(s, r);
  // 敵将の名簿（6夜目）：年をとる・引退・権力争い・卒業生が敵将に・手紙
  const officerNews = yearlyOfficers(s, r);
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
  // 8. 廃校の期限は8夜目でなくした（ヒナタさん了承）。傘下入りは国からの誘いを自分で受けたときだけ。傘下の学校は評判70で独立を取り戻せる
  const deadline: string[] = [];
  if (s.world.vassal && s.reputation >= B.school.independenceRep) {
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
    if (!s.world.vassal && others.every((o) => s.world.friendship[c] - s.world.friendship[o] >= B.vassalInviteGap) && !s.pending.some((p) => p.type === 'vassalOffer')) {
      mail(s, `${COUNTRY_NAMES[c]}の使者`, '傘下への誘い', `貴校と我が国の縁は深い。我が国の傘下に入れば、十分な援助を約束しよう。考えておいてほしい。—${COUNTRY_NAMES[c]}`);
      s.pending.push({ type: 'vassalOffer', country: c });
    }
  }
  // 5. 新聞（8夜目：後期号。半年分の出来事をまとめる）
  const paper = publishIssue(s, 'second', {
    world, officers: officerNews,
    alumni: news.filter((n) => n.big).slice(0, 12).map((n) => ({ id: n.id, text: n.text })),
    school: [`学校の収入：援助金${aidTotal}G・寄付${donation}G（所持金 ${before}G → ${s.money}G）`, ...deadline],
  });
  paper.body.push(`三国の国力：王国${Math.round(s.world.power.kingdom)}・帝国${Math.round(s.world.power.empire)}・同盟${Math.round(s.world.power.alliance)}`);
  s.world.epidemic = false; s.world.famine = false;
  // エンディングの判定（年度末）。平和な時代は、火種がくすぶり、予兆が出て、やがて次の戦争（7夜目）
  const omen = peaceEraYear(s, r);
  if (omen.length) {
    paper.body.push('【火種】', ...omen);
    paper.politics?.push({ country: 'seed', stance: '次の戦争の火種', text: omen.map((x) => x.replace('【大事件】', '')).join('。') });
    if (omen.some((x) => x.startsWith('【大事件】'))) { const h = omen[omen.length - 1].replace('【大事件】', ''); paper.headline = `${s.year}年目 後期号：${h}`; if (paper.front) { paper.front.sub = paper.front.head; paper.front.head = h; } }
  }
  const endN = (s.endings ?? []).length;
  checkEndings(s, r, 'year');
  // 14夜目：伝説の武器の行方。戦争を終わらせた年は、三国から1振り贈られる
  {
    const found = yearlyLegends(s, r);
    const gift = B.loot.legendEnding && (s.endings ?? []).length > endN ? unclaimedLegend(s, r) : null;
    const loot = [...(found ? [found] : []), ...(gift ? [legendLoot(gift, '戦争を終わらせた学校へ、三国から贈られた')] : [])];
    if (loot.length) takeLoot(s, loot);
  }
  // 13夜目：勢力図（戦争中の国境の地域が動く。統一なら大陸が一色に）
  yearlyRegions(s, r);
  // 14夜目：1年の振り返り（卒業式と新聞のあと。エンディングの年は、エンディングのあとに）
  const rv = closeYear(s);
  let at = s.pending.length;
  for (let i = s.pending.length - 1; i >= pendFrom; i--) if (s.pending[i].type === 'ending') { at = i + 1; break; }
  s.pending.splice(at, 0, { type: 'yearReview', year: rv.year });
  // 9. 新年度
  s.year += 1; s.month = 0; s.week = 1; s.day = 1; s.today = null;
  for (const st of Object.values(s.students)) if (st.status === 'enrolled') st.offers = st.grade === 3 ? st.offers : st.offers;
  if (rc.can) s.pending.push({ type: 'retire', forced: rc.forced });
  prepareEntrance(s);
  rollTeacherCandidates(s, r);
  markYear(s);
  startMonth(s);
  void graduated; void MONTH_NAMES; void absMonth; void tensionStage; void titleOf; void mail; void SKILL_NAMES; void getSupport; void available;
}

/** 入学試験の志願者 */
export function prepareEntrance(s: GameState): void {
  const r = rng(s);
  const cap = capacity(s);
  const n = Math.max(cap, Math.round(cap * (1 + s.reputation / 40) * (1 + fx(s, 'applicants'))));
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

/** 傘下への誘いを受ける（8夜目：自分で選んだときだけ傘下に入る） */
export function acceptVassal(s: GameState, c: CountryId): void {
  s.pending = s.pending.filter((p) => p.type !== 'vassalOffer');
  if (s.world.vassal) return;
  s.world.vassal = c;
  for (const o of COUNTRIES) if (o !== c) s.world.friendship[o] = Math.max(-50, s.world.friendship[o] + B.school.vassalOtherFriendship);
  chronicle(s, `${COUNTRY_SHORT[c]}の傘下に入る`, 'school');
}
