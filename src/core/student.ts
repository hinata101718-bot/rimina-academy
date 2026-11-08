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
  const given = rng.pick(gender === 'm' ? list.male : list.female);
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

  // 才能
  let talent: string | null = null;
  if (parents && (parents[0].talent || parents[1].talent) && rng.chance(0.6)) {
    talent = rng.pick([parents[0].talent, parents[1].talent].filter(Boolean) as string[]);
  } else if (rng.chance(B.student.heroChance)) talent = 'hero';
  else if (rng.chance(B.student.talentChance + q * 0.15)) {
    const ids = Object.keys(TALENTS).filter((k) => TALENTS[k].weight > 0);
    talent = rng.weighted(ids, (k) => TALENTS[k].weight);
  }

  // 能力値
  const stats: Stats = emptyStats();
  const growth: Stats = emptyStats();
  for (const k of STATS) {
    const bonus = Math.round(q * 2);
    stats[k] = k === 'hp' ? rng.int(...B.student.hpStart) + bonus : rng.int(B.student.statStart[0], B.student.statStart[1]) + (rng.chance(q) ? 1 : 0);
    let g = rng.int(...B.student.growthBase) + Math.round(q * B.student.growthQuality);
    if (k === 'hp') g += B.student.hpGrowthBonus;
    if (parents) g = Math.round((g + (parents[0].growth[k] + parents[1].growth[k]) / 2) / 2);
    growth[k] = g;
  }
  if (talent) for (const [k, v] of Object.entries(TALENTS[talent].stats)) growth[k as keyof Stats] += v as number;
  // 出身・家柄の補正
  if (house === 'noble') { growth.cha += 5; stats.cha += 1; }
  if (house === 'orphan') { growth.spd += 5; growth.lck -= 3; }
  if (origin === 'kingdom') growth.def += 3;
  if (origin === 'empire') growth.str += 3;
  if (origin === 'alliance') growth.mag += 3;
  for (const k of STATS) growth[k] = clamp(growth[k], 5, 95);

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

  const st: Student = {
    id: newId(s), given, family, gender, age, birthYear: s.year - age,
    origin, house, personality, dream, traits, knownTraits, talent, talentReveal: 0,
    stats, growth, growthKnown: false, level: 1, exp: 0, skills, targets, targetsAuto: true,
    classId: 'novice', motivation: 2, fatigue: 0, sickWeeks: 0, injuredWeeks: 0, trust: 10,
    grade: 1, cohort: 0, enrollYear: s.year, status: 'enrolled', lowMotivWeeks: 0, dropoutSign: null,
    lastAttention: s.absWeek, spotlightCount: 0, examMonth: -1, face, faceImage: null, recent: [],
    kills: 0, battles: 0, weaponUse: {}, bestGrade: null, memories: [], offers: [], exhibitionScore: 0,
    career: null, history: [], farewell: null, keepsake: null,
    parents: parents ? [parents[0].id, parents[1].id] : [], children: [], spouse: null, diedYear: null, deathNote: null,
    spells: [],
  };
  st.spellPlan = makeSpellPlan(st);
  learnSpells(null, st);
  st.birthday = birthdayFor(st.id + st.given);
  return st;
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
