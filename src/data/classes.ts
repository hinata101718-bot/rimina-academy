// 兵種データ（木構造、合計68種）。設計書 §8.8 を参照。
import type { ClassDef, MoveType } from '../core/types';

/** 移動力の目安：歩兵5、騎兵7、重装4、飛行7（上級・最上級で+1） */
const BASE_MOVE: Record<MoveType, number> = { infantry: 5, cavalry: 7, armor: 4, flying: 7 };

type Def = Omit<ClassDef, 'move' | 'needStable'>;

function cls(d: Def): ClassDef {
  const move = BASE_MOVE[d.moveType] + (d.tier >= 3 ? 1 : 0);
  const mounted = d.moveType === 'cavalry' || d.moveType === 'flying';
  const needStable = mounted && d.tier >= 1 && d.tier <= 3;
  return { ...d, move, ...(needStable ? { needStable: true } : {}) };
}

const TIER3_IDS = [
  'swordmaster', 'spellblade', 'assassin',
  'paladin', 'mage_knight', 'pegasus_knight',
  'general', 'berserker', 'brave',
  'sniper', 'bow_knight',
  'sage', 'dark_mage',
  'bishop', 'saint', 'templar',
  'sharpshooter',
];

const list: Def[] = [
  // ======================= 見習い =======================
  {
    id: 'novice', name: '見習い', tier: 0, prereq: [], req: {},
    moveType: 'infantry', weapons: ['sword', 'lance', 'axe', 'bow', 'magic', 'staff'],
    bonus: {}, growth: {},
    desc: '入学したばかりの生徒。何にでもなれる。',
  },

  // ======================= 初級 =======================
  {
    id: 'swordsman', name: '剣士', tier: 1, prereq: ['novice'], req: { sword: 'D' },
    moveType: 'infantry', weapons: ['sword'],
    bonus: { hp: 1, str: 1, skl: 1, spd: 2 }, growth: { skl: 5, spd: 10 },
    ability: 'blade_sense', desc: '剣を学び始めた身軽な兵。',
  },
  {
    id: 'lancer', name: '槍兵', tier: 1, prereq: ['novice'], req: { lance: 'D' },
    moveType: 'infantry', weapons: ['lance'],
    bonus: { hp: 1, str: 1, skl: 1, def: 2 }, growth: { hp: 5, def: 10 },
    ability: 'steady_guard', desc: '槍で隊列を支える基本の兵。',
  },
  {
    id: 'fighter', name: '戦士', tier: 1, prereq: ['novice'], req: { axe: 'D' },
    moveType: 'infantry', weapons: ['axe'],
    bonus: { hp: 2, str: 2, def: 1 }, growth: { hp: 10, str: 10, spd: -5 },
    ability: 'brute', desc: '斧を振るう力自慢。',
  },
  {
    id: 'archer', name: 'アーチャー', tier: 1, prereq: ['novice'], req: { bow: 'D' },
    moveType: 'infantry', weapons: ['bow'],
    bonus: { str: 1, skl: 3, spd: 1 }, growth: { skl: 10, def: -5 },
    ability: 'keen_aim', desc: '弓で遠くから敵を射る。',
  },
  {
    id: 'mage', name: '魔道士', tier: 1, prereq: ['novice'], req: { magic: 'D' },
    moveType: 'infantry', weapons: ['magic'],
    bonus: { mag: 3, res: 2 }, growth: { mag: 10, res: 5, def: -5 },
    ability: 'mana_flow', desc: '魔道書を読み解く学徒。',
  },
  {
    id: 'monk', name: '修道士', tier: 1, prereq: ['novice'], req: { faith: 'D' },
    moveType: 'infantry', weapons: ['holy', 'staff'],
    bonus: { mag: 1, lck: 1, res: 2, cha: 1 }, growth: { res: 10, cha: 5 },
    ability: 'kindness', desc: '祈りと癒しを学ぶ見習い僧。',
  },
  {
    id: 'gunner', name: '銃兵', tier: 1, prereq: ['novice'], req: { gun: 'D' }, needGun: true,
    moveType: 'infantry', weapons: ['gun'],
    bonus: { str: 1, skl: 3, def: 1 }, growth: { skl: 10, spd: -5 },
    ability: 'steady_hands', desc: '新しい武器・銃を扱う兵。',
  },

  // ======================= 中級 =======================
  // --- 剣士系 ---
  {
    id: 'fencer', name: '剣客', tier: 2, prereq: ['swordsman'], req: { sword: 'C' },
    moveType: 'infantry', weapons: ['sword'],
    bonus: { hp: 1, str: 2, skl: 3, spd: 3 }, growth: { skl: 10, spd: 10 },
    ability: 'quick_step', desc: '剣一本で身を立てる腕利き。',
  },
  {
    id: 'thief', name: 'シーフ', tier: 2, prereq: ['swordsman'], req: { sword: 'C' },
    moveType: 'infantry', weapons: ['sword'],
    bonus: { skl: 2, spd: 4, lck: 3 }, growth: { spd: 15, lck: 10, str: -5 },
    ability: 'lockpick', desc: '鍵も扉もお手のもの。',
  },
  // --- 槍兵系 ---
  {
    id: 'cavalier', name: '騎兵', tier: 2, prereq: ['lancer'], req: { lance: 'C', riding: 'D' },
    moveType: 'cavalry', weapons: ['lance', 'sword'],
    bonus: { hp: 2, str: 2, skl: 1, spd: 1, def: 2, res: 1 }, growth: { hp: 5, str: 5, def: 5 },
    ability: 'charge', desc: '馬を駆り戦場を駆け抜ける。',
  },
  {
    id: 'pegasus_rider', name: 'ペガサスライダー', tier: 2, prereq: ['lancer'], req: { lance: 'C', flying: 'D' },
    moveType: 'flying', weapons: ['lance'],
    bonus: { str: 1, skl: 2, spd: 3, res: 3 }, growth: { spd: 10, res: 10, def: -5 },
    ability: 'wind_ride', desc: '天馬にまたがり空を行く。',
  },
  // --- 戦士系 ---
  {
    id: 'armor_knight', name: 'アーマーナイト', tier: 2, prereq: ['fighter'], req: { axe: 'C', heavy: 'D' },
    moveType: 'armor', weapons: ['axe', 'lance'],
    bonus: { hp: 3, str: 2, def: 5, spd: -1 }, growth: { def: 15, spd: -10, res: -5 },
    ability: 'iron_wall', desc: '重い鎧で味方の盾となる。',
  },
  {
    id: 'warrior', name: 'ウォーリア', tier: 2, prereq: ['fighter'], req: { axe: 'C' },
    moveType: 'infantry', weapons: ['axe'],
    bonus: { hp: 4, str: 4, skl: 1 }, growth: { hp: 15, str: 10, res: -5 },
    ability: 'war_cry', desc: '大斧で敵をなぎ倒す猛者。',
  },
  // --- アーチャー系 ---
  {
    id: 'hunter', name: '狩人', tier: 2, prereq: ['archer'], req: { bow: 'C' },
    moveType: 'infantry', weapons: ['bow'],
    bonus: { hp: 1, str: 1, skl: 4, spd: 2, lck: 1 }, growth: { skl: 15, spd: 5 },
    ability: 'tracker', desc: '獲物を逃さない森の射手。',
  },
  {
    id: 'bow_rider', name: 'ボウライダー', tier: 2, prereq: ['archer'], req: { bow: 'C', riding: 'D' },
    moveType: 'cavalry', weapons: ['bow'],
    bonus: { hp: 1, str: 2, skl: 3, spd: 2, def: 1 }, growth: { skl: 10, spd: 5 },
    ability: 'mounted_shot', desc: '馬上から矢を放つ騎射兵。',
  },
  // --- 魔道士系 ---
  {
    id: 'sorcerer', name: '魔術師', tier: 2, prereq: ['mage'], req: { magic: 'C' },
    moveType: 'infantry', weapons: ['magic'],
    bonus: { mag: 5, skl: 1, res: 3 }, growth: { mag: 15, res: 5, def: -5 },
    ability: 'focus', desc: '理を極めんとする魔道の徒。',
  },
  {
    id: 'hexer', name: '呪術師', tier: 2, prereq: ['mage'], req: { magic: 'C' },
    moveType: 'infantry', weapons: ['magic'],
    bonus: { mag: 4, skl: 2, res: 2, lck: 1 }, growth: { mag: 10, skl: 5, cha: -5 },
    ability: 'venom', desc: '毒と呪いで敵を蝕む。',
  },
  // --- 修道士系 ---
  {
    id: 'cleric', name: '僧侶', tier: 2, prereq: ['monk'], req: { faith: 'C' },
    moveType: 'infantry', weapons: ['holy', 'staff'],
    bonus: { hp: 1, mag: 3, res: 4, cha: 1 }, growth: { mag: 5, res: 10, cha: 5 },
    ability: 'mercy', desc: '杖で傷ついた仲間を癒す。',
  },
  {
    id: 'battle_monk', name: 'バトルモンク', tier: 2, prereq: ['monk'], req: { faith: 'C', axe: 'D' },
    moveType: 'infantry', weapons: ['axe', 'holy'],
    bonus: { hp: 2, str: 3, mag: 1, def: 1, res: 2 }, growth: { hp: 10, str: 10, res: 5 },
    ability: 'iron_fist', desc: '祈りと斧で戦う武闘僧。',
  },
  // --- 銃兵系 ---
  {
    id: 'musketeer', name: '銃士', tier: 2, prereq: ['gunner'], req: { gun: 'C' }, needGun: true,
    moveType: 'infantry', weapons: ['gun'],
    bonus: { hp: 1, str: 2, skl: 4, def: 2 }, growth: { skl: 15, spd: -5 },
    ability: 'marksman', desc: '訓練を積んだ銃の使い手。',
  },

  // ======================= 上級 =======================
  // --- 剣士系 ---
  {
    id: 'swordmaster', name: 'ソードマスター', tier: 3, prereq: ['fencer'], req: { sword: 'B', axe: 'C' },
    moveType: 'infantry', weapons: ['sword'],
    bonus: { hp: 2, str: 3, skl: 4, spd: 5, lck: 1 }, growth: { skl: 10, spd: 15 },
    ability: 'meteor', desc: '剣の道を究めつつある達人。',
  },
  {
    id: 'spellblade', name: '魔法剣士', tier: 3, prereq: ['fencer'], req: { sword: 'B', magic: 'C' },
    moveType: 'infantry', weapons: ['sword', 'magic'],
    bonus: { hp: 2, str: 3, mag: 3, skl: 2, spd: 2, res: 2 }, growth: { str: 5, mag: 10, spd: 5 },
    ability: 'magic_blade', desc: '剣と魔道を併せて操る。',
  },
  {
    id: 'assassin', name: 'アサシン', tier: 3, prereq: ['thief'], req: { sword: 'B', bow: 'C' },
    moveType: 'infantry', weapons: ['sword', 'bow'],
    bonus: { hp: 1, str: 2, skl: 5, spd: 5, lck: 2 }, growth: { skl: 10, spd: 15, def: -5 },
    ability: 'shadow_step', desc: '闇に紛れて急所を突く。',
  },
  // --- 槍兵系 ---
  {
    id: 'paladin', name: 'パラディン', tier: 3, prereq: ['cavalier'], req: { lance: 'B', riding: 'C' },
    moveType: 'cavalry', weapons: ['lance', 'sword'],
    bonus: { hp: 3, str: 3, skl: 2, spd: 2, def: 3, res: 2 }, growth: { hp: 5, def: 10, res: 5 },
    ability: 'chivalry', desc: '仲間を守る誇り高き騎士。',
  },
  {
    id: 'mage_knight', name: 'マージナイト', tier: 3, prereq: ['cavalier'], req: { magic: 'B', riding: 'C' },
    moveType: 'cavalry', weapons: ['sword', 'magic'],
    bonus: { hp: 2, str: 1, mag: 4, spd: 2, def: 2, res: 3 }, growth: { mag: 15, res: 5 },
    ability: 'magic_lance', desc: '馬上で魔道を放つ騎士。',
  },
  {
    id: 'pegasus_knight', name: 'ペガサスナイト', tier: 3, prereq: ['pegasus_rider'], req: { lance: 'B', flying: 'C' },
    moveType: 'flying', weapons: ['lance', 'sword'],
    bonus: { hp: 2, str: 2, skl: 3, spd: 4, res: 4 }, growth: { spd: 15, res: 10, def: -5 },
    ability: 'sky_dance', desc: '空を舞う天馬の騎士。',
  },
  // --- 戦士系 ---
  {
    id: 'general', name: '将軍', tier: 3, prereq: ['armor_knight'], req: { axe: 'B', heavy: 'C' },
    moveType: 'armor', weapons: ['axe', 'lance'],
    bonus: { hp: 5, str: 4, def: 7, res: 1, spd: -2 }, growth: { hp: 10, def: 20, spd: -10 },
    ability: 'guardian', desc: '鉄壁の守りで隊を率いる。',
  },
  {
    id: 'berserker', name: 'バーサーカー', tier: 3, prereq: ['warrior'], req: { axe: 'B', bow: 'C' },
    moveType: 'infantry', weapons: ['axe'],
    bonus: { hp: 6, str: 6, skl: 2, spd: 2, def: -1 }, growth: { hp: 15, str: 15, def: -5, res: -5 },
    ability: 'frenzy', desc: '傷つくほどに猛り狂う狂戦士。',
  },
  {
    id: 'brave', name: '勇者', tier: 3, prereq: ['warrior'], req: { axe: 'B', sword: 'C' },
    moveType: 'infantry', weapons: ['axe', 'sword'],
    bonus: { hp: 4, str: 4, skl: 3, spd: 3, def: 1 }, growth: { hp: 10, str: 5, skl: 5, spd: 5 },
    ability: 'courage', desc: '斧と剣を使いこなす勇敢な戦士。',
  },
  // --- アーチャー系 ---
  {
    id: 'sniper', name: 'スナイパー', tier: 3, prereq: ['hunter'], req: { bow: 'B', sword: 'C' },
    moveType: 'infantry', weapons: ['bow'],
    bonus: { hp: 2, str: 3, skl: 6, spd: 2, def: 1 }, growth: { skl: 20, str: 5 },
    ability: 'hawk_eye', desc: '狙った的は外さない名射手。',
  },
  {
    id: 'bow_knight', name: 'ボウナイト', tier: 3, prereq: ['bow_rider'], req: { bow: 'B', riding: 'C' },
    moveType: 'cavalry', weapons: ['bow', 'sword'],
    bonus: { hp: 2, str: 3, skl: 4, spd: 4, def: 1 }, growth: { skl: 10, spd: 10 },
    ability: 'running_shot', desc: '駆けながら射る騎馬弓兵。',
  },
  // --- 魔道士系 ---
  {
    id: 'sage', name: '賢者', tier: 3, prereq: ['sorcerer'], req: { magic: 'B', faith: 'C' },
    moveType: 'infantry', weapons: ['magic', 'staff'],
    bonus: { hp: 1, mag: 6, skl: 2, spd: 1, res: 4 }, growth: { mag: 15, res: 10, def: -5 },
    ability: 'wisdom', desc: '魔道と杖を修めた学者。',
  },
  {
    id: 'dark_mage', name: 'ダークメイジ', tier: 3, prereq: ['hexer'], req: { magic: 'B', faith: 'C' },
    moveType: 'infantry', weapons: ['magic'],
    bonus: { hp: 1, mag: 6, skl: 2, lck: 1, res: 4 }, growth: { mag: 15, res: 5, cha: -10 },
    ability: 'hex', desc: '闇の魔道で敵の守りを崩す。',
  },
  // --- 修道士系 ---
  {
    id: 'bishop', name: '司祭', tier: 3, prereq: ['cleric'], req: { faith: 'B', magic: 'C' },
    moveType: 'infantry', weapons: ['holy', 'staff'],
    bonus: { hp: 2, mag: 4, res: 6, cha: 2 }, growth: { res: 15, cha: 10 },
    ability: 'prayer', desc: '祈りで仲間を支える聖職者。',
  },
  {
    id: 'saint', name: 'セイント', tier: 3, prereq: ['cleric'], req: { magic: 'B', faith: 'C' },
    moveType: 'infantry', weapons: ['holy', 'staff', 'magic'],
    bonus: { hp: 1, mag: 5, skl: 1, lck: 1, res: 5, cha: 1 }, growth: { mag: 10, res: 10 },
    ability: 'holy_light', desc: '信仰と魔道の両方に通じる。',
  },
  {
    id: 'templar', name: 'テンプラー', tier: 3, prereq: ['battle_monk'], req: { faith: 'B', axe: 'C' },
    moveType: 'infantry', weapons: ['axe', 'holy'],
    bonus: { hp: 3, str: 4, mag: 2, def: 3, res: 2 }, growth: { hp: 10, str: 10, def: 5 },
    ability: 'sacred_vow', desc: '神に誓いを立てた戦う僧。',
  },
  // --- 銃兵系 ---
  {
    id: 'sharpshooter', name: 'シャープシューター', tier: 3, prereq: ['musketeer'], req: { gun: 'B', bow: 'C' }, needGun: true,
    moveType: 'infantry', weapons: ['gun'],
    bonus: { hp: 2, str: 2, skl: 7, def: 3 }, growth: { skl: 20, spd: -5 },
    ability: 'deadly_aim', desc: '遠距離から急所を撃ち抜く。',
  },

  // ======================= 最上級（卒業後） =======================
  // --- 剣士系 ---
  {
    id: 'sword_saint', name: '剣聖', tier: 4, prereq: ['swordmaster'], req: { sword: 'A', axe: 'B' },
    moveType: 'infantry', weapons: ['sword'],
    bonus: { hp: 3, str: 4, skl: 5, spd: 5, lck: 1 }, growth: { skl: 15, spd: 15 },
    ability: 'sword_mind', desc: '剣の道の頂に立つ者。',
  },
  {
    id: 'rune_knight', name: 'ルーンナイト', tier: 4, prereq: ['spellblade'], req: { sword: 'A', magic: 'B' },
    moveType: 'infantry', weapons: ['sword', 'magic'],
    bonus: { hp: 3, str: 4, mag: 4, skl: 2, spd: 2, def: 1, res: 2 }, growth: { str: 10, mag: 10 },
    ability: 'rune_ward', desc: '刻印の剣で戦う魔剣の騎士。',
  },
  {
    id: 'shadow', name: 'シャドウ', tier: 4, prereq: ['assassin'], req: { sword: 'A', bow: 'B' },
    moveType: 'infantry', weapons: ['sword', 'bow'],
    bonus: { hp: 2, str: 3, skl: 5, spd: 6, lck: 2 }, growth: { spd: 20, skl: 10, def: -5 },
    ability: 'vanish', desc: '誰にも姿を見せない影の刃。',
  },
  // --- 槍兵系 ---
  {
    id: 'great_knight', name: 'グレートナイト', tier: 4, prereq: ['paladin'], req: { lance: 'A', riding: 'B' },
    moveType: 'cavalry', weapons: ['lance', 'sword', 'axe'],
    bonus: { hp: 5, str: 5, skl: 1, def: 6, res: 1 }, growth: { hp: 10, def: 15, spd: -5 },
    ability: 'iron_rampart', desc: '重装の騎馬で敵陣を割る。',
  },
  {
    id: 'dark_knight', name: 'ダークナイト', tier: 4, prereq: ['mage_knight'], req: { magic: 'A', riding: 'B' },
    moveType: 'cavalry', weapons: ['sword', 'magic'],
    bonus: { hp: 3, str: 2, mag: 5, spd: 2, def: 2, res: 4 }, growth: { mag: 15, res: 10 },
    ability: 'dark_aura', desc: '闇の魔道をまとう騎士。',
  },
  {
    id: 'falcon_knight', name: 'ファルコンナイト', tier: 4, prereq: ['pegasus_knight'], req: { lance: 'A', flying: 'B' },
    moveType: 'flying', weapons: ['lance', 'sword', 'staff'],
    bonus: { hp: 3, str: 3, skl: 3, spd: 5, res: 4 }, growth: { spd: 15, res: 10 },
    ability: 'gale', desc: '疾風のごとく空を翔ける騎士。',
  },
  // --- 戦士系 ---
  {
    id: 'great_general', name: '大将軍', tier: 4, prereq: ['general'], req: { axe: 'A', heavy: 'B' },
    moveType: 'armor', weapons: ['axe', 'lance', 'sword'],
    bonus: { hp: 7, str: 5, def: 9, res: 2, spd: -3 }, growth: { hp: 10, def: 20, spd: -10 },
    ability: 'citadel', desc: '一歩も退かぬ不動の大将。',
  },
  {
    id: 'warlord', name: 'ウォーロード', tier: 4, prereq: ['berserker'], req: { axe: 'A', bow: 'B' },
    moveType: 'infantry', weapons: ['axe', 'bow'],
    bonus: { hp: 6, str: 6, skl: 3, spd: 2, def: 1 }, growth: { hp: 15, str: 15, res: -5 },
    ability: 'conqueror', desc: '戦場を制する覇者。',
  },
  {
    id: 'champion', name: 'チャンピオン', tier: 4, prereq: ['brave'], req: { axe: 'A', sword: 'B' },
    moveType: 'infantry', weapons: ['axe', 'sword'],
    bonus: { hp: 5, str: 5, skl: 3, spd: 3, def: 2 }, growth: { hp: 10, str: 10, spd: 5 },
    ability: 'indomitable', desc: '幾多の戦いを勝ち抜いた勇士。',
  },
  // --- アーチャー系 ---
  {
    id: 'hawkeye', name: 'ホークアイ', tier: 4, prereq: ['sniper'], req: { bow: 'A', sword: 'B' },
    moveType: 'infantry', weapons: ['bow', 'sword'],
    bonus: { hp: 3, str: 3, skl: 7, spd: 3, lck: 1, def: 1 }, growth: { skl: 20, spd: 5 },
    ability: 'farsight', desc: '千里先をも見通す弓の名手。',
  },
  {
    id: 'bow_lord', name: 'ボウロード', tier: 4, prereq: ['bow_knight'], req: { bow: 'A', riding: 'B' },
    moveType: 'cavalry', weapons: ['bow', 'sword', 'lance'],
    bonus: { hp: 3, str: 4, skl: 5, spd: 4, def: 2 }, growth: { skl: 10, spd: 10, str: 5 },
    ability: 'sky_arrow', desc: '騎馬弓兵を束ねる弓の将。',
  },
  // --- 魔道士系 ---
  {
    id: 'archsage', name: '大賢者', tier: 4, prereq: ['sage'], req: { magic: 'A', faith: 'B' },
    moveType: 'infantry', weapons: ['magic', 'staff'],
    bonus: { hp: 2, mag: 8, skl: 2, spd: 1, res: 5 }, growth: { mag: 20, res: 10, def: -5 },
    ability: 'arcane', desc: '大陸に名を知られる魔道の賢人。',
  },
  {
    id: 'necromancer', name: 'ネクロマンサー', tier: 4, prereq: ['dark_mage'], req: { magic: 'A', faith: 'B' },
    moveType: 'infantry', weapons: ['magic'],
    bonus: { hp: 2, mag: 8, skl: 2, lck: 1, res: 5 }, growth: { mag: 20, res: 5, cha: -10 },
    ability: 'death_curse', desc: '死の呪いを操る闇の術者。',
  },
  // --- 修道士系 ---
  {
    id: 'archbishop', name: '大司教', tier: 4, prereq: ['bishop'], req: { faith: 'A', magic: 'B' },
    moveType: 'infantry', weapons: ['holy', 'staff'],
    bonus: { hp: 3, mag: 5, res: 7, cha: 3 }, growth: { res: 15, cha: 15 },
    ability: 'grace', desc: '人々の信仰を集める高位の聖職者。',
  },
  {
    id: 'oracle', name: 'オラクル', tier: 4, prereq: ['saint'], req: { magic: 'A', faith: 'B' },
    moveType: 'infantry', weapons: ['holy', 'staff', 'magic'],
    bonus: { hp: 2, mag: 6, skl: 2, lck: 2, res: 6 }, growth: { mag: 10, res: 10, lck: 10 },
    ability: 'revelation', desc: '天の声を聞くという預言者。',
  },
  {
    id: 'crusader', name: 'クルセイダー', tier: 4, prereq: ['templar'], req: { faith: 'A', axe: 'B' },
    moveType: 'infantry', weapons: ['axe', 'holy', 'staff'],
    bonus: { hp: 4, str: 5, mag: 3, def: 3, res: 3 }, growth: { hp: 10, str: 10, res: 10 },
    ability: 'holy_war', desc: '信仰を掲げて戦う聖戦士。',
  },
  // --- 銃兵系 ---
  {
    id: 'deadeye', name: 'デッドアイ', tier: 4, prereq: ['sharpshooter'], req: { gun: 'A', bow: 'B' }, needGun: true,
    moveType: 'infantry', weapons: ['gun', 'bow'],
    bonus: { hp: 3, str: 3, skl: 8, def: 4 }, growth: { skl: 20, def: 5, spd: -5 },
    ability: 'one_shot', desc: '一発で勝負を決める銃の名手。',
  },

  // ======================= 国専用の最上級 =======================
  // --- 王国 ---
  {
    id: 'holy_knight', name: '聖騎士', tier: 4, nation: 'kingdom', prereq: ['paladin'], req: { lance: 'A', riding: 'B' },
    moveType: 'cavalry', weapons: ['lance', 'sword', 'staff'],
    bonus: { hp: 5, str: 4, skl: 2, spd: 2, def: 4, res: 3 }, growth: { hp: 10, def: 10, res: 10 },
    ability: 'holy_shield', desc: '王に剣を捧げた王国の騎士。',
  },
  {
    id: 'fortress', name: 'フォートレス', tier: 4, nation: 'kingdom', prereq: ['general'], req: { axe: 'A', heavy: 'B' },
    moveType: 'armor', weapons: ['axe', 'lance'],
    bonus: { hp: 8, str: 4, def: 10, res: 2, spd: -4 }, growth: { hp: 15, def: 20, spd: -10 },
    ability: 'bastion', desc: '王国の城門を守る動く城塞。',
  },
  {
    id: 'royal_guard', name: 'ロイヤルガード', tier: 4, nation: 'kingdom', prereq: ['swordmaster'], req: { sword: 'A', axe: 'B' },
    moveType: 'infantry', weapons: ['sword', 'lance'],
    bonus: { hp: 3, str: 4, skl: 5, spd: 5, def: 2 }, growth: { skl: 10, spd: 10, def: 5 },
    ability: 'royal_blade', desc: '王族の身辺を守る近衛の剣士。',
  },
  {
    id: 'white_wing', name: 'ホワイトウイング', tier: 4, nation: 'kingdom', prereq: ['pegasus_knight'], req: { lance: 'A', flying: 'B' },
    moveType: 'flying', weapons: ['lance', 'sword'],
    bonus: { hp: 3, str: 3, skl: 3, spd: 5, res: 5, cha: 1 }, growth: { spd: 15, res: 15 },
    ability: 'white_feather', desc: '王国の空を守る白き天馬隊。',
  },
  // --- 帝国 ---
  {
    id: 'gun_cavalry', name: '銃騎兵', tier: 4, nation: 'empire', prereq: ['paladin', 'sharpshooter'], req: { gun: 'A', riding: 'B' }, needGun: true,
    moveType: 'cavalry', weapons: ['gun', 'lance'],
    bonus: { hp: 4, str: 3, skl: 6, spd: 2, def: 3 }, growth: { skl: 15, def: 5 },
    ability: 'thunder_charge', desc: '馬上から銃を撃つ帝国の新兵科。',
  },
  {
    id: 'magic_general', name: '魔導将軍', tier: 4, nation: 'empire', prereq: ['sage'], req: { magic: 'A', faith: 'B' },
    moveType: 'infantry', weapons: ['magic', 'staff'],
    bonus: { hp: 4, mag: 6, def: 4, res: 5, cha: 1 }, growth: { mag: 15, def: 10 },
    ability: 'mage_command', desc: '帝国の魔導兵団を率いる将。',
  },
  {
    id: 'dominator', name: 'ドミネーター', tier: 4, nation: 'empire', prereq: ['berserker', 'brave'], req: { axe: 'A', sword: 'B' },
    moveType: 'infantry', weapons: ['axe', 'sword'],
    bonus: { hp: 6, str: 7, skl: 2, spd: 2, def: 2 }, growth: { hp: 15, str: 15, cha: -5 },
    ability: 'tyranny', desc: '力で戦場を支配する帝国の猛将。',
  },
  {
    id: 'imperial_guard', name: 'インペリアルガード', tier: 4, nation: 'empire', prereq: ['general', 'swordmaster'], req: { heavy: 'A', sword: 'B' },
    moveType: 'armor', weapons: ['sword', 'lance'],
    bonus: { hp: 6, str: 4, skl: 2, def: 7, res: 2, spd: -1 }, growth: { hp: 10, def: 15, skl: 5 },
    ability: 'imperial_wall', desc: '皇帝を守る帝国の重装近衛。',
  },
  // --- 同盟 ---
  {
    id: 'high_wizard', name: 'ハイウィザード', tier: 4, nation: 'alliance', prereq: ['sage'], req: { magic: 'A', faith: 'B' },
    moveType: 'infantry', weapons: ['magic', 'staff'],
    bonus: { hp: 2, mag: 8, skl: 3, spd: 2, res: 5 }, growth: { mag: 20, spd: 5 },
    ability: 'grand_magic', desc: '同盟の魔道院が認めた大魔導士。',
  },
  {
    id: 'dragon_knight', name: '竜騎士', tier: 4, nation: 'alliance', prereq: ['pegasus_knight'], req: { lance: 'A', flying: 'B' },
    moveType: 'flying', weapons: ['lance', 'axe'],
    bonus: { hp: 5, str: 6, skl: 2, spd: 2, def: 4, res: -1 }, growth: { str: 15, def: 10, res: -5 },
    ability: 'dragon_scale', desc: '飛竜を駆る同盟の精鋭。',
  },
  {
    id: 'bow_master', name: 'ボウマスター', tier: 4, nation: 'alliance', prereq: ['sniper', 'bow_knight'], req: { bow: 'A', sword: 'B' },
    moveType: 'infantry', weapons: ['bow', 'sword'],
    bonus: { hp: 3, str: 4, skl: 7, spd: 3, lck: 1, def: 1 }, growth: { skl: 20, str: 5 },
    ability: 'arrow_rain', desc: '同盟随一の弓の師範。',
  },
  {
    id: 'high_priest', name: 'ハイプリースト', tier: 4, nation: 'alliance', prereq: ['bishop'], req: { faith: 'A', magic: 'B' },
    moveType: 'infantry', weapons: ['holy', 'staff'],
    bonus: { hp: 3, mag: 5, res: 8, lck: 1, cha: 3 }, growth: { res: 15, cha: 10, lck: 5 },
    ability: 'benediction', desc: '同盟の聖堂を束ねる祭司長。',
  },

  // ======================= 隠し =======================
  {
    id: 'hero', name: '英雄', tier: 4, hidden: true, prereq: TIER3_IDS, req: {},
    moveType: 'infantry', weapons: ['sword', 'lance', 'axe', 'bow'],
    bonus: { hp: 5, str: 4, mag: 1, skl: 3, spd: 3, lck: 2, def: 2 }, growth: { hp: 10, str: 10, skl: 10, spd: 10, lck: 10 },
    ability: 'heroic_soul', desc: '「英雄の器」を持つ者だけが至る道。',
  },
];

export const CLASSES: Record<string, ClassDef> = Object.fromEntries(list.map((d) => [d.id, cls(d)]));
export const CLASS_LIST: ClassDef[] = Object.values(CLASSES);
