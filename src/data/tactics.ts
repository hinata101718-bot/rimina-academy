// 19夜目：新しい戦い（小さなマス目・運なし・盾と弱点・ブレイク）の数値と技
import type { SkillId } from '../core/types';

/** 攻撃の種類 */
/** 19夜目（問の兵種のヒアリング）：攻撃の種類は10。斬・突・射・砕・打・炎・雷・氷・光・闇 */
export type AtkType = 'slash' | 'thrust' | 'shot' | 'crush' | 'blunt' | 'fire' | 'thunder' | 'ice' | 'light' | 'dark';
export const ATK_TYPES: AtkType[] = ['slash', 'thrust', 'shot', 'crush', 'blunt', 'fire', 'thunder', 'ice', 'light', 'dark'];
export const ATK_NAME: Record<AtkType, string> = { slash: '斬', thrust: '突', shot: '射', crush: '砕', blunt: '打', fire: '炎', thunder: '雷', ice: '氷', light: '光', dark: '闇' };
/** 魔力で戦う種類（守りを少し通り抜ける） */
export const MAGIC_TYPES: AtkType[] = ['fire', 'thunder', 'ice', 'light', 'dark'];

/** 戦いの数値 */
export const TB = {
  w: 6, h: 8,
  /** 森の守り+ */
  forestDef: 2,
  /** 魔法は守りをこの割合だけ受ける */
  magicDefRate: 0.6,
  /** 効かない種類は1/3 */
  resistDiv: 3,
  /** ブレイク中は受ける傷が2倍。動けないのは次の自分の番1回 */
  breakMul: 2, breakTurns: 1,
  /** 速さがこれだけ上だと、ふつうの攻撃が2回 */
  doubleSpd: 5,
  /** 技（技能）の威力に足す：技 ÷ この数 */
  sklDiv: 4,
  /** 心：闘志がこれ以上で威力+、これより上は無茶（守り−） */
  fightHot: 70, fightHotDmg: 2, fightReckless: 90, recklessDef: 2,
  /** 平静がこれ未満だと、宿敵の前ですくむ（威力−） */
  calmLow: 30, fearDmg: 2,
  /** 執念：宿敵と戦うとき、執念÷この数だけ威力+ */
  grudgeDiv: 20,
  /** 教訓が効くとき：威力+／受ける傷− */
  lessonDmg: 2, lessonProt: 2,
  /** 先生：号令（ほかの子をもう一度動かす）と見極め（隠れた弱点を明かす）の回数・届く距離 */
  command: 1, insight: 2, insightRange: 3,
  /** 先生の攻撃は弱め（力×この割合） */
  teacherAtk: 0.6,
  /** 傷薬（各自1回） */
  potionHeal: 10,
  /** いちばん長いターン（こえたら引き上げ。守り抜く戦いは勝ち） */
  maxTurns: 12,
  /** 宿敵：HPがこの割合以下で逃げはじめる（追いつめられると逃げる） */
  fleeAt: 0.25,
  /** 命の危険：体力がこの割合以下の子への、宿敵の倒れる一撃 */
  lethalHp: 0.5,
  /** 宿敵：HPがこの割合以下になると、次の敵の番に大技 */
  rageAt: 0.5, ragePow: 8,
  /** 盾の数（ふつうの兵・隊長・宿敵）。宿敵は因縁の深さで+ */
  shields: { grunt: [1, 2] as [number, number], captain: 3, nemesis: 4, nemesisMax: 6 },
  /** 敵の強さ（依頼の危険度ごと）：HP・力・守り・速さの倍率 */
  enemyMul: [0.85, 1.0, 1.1, 1.25] as number[],
  /** 経験値：倒した敵1体・弱点・ブレイク・勝ち */
  exp: { kill: 14, weak: 3, brk: 8, win: 20, join: 10, boss: 20 },
  /** おまかせ：これより長い試合は打ち切る */
  autoGuard: 400,
} as const;

/** 技 */
export interface TechDef {
  id: string;
  name: string;
  type: AtkType;
  /** 威力の足し引き */
  pow: number;
  hits: number;
  /** 1回の戦いで使える回数 */
  uses: number;
  /** 届く距離（なければ武器のまま） */
  range?: [number, number];
  /** 回復の量（回復の技） */
  heal?: number;
  /** 覚える技能とランクの点 */
  skill: SkillId;
  at: number;
  desc: string;
  /** この兵種の子だけが覚える（兵種の技） */
  cls?: string[];
  /** 弱点でなくても盾を1つ割る */
  smash?: boolean;
}

/** 技能のランクで覚える技（育つほど増える。D=50 C=140 B=270 A=440） */
export const TECHS: TechDef[] = [
  { id: 'swallow', name: '燕返し', type: 'slash', pow: -3, hits: 2, uses: 2, skill: 'sword', at: 50, desc: '2回斬る' },
  { id: 'iai', name: '居合い', type: 'slash', pow: 7, hits: 1, uses: 2, skill: 'sword', at: 140, desc: '重い一太刀' },
  { id: 'moonlight', name: '月影', type: 'slash', pow: 3, hits: 3, uses: 1, skill: 'sword', at: 270, desc: '3回斬る' },
  { id: 'charge', name: '駆け抜け突き', type: 'thrust', pow: 6, hits: 1, uses: 2, skill: 'lance', at: 50, desc: '重い突き' },
  { id: 'triple', name: '三段突き', type: 'thrust', pow: -4, hits: 3, uses: 1, skill: 'lance', at: 140, desc: '3回突く' },
  { id: 'javelin', name: '投げ槍', type: 'thrust', pow: 1, hits: 1, uses: 2, range: [2, 2], skill: 'lance', at: 270, desc: '2マス先を突く' },
  { id: 'helm', name: '兜割り', type: 'crush', pow: 7, hits: 1, uses: 2, skill: 'axe', at: 50, desc: '重い一撃（斧兵の系統は、弱点でなくても盾を割る）', smash: true },
  { id: 'cyclone', name: '大旋風', type: 'crush', pow: 2, hits: 2, uses: 1, skill: 'axe', at: 140, desc: '2回砕く' },
  { id: 'firearrow', name: '火矢', type: 'fire', pow: 2, hits: 1, uses: 2, range: [2, 3], skill: 'bow', at: 50, desc: '燃える矢' },
  { id: 'aimshot', name: '狙い撃ち', type: 'shot', pow: 6, hits: 1, uses: 2, range: [2, 4], skill: 'bow', at: 140, desc: '遠くから重い矢' },
  { id: 'twin', name: '二連射', type: 'shot', pow: -2, hits: 2, uses: 2, range: [2, 3], skill: 'bow', at: 270, desc: '2本の矢' },
  { id: 'fire', name: 'ファイア', type: 'fire', pow: 0, hits: 1, uses: 3, range: [1, 2], skill: 'magic', at: 0, desc: '炎の魔法' },
  { id: 'thunder', name: 'サンダー', type: 'thunder', pow: 2, hits: 1, uses: 2, range: [1, 2], skill: 'magic', at: 50, desc: '雷の魔法' },
  { id: 'blaze', name: 'ボルガノン', type: 'fire', pow: 8, hits: 1, uses: 1, range: [1, 2], skill: 'magic', at: 270, desc: '大きな炎' },
  { id: 'heal', name: 'ライブ', type: 'light', pow: 0, hits: 1, uses: 3, range: [1, 2], heal: 12, skill: 'faith', at: 0, desc: '仲間のHP+12' },
  { id: 'shine', name: 'ひかり', type: 'light', pow: 1, hits: 1, uses: 2, range: [1, 2], skill: 'faith', at: 50, desc: '光の魔法' },
  { id: 'recover', name: 'リカバー', type: 'light', pow: 0, hits: 1, uses: 1, range: [1, 2], heal: 30, skill: 'faith', at: 270, desc: '仲間のHPを大きく戻す' },
  { id: 'lancecharge', name: '突撃', type: 'thrust', pow: 4, hits: 1, uses: 2, skill: 'riding', at: 140, desc: '馬の勢いで突く' },
  { id: 'dive', name: '急降下', type: 'thrust', pow: 5, hits: 1, uses: 2, skill: 'flying', at: 140, desc: '空から突く' },
  { id: 'shieldbash', name: '盾打ち', type: 'blunt', pow: 3, hits: 1, uses: 3, skill: 'heavy', at: 140, desc: '盾で打つ' },
  { id: 'blizzard', name: 'ブリザー', type: 'ice', pow: 3, hits: 1, uses: 2, range: [1, 2], skill: 'magic', at: 140, desc: '氷の魔法' },
  { id: 'miasma', name: 'ミアズマ', type: 'dark', pow: 4, hits: 1, uses: 2, range: [1, 2], skill: 'magic', at: 140, desc: '闇の魔法', cls: ['hexer', 'warlock', 'necromancer', 'cursechild', 'sage'] },
  { id: 'barrage', name: '連打', type: 'blunt', pow: -3, hits: 3, uses: 2, skill: 'axe', at: 0, desc: '3回打つ', cls: ['brawler', 'shura', 'bareblade'] },
  { id: 'mendhand', name: '手当て', type: 'light', pow: 0, hits: 1, uses: 9, range: [1, 1], heal: 8, skill: 'faith', at: 0, desc: '隣の仲間のHP+8', cls: ['cleric', 'priest', 'bishop', 'holy_saint'] },
  { id: 'snipe', name: '狙撃', type: 'shot', pow: 10, hits: 1, uses: 1, range: [2, 4], skill: 'gun', at: 50, desc: '銃の一撃' },
];
export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));
/** 1人が並べる技の数の上限（多いと札が並びきらないため） */
export const TECH_MAX = 4;

/** 戦場の形（宿敵ごとの戦場もここ） */
export interface FieldDef { id: string; name: string; forest: string[]; rock: string[]; desc: string }
export const FIELDS: FieldDef[] = [
  { id: 'plain', name: '野原', forest: ['1-3', '4-4', '2-5', '5-1'], rock: ['3-3', '0-5'], desc: '見通しのよい野原' },
  { id: 'woods', name: '森の道', forest: ['0-2', '1-2', '4-3', '5-3', '2-4', '3-5', '1-5', '4-1'], rock: ['3-2'], desc: '木々が多く、身を隠しやすい' },
  { id: 'pass', name: '山あいの道', forest: ['2-1', '3-6'], rock: ['0-3', '1-3', '4-4', '5-4', '0-4'], desc: '岩にはさまれた細い道' },
  { id: 'village', name: '村はずれ', forest: ['0-1', '5-6', '2-3'], rock: ['1-4', '4-2', '4-5'], desc: '柵と小屋の残る村はずれ' },
  // 宿敵ごとの戦場
  { id: 'fort', name: '砦', forest: [], rock: ['0-2', '1-2', '4-2', '5-2', '2-4', '3-4'], desc: '石の壁に守られた砦' },
  { id: 'ship', name: '船の上', forest: [], rock: ['0-0', '5-0', '0-7', '5-7', '0-3', '5-4'], desc: '揺れる甲板。両端は海' },
  { id: 'ruins', name: '古い遺跡', forest: ['1-1', '4-6'], rock: ['2-2', '3-2', '2-5', '3-5'], desc: '崩れた柱の並ぶ遺跡' },
  { id: 'snow', name: '雪原', forest: ['0-4', '5-3'], rock: ['2-1', '3-6'], desc: '吹雪の雪原' },
];
export const FIELD_BY_ID: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.id, f]));

/** 敵の兵の種類（雑兵）。弱点は2つ */
export interface EnemyKind { id: string; mark: string; name: string; classId: string; type: AtkType; magic?: boolean; range: [number, number]; weak: AtkType[]; mov: number; hp?: number; def?: number; spd?: number }
export const ENEMY_KINDS: Record<string, EnemyKind> = {
  sword: { id: 'sword', mark: '剣', name: '剣兵', classId: 'swordsman', type: 'slash', range: [1, 1], weak: ['blunt', 'thrust'], mov: 3 },
  lance: { id: 'lance', mark: '槍', name: '槍兵', classId: 'lancer', type: 'thrust', range: [1, 1], weak: ['slash', 'fire'], mov: 3, def: 1 },
  axe: { id: 'axe', mark: '斧', name: '斧兵', classId: 'fighter', type: 'crush', range: [1, 1], weak: ['shot', 'light'], mov: 3, hp: 3, spd: -1 },
  bow: { id: 'bow', mark: '弓', name: '弓兵', classId: 'archer', type: 'shot', range: [2, 3], weak: ['thrust', 'slash'], mov: 3, hp: -4, def: -1 },
  mage: { id: 'mage', mark: '魔', name: '魔道兵', classId: 'mage', type: 'fire', magic: true, range: [1, 2], weak: ['shot', 'dark'], mov: 3, hp: -4, def: -2 },
  cav: { id: 'cav', mark: '騎', name: '騎兵', classId: 'cavalier', type: 'thrust', range: [1, 1], weak: ['shot', 'thunder'], mov: 4, hp: 2 },
  knight: { id: 'knight', mark: '鎧', name: '重装兵', classId: 'armor_knight', type: 'crush', range: [1, 1], weak: ['thunder', 'ice'], mov: 2, hp: 4, def: 4, spd: -3 },
  brute: { id: 'brute', mark: '拳', name: '荒くれ', classId: 'brawler', type: 'blunt', range: [1, 1], weak: ['ice', 'thrust'], mov: 3, hp: 2 },
  priestE: { id: 'priestE', mark: '祈', name: '従軍僧', classId: 'cleric', type: 'light', magic: true, range: [1, 2], weak: ['dark', 'slash'], mov: 3, hp: -4, def: -1 },
  beast: { id: 'beast', mark: '獣', name: '魔獣', classId: 'beast', type: 'blunt', range: [1, 1], weak: ['fire', 'light'], mov: 4, hp: 4 },
};
export const ENEMY_MIX: Record<'army' | 'bandit' | 'monster', string[]> = {
  army: ['lance', 'sword', 'bow', 'mage', 'cav', 'knight', 'lance', 'priestE'],
  bandit: ['axe', 'sword', 'bow', 'axe', 'brute'],
  monster: ['beast', 'beast', 'beast'],
};
/** 敵の素の強さ（レベルから）：体力・力・魔力・技・速さ・守り */
export const ENEMY_BASE = { hp: [17, 1.1], str: [6, 0.5], mag: [5, 0.45], skl: [3, 0.35], spd: [3, 0.36], def: [3, 0.33] } as Record<string, [number, number]>;
/** 敵将・宿敵の強さの倍率（体力・ほか） */
export const BOSS_MUL = { hp: 1.7, other: 1.15, nemesisHp: 2.2, nemesisOther: 1.1, perMeet: 0.03 };
/** 兵種の武器の種類 → 攻撃の種類・届く距離 */
export const WTYPE_ATK: Record<string, { type: AtkType; range: [number, number]; magic?: boolean }> = {
  sword: { type: 'slash', range: [1, 1] }, lance: { type: 'thrust', range: [1, 1] }, axe: { type: 'crush', range: [1, 1] }, fist: { type: 'blunt', range: [1, 1] },
  bow: { type: 'shot', range: [2, 3] }, gun: { type: 'shot', range: [2, 3] }, magic: { type: 'fire', range: [1, 2], magic: true },
  holy: { type: 'light', range: [1, 2], magic: true }, staff: { type: 'light', range: [1, 1], magic: true },
};
/** 魔道書・杖を持たない子の魔法の威力 */
export const SPELL_MIGHT = 4;
