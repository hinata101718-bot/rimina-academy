// 新しいゲームの作成と、よく使う問い合わせ
import { B, DIFFICULTY, SAVE_VERSION, RANK_POINTS, SKILLS } from '../data/balance';
import { BACKGROUNDS, COUNTRIES } from '../data/people';
import { STARTING_ARMORY } from '../data/weapons';
import { CLASSES } from '../data/classes';
import type { GameState, Student, Settings, Mail } from './state';
import type { Rank, SkillId, Stats, CountryId } from './types';
import { Rng } from './rng';
import { WEAPONS } from '../data/weapons';
import { generateStudent } from './student';
import { emptySkills, clamp } from './util';
import { ensureRosters } from './officers';
import { reputationRankUp } from './discovery';
import { repTier } from '../data/discovery';
import { repGift, takeLoot, STOCK_IDS } from './loot';
import { ensureRegions } from './regions';
import { rollQuests } from './quests';
import { autoTargets } from './week';
import { fx } from './mentor';
import { startNewsDesk } from './newspaper';
import { markYear } from './review';
import { startOpening } from './opening';
import { learnTechs } from './techs';
import { ensureLegends } from './rarity';

export function defaultSettings(): Settings {
  return {
    difficulty: 'normal', mods: { ...DIFFICULTY.normal }, portrait: 'face', cutin: 'important',
    enemySpeed: 1, animSpeed: 2, flip: true, rosterView: 'card', manualBattle: false, battleLog: 'tap', battleFx: 'big', rewind: true, guide: true, sound: true, volume: 0.6,
  };
}

export function rng(s: { rng: number }): Rng { return new Rng(s); }

export type StartKind = 'poor' | 'normal' | 'elite';
export function newGame(opts: { name: string; background: string; seed: number; slot?: number; startGrade?: number; start?: StartKind; /** 14夜目：最初の1時間の案内をつける */ tutorial?: boolean; /** 19夜目：着任の道中の戦い（はじめは true） */ opening?: boolean }): GameState {
  const st0 = B.starts[opts.start ?? 'poor'];
  const bg = BACKGROUNDS.find((b) => b.id === opts.background) ?? BACKGROUNDS[3];
  const skills = emptySkills(RANK_POINTS[bg.defaultRank as Rank]);
  for (const [k, r] of Object.entries(bg.skills)) skills[k as SkillId] = RANK_POINTS[r as Rank];
  skills.gun = 0;
  const s: GameState = {
    version: SAVE_VERSION, slot: opts.slot ?? 0, rng: opts.seed | 0, createdAt: Date.now(), lastExport: Date.now(),
    year: 1, month: 0, week: 1, day: 1, absWeek: 0,
    money: opts.start ? st0.money : B.school.startMoney, reputation: opts.start ? st0.rep : B.school.startReputation,
    facilities: { training: st0.facility, library: st0.facility, stable: st0.facility, chapel: st0.facility, dining: st0.facility, range: 0 },
    teachers: [], teacherCandidates: [],
    armory: STARTING_ARMORY.filter((w) => !STOCK_IDS.has(w)).map((w, i) => ({ uid: `w${i}`, weaponId: w })), // 10夜目：鉄の武器は学校の備え（数の制限なし）
    items: { vulnerary: 3, elixir: 0 },
    instructor: { name: opts.name || '教官', background: bg.id, age: bg.age, experience: 0, skills, cha: bg.cha, generation: 1, since: 1 },
    students: {}, supports: {}, archive: {}, focus: {}, plan: { tutoring: [], weekend: [] },
    consults: [], pinned: [], spotlight: [], notices: [], pending: [], quests: [], battle: null, applicants: [],
    world: {
      power: { ...B.world.startPower }, relations: { ...B.world.startRelations }, tension: B.world.startTension,
      friendship: { ...bg.friendship }, gunYear: 0, gunUnlocked: false, kingDied: false, warYears: 0,
      epidemic: false, famine: false, vassal: null, peaceTalksHeld: 0, schoolDefensePending: false,
      eventCooldown: {}, history: [],
    },
    mail: [], news: [], chronicle: [], photos: [], cohortCount: 0, heirs: [], nextId: 1,
    settings: defaultSettings(), guideStep: 0,
    stats: { battlesWon: 0, battlesLost: 0, deaths: 0, graduates: 0 },
    gameOver: false, log: [],
  };
  const r = rng(s);
  s.world.gunYear = r.int(...B.world.gunYears);
  s.chronicle.push({ year: 1, month: 0, text: `${s.instructor.name}が教官として着任${opts.start && opts.start !== 'poor' ? `（${st0.name}の学校から）` : ''}`, kind: 'school' });
  if (!st0.deadline) s.noDeadline = true;
  // 一期生
  const n = r.int(...(opts.start ? st0.cohort : B.student.firstYearCount));
  enrollCohort(s, Array.from({ length: n }, () => generateStudent(s, r, { quality: st0.quality })));
  if (opts.startGrade && opts.startGrade > 1) {
    // デバッグ：在校生を上の学年として始める
    for (const st of enrolled(s)) {
      st.grade = opts.startGrade;
      st.level = 1 + (opts.startGrade - 1) * 6;
      for (const k of SKILLS) if (k !== 'gun') st.skills[k] += (opts.startGrade - 1) * 60;
      for (const k of Object.keys(st.stats) as (keyof Stats)[]) st.stats[k] += (opts.startGrade - 1) * 3;
    }
  }
  // 19夜目：頼れる上級生が2〜3人（1〜2年で卒業する。早くから卒業生の流れが見られる）
  if (!opts.startGrade || opts.startGrade <= 1) {
    const nSenior = r.int(...B.student.seniors);
    for (let i = 0; i < nSenior; i++) {
      const g = i === 0 ? 3 : r.chance(0.5) ? 3 : 2;
      const st = generateStudent(s, r, { quality: Math.min(1, st0.quality + 0.2) });
      s.students[st.id] = st;
      st.cohort = 1 - (g - 1); st.grade = g; st.enrollYear = 1 - (g - 1); st.status = 'enrolled'; st.lastAttention = 0;
      st.level = 1 + (g - 1) * 6; st.age += g - 1;
      for (const k of SKILLS) if (k !== 'gun' && (st.skills[k] ?? 0) > 0) st.skills[k] += (g - 1) * 55;
      for (const k of Object.keys(st.stats) as (keyof Stats)[]) st.stats[k] += (g - 1) * 3;
      st.battles = (g - 1) * 4;
      st.trust = 30 + (g - 1) * 10;
      st.targets = autoTargets(s, st, 'balance');
      learnTechs(null, st, false);
    }
  }
  for (let g = 1; g <= 3; g++) s.focus[g] = ['sword', 'lance'];
  // 敵将の名簿（6夜目）
  s.officers = []; s.rivalries = {};
  ensureRosters(s, r);
  ensureLegends(s, r); // 14夜目：伝説の武器の行方
  startNewsDesk(s);
  if (opts.tutorial) s.tutorial = { tour: 0, seen: [] }; // 14夜目：最初の1時間の案内
  s.quests = rollQuests(s);
  ensureRegions(s); // 13夜目：勢力図
  markYear(s); // 14夜目：1年の振り返りの控え
  if (opts.opening !== false) startOpening(s, r);
  return s;
}

export function enrollCohort(s: GameState, list: Student[]): void {
  s.cohortCount += 1;
  for (const st of list) {
    st.cohort = s.cohortCount; st.grade = 1; st.enrollYear = s.year; st.status = 'enrolled';
    st.lastAttention = s.absWeek;
    st.targets = autoTargets(s, st, 'balance');
    s.students[st.id] = st;
    if (st.origin !== 'frontier') s.world.friendship[st.origin as CountryId] = clamp(s.world.friendship[st.origin as CountryId] + 1, -50, 100);
  }
}

const idCollator = new Intl.Collator('en', { numeric: true });
export function enrolled(s: GameState): Student[] {
  return Object.values(s.students).filter((st) => st.status === 'enrolled').sort((a, b) => a.grade - b.grade || idCollator.compare(a.id, b.id));
}
export function graduates(s: GameState): Student[] {
  return Object.values(s.students).filter((st) => st.status === 'graduated');
}
export function available(st: Student): boolean { return st.status === 'enrolled' && st.sickWeeks <= 0 && st.injuredWeeks <= 0; }

/** 兵種補正込みの能力値 */
export function effectiveStats(st: { stats: Stats; classId: string }): Stats {
  const c = CLASSES[st.classId] ?? CLASSES.novice;
  const out = { ...st.stats };
  for (const [k, v] of Object.entries(c.bonus)) out[k as keyof Stats] += v as number;
  return out;
}

export function capacity(s: GameState): number {
  let c = B.student.capacityByRep[0][1];
  for (const [rep, n] of B.student.capacityByRep) if (s.reputation >= rep) c = n;
  return c;
}

export function deployLimit(s: GameState): number {
  const n = enrolled(s).length;
  if (n >= 20) return B.battle.deployAt20;
  if (n >= 12) return B.battle.deployAt12;
  return B.battle.deployBase;
}

export function addMoney(s: GameState, amount: number): void {
  const m = amount > 0 ? Math.round(amount * s.settings.mods.money) : amount;
  s.money = Math.max(0, Math.round(s.money + m));
}
export function addRep(s: GameState, d: number): void {
  const before = s.reputation;
  addRepRaw(s, d > 0 ? d * (1 + fx(s, 'repMul')) : d);
  if (s.reputation > before) {
    reputationRankUp(s, before, s.reputation);
    // 10夜目：評判の段階が上がると、国から武器が届くことがある
    const t0 = repTier(before), t1 = repTier(s.reputation);
    if (t1 > t0) {
      const g = repGift(s, t1, new Rng(s));
      if (g) { takeLoot(s, [g]); notify(s, `学校の評判を聞いて、${WEAPONS[g.weaponId]?.name}が届いた。武器庫に飾っています`); }
    }
  }
}
function addRepRaw(s: GameState, d: number): void {
  s.reputation = clamp(Math.round((s.reputation + d) * 10) / 10, 0, B.school.reputationMax);
}
export function addFriendship(s: GameState, c: CountryId, d: number): void {
  s.world.friendship[c] = clamp(s.world.friendship[c] + (d > 0 ? d * (1 + fx(s, 'friendMul')) : d), -50, 100);
}
export function chronicle(s: GameState, text: string, kind: 'school' | 'world' | 'student' = 'school'): void {
  s.chronicle.push({ year: s.year, month: s.month, text, kind });
}
export function notify(s: GameState, text: string, studentId?: string): void {
  s.notices = s.notices.filter((n) => n.text !== text);
  s.notices.push({ id: `n${s.nextId++}`, text, studentId });
  if (s.notices.length > 30) s.notices.shift();
}
export function mail(s: GameState, from: string, title: string, body: string, studentId?: string, important?: boolean): void {
  s.mail.unshift({ id: `m${s.nextId++}`, year: s.year, month: s.month, from, title, body, read: false, studentId, ...(important ? { important: true } : {}) });
  if (s.mail.length > 120) s.mail.length = 120;
}
/** 15夜目：大事な知らせの書状の題（古いセーブの書状も、題で見分ける） */
export const IMPORTANT_MAIL_TITLES = new Set(['最前線より', '気になる知らせ', '警告の書簡', '傘下への誘い', '敵将のうわさ', '昇格のお知らせ']);
export function mailImportant(m: Mail): boolean { return m.important ?? IMPORTANT_MAIL_TITLES.has(m.title); }
/** 学校のタブ・机の書状に出す赤い数字（大事な知らせの未読だけ） */
export function importantUnread(s: GameState): Mail[] { return s.mail.filter((m) => !m.read && mailImportant(m)); }
export function readAllMail(s: GameState): void { for (const m of s.mail) m.read = true; }
export { COUNTRIES };

/** 傷薬・特効薬の補充（月のはじめ。お金から少し引く） */
export function restockItems(s: GameState): number {
  let spent = 0;
  for (const kind of ['vulnerary', 'elixir'] as const) {
    while (s.items[kind] < B.restock[kind] && s.money - B.itemPrice[kind] >= B.restock.keep) { s.money -= B.itemPrice[kind]; s.items[kind] += 1; spent += B.itemPrice[kind]; }
  }
  return spent;
}
