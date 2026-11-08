// 自動の戦闘（5夜目）：作戦の方針・役割・敵将・数値。文章は autobattle_text.ts
import type { Quest } from '../core/state';

export type Objective = Quest['objective'];
export type TacticId = 'careful' | 'attack' | 'protect' | 'boss' | 'rescue' | 'hold';

export interface UnitMod { hit?: number; avo?: number; dmg?: number; def?: number; crit?: number }

export interface TacticDef {
  id: TacticId; name: string; desc: string;
  /** この方針が合う勝利条件 */
  fits: Objective[];
  mod: UnitMod;
  /** HPがこの割合を下回った子は、無理をせず下がる */
  carefulHp: number;
  /** 重傷で済む確率+（%） */
  injury: number;
  /** 敵将を優先して狙う */
  focusBoss?: boolean;
  /** 救出・護衛・突破の目的を優先する（弱っていても目的へ向かう） */
  focusGoal?: boolean;
  /** 勢いの見え方（場面の文の選び方に使う） */
  tone: 'calm' | 'bold' | 'warm' | 'sharp';
}

export const TACTICS: Record<TacticId, TacticDef> = {
  careful: { id: 'careful', name: '慎重に', desc: '無理をしない。弱った子はすぐ下げる。勝ちにくいが、けがは少ない', fits: [], mod: { avo: 6, hit: -3 }, carefulHp: 0.6, injury: 5, tone: 'calm' },
  attack: { id: 'attack', name: '攻めろ', desc: '前へ出て一気に押す。勝ちやすいが、倒れる子も出やすい', fits: ['rout', 'escape'], mod: { hit: 6, dmg: 1, avo: -6 }, carefulHp: 0.3, injury: -5, tone: 'bold' },
  protect: { id: 'protect', name: '仲間を守れ', desc: '近くの仲間をかばい合う。支援が深まりやすく、重傷で済みやすい', fits: ['escort', 'defend'], mod: { def: 1, dmg: -1 }, carefulHp: 0.5, injury: 10, tone: 'warm' },
  boss: { id: 'boss', name: '速攻で敵将を', desc: '敵将を真っ先に狙う。敵将を倒せば勝ちの戦いに強い', fits: ['boss', 'seize'], mod: { hit: 3, crit: 3 }, carefulHp: 0.4, injury: 0, focusBoss: true, tone: 'sharp' },
  rescue: { id: 'rescue', name: '救出・護衛を優先', desc: '目的の人のもとへまっすぐ向かう。敵を倒すのは後回し', fits: ['rescue', 'escort', 'escape'], mod: { avo: 3 }, carefulHp: 0.35, injury: 0, focusGoal: true, tone: 'warm' },
  hold: { id: 'hold', name: '守りを固めろ', desc: '陣を固めて迎え撃つ。守る戦いに強い', fits: ['defend'], mod: { def: 2, avo: 3, hit: -2 }, carefulHp: 0.5, injury: 0, tone: 'calm' },
};

/** 勝利条件ごとに選べる方針（3〜4つ） */
export const TACTIC_OPTIONS: Record<Objective, TacticId[]> = {
  rout: ['attack', 'careful', 'protect', 'boss'],
  boss: ['boss', 'attack', 'careful', 'protect'],
  defend: ['hold', 'protect', 'careful', 'attack'],
  escort: ['protect', 'rescue', 'careful', 'attack'],
  seize: ['boss', 'attack', 'careful', 'protect'],
  rescue: ['rescue', 'careful', 'attack', 'protect'],
  escape: ['rescue', 'attack', 'careful'],
};

export type RoleId = 'front' | 'back' | 'flank' | 'heal';
export interface RoleDef { id: RoleId; name: string; desc: string; mod: UnitMod }
export const ROLES: Record<RoleId, RoleDef> = {
  front: { id: 'front', name: '前衛', desc: '先頭で敵を受け止める', mod: { def: 2, avo: -3 } },
  back: { id: 'back', name: '後衛', desc: '後ろから弓や魔法で狙う', mod: { hit: 5, def: -1 } },
  flank: { id: 'flank', name: '遊撃', desc: '横から回りこんで切り込む', mod: { avo: 6, crit: 3, def: -1 } },
  heal: { id: 'heal', name: '回復', desc: '傷ついた仲間を癒やす', mod: { avo: 3, dmg: -1 } },
};
export const ROLE_IDS: RoleId[] = ['front', 'back', 'flank', 'heal'];

export const AUTO = {
  /** 方針が勝利条件に合うとき（全員） */
  tacticFit: { hit: 3, avo: 0 } as UnitMod,
  /** 役割が兵種に合うとき／合わないとき */
  roleFit: { hit: 2, avo: 0 } as UnitMod,
  roleMisfit: { hit: -6, avo: -6 } as UnitMod,
  /** やる気（0〜4）1段階ごとの命中・回避（2がふつう） */
  motivationStep: 2,
  /** 疲労がこれ以上だと命中・回避が下がる */
  fatigueFrom: 60, fatigueMod: { hit: -6, avo: -6 } as UnitMod,
  /** 場面の区切り（このターンまで進めたら次の場面） */
  segmentTurns: [2, 5] as [number, number],
  /** 選択「助けに行く」で回復する割合、作戦を優先したときの命中+ */
  helpHealPct: 0.3, planFirstMod: { hit: 6, dmg: 1 } as UnitMod, helpCostMod: { hit: -3 } as UnitMod,
  /** 選択「押し切る」 */
  pushMod: { hit: 8, dmg: 1, avo: -4 } as UnitMod,
  /** 回り道／正面突破 */
  detourMod: { avo: 6, hit: -2 } as UnitMod, frontalMod: { hit: 5, dmg: 1, avo: -5 } as UnitMod,
  /** 一騎打ち：やりとりの回数。負けた側はHP1で膝をつく */
  duelRounds: 3,
  /** 一騎打ちに勝ったとき、逃げ出す敵の割合 */
  duelRout: 0.3,
  /** 2つ目の選択が起きる確率（候補があるとき） */
  secondChoice: 0.7,
  /** 因縁の敵将が再び現れる確率と、会うたびのレベル+ */
  nemesisChance: 0.35, nemesisLevelUp: 2, nemesisMax: 12,
  /** 勝ち目の目安：裏で試しに戦わせる回数と区切り */
  estimateRuns: 3, estimateGood: 0.75, estimateBad: 0.4,
  /** 直近に使った文・出来事を覚えておく数（出にくくする） */
  recentLines: 60, recentEvents: 14, recentPenalty: 0.15,
  /** 出来事の数（1戦闘） */
  eventsPerBattle: [1, 3] as [number, number],
  /** 出来事の効果 */
  ev: {
    loserHate: { dmg: 2, hit: 5 } as UnitMod,
    coward: { avo: 5 } as UnitMod,
    combo: { hit: 5 } as UnitMod, comboSupport: 6,
    loverHealPct: 0.3, loverSupport: 8,
    rival: { dmg: 1 } as UnitMod, rivalSupport: 5,
    talentReveal: 40,
    firstExp: 10,
    lastTrust: 3,
    recovered: { hit: 5 } as UnitMod,
    newSkill: { hit: 3, crit: 3 } as UnitMod,
    choiceTrust: 3, choiceSupport: 8,
  },
  /** 演武会：場面で活躍した子の演武会の点数+ */
  exhibitionBonus: 3,
  /** 早送りの間隔（ミリ秒） */
  fastMs: 1100,
};

// ---------- 敵将 ----------
export type LeaderPersonality = 'arrogant' | 'veteran' | 'cunning' | 'proud' | 'young' | 'cold' | 'beast';
export const LEADER_NAMES: Record<LeaderPersonality, string> = {
  arrogant: '傲慢', veteran: '老練', cunning: '卑怯', proud: '誇り高い', young: '若い野心家', cold: '冷徹', beast: '魔物の主',
};
/** 一騎打ちを申し込んでくる確率 */
export const LEADER_DUEL: Record<LeaderPersonality, number> = { arrogant: 0.7, veteran: 0.35, cunning: 0.1, proud: 0.9, young: 0.8, cold: 0.25, beast: 0 };
/** 負けそうになると逃げる確率（因縁になる） */
export const LEADER_FLEE: Record<LeaderPersonality, number> = { arrogant: 0.4, veteran: 0.55, cunning: 0.8, proud: 0.1, young: 0.5, cold: 0.45, beast: 0 };
/** 盗賊の頭の二つ名 */
export const BANDIT_EPITHETS = ['赤髭の', '片目の', '鉄鍋の', '山猫の', '黒狼の', '三本指の', '笑う', '風切りの', '大鉈の', '泥沼の', '銀歯の', '夜鴉の'];
export const MONSTER_LEADERS = ['大牙の狼王', '岩殻の大蜥蜴', '森の古老熊', '霧の大蛇', '黒翼の怪鳥', '沼の大蟇'];
