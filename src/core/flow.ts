// ゲームの流れ：週→月末の戦闘→月の終わり→年度末→入学試験
import { B } from '../data/balance';
import { COUNTRIES, COUNTRY_SHORT, COUNTRY_NAMES, SKILL_NAMES } from '../data/people';
import { WEAPONS } from '../data/weapons';
import { ATK_NAME } from '../data/tactics';
import type { CountryId, SkillId } from './types';
import type { GameState, Quest, Student, GrowthEntry, TalkLog, SquadPlan, BattleReport, EnemyOfficer } from './state';
import type { TBattle, Deploy } from './tactics/types';
import { LESSON_BY_ID } from '../data/lessons';
import { specialInterview } from './interview';
const LESSON_NAME: Record<string, string> = Object.fromEntries(Object.values(LESSON_BY_ID).map((l) => [l.id, l.name]));
import { Rng } from './rng';
import { enrolled, addRep, chronicle, notify, enrollCohort, capacity, mail, available, addMoney } from './game';
import { startMonthStudents, changeMotivation, autoMonthTargets } from './week';
import { resolveLesson, advanceDay, recommendCard, todayCards, type DayOutcome } from './lessons';
import { rollQuests } from './quests';
import { addRecent, getSupport, pruneArchive } from './support';
import { createTactics, questSeed } from './tactics/setup';
import { autoFinish } from './tactics/ai';
import { applyTactics } from './tactics/after';
import { ensureRosters, yearlyOfficers, pickOfficerForQuest, officerById } from './officers';
import { bondOf, battleLines, scoutWeak, afterNemesisBattle } from './nemesis';
import { fx } from './mentor';
import { publishIssue } from './newspaper';
import { rollSides, deferShows } from './discovery';
import { monthlyWorld, yearlyWorld, tensionStage, activeAlumni } from './world';
import { simulateAlumni, aidMoney, titleOf } from './alumni';
import { prepareCareers, graduate, type CareerPlan } from './career';
import { generateStudent } from './student';
import { absMonth, MONTH_NAMES } from './util';
import { retireCheck } from './instructor';
import { checkEndings, peaceEraYear } from './ending';
import { supportValue, bestFriend } from './support';
import { closeYear, markYear } from './review';
import { senpaiLetters } from './senpai';
import { yearlyRegions } from './regions';
import { yearlyLegends, unclaimedLegend, legendLoot } from './rarity';
import { takeLoot } from './loot';
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
    for (let i = 0; i < n; i++) scoutWeak(o, new Rng({ rng: questSeed(s, q) ^ (0x51 + i) }));
  }
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
  deferShows(s, from);
  if (tutorialMonth(s) && s.week === 2) { tip(s, 'lesson1'); const t = tutorialTalk(s); if (t) { s.pending.push({ type: 'talk', talk: t }); tip(s, 'interview'); } }
  checkTips(s);
  if (ended.monthEnd) { freshQuests(s); if (s.quests.some((q) => q.tutorial)) tip(s, 'quest'); s.pending.push({ type: 'questBoard' }); }
  else todayCards(s);
}

/** 「次の週へ」（6夜目までの呼び名。今は「今週はおまかせ」と同じ） */
export function nextWeek(s: GameState): void { weekAuto(s); }

// ---------- 月末の出撃（19夜目：教え子4人と先生。1つの依頼。自分で遊ぶか、おまかせ） ----------
/** 出撃できる人数（教え子） */
export function squadLimit(_s: GameState, _i = 0): number { return B.sortie.members; }
export function squadCount(_s: GameState): number { return 1; }
/** 依頼を受けて出撃する。manual＝自分で遊ぶ（false はおまかせ：同じ計算で自動に進め、名場面を残す） */
export function startSortie(s: GameState, squads: SquadPlan[]): void {
  const sq = squads.find((x) => x.deploy.length && s.quests.some((q) => q.id === x.questId));
  if (!sq || s.battle) return;
  s.pending = s.pending.filter((p) => p.type !== 'questBoard');
  for (const x of sq.deploy) if (x.item) s.items[x.item] = Math.max(0, s.items[x.item] - 1);
  s.sortie = { squads: [sq], idx: 0, reports: [], pendFrom: s.pending.length };
  startBattle(s, sq.questId, sq.deploy, !sq.manual);
}
export function squadAway(_sq: SquadPlan, _idx: number): boolean { return false; }
export function moreEscorted(_s: GameState): boolean { return false; }
export function squadWatched(_s: GameState, sq: SquadPlan, _idx: number): boolean { return !!sq.manual; }

/** 戦いを始める。auto のときは最後まで自動で進めて結果へ */
export function startBattle(s: GameState, questId: string, deploys: Deploy[], auto = false): void {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) return;
  s.pending = s.pending.filter((p) => p.type !== 'questBoard');
  s.battle = buildBattle(s, q, deploys);
  if (auto) { autoFinish(s.battle, { noDeath: noDeath(s, q) }); finishBattle(s); }
}
/** 死なない戦い（最初の戦い・「生徒が死なない」設定） */
export function noDeath(s: GameState, q?: Quest | null): boolean { return !!q?.tutorial || !!s.settings.noDeath; }

/** 戦いを組み立てる（依頼の敵将・宿敵の台詞・出撃しない子の支えまで） */
export function buildBattle(s: GameState, q: Quest, deploys: Deploy[]): TBattle {
  const o = officerForQuest(s, q);
  const ids = deploys.map((d) => d.studentId);
  const nemesis = o && (q.nemesisId === o.id || bondOf(s, o) > 0 && o.meets.length > 0) ? o : null;
  const r = new Rng({ rng: questSeed(s, q) ^ 0x1e5 });
  const lines = o ? battleLines(s, o, ids, r) : undefined;
  const b = createTactics(s, q, deploys, { officer: o, nemesisId: nemesis?.id ?? null, tutorial: q.tutorial, lines, extraShields: nemesis ? Math.min(2, Math.floor(bondOf(s, nemesis) / 4)) : 0 });
  applySupportCrew(s, b, ids);
  if (lines?.['boss:intro']) { const bu = b.units.find((u) => u.boss); if (bu) { b.fx = [{ k: 'say', by: bu.uid, text: lines['boss:intro'], tone: 'nemesis' }]; b.said.push('boss:intro'); b.log.push({ turn: 1, text: `${bu.name}「${lines['boss:intro']}」` }); if (nemesis) b.scenes.push({ turn: 1, text: `${bu.name}「${lines['boss:intro']}」`, big: true }); } }
  return b;
}

/** この依頼の敵将（名簿から。編成によらず同じ） */
export function officerForQuest(s: GameState, q: Quest): EnemyOfficer | null {
  if (q.nemesisId) { const o = officerById(s, q.nemesisId); if (o && o.status === 'active') return o; }
  if (q.small && ((questSeed(s, q) >>> 3) % 100) >= B.quests.smallOfficer * 100) return null;
  const ids = Object.values(s.students).filter((x) => x.status === 'enrolled').map((x) => x.id);
  return pickOfficerForQuest(s, q, new Rng({ rng: questSeed(s, q) ^ 0x2f6b5a }), ids);
}

/** 出撃しない子が後ろで支える（薬を作る・罠を仕掛ける・弱点を調べる）。成果が戦いに出る */
export function applySupportCrew(s: GameState, b: TBattle, ids: string[]): void {
  const crew = enrolled(s).filter((st) => available(st) && !ids.includes(st.id));
  if (!crew.length) return;
  b.support = [];
  const by = (pred: (st: Student) => boolean) => crew.filter(pred).sort((a, c) => c.level - a.level)[0];
  const healer = by((st) => (st.skills.faith ?? 0) >= 50) ?? crew[0];
  const trapper = by((st) => st.id !== healer?.id && ((st.skills.bow ?? 0) >= 50 || st.classId === 'thief'));
  const scholar = by((st) => st.id !== healer?.id && st.id !== trapper?.id && ((st.skills.magic ?? 0) + (st.skills.tactics ?? 0)) >= 60);
  if (healer) { for (const u of b.units) if (u.side === 'me' && !u.teacher && !u.potion) { u.potion = 1; break; } b.support.push({ kind: 'potion', by: healer.id, text: `${healer.given}が作った傷薬を持たせた` }); }
  if (trapper) { const f = b.units.filter((u) => u.side === 'foe' && !u.boss).sort((a, c) => c.hp - a.hp)[0]; if (f) { const d = Math.min(f.hp - 1, B.sortie.trapDmg); f.hp -= d; b.support.push({ kind: 'trap', by: trapper.id, text: `${trapper.given}の仕掛けた罠で、${f.name}が傷を負った（−${d}）` }); } }
  if (scholar) { const bu = b.units.find((u) => u.boss) ?? b.units.find((u) => u.side === 'foe'); const hidden = bu?.weak.find((w) => !bu.known.includes(w)); if (bu && hidden) { bu.known.push(hidden); b.support.push({ kind: 'study', by: scholar.id, text: `${scholar.given}が調べておいた：${bu.name}の弱点は「${ATK_NAME[hidden]}」` }); } }
  for (const x of b.support) b.log.push({ turn: 1, text: x.text });
}

/** 自分で遊んでいる戦いを、おまかせで最後まで */
export function finishAuto(s: GameState): void {
  const b = s.battle;
  if (!b || b.phase === 'done') { finishBattle(s); return; }
  const q = s.quests.find((x) => x.id === b.questId);
  autoFinish(b, { noDeath: noDeath(s, q) });
  finishBattle(s);
}

/** 戦闘の結果を学校に反映する */
export function finishBattle(s: GameState): void {
  const b = s.battle;
  if (!b || b.phase !== 'done') return;
  const r = rng(s);
  const pendFrom = s.pending.length;
  const q = s.quests.find((x) => x.id === b.questId);
  const out = applyTactics(s, b, r);
  for (const { st, u } of out.dead) { killStudent(s, st, `「${b.title}」で戦死`); warAfterScene(s, r, st, 'dead', null); void u; }
  for (const { st } of out.injured) {
    st.injuredWeeks = r.int(...B.battle.injuryWeeks);
    addRecent(s, st, 'ev_injury', b.title);
    out.report.lines.push(`${st.given}は重傷（${st.injuredWeeks}週間休み）`);
    const scar = r.pick(['左の肩', '右の脇腹', '額', '左の腿', '背中', '右の腕']);
    st.history.push({ year: s.year, text: `「${b.title}」で${scar}に深い傷を負った` });
    (st.scars ??= []).push({ year: s.year, text: `${scar}の傷（「${b.title}」）` });
    st.wounds = (st.wounds ?? 0) + 1;
    warAfterScene(s, r, st, 'injured', null);
  }
  for (const e of out.report.evals ?? []) {
    const st = s.students[e.id];
    if (!st) continue;
    (st.evalLog ??= []).push({ year: s.year, month: s.month, title: b.title, grade: e.grade, badges: e.badges, scene: e.scene });
    if (st.evalLog.length > 12) st.evalLog.splice(0, st.evalLog.length - 12);
  }
  s.battle = null;
  if (q?.kind === 'schoolDefense' && b.result === 'win') checkEndings(s, r, 'month');
  afterNemesisBattle(s, b, out.report);
  const so = s.sortie;
  const from = so ? Math.min(so.pendFrom, s.pending.length) : pendFrom;
  s.pending.splice(from, 0, { type: 'battleResult', ...out.report });
  s.sortie = null;
  deferShows(s, from);
  afterBattleGuide(s, q);
  endMonth(s);
}

/** 14夜目：最初の依頼のあとの案内と、はじめて出たもの */
function afterBattleGuide(s: GameState, q: Quest | undefined): void {
  if (q?.tutorial) tip(s, 'afterBattle');
  checkTips(s);
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
