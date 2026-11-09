// 宿敵の仕組み（6夜目）：敵将の名簿・階級・隠れた特徴・二つ名・数値。文章は officers_text.ts
import type { CountryId } from '../core/types';
import type { LeaderPersonality } from './autobattle';
import enemyIndex from '../../public/enemies/index.json';

/** 敵将の陣営：三国の軍・盗賊団（魔物の群れの頭は名簿を持たない） */
export type FactionId = CountryId | 'bandit' | 'monster';
export const ROSTER_FACTIONS: FactionId[] = ['kingdom', 'empire', 'alliance', 'bandit'];
export const FACTION_NAMES: Record<FactionId, string> = { kingdom: '王国軍', empire: '帝国軍', alliance: '同盟軍', bandit: '盗賊団', monster: '魔物の群れ' };
export const FACTION_COLOR: Record<FactionId, string> = { kingdom: '#2f5fa8', empire: '#b03a2e', alliance: '#4f8f4a', bandit: '#7a6a55', monster: '#5d5470' };

/** 階級（0がいちばん上） */
export const RANK_NAMES: Record<'army' | 'bandit', string[]> = {
  army: ['将軍', '幹部', '隊長'],
  bandit: ['頭目', '幹部', '隊長'],
};

/** 敵将の顔画像（public/enemies/index.json） */
export const ENEMY_FACES: string[] = (enemyIndex as { files: string[] }).files;
export type AgeBand = 'young' | 'middle' | 'old';
export function ageBand(age: number): AgeBand { return age < 30 ? 'young' : age < 50 ? 'middle' : 'old'; }

export const OFFICER = {
  /** 陣営ごとの名簿の人数（階級ごと）。足りなくなれば年度末と月の初めに補う */
  roster: [1, 4, 6] as [number, number, number], // 19夜目：名前のある将を40〜60人に（3,4 → 4,6）
  /** 名簿の最大人数（卒業生の敵将を含む） */
  rosterMax: 13,
  /** 階級ごとの、出てきたときのレベル+（依頼の敵より強い） */
  rankLevel: [3, 2, 1] as [number, number, number],
  /** 戦うたびの成長：倒した生徒1人ごと・傷1つごとのレベル+（上限） */
  victimLevel: 1, scarLevel: 0.5, growthCap: 4,
  /** 年齢（作るとき） */
  ageRange: { young: [22, 29], middle: [30, 49], old: [50, 60] } as Record<AgeBand, [number, number]>,
  /** この年齢を過ぎると、年度末に引退することがある */
  retireAge: 56, retireChance: 0.25,
  /** 名簿から選ぶ重み：会ったことのある敵将・執着している生徒が出撃しているとき */
  metWeight: 2.2, grudgeWeight: 2.5, rivalWeight: 3.0,
  /** 魔物の頭が逃げたとき（名簿はないが、因縁として残る） */
  monsterAgain: 0.35,
  /** 隠れた特徴の数 */
  traitCount: 2,
  /** 特徴が分かる確率：戦いのあと（ふつう／その特徴が表に出たとき／斥候がいるとき+） */
  revealBase: 0.15, revealActive: 0.6, revealScout: 0.3,
  /** 卒業生からの手紙で特徴が分かる（年度末、1年に何通まで・1人あたりの確率） */
  letterMax: 2, letterChance: 0.3,
  /** 卒業生が敵将になる：役職の段階（career.rank）がこれ以上で、年度末にこの確率。陣営ごとの上限 */
  alumniRank: 2, alumniChance: 0.35, alumniMax: 2,
  /** 宿敵の段階：何度戦えば（直接ぶつかった回数）次の段階か */
  stageAt: [2, 3, 5] as [number, number, number],
  /** 倒れた敵将が、深手を負いながら逃げのびる確率（階級ごと）。敵将を倒せば勝ちの戦いでは×0.6 */
  survive: [0.66, 0.62, 0.6] as [number, number, number], surviveBossMul: 0.6, // 14夜目：0.55/0.5/0.45 → 逃げのびて宿敵になりやすく
  /** 仇討ちの誓いを立てる人数（倒された子1人につき） */
  vowMax: 2,
  /** 仇討ちの誓い：その敵将との戦いでの補正 */
  vowMod: { hit: 8, dmg: 2 },
  /** 宿敵（段階2以上）との戦いでの補正 */
  rivalMod: { hit: 4, crit: 3 },
  /** 決着の選択：説得の成功率（性格ごと）、段階1つごと+、卒業生なら信頼/200 */
  persuadeBase: { arrogant: 0.15, veteran: 0.45, cunning: 0.3, proud: 0.5, young: 0.35, cold: 0.2, beast: 0 } as Record<LeaderPersonality, number>,
  persuadePerStage: 0.08,
  /** 決着「討ち取る」：全員の補正、宿敵本人の補正 */
  killMod: { hit: 6, dmg: 1 }, killSelfMod: { hit: 10, dmg: 2 },
  /** 執着：敵将に狙われた子の判断 */
  grudgeGuardMod: { def: 2, avo: 6 }, grudgeFaceMod: { hit: 6, dmg: 1 }, grudgeBaitMod: { hit: 5 },
  /** 傷1つごとの能力の変化（速さ−、守備+） */
  scarStats: { spd: -1, def: 1 },
  /** 二つ名のつく条件：倒した数（戦死は1、重傷は0.5） */
  epithetAt: 1,
  /** 見込みのある兵（9夜目）：陣営ごとの人数、隊長の席が空いたとき抜擢される確率、戦いで名を得る確率（倒した・必殺・粘った・撤退を生き延びた） */
  prospectMax: 4, raiseChance: 0.6, raiseOdds: { victim: 0.45, crit: 0.12, last: 0.15, retreat: 0.1 },
  /** 権力争い：年度末に始まる確率、翌年に頭の座を奪う確率 */
  contestChance: 0.15, contestWin: 0.5,
  /** 弱点を知っていて突いたときの上乗せ */
  exploitMod: { hit: 5, dmg: 1 },
};

/** 依頼の種類ごとに、出てくる敵将の階級 [ふつう, 危険度3のとき] と、上の階級が出る確率 */
export const QUEST_RANK: Record<string, { rank: number; up: number }> = {
  bandit: { rank: 2, up: 0.2 }, escort: { rank: 2, up: 0.1 }, refugee: { rank: 2, up: 0.2 }, rescue: { rank: 2, up: 0.3 },
  border: { rank: 2, up: 0.3 }, defend: { rank: 2, up: 0.3 }, breakout: { rank: 1, up: 0.1 }, fort: { rank: 1, up: 0.15 }, schoolDefense: { rank: 0, up: 0 },
};

/** 敵将の兵種のもと（レベルで上級職に上がる） */
export const OFFICER_CLASSES: Record<'army' | 'bandit', string[]> = {
  army: ['lancer', 'swordsman', 'fighter', 'archer', 'mage', 'armor_knight', 'cavalier', 'monk', 'pegasus_rider'],
  bandit: ['fighter', 'fighter', 'swordsman', 'thief', 'warrior', 'archer'],
};

/** 斥候に向いた兵種（偵察が出せる・戦いのあと特徴が分かりやすい） */
export const SCOUT_CLASSES = ['thief', 'assassin', 'shadow', 'hunter', 'bow_rider', 'pegasus_rider', 'pegasus_knight', 'falcon_knight', 'sniper', 'hawkeye', 'bow_knight', 'bow_lord'];

/** 生徒の性格→卒業生が敵将になったときの性格 */
export const ALUMNI_PERSONALITY: Record<string, LeaderPersonality> = {
  hot: 'young', calm: 'veteran', timid: 'cold', cynic: 'cunning', gentle: 'veteran', serious: 'proud', cheerful: 'young', shy: 'cold', competitive: 'arrogant', whimsical: 'cunning',
};

// ---------- 隠れた特徴（弱点と強み） ----------
export interface OfficerTraitDef {
  id: string; name: string; weak: boolean;
  /** 偵察・手紙で分かったときの説明 */
  desc: string;
  /** 出撃前の画面での、突き方のヒント */
  tip: string;
  /** 敵将を攻撃したときの補正（武器の種類・移動の種類） */
  foe?: { types?: string[]; moveTypes?: string[]; hit?: number; dmg?: number };
  /** 敵将そのものの補正 */
  self?: { hit?: number; avo?: number; def?: number; spd?: number };
  /** 天候で敵将に付く補正 */
  weather?: { w: 'rain' | 'fog'; hit?: number; avo?: number };
  /** この方針のとき、敵将に付く補正（突く） */
  tactic?: { t: string; hit?: number; avo?: number; def?: number };
  /** 部下の補正 */
  men?: { hit?: number };
  /** 逃げやすさの倍率 */
  flee?: number;
  /** 一騎打ちを必ず受ける */
  duel?: boolean;
  /** 傷が2つ以上でつく */
  fromScars?: boolean;
  /** 10夜目：敵将の型（勇士型・将型）。くじでは選ばれず、どの敵将にも1つ。はじめから見える */
  style?: boolean;
  /** 勇士型：倒れると兵が崩れる（味方の命中・回避の補正が敵の兵に） */
  collapse?: { hit: number; avo: number };
}
export const OFFICER_TRAITS: Record<string, OfficerTraitDef> = {
  // 10夜目：敵将の型
  valor: { id: 'valor', name: '武勇に優れる', weak: true, style: true, desc: '自ら先頭に立って戦う勇士。本人はとても強いが、倒れると兵が崩れやすい', tip: '一騎打ちの申し込みがよく効く。討ち取れば兵が崩れる', self: { hit: 8, avo: 5, def: 2 }, collapse: { hit: -10, avo: -10 } },
  marshal: { id: 'marshal', name: '采配に優れる', weak: true, style: true, desc: '後ろから兵を動かす将。兵はよく動くが、本人は討ちやすい', tip: '伏兵・挟み撃ちが効く。敵将を狙えば早く崩せる', self: { def: -2, avo: -5 }, men: { hit: 5 } },
  fire_weak: { id: 'fire_weak', name: '炎に弱い', weak: true, desc: '昔、大火事で逃げ遅れたことがあり、炎を見ると体がすくむ', tip: '魔道の使い手を連れていくと有利', foe: { types: ['magic'], hit: 10, dmg: 3 } },
  bow_fear: { id: 'bow_fear', name: '弓を恐れる', weak: true, desc: '矢傷の古い記憶があり、弓兵を前にすると落ち着きをなくす', tip: '弓の使い手を連れていくと有利', foe: { types: ['bow'], hit: 15, dmg: 1 } },
  duel_bound: { id: 'duel_bound', name: '一騎打ちを断れない', weak: true, desc: '名誉にこだわり、挑まれた一騎打ちは決して断らない', tip: '一騎打ちの機会が必ず来る。腕の立つ子を連れていこう', duel: true },
  night_strong: { id: 'night_strong', name: '夜霧に強い', weak: false, desc: '闇と霧に紛れる戦いを得意とする', tip: '霧の日は手ごわい。晴れた日に戦いたい', weather: { w: 'fog', hit: 5, avo: 15 } },
  loyal: { id: 'loyal', name: '仲間を見捨てない', weak: true, desc: '部下を置いて逃げることはない。部下が倒れると動揺する', tip: '「攻めろ」で部下を崩すと、敵将が乱れる', flee: 0, tactic: { t: 'attack', avo: -10, def: -2 } },
  rain_hate: { id: 'rain_hate', name: '雨を嫌う', weak: true, desc: '雨の日はひどく機嫌が悪く、手元が狂う', tip: '雨の日なら有利', weather: { w: 'rain', hit: -10, avo: -10 } },
  hothead: { id: 'hothead', name: '挑発に乗りやすい', weak: true, desc: 'かっとなると前に出すぎる', tip: '「速攻で敵将を」で誘い出すと、守りが甘くなる', tactic: { t: 'boss', avo: -12 } },
  cautious: { id: 'cautious', name: '逃げ足が速い', weak: false, desc: '形勢が悪いと見るや、すぐに退く', tip: '「速攻で敵将を」なら逃がさずに済む', flee: 2, tactic: { t: 'boss', hit: 0 } },
  flier_weak: { id: 'flier_weak', name: '空からの攻めに弱い', weak: true, desc: '頭上からの攻撃への備えが薄い', tip: '天馬・竜など空を飛ぶ子が有利', foe: { moveTypes: ['flying'], hit: 15, dmg: 2 } },
  sword_master: { id: 'sword_master', name: '剣の達人', weak: false, desc: '剣の太刀筋を読みきる。剣で挑むのは分が悪い', tip: '剣以外の武器で挑もう', foe: { types: ['sword'], hit: -15 } },
  iron_wall: { id: 'iron_wall', name: '守りが固い', weak: false, desc: '分厚い守りで、並の攻撃を受け流す。ただし魔法には弱い', tip: '魔法なら守りを抜ける', self: { def: 3 }, foe: { types: ['magic', 'holy'], dmg: 3 } },
  charisma: { id: 'charisma', name: '部下に慕われる', weak: false, desc: '部下が奮い立ち、いつも以上の力を出す', tip: '敵将を早く倒せば、部下の勢いも止まる', men: { hit: 5 } },
  old_wound: { id: 'old_wound', name: '古傷が痛む', weak: true, desc: '前の戦いの傷が癒えず、動きが鈍い', tip: '速さで上回れる', self: { spd: -2 }, fromScars: true },
};
export const TRAIT_IDS = Object.keys(OFFICER_TRAITS).filter((k) => !OFFICER_TRAITS[k].fromScars && !OFFICER_TRAITS[k].style);
/** 敵将の型（10夜目：個の武と采配の2つの軸） */
export const STYLE_IDS = ['valor', 'marshal'] as const;

// ---------- 二つ名 ----------
/** 倒した相手から：{v}は生徒の名 */
export const EPITHET_VICTIM = { dead: ['{v}殺しの', '{v}討ちの'], injured: ['{v}斬りの', '{v}崩しの'] };
/** 戦い方（武器の種類）から */
export const EPITHET_WEAPON: Record<string, string[]> = {
  sword: ['血刃の', '鉄刃の'], lance: ['串刺しの', '長槍の'], axe: ['首狩りの', '大斧の'], bow: ['百舌の', '鷹目の'],
  magic: ['焦土の', '黒炎の'], holy: ['白光の'], gun: ['硝煙の'], staff: ['不死身の'],
};
/** 性格から */
export const EPITHET_PERSONALITY: Record<LeaderPersonality, string[]> = {
  arrogant: ['驕れる', '暴君の'], veteran: ['古強者の', '不落の'], cunning: ['毒蛇の', '影縫いの'], proud: ['誇り高き', '白銀の'],
  young: ['若獅子の', '昇り竜の'], cold: ['氷の', '鉄面の'], beast: ['人喰いの'],
};
/** 二度目以降（倒した数が多い） */
export const EPITHET_MANY = ['学徒殺しの', '死神の', '鬼の'];

/** 頭（いちばん上の階級）の性格で、その陣営の依頼・戦況が少し変わる */
export const HEAD_EFFECT: Record<LeaderPersonality, { level: number; reward: number; tension: number; duel: number; flee: number }> = {
  arrogant: { level: 1, reward: 1.0, tension: 2, duel: 0.1, flee: 0 },
  veteran: { level: 0, reward: 1.0, tension: -1, duel: 0, flee: 0.1 },
  cunning: { level: 0, reward: 1.1, tension: 1, duel: -0.1, flee: 0.15 },
  proud: { level: 0, reward: 1.0, tension: 0, duel: 0.15, flee: -0.1 },
  young: { level: 1, reward: 1.05, tension: 2, duel: 0.1, flee: 0 },
  cold: { level: 0, reward: 1.1, tension: 1, duel: -0.05, flee: 0 },
  beast: { level: 0, reward: 1, tension: 0, duel: 0, flee: 0 },
};

/** 宿敵の段階の名前（0は「顔見知り」で、名簿には出さない） */
export const RIVAL_STAGE_NAMES = ['顔見知り', '因縁', '宿敵', '生涯の宿敵'];
