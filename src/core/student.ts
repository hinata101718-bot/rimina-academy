// 生徒の自動生成
import { makeSpellPlan, learnSpells } from './spells';
import { B, SKILLS, STATS } from '../data/balance';
import { NAMES } from '../data/names';
import {
  DREAMS, TRAITS, TALENTS, PERSONALITY_IDS, ORIGIN_WEIGHTS, HOUSE_WEIGHTS,
  HAIR_TENDENCY, SKIN_TENDENCY, CLOTH_COLORS, COUNTRY_FAVOR_SKILLS, HAIR_COLORS,
} from '../data/people';
import type { Origin, House, Gender, SkillId, Stats, CountryId } from './types';
import type { Student, FaceParts, GameState } from './state';
import { Rng } from './rng';
import { emptySkills, emptyStats, clamp } from './util';
import { round5 } from './growth';
import { assignApt, assignBud, fitTotal } from './aptitude';
import { takenNames } from './officers';

export interface GenOptions {
  origin?: Origin;
  house?: House;
  quality?: number;    // 0..1 評判による質
  orphanBias?: number; // 戦災孤児の増加
  parents?: [Student, Student];
}

function weightedKey<T extends string>(rng: Rng, w: Record<T, number>): T {
  const keys = Object.keys(w) as T[];
  return rng.weighted(keys, (k) => w[k]);
}
function weightedIndex(rng: Rng, w: number[]): number {
  return rng.weighted(w.map((_, i) => i), (i) => w[i]);
}

export function generateFace(rng: Rng, origin: Origin, gender: Gender): FaceParts {
  return {
    hair: weightedIndex(rng, HAIR_TENDENCY[origin]),
    hairStyle: gender === 'f' ? rng.pick([0, 1, 2, 3, 4, 5, 10, 11]) : rng.pick([5, 6, 7, 8, 9, 10, 2, 11]),
    skin: weightedIndex(rng, SKIN_TENDENCY[origin]),
    eyes: rng.int(0, 4),
    cloth: rng.pick(CLOTH_COLORS[origin]),
    mouth: rng.int(0, 3),
    brows: rng.int(0, 2),
    accessory: rng.chance(0.15) ? rng.int(1, 3) : 0,
  };
}

export function newId(s: GameState, prefix = 's'): string {
  return `${prefix}${s.nextId++}`;
}

export function generateStudent(s: GameState, rng: Rng, opt: GenOptions = {}): Student {
  const q = opt.quality ?? 0;
  const parents = opt.parents;
  let origin: Origin = opt.origin ?? weightedKey(rng, ORIGIN_WEIGHTS);
  if (parents) origin = rng.pick([parents[0].origin, parents[1].origin]);
  const houseW = { ...HOUSE_WEIGHTS };
  if (opt.orphanBias) houseW.orphan += opt.orphanBias;
  let house: House = opt.house ?? weightedKey(rng, houseW);
  if (origin === 'frontier' && house === 'noble') house = 'commoner';
  if (parents) house = parents[0].house === 'noble' || parents[1].house === 'noble' ? 'noble' : 'commoner';
  const gender: Gender = rng.chance(0.5) ? 'm' : 'f';
  const list = NAMES[origin];
  // 10夜目：今いる生徒・敵将（名を得た一般兵も）と同じ名前はなるべく避ける
  const taken = takenNames(s);
  let given = rng.pick(gender === 'm' ? list.male : list.female);
  for (let k = 0; k < 8 && taken.has(given); k++) given = rng.pick(gender === 'm' ? list.male : list.female);
  let family = parents ? parents[0].family : rng.pick(list.family);
  if (!parents && house === 'noble' && list.noblePrefix && !family.startsWith(list.noblePrefix)) family = `${list.noblePrefix}・${family}`;
  if (house === 'orphan' && !parents) family = rng.chance(0.5) ? family : '';

  const older = rng.chance(B.student.olderChance);
  const age = older ? rng.int(...B.student.olderAge) : rng.int(...B.student.startAge);
  const personality = rng.pick(PERSONALITY_IDS);
  const dream = rng.weighted(DREAMS, (d) => d.weight).id;
  const dreamDef = DREAMS.find((d) => d.id === dream)!;

  // 特徴タグ
  const traitIds = Object.keys(TRAITS);
  const nTraits = rng.int(...B.student.traitCount);
  const traits: string[] = [];
  while (traits.length < nTraits) {
    const t = rng.weighted(traitIds, (id) => TRAITS[id].weight);
    if (traits.includes(t)) continue;
    if ((t === 'early' && traits.includes('late')) || (t === 'late' && traits.includes('early'))) continue;
    if ((t === 'diligent' && traits.includes('lazy')) || (t === 'lazy' && traits.includes('diligent'))) continue;
    if ((t === 'friendly' && traits.includes('lone_wolf')) || (t === 'lone_wolf' && traits.includes('friendly'))) continue;
    traits.push(t);
  }
  const knownTraits = traits.filter((t) => TRAITS[t].visible);

  // 10夜目：隠れた才能はなくした（得意・苦手・眠った芽が引き継ぐ）
  const talent: string | null = null;

  // 能力値
  const stats: Stats = emptyStats();
  for (const k of STATS) {
    const bonus = Math.round(q * 2);
    stats[k] = k === 'hp' ? rng.int(...B.student.hpStart) + bonus : rng.int(B.student.statStart[0], B.student.statStart[1]) + (rng.chance(q) ? 1 : 0);
  }
  // 10夜目：本人の成長率（風花雪月くらいの基準）。夢に合う能力ほど「得意な能力」になりやすい
  const growth = rollGrowth(rng, dreamDef.skills, q);
  if (parents) for (const k of STATS) growth[k] = Math.round((growth[k] + (parents[0].growth[k] + parents[1].growth[k]) / 2) / 2);
  // 出身・家柄の補正
  if (house === 'noble') { growth.cha += 5; stats.cha += 1; }
  if (house === 'orphan') { growth.spd += 5; growth.lck -= 5; }
  if (origin === 'kingdom') growth.def += 5;
  if (origin === 'empire') growth.str += 5;
  if (origin === 'alliance') growth.mag += 5;
  // 8夜目：成長率は5%きざみ（ヒナタさん指定）
  for (const k of STATS) growth[k] = clamp(round5(growth[k]), k === 'hp' ? 35 : 15, 70);
  fitTotal(growth);

  // 技能の初期値：夢と出身国に沿った技能を少し
  const skills = emptySkills(0);
  const favored: SkillId[] = [...dreamDef.skills];
  if (origin !== 'frontier') favored.push(...COUNTRY_FAVOR_SKILLS[origin as CountryId].filter((k) => k !== 'gun'));
  for (let i = 0; i < 3; i++) {
    const sk = favored.length ? rng.pick(favored) : rng.pick(SKILLS.filter((k) => k !== 'gun'));
    skills[sk] = Math.max(skills[sk], rng.int(...B.student.startSkillPoints));
  }
  // 目標技能（夢に沿ったものを初期値に）
  const t1 = (dreamDef.skills[0] ?? highestSkill(skills)) as SkillId;
  const rest = SKILLS.filter((k) => k !== t1 && k !== 'gun').sort((a, b) => skills[b] - skills[a]);
  const targets: [SkillId, SkillId] = [t1, (dreamDef.skills[1] && dreamDef.skills[1] !== t1 ? dreamDef.skills[1] : rest[0]) as SkillId];

  const face = generateFace(rng, origin, gender);
  if (parents) { face.hair = parents[0].face.hair; if (rng.chance(0.5)) face.hairStyle = parents[1].face.hairStyle; }

  void TALENTS;
  const st: Student = {
    id: newId(s), given, family, gender, age, birthYear: s.year - age,
    origin, house, personality, dream, traits, knownTraits, talent, talentReveal: 0,
    stats, growth, growthKnown: true, level: 1, exp: 0, skills, targets, targetsAuto: true,
    classId: 'novice', motivation: 2, fatigue: 0, sickWeeks: 0, injuredWeeks: 0, trust: 10,
    grade: 1, cohort: 0, enrollYear: s.year, status: 'enrolled', lowMotivWeeks: 0, dropoutSign: null,
    lastAttention: s.absWeek, spotlightCount: 0, examMonth: -1, face, faceImage: null, recent: [],
    kills: 0, battles: 0, weaponUse: {}, bestGrade: null, memories: [], offers: [], exhibitionScore: 0,
    career: null, history: [], farewell: null, keepsake: null,
    parents: parents ? [parents[0].id, parents[1].id] : [], children: [], spouse: null, diedYear: null, deathNote: null,
    spells: [],
  };
  // 10夜目：得意・苦手（入学時から見える）と眠った芽。親の得意を受け継ぐことがある
  const inherit = parents ? [...new Set([...(parents[0].apt?.good ?? []), ...(parents[1].apt?.good ?? [])])].filter(() => rng.chance(0.35)).slice(0, 1) : [];
  assignApt(st, rng, inherit);
  assignBud(st, rng);
  st.spellPlan = makeSpellPlan(st);
  learnSpells(null, st);
  st.birthday = birthdayFor(st.id + st.given);
  return st;
}

/** 本人の成長率を作る：得意な能力2〜3つ（50〜65）・苦手2つ（20〜30）・ほか（30〜45）、HP（40〜65） */
const STAT_FOR_SKILL: Partial<Record<SkillId, (keyof Stats)[]>> = {
  sword: ['str', 'spd'], lance: ['str', 'def'], axe: ['str', 'hp'], bow: ['skl', 'spd'], magic: ['mag', 'res'], faith: ['mag', 'res'],
  riding: ['spd', 'def'], heavy: ['def', 'hp'], flying: ['spd', 'res'], gun: ['skl'], tactics: ['skl', 'cha'], command: ['cha', 'def'],
};
export function rollGrowth(rng: Rng, favor: SkillId[], q = 0): Stats {
  const g: Stats = emptyStats();
  const keys = STATS.filter((k) => k !== 'hp');
  const pref: Record<string, number> = {};
  for (const sk of favor) for (const k of STAT_FOR_SKILL[sk] ?? []) pref[k] = (pref[k] ?? 0) + 1;
  // 並べる順：好みのある能力ほど前（得意な能力）になりやすい
  const order = [...keys].map((k) => ({ k, v: rng.next() + (pref[k] ?? 0) * 0.35 })).sort((a, b) => b.v - a.v).map((x) => x.k);
  const nHigh = rng.chance(0.5) ? 3 : 2;
  order.forEach((k, i) => {
    const band = i < nHigh ? B.student.growthHigh : i >= order.length - 2 ? B.student.growthLow : B.student.growthMid;
    g[k] = rng.int(band[0], band[1]);
  });
  g.hp = rng.int(...B.student.growthHp);
  if (q > 0 && rng.chance(q)) g[rng.pick(keys)] += 5;
  return g;
}

function highestSkill(sk: Record<SkillId, number>): SkillId {
  return (Object.keys(sk) as SkillId[]).filter((k) => k !== 'gun').sort((a, b) => sk[b] - sk[a])[0];
}

export function fullName(st: Student): string { return st.family ? `${st.given}・${st.family}` : st.given; }
export function hairName(st: Student): string { return HAIR_COLORS[st.face.hair]; }

export function dreamOf(st: Student) { return DREAMS.find((d) => d.id === st.dream)!; }
export function hasDream(st: Student): boolean { return st.dream !== 'none'; }

/** 誕生日（名前とidから決める。古いセーブの生徒にも同じ方法で付けられ、ゲームの乱数の流れを変えない） */
export function birthdayFor(key: string): { month: number; week: number } {
  let h = 7;
  for (const c of key) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return { month: h % 12, week: 1 + (Math.floor(h / 12) % 4) };
}
