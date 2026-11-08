// 策（作戦カード）・陣形・部隊（9夜目）。数値と文章。計算は core/stratagems.ts
import type { UnitMod } from './autobattle';
import type { MoveType } from '../core/types';

export type StratId = 'rally' | 'ambush' | 'feint' | 'withdraw' | 'fire' | 'night' | 'pincer' | 'hold' | 'rush' | 'duel' | 'decoy' | 'starve' | 'scout';
export type Weather = 'clear' | 'rain' | 'fog';

/** マップの地形の印（策の効く・効かないに使う） */
export const MAP_TAGS: Record<string, string[]> = {
  training: ['plain'], forest_road: ['forest', 'road'], border_village: ['village', 'plain'], mountain_fort: ['fort', 'mountain'],
  river_bridge: ['river', 'bridge'], hill_camp: ['hill', 'forest'], ruins: ['town'], old_keep: ['fort', 'keep'], prison: ['keep'], school: ['fort'],
};
export const TAG_NAMES: Record<string, string> = { plain: '平原', forest: '森', road: '街道', village: '村', fort: '砦', mountain: '山', river: '川', bridge: '橋', hill: '丘', town: '街', keep: '城' };

export interface StratEffect {
  /** 味方全員・敵全員・敵将への補正 */
  ally?: UnitMod; foe?: UnitMod; leaderFoe?: UnitMod;
  /** 敵全員のHPを最大HPのこの割合だけ減らす（火・伏兵） */
  foeHpPct?: number;
  /** 味方の重傷で済む確率+（%） */
  injury?: number;
  /** 一騎打ちを必ず申し込ませる */
  duel?: boolean;
  /** 敵将が逃げられない */
  noFlee?: boolean;
  /** 戦いのあと敵将の特徴が1つ分かる */
  reveal?: boolean;
}
export interface StratDef {
  id: StratId; name: string; mark: string;
  desc: string;
  /** open＝開戦で、mid＝ぶつかり合いのあと（ここぞの判断で早めに切れる） */
  when: 'open' | 'mid';
  /** 成功しやすさのもと（%） */
  base: number;
  /** 効きやすい地形（MAP_TAGS）・天候・勝利条件 */
  terrain?: string[]; weather?: Weather[]; objectives?: string[];
  /** 効かない天候（不発） */
  fizzle?: Weather[];
  /** 突ける敵将の特徴（その特徴があれば大きく有利）／相性の悪い特徴 */
  weak?: string[]; bad?: string[];
  /** 味方に要る兵種の移動（騎馬・飛行など）・人数 */
  needMove?: MoveType[]; minMembers?: number;
  /** 部隊長の魅力で成功しやすい */
  captainCha?: boolean;
  win: StratEffect;
  lose: StratEffect;
  /** 覚える条件（どれか）：start＝はじめから／strat＝在籍の誰かの軍略がこれ以上／cha＝誰かの魅力／move＝その移動の兵種の子がいて軍略これ以上／talent＝才能が分かった子 */
  unlock: { start?: boolean; strat?: number; cha?: number; move?: { types: MoveType[]; strat: number }; talent?: string[] };
  /** 出撃前のひとこと（効く条件） */
  tip: string;
  /** 黄色い帯の文：成功／外れ／不発。{leader}＝敵将、{a}＝策を立てた子、{c}＝部隊長 */
  ok: string[]; ng: string[]; dud?: string[];
}

export const STRATS: Record<StratId, StratDef> = {
  rally: { id: 'rally', name: '鼓舞', mark: '鼓', when: 'open', base: 55, captainCha: true,
    desc: '部隊長が皆を奮い立たせる。どこでも使えるが、効き目は部隊長の魅力しだい',
    win: { ally: { hit: 4, avo: 2 } }, lose: { ally: { hit: -2 } }, unlock: { start: true },
    tip: '部隊長の魅力が高いほど効く',
    ok: ['{c}の声が戦場に響いた。「行くぞ！」――皆の目に火がともる', '{c}が{craise}。部隊の足並みがそろった'], ng: ['{c}の声は、敵の鬨の声にかき消された……'] },
  ambush: { id: 'ambush', name: '伏兵', mark: '伏', when: 'open', base: 40, terrain: ['forest', 'hill', 'town', 'village'], weak: ['hothead', 'marshal'], bad: ['cautious', 'night_strong'],
    desc: '物陰に兵を伏せ、敵の背後を突く。森・丘・街で効きやすい',
    win: { foeHpPct: 0.12, ally: { hit: 4, crit: 3 } }, lose: { ally: { avo: -5 } }, unlock: { start: true },
    tip: '森・丘・街・村なら効きやすい。挑発に乗りやすい敵将に強い',
    ok: ['森から伏兵が飛び出した！ 敵の背後を突く', '{a}の読みどおり、敵は伏兵の真ん中へ踏みこんだ！'], ng: ['伏兵の気配を読まれた！ 隠れていた子たちが追い立てられる……'] },
  feint: { id: 'feint', name: '陽動', mark: '陽', when: 'open', base: 45, weak: ['hothead', 'loyal'], bad: ['cautious'],
    desc: '別の方向で騒ぎを起こし、敵の目をそらす。守りがゆるんだところを突く',
    win: { foe: { avo: -8, def: -1 }, leaderFoe: { avo: -6 } }, lose: { ally: { hit: -4 } }, unlock: { start: true },
    tip: '挑発に乗りやすい・仲間を見捨てない敵将に強い',
    ok: ['陽動に釣られ、敵の陣が横に伸びた！ 守りが薄い', '{leader}が囮の旗を追って前に出た！'], ng: ['陽動は見抜かれた。敵は動かない……'] },
  withdraw: { id: 'withdraw', name: '退き陣', mark: '退', when: 'mid', base: 60,
    desc: '退く道を先に決めておく。傷ついた子を下げやすく、倒れても重傷で済みやすい',
    win: { injury: 10, ally: { avo: 3 } }, lose: { ally: { hit: -3 } }, unlock: { start: true },
    tip: 'どこでも使える。危ない依頼の守り札',
    ok: ['{a}の合図で、退く道が開かれた。傷ついた子から下がっていく', '退き陣が整った。これで誰も置いていかない'], ng: ['退く道が敵にふさがれた！ 下がりたくても下がれない……'] },
  fire: { id: 'fire', name: '火計', mark: '火', when: 'open', base: 40, terrain: ['forest', 'village', 'town', 'fort', 'hill'], weather: ['clear'], fizzle: ['rain'], weak: ['fire_weak'], bad: ['iron_wall'],
    desc: '火を放って敵を混乱させる。雨の日は火がつかない',
    win: { foeHpPct: 0.18, foe: { hit: -5 } }, lose: { ally: { hit: -3, avo: -3 } }, unlock: { strat: 30 },
    tip: '晴れた日の森・村・砦で効く。炎に弱い敵将には大きく効く。雨では不発',
    ok: ['火の手が上がった！ 煙にまかれた敵が逃げまどう', '{leader}の陣に火が回る！'], ng: ['火は風にあおられ、こちらへ向かってきた！'], dud: ['雨で火がつかない……火計は不発に終わった'] },
  night: { id: 'night', name: '夜襲', mark: '夜', when: 'open', base: 35, weather: ['fog'], bad: ['night_strong', 'cautious'],
    desc: '夜明け前に忍び寄って襲う。霧の日は特に効く',
    win: { foe: { hit: -8, avo: -8 } }, lose: { ally: { avo: -6 } }, unlock: { strat: 45 },
    tip: '霧の日に効く。夜霧に強い敵将には効かない',
    ok: ['闇にまぎれて陣へ忍びこんだ！ 敵はまだ寝ぼけている', '霧の中から襲いかかる。敵は何が起きたか分からない！'], ng: ['夜襲は待ち伏せられていた！ 敵の松明に囲まれる……'] },
  pincer: { id: 'pincer', name: '挟み撃ち', mark: '挟', when: 'mid', base: 35, terrain: ['river', 'bridge', 'plain', 'road'], minMembers: 5, weak: ['marshal'],
    desc: '部隊を二つに分けて、前と後ろから挟む。川や橋で効きやすい。人数が要る',
    win: { foe: { def: -2, avo: -6 }, ally: { dmg: 1 } }, lose: { ally: { def: -1, hit: -2 } }, unlock: { strat: 60, talent: ['strategist', 'leader'] },
    tip: '川・橋・平原で効く。5人以上で',
    ok: ['回りこんだ別働隊が背後に現れた！ 挟み撃ちだ', '{a}の合図で、前と後ろから同時に攻めかかる！'], ng: ['別働隊がたどり着けない！ 部隊が二つに割れたまま……'] },
  hold: { id: 'hold', name: '籠城', mark: '籠', when: 'open', base: 55, terrain: ['fort', 'bridge', 'keep'], objectives: ['defend', 'escort'],
    desc: '守りやすい場所に陣を構えて迎え撃つ。守る戦いに強い',
    win: { ally: { def: 3, avo: 5 } }, lose: { ally: { hit: -4 } }, unlock: { strat: 25 },
    tip: '砦・橋・城、守る戦いで効く',
    ok: ['柵と盾で陣を固めた。敵の勢いが止まる', '{c}の指図で守りの陣が組み上がった'], ng: ['陣を組む前に敵が来た！ 守りが中途半端だ……'] },
  rush: { id: 'rush', name: '奇襲の早駆け', mark: '駆', when: 'open', base: 45, needMove: ['cavalry', 'flying'], weak: ['cautious'], bad: ['iron_wall'],
    desc: '馬や天馬で一気に駆けこみ、敵将を逃がさない。騎馬か飛行の子が要る',
    win: { ally: { hit: 6, crit: 4 }, noFlee: true }, lose: { ally: { avo: -6 } }, unlock: { move: { types: ['cavalry', 'flying'], strat: 40 } },
    tip: '騎馬・飛行の子がいると使える。逃げ足の速い敵将に強い',
    ok: ['蹄の音が響く！ 早駆けで敵将の退路を断った', '空と地から一気に駆けこむ。敵は逃げ場を失った！'], ng: ['駆けこみすぎた！ 先頭の子が囲まれる……'] },
  duel: { id: 'duel', name: '一騎打ちの申し込み', mark: '騎', when: 'mid', base: 45, weak: ['duel_bound', 'hothead', 'valor'], bad: ['cautious'],
    desc: '敵将に一騎打ちを申し込む。受ければ、腕の立つ子が敵将と戦える',
    win: { duel: true, leaderFoe: { avo: -5 } }, lose: { ally: { hit: -3 } }, unlock: { cha: 30 },
    tip: '一騎打ちを断れない・挑発に乗りやすい敵将に強い',
    ok: ['{c}が前に出て名乗りを上げた。{leader}が応じる！', '{leader}「面白い、受けて立とう」――一騎打ちの場が開かれた'], ng: ['{leader}は申し出を鼻で笑った。部隊の士気が下がる……'] },
  decoy: { id: 'decoy', name: '囮', mark: '囮', when: 'mid', base: 40, weak: ['loyal', 'hothead'],
    desc: 'わざと隙を見せて敵を引きつけ、その間に横から叩く',
    win: { foe: { hit: -6 }, leaderFoe: { avo: -8 }, ally: { crit: 5 } }, lose: { ally: { def: -2 } }, unlock: { cha: 32, strat: 40 },
    tip: '仲間を見捨てない・挑発に乗りやすい敵将に強い',
    ok: ['囮に食いついた！ 敵の横腹ががら空きだ', '{leader}が囮を追って陣を離れた！'], ng: ['囮が本当に囲まれてしまった！'] },
  starve: { id: 'starve', name: '兵糧攻め', mark: '糧', when: 'open', base: 45, terrain: ['fort', 'keep'], objectives: ['seize', 'boss', 'defend'],
    desc: '敵の兵糧を断ってから攻める。砦や城の敵は腹をすかせて弱る',
    win: { foe: { hit: -6, avo: -4, dmg: -1 } }, lose: { ally: { hit: -2 } }, unlock: { strat: 75, talent: ['strategist'] },
    tip: '砦・城の敵に効く',
    ok: ['兵糧を断たれた敵は、もう何日も食べていない。足元がふらつく', '{a}が見つけた抜け道で、敵の兵糧を焼き払った！'], ng: ['兵糧は別の道から運びこまれていた……'] },
  scout: { id: 'scout', name: '物見', mark: '物', when: 'open', base: 65,
    desc: '先に物見を出して敵の陣を探る。戦いのあと、敵将の特徴が分かりやすい',
    win: { ally: { hit: 3 }, reveal: true }, lose: {}, unlock: { strat: 20 },
    tip: 'どこでも使える。敵将の特徴を探りたいときに',
    ok: ['物見が戻ってきた。敵の陣の形はつかんだ', '{a}が敵の動きを読み切った'], ng: ['物見は敵に見つかって引き返してきた'] },
};
export const STRAT_IDS = Object.keys(STRATS) as StratId[];

export const STRAT = {
  /** 出撃前に選べる策の数（先生の「軍師の眼」で+1） */
  slots: 2,
  /** 成功率：策を立てる子の軍略・魅力、軍師の才、地形・天候・勝利条件が合う、敵将の弱点・苦手、人数・兵種が足りない、早めに切った */
  plannerStrat: 0.2, plannerCha: 0.25, talent: 10, captainCha: 0.3,
  terrainFit: 12, weatherFit: 10, objectiveFit: 10, weakHit: 20, badHit: -25, missingNeed: -30, early: 10,
  min: 5, max: 90,
  /** 弱点を突いたとき、効き目が大きくなる倍率 */
  weakMul: 1.5,
  /** 軍略：授業でたまる量（顔の子は×faceMul）・戦いで策を立てた子・軍師の才 */
  lessonGain: { tactics: 1, history: 0.7 } as Record<string, number>, faceMul: 2, plannerGain: 1, talentMul: 1.5, stratMax: 100,
  /** 10夜目：部隊長を務めた戦いで身につく統率（技能ポイント） */
  captainGain: 4,
  /** 10夜目：軍略がこのくらい（C）の教え子が敵将になると、策の見込みがこれだけ下がる */
  alumniSeeAt: 140, alumniSee: 15,
};

/** 陣形（9夜目）：前列は狙われやすく、後列は守られる */
export const FORMATION = {
  /** 敵が狙う相手を選ぶときの点（前列+、後列−） */
  frontAggro: 12, backAggro: -20,
  front: { def: 1 } as UnitMod, back: { avo: 4 } as UnitMod,
};

/** 部隊（9夜目）：在籍の人数で部隊の数が増える。2つ目からの部隊の人数 */
export const SQUADS = {
  /** 在籍がこの人数を超えると2部隊、この人数以上で3部隊 */
  two: 20, three: 30,
  /** 2つ目・3つ目の部隊の人数の上限 */
  extraLimit: 6,
  /** 部隊長の腕前（魅力＋軍略）10ごとの命中+ */
  captainPer10: 0.5, captainMax: 2,
  /** 教官が同行しない部隊（10夜目）：部隊長がここぞの判断で「おすすめ」を選ぶ見込み。もと＋部隊長の腕前・策を立てる子の腕前（上限あり） */
  away: { base: 0.4, perCaptain: 0.01, perPlanner: 0.004, max: 0.9 },
};

export const ROW_NAMES = { front: '前列', back: '後列' };
