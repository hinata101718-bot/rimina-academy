// 戦技とスキル（12夜目。16夜目：生徒ごとに覚えるものが違う・札になる）
// 技能×節目（E+・D・C・B・A・S）ごとに4通りの候補があり、入学のときに「覚える表」で1つずつ決まる（core/arts.ts の makeArtPlan）。
// 戦技（art）：戦いで使う札。スキル（mind）：いつも効く・条件で効く、または札になる（かばう・鉄壁など）。
// データを足すだけで増やせる：同じ技能・同じ節目に足せば、覚える表の候補に入る。
import type { Rank, SkillId, WeaponType, MoveType, AbilityDef } from '../core/types';

/** 覚える表の決め方に使う傾き：攻め・守り・速さ（帝国）・重さ（王国）・搦め手（同盟）・仲間を助ける・格式（家柄） */
export type ArtStyle = 'atk' | 'guard' | 'swift' | 'heavy' | 'trick' | 'support' | 'noble';
/** 条件で効くスキル（16夜目）：HPが半分以下・仲間が倒れた・そのターンの最初の札・敵将と戦う・HPが満タン */
export type SkillCond = 'lowHp' | 'allyDown' | 'first' | 'vsLeader' | 'fullHp';
export const COND_LABEL: Record<SkillCond, string> = { lowHp: 'HPが半分以下のとき', allyDown: '仲間が倒れたとき', first: '先に攻撃したとき', vsLeader: '敵将と戦うとき', fullHp: 'HPが満タンのとき' };

/** 札の効き目（16夜目）。数は武器の威力と能力から計算する（core/battle/cards.ts） */
export interface CardFx {
  type: 'atk' | 'guard' | 'heal' | 'buff';
  /** 行動力（ふつう1） */
  cost?: number;
  // ---- 攻撃 ----
  /** 威力の倍率（1回あたり）・回数・上乗せ・守りを低く見る・必殺+・命中+ */
  mul?: number; hits?: number; flat?: number; pierce?: number; crit?: number; hit?: number;
  /** 敵の前に出ている者すべて */
  aoe?: boolean;
  /** この移動の相手に威力+ */
  vsMove?: MoveType[];
  /** 相手の次の行動を止める */
  stun?: boolean;
  /** 相手を弱める：回避・攻撃・守り（amt だけ、戦いのあいだ） */
  debuff?: 'avo' | 'atk' | 'def'; amt?: number;
  // ---- 守り ----
  /** いちばん危ない仲間をかばう（受けるダメージ半分） */
  cover?: boolean;
  /** このターン、味方みんなの受けるダメージ− */
  wall?: number;
  /** このターン、自分の受けるダメージ− */
  self?: number;
  /** このターン、攻撃されたら反撃（威力の倍率） */
  counter?: number;
  // ---- 回復 ----
  heal?: number; all?: boolean;
  // ---- 強め ----
  team?: { dmg?: number; hit?: number; crit?: number };
  /** 行動力+・札を引く */
  ap?: number; draw?: number;
}

export interface ArtDef {
  id: string; name: string; skill: SkillId; rank: Rank; kind: 'art' | 'mind'; desc: string;
  /** 戦技：使える武器（なければどの武器でも） */
  weapons?: WeaponType[];
  /** 古いマス目の戦いの効き目（15夜目まで。今は使わない。古いセーブの読みこみのために残す） */
  chance?: number; hit?: number; dmg?: number; crit?: number; pierce?: number; mul?: number; vsMove?: MoveType[];
  /** スキル：いつも効く補正（AbilityDef と同じ書き方）。cond があれば、その条件のときだけ */
  ability?: Omit<AbilityDef, 'id' | 'name' | 'desc'>;
  cond?: SkillCond;
  /** 札（戦技はいつも。スキルは札になるものだけ） */
  card?: CardFx;
  /** 開花した子だけの固有の戦技 */
  bloom?: boolean;
  /** 覚える表の傾き */
  style?: ArtStyle[];
  /** 得意の技能の子だけが覚える秘伝 */
  rare?: boolean;
}

const W: Partial<Record<SkillId, WeaponType[]>> = { sword: ['sword'], lance: ['lance'], axe: ['axe'], bow: ['bow'], magic: ['magic'], faith: ['holy'], gun: ['gun'] };

/** 札の効き目を短い文に（個人ページ・図鑑・札の下の説明） */
export function fxText(c: CardFx): string {
  const t: string[] = [];
  if (c.type === 'atk') {
    const m = c.mul ?? 1;
    if ((c.hits ?? 1) > 1) t.push(`${c.hits}回攻撃（1回は威力×${m}）`);
    else if (m !== 1) t.push(`威力×${m}`);
    if (c.aoe) t.push('前に出ている敵すべて');
    if (c.flat) t.push(`威力+${c.flat}`);
    if (c.pierce) t.push(`守りを${c.pierce}低く見る`);
    if (c.crit) t.push(`必殺+${c.crit}`);
    if (c.hit) t.push(`命中${c.hit > 0 ? '+' : '−'}${Math.abs(c.hit)}`);
    if (c.vsMove?.length) t.push(`${c.vsMove.map((x) => MOVE_NAME[x]).join('・')}に強い`);
    if (c.stun) t.push('相手の次の行動を止める');
    if (c.debuff) t.push(`相手の${{ avo: '回避', atk: '攻撃', def: '守り' }[c.debuff]}−${c.amt ?? 0}`);
    if (!t.length) t.push('ふつうの攻撃');
  } else if (c.type === 'guard') {
    if (c.cover) t.push('いちばん危ない仲間をかばう（受けるダメージ半分）');
    if (c.wall) t.push(`このターン、味方みんなの受けるダメージ−${c.wall}`);
    if (c.self) t.push(`このターン、自分の受けるダメージ−${c.self}`);
    if (c.counter) t.push('このターン、攻撃されたら反撃');
  } else if (c.type === 'heal') {
    t.push(c.all ? `味方みんなのHP+${c.heal}` : `いちばん弱った仲間のHP+${c.heal}`);
  } else {
    if (c.team?.dmg) t.push(`このターン、味方の威力+${c.team.dmg}`);
    if (c.team?.hit) t.push(`味方の命中+${c.team.hit}`);
    if (c.team?.crit) t.push(`味方の必殺+${c.team.crit}`);
    if (c.ap) t.push(`行動力+${c.ap}`);
    if (c.draw) t.push(`札を${c.draw}枚引く`);
  }
  if ((c.cost ?? 1) !== 1) t.push(`行動力${c.cost}`);
  return t.join('・');
}
const MOVE_NAME: Record<MoveType, string> = { infantry: '歩兵', cavalry: '騎馬', armor: '重装', flying: '飛行' };
function abText(ab: ArtDef['ability']): string {
  if (!ab) return '';
  const t: string[] = [];
  if (ab.hit) t.push(`命中+${ab.hit}`);
  if (ab.avo) t.push(`回避+${ab.avo}`);
  if (ab.crit) t.push(`必殺+${ab.crit}`);
  if (ab.dmg) t.push(`威力+${ab.dmg}`);
  if (ab.prot) t.push(`受けるダメージ−${ab.prot}`);
  if (ab.adjAllyDef) t.push(`仲間の守備+${ab.adjAllyDef}`);
  if (ab.adjAllyProt) t.push(`仲間の受けるダメージ−${ab.adjAllyProt}`);
  if (ab.auraHeal) t.push(`ターンのはじめに仲間のHP+${ab.auraHeal}`);
  return t.join('・');
}
const WT_NAME: Partial<Record<WeaponType, string>> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道書', holy: '光の魔法', gun: '銃' };

/** 古いマス目の戦いの数（威力の倍率など）を、札から作る */
function legacy(c: CardFx): Partial<ArtDef> {
  if (c.type !== 'atk') return { chance: 0 };
  const m = (c.mul ?? 1) * (c.hits ?? 1) * (c.aoe ? 0.8 : 1);
  return { mul: Math.round(m * 10) / 10, dmg: c.flat, pierce: c.pierce, crit: c.crit, hit: c.hit, vsMove: c.vsMove, chance: (c.cost ?? 1) >= 2 ? 30 : 25 };
}
const art = (id: string, name: string, skill: SkillId, rank: Rank, style: ArtStyle[], card: CardFx, e: Partial<ArtDef> = {}): ArtDef => {
  const weapons = card.type === 'atk' ? W[skill] : undefined;
  return { id, name, skill, rank, kind: 'art', desc: fxText(card), weapons, style, card, ...legacy(card), ...e };
};
/** いつも効くスキル */
const mind = (id: string, name: string, skill: SkillId, rank: Rank, style: ArtStyle[], ab: ArtDef['ability'], e: Partial<ArtDef> = {}): ArtDef => {
  const wt = ab?.wtype?.map((w) => WT_NAME[w]).join('・');
  return { id, name, skill, rank, kind: 'mind', desc: `${wt ? `${wt}を持つと` : ''}${abText(ab)}`, ability: ab, style, ...e };
};
/** 条件で効くスキル */
const cmind = (id: string, name: string, skill: SkillId, rank: Rank, style: ArtStyle[], cond: SkillCond, ab: ArtDef['ability']): ArtDef =>
  ({ id, name, skill, rank, kind: 'mind', desc: `${COND_LABEL[cond]}、${abText(ab)}`, ability: ab, cond, style });
/** 札になるスキル（かばう・鉄壁など） */
const kmind = (id: string, name: string, skill: SkillId, rank: Rank, style: ArtStyle[], card: CardFx): ArtDef =>
  ({ id, name, skill, rank, kind: 'mind', desc: `札：${fxText(card)}`, style, card });

export const ART_LIST: ArtDef[] = [
  // ======== 剣 ========
  mind('sw_mind1', '剣の基本', 'sword', 'E+', [], { hit: 5, wtype: ['sword'] }),
  kmind('sw_m1b', '受け流し', 'sword', 'E+', ['guard'], { type: 'guard', self: 5, counter: 0.6 }),
  cmind('sw_m1c', '踏みこみ', 'sword', 'E+', ['atk', 'swift'], 'first', { dmg: 3 }),
  kmind('sw_m1d', '礼の構え', 'sword', 'E+', ['noble'], { type: 'buff', team: { hit: 10, crit: 5 } }),
  art('sw_art1', '燕返し', 'sword', 'D', ['swift', 'atk'], { type: 'atk', hits: 2, mul: 0.7 }),
  art('sw_a1b', '踏みこみ斬り', 'sword', 'D', ['atk', 'heavy'], { type: 'atk', mul: 1.3 }),
  art('sw_a1c', '居合い', 'sword', 'D', ['swift', 'trick'], { type: 'atk', crit: 25, hit: 10 }),
  art('sw_a1d', '峰打ち', 'sword', 'D', ['trick', 'guard'], { type: 'atk', mul: 0.7, stun: true }),
  mind('sw_mind2', '剣の心得', 'sword', 'C', [], { hit: 10, wtype: ['sword'] }),
  kmind('sw_m2b', '返し刃', 'sword', 'C', ['guard', 'trick'], { type: 'guard', self: 3, counter: 1 }),
  cmind('sw_m2c', '背水の剣', 'sword', 'C', ['atk'], 'lowHp', { dmg: 4 }),
  kmind('sw_m2d', '剣気', 'sword', 'C', ['noble', 'support'], { type: 'buff', team: { hit: 10, dmg: 1 } }),
  art('sw_art2', '影抜き', 'sword', 'B', ['trick'], { type: 'atk', pierce: 5, hit: 5, mul: 1.1 }),
  art('sw_a2b', '突き崩し', 'sword', 'B', ['heavy'], { type: 'atk', mul: 1.2, debuff: 'def', amt: 3 }),
  art('sw_a2c', '三段斬り', 'sword', 'B', ['swift'], { type: 'atk', hits: 3, mul: 0.55 }),
  art('sw_a2d', '鎧通し', 'sword', 'B', ['heavy', 'noble'], { type: 'atk', pierce: 9, mul: 1.1 }, { rare: true }),
  mind('sw_mind3', '見切り', 'sword', 'A', [], { avo: 10, wtype: ['sword'] }),
  cmind('sw_m3b', '先の先', 'sword', 'A', ['swift'], 'first', { crit: 15 }),
  cmind('sw_m3c', '不屈', 'sword', 'A', ['atk', 'support'], 'allyDown', { dmg: 4, hit: 10 }),
  kmind('sw_m3d', '守りの剣', 'sword', 'A', ['guard', 'noble'], { type: 'guard', cover: true, self: 2 }),
  art('sw_art3', '月下一閃', 'sword', 'S', [], { type: 'atk', mul: 1.5, crit: 30, flat: 3, cost: 2 }),
  art('sw_a3b', '千鳥', 'sword', 'S', ['swift'], { type: 'atk', hits: 4, mul: 0.5, cost: 2 }),
  art('sw_a3c', '王剣', 'sword', 'S', ['heavy', 'noble'], { type: 'atk', mul: 2, cost: 2 }, { rare: true }),
  art('sw_a3d', '薙ぎ払い', 'sword', 'S', ['atk'], { type: 'atk', aoe: true, mul: 0.9, cost: 2 }),
  // ======== 槍 ========
  mind('la_mind1', '槍の基本', 'lance', 'E+', [], { hit: 5, wtype: ['lance'] }),
  kmind('la_m1b', '槍ぶすま', 'lance', 'E+', ['guard', 'heavy'], { type: 'guard', wall: 2 }),
  mind('la_m1c', '間合い取り', 'lance', 'E+', ['swift', 'trick'], { avo: 5, wtype: ['lance'] }),
  kmind('la_m1d', '騎士の礼', 'lance', 'E+', ['noble'], { type: 'buff', team: { hit: 8, dmg: 1 } }),
  art('la_art1', '穂先崩し', 'lance', 'D', [], { type: 'atk', mul: 1.1, vsMove: ['armor'] }),
  art('la_a1b', '突進突き', 'lance', 'D', ['atk', 'swift'], { type: 'atk', mul: 1.4, hit: -10 }),
  art('la_a1c', '足払い', 'lance', 'D', ['trick'], { type: 'atk', mul: 0.7, stun: true }),
  art('la_a1d', '構え突き', 'lance', 'D', ['guard'], { type: 'atk', mul: 1.1, self: 3 } as CardFx),
  mind('la_mind2', '槍の心得', 'lance', 'C', [], { prot: 1, wtype: ['lance'] }),
  kmind('la_m2b', '迎え撃ち', 'lance', 'C', ['guard'], { type: 'guard', self: 2, counter: 1.1 }),
  cmind('la_m2c', '一番槍', 'lance', 'C', ['atk'], 'first', { dmg: 4 }),
  kmind('la_m2d', '守護の誓い', 'lance', 'C', ['guard', 'noble'], { type: 'guard', cover: true }),
  art('la_art2', '連ね突き', 'lance', 'B', [], { type: 'atk', hits: 2, mul: 0.8 }),
  art('la_a2b', '薙ぎ槍', 'lance', 'B', ['heavy'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('la_a2c', '急所突き', 'lance', 'B', ['trick'], { type: 'atk', crit: 30, mul: 1.1 }, { rare: true }),
  art('la_a2d', '回し突き', 'lance', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.7, debuff: 'atk', amt: 3 }),
  mind('la_mind3', '不動の構え', 'lance', 'A', [], { prot: 2, wtype: ['lance'] }),
  kmind('la_m3b', '堅陣', 'lance', 'A', ['guard'], { type: 'guard', wall: 3 }),
  cmind('la_m3c', '槍騎の誉れ', 'lance', 'A', ['noble', 'atk'], 'vsLeader', { dmg: 5 }),
  cmind('la_m3d', '踏みとどまり', 'lance', 'A', ['guard'], 'lowHp', { prot: 3 }),
  art('la_art3', '天穿ち', 'lance', 'S', [], { type: 'atk', mul: 1.6, pierce: 10, cost: 2 }),
  art('la_a3b', '百花突き', 'lance', 'S', ['swift'], { type: 'atk', hits: 5, mul: 0.42, cost: 2 }),
  art('la_a3c', '城門破り', 'lance', 'S', ['heavy'], { type: 'atk', mul: 1.8, vsMove: ['armor'], cost: 2 }, { rare: true }),
  art('la_a3d', '槍陣一閃', 'lance', 'S', ['noble', 'atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }),
  // ======== 斧 ========
  mind('ax_mind1', '斧の基本', 'axe', 'E+', [], { dmg: 1, wtype: ['axe'] }),
  cmind('ax_m1b', '力み', 'axe', 'E+', ['atk'], 'lowHp', { dmg: 3 }),
  mind('ax_m1c', '頑丈', 'axe', 'E+', ['guard', 'heavy'], { prot: 1 }),
  kmind('ax_m1d', '雄叫び', 'axe', 'E+', ['atk', 'support'], { type: 'buff', team: { dmg: 2 } }),
  art('ax_art1', '兜割り', 'axe', 'D', [], { type: 'atk', flat: 4, hit: -10 }),
  art('ax_a1b', '振り回し', 'axe', 'D', ['atk'], { type: 'atk', aoe: true, mul: 0.6 }),
  art('ax_a1c', '叩き伏せ', 'axe', 'D', ['heavy'], { type: 'atk', mul: 0.9, stun: true }),
  art('ax_a1d', '投げ斧', 'axe', 'D', ['trick'], { type: 'atk', mul: 1, hit: 20 }),
  mind('ax_mind2', '斧の心得', 'axe', 'C', [], { hit: 10, wtype: ['axe'] }),
  kmind('ax_m2b', '仁王立ち', 'axe', 'C', ['guard'], { type: 'guard', cover: true, self: 2 }),
  cmind('ax_m2c', '血の滾り', 'axe', 'C', ['atk'], 'allyDown', { dmg: 5 }),
  kmind('ax_m2d', '鉄の胃袋', 'axe', 'C', ['heavy'], { type: 'guard', self: 6 }),
  art('ax_art2', '大地割り', 'axe', 'B', [], { type: 'atk', mul: 1.5, hit: -5 }),
  art('ax_a2b', '竜巻斧', 'axe', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.8 }),
  art('ax_a2c', '骨砕き', 'axe', 'B', ['heavy'], { type: 'atk', mul: 1.2, debuff: 'def', amt: 4 }, { rare: true }),
  art('ax_a2d', '返し斧', 'axe', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.75 }),
  mind('ax_mind3', '剛力', 'axe', 'A', [], { dmg: 2, wtype: ['axe'] }),
  cmind('ax_m3b', '狂戦の血', 'axe', 'A', ['atk'], 'lowHp', { crit: 20, dmg: 2 }),
  kmind('ax_m3c', '大樹の構え', 'axe', 'A', ['guard'], { type: 'guard', wall: 2, self: 4 }),
  cmind('ax_m3d', '豪傑', 'axe', 'A', ['heavy', 'noble'], 'vsLeader', { dmg: 5 }),
  art('ax_art3', '鬼神断ち', 'axe', 'S', [], { type: 'atk', mul: 1.4, crit: 25, flat: 4, cost: 2 }),
  art('ax_a3b', '地響き', 'axe', 'S', ['heavy'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }),
  art('ax_a3c', '渾身の大斧', 'axe', 'S', ['atk'], { type: 'atk', mul: 2.2, hit: -15, cost: 2 }, { rare: true }),
  art('ax_a3d', '山嵐', 'axe', 'S', ['swift'], { type: 'atk', hits: 3, mul: 0.7, cost: 2 }),
  // ======== 弓 ========
  mind('bo_mind1', '弓の基本', 'bow', 'E+', [], { hit: 5, wtype: ['bow'] }),
  mind('bo_m1b', '遠目', 'bow', 'E+', ['trick'], { hit: 8, wtype: ['bow'] }),
  cmind('bo_m1c', '先手の矢', 'bow', 'E+', ['swift'], 'first', { dmg: 3 }),
  kmind('bo_m1d', '援護射撃', 'bow', 'E+', ['support'], { type: 'buff', team: { hit: 10 }, draw: 1 }),
  art('bo_art1', '影縫い', 'bow', 'D', [], { type: 'atk', mul: 0.6, hit: 15, debuff: 'avo', amt: 20 }),
  art('bo_a1b', '狙い射ち', 'bow', 'D', ['atk'], { type: 'atk', mul: 1.25, hit: 20 }),
  art('bo_a1c', '二本射ち', 'bow', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.65 }),
  art('bo_a1d', '牽制の矢', 'bow', 'D', ['guard', 'trick'], { type: 'atk', mul: 0.6, debuff: 'atk', amt: 4 }),
  mind('bo_mind2', '弓の心得', 'bow', 'C', [], { hit: 10, wtype: ['bow'] }),
  cmind('bo_m2b', '狙撃手の息', 'bow', 'C', ['trick'], 'fullHp', { crit: 15 }),
  kmind('bo_m2c', '守り矢', 'bow', 'C', ['guard', 'support'], { type: 'guard', wall: 2 }),
  mind('bo_m2d', '狩人の勘', 'bow', 'C', ['swift'], { avo: 6 }),
  art('bo_art2', '落鳥', 'bow', 'B', [], { type: 'atk', mul: 1.1, vsMove: ['flying'] }),
  art('bo_a2b', '雨の矢', 'bow', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('bo_a2c', '縫い止め', 'bow', 'B', ['trick'], { type: 'atk', mul: 0.8, stun: true }, { rare: true }),
  art('bo_a2d', '貫き矢', 'bow', 'B', ['heavy'], { type: 'atk', pierce: 8, mul: 1.1 }),
  mind('bo_mind3', '鷹の目', 'bow', 'A', [], { crit: 10, wtype: ['bow'] }),
  cmind('bo_m3b', '静かな狙い', 'bow', 'A', ['trick'], 'first', { crit: 20 }),
  cmind('bo_m3c', '逃げ足', 'bow', 'A', ['swift', 'guard'], 'lowHp', { avo: 15, prot: 1 }),
  kmind('bo_m3d', '号矢', 'bow', 'A', ['noble'], { type: 'buff', team: { dmg: 2, crit: 5 } }),
  art('bo_art3', '流星', 'bow', 'S', [], { type: 'atk', mul: 1.7, cost: 2 }),
  art('bo_a3b', '千本の雨', 'bow', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }),
  art('bo_a3c', '一矢必中', 'bow', 'S', ['trick'], { type: 'atk', mul: 1.6, hit: 50, crit: 20, cost: 2 }, { rare: true }),
  art('bo_a3d', '五月雨', 'bow', 'S', ['swift'], { type: 'atk', hits: 4, mul: 0.5, cost: 2 }),
  // ======== 魔道 ========
  mind('ma_mind1', '魔道の基本', 'magic', 'E+', [], { hit: 5, wtype: ['magic'] }),
  kmind('ma_m1b', '魔力の盾', 'magic', 'E+', ['guard'], { type: 'guard', wall: 2 }),
  cmind('ma_m1c', '先駆けの詠唱', 'magic', 'E+', ['swift'], 'first', { dmg: 3 }),
  mind('ma_m1d', '書の知識', 'magic', 'E+', ['trick', 'noble'], { hit: 8, wtype: ['magic'] }),
  art('ma_art1', '魔力集中', 'magic', 'D', [], { type: 'atk', flat: 4 }),
  art('ma_a1b', '二重詠唱', 'magic', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.6 }),
  art('ma_a1c', '惑わしの霧', 'magic', 'D', ['trick'], { type: 'atk', mul: 0.5, debuff: 'atk', amt: 4 }),
  art('ma_a1d', '的確な詠唱', 'magic', 'D', ['atk'], { type: 'atk', mul: 1.1, hit: 20 }),
  mind('ma_mind2', '魔道の心得', 'magic', 'C', [], { dmg: 1, wtype: ['magic'] }),
  kmind('ma_m2b', '魔力循環', 'magic', 'C', ['trick'], { type: 'buff', cost: 0, draw: 1 }),
  cmind('ma_m2c', '怒りの魔力', 'magic', 'C', ['atk'], 'allyDown', { dmg: 5 }),
  cmind('ma_m2d', '静謐', 'magic', 'C', ['noble', 'guard'], 'fullHp', { hit: 15, crit: 5 }),
  art('ma_art2', '魔障破り', 'magic', 'B', [], { type: 'atk', pierce: 6, mul: 1.1 }),
  art('ma_a2b', '魔力の嵐', 'magic', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('ma_a2c', '封じの呪', 'magic', 'B', ['trick'], { type: 'atk', mul: 0.6, stun: true }),
  art('ma_a2d', '魔力爆発', 'magic', 'B', ['heavy'], { type: 'atk', mul: 1.5, hit: -10 }, { rare: true }),
  mind('ma_mind3', '詠唱短縮', 'magic', 'A', [], { avo: 8, wtype: ['magic'] }),
  cmind('ma_m3b', '魔の目覚め', 'magic', 'A', ['atk'], 'lowHp', { dmg: 5 }),
  kmind('ma_m3c', '結界', 'magic', 'A', ['guard', 'support'], { type: 'guard', wall: 3 }),
  mind('ma_m3d', '叡智', 'magic', 'A', ['noble'], { crit: 8, wtype: ['magic'] }),
  art('ma_art3', '大詠唱', 'magic', 'S', [], { type: 'atk', mul: 1.8, hit: -5, cost: 2 }),
  art('ma_a3b', '天変', 'magic', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }),
  art('ma_a3c', '時の縛め', 'magic', 'S', ['trick'], { type: 'atk', mul: 1.2, stun: true, cost: 2 }, { rare: true }),
  art('ma_a3d', '星読みの一撃', 'magic', 'S', ['noble'], { type: 'atk', mul: 1.6, crit: 30, cost: 2 }),
  // ======== 信仰 ========
  mind('fa_mind1', '祈りの基本', 'faith', 'E+', [], { prot: 1 }),
  kmind('fa_m1b', '癒やしの手', 'faith', 'E+', ['support'], { type: 'heal', heal: 8 }),
  kmind('fa_m1c', '小さな加護', 'faith', 'E+', ['guard'], { type: 'guard', cover: true }),
  cmind('fa_m1d', '清らかな心', 'faith', 'E+', ['noble'], 'fullHp', { hit: 10 }),
  art('fa_art1', '裁きの光', 'faith', 'D', [], { type: 'atk', flat: 3, hit: 10 }),
  art('fa_a1b', '祈りの盾', 'faith', 'D', ['guard', 'support'], { type: 'guard', wall: 3 }),
  art('fa_a1c', '聖なる鎖', 'faith', 'D', ['trick'], { type: 'atk', mul: 0.6, stun: true }),
  art('fa_a1d', '癒やしの祈り', 'faith', 'D', ['support'], { type: 'heal', heal: 6, all: true, cost: 2 }),
  mind('fa_mind2', '慈愛', 'faith', 'C', [], { auraHeal: 2 }),
  kmind('fa_m2b', '献身', 'faith', 'C', ['guard', 'support'], { type: 'guard', cover: true, self: 2 }),
  cmind('fa_m2c', '信念', 'faith', 'C', ['atk'], 'allyDown', { dmg: 4, hit: 10 }),
  kmind('fa_m2d', '祝福', 'faith', 'C', ['noble'], { type: 'buff', team: { dmg: 1, hit: 10 } }),
  art('fa_art2', '浄めの光', 'faith', 'B', [], { type: 'atk', pierce: 6, mul: 1.1 }),
  art('fa_a2b', '光の雨', 'faith', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('fa_a2c', '再起の祈り', 'faith', 'B', ['support'], { type: 'heal', heal: 20 }),
  art('fa_a2d', '聖域', 'faith', 'B', ['guard'], { type: 'guard', wall: 4, cost: 2 }, { rare: true }),
  mind('fa_mind3', '加護', 'faith', 'A', [], { prot: 2 }),
  cmind('fa_m3b', '奇跡', 'faith', 'A', ['guard'], 'lowHp', { prot: 4 }),
  kmind('fa_m3c', '癒やしの風', 'faith', 'A', ['support'], { type: 'heal', heal: 8, all: true, cost: 2 }),
  cmind('fa_m3d', '聖騎士の誓い', 'faith', 'A', ['noble', 'atk'], 'vsLeader', { dmg: 5 }),
  art('fa_art3', '天の審判', 'faith', 'S', [], { type: 'atk', mul: 1.6, hit: 10, cost: 2 }),
  art('fa_a3b', '大いなる癒やし', 'faith', 'S', ['support'], { type: 'heal', heal: 18, all: true, cost: 2 }),
  art('fa_a3c', '光の柱', 'faith', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }),
  art('fa_a3d', '不落の祈り', 'faith', 'S', ['guard'], { type: 'guard', wall: 6, cost: 2 }, { rare: true }),
  // ======== 騎乗 ========
  mind('ri_mind1', '手綱さばき', 'riding', 'E+', [], { avo: 3 }),
  cmind('ri_m1b', '騎馬の勢い', 'riding', 'E+', ['atk', 'swift'], 'first', { dmg: 3 }),
  kmind('ri_m1c', '乗り手の盾', 'riding', 'E+', ['guard', 'noble'], { type: 'guard', cover: true }),
  cmind('ri_m1d', '鞍上の余裕', 'riding', 'E+', ['noble'], 'fullHp', { avo: 10 }),
  art('ri_art1', '駆け抜け', 'riding', 'D', [], { type: 'atk', flat: 3 }, { weapons: undefined }),
  art('ri_a1b', '蹄の一撃', 'riding', 'D', ['heavy'], { type: 'atk', mul: 0.9, stun: true }, { weapons: undefined }),
  art('ri_a1c', '一撃離脱', 'riding', 'D', ['swift', 'trick'], { type: 'atk', mul: 1.1, self: 4 } as CardFx, { weapons: undefined }),
  art('ri_a1d', '騎馬突撃', 'riding', 'D', ['atk'], { type: 'atk', mul: 1.4, hit: -10 }, { weapons: undefined }),
  mind('ri_mind2', '人馬の呼吸', 'riding', 'C', [], { avo: 6 }),
  kmind('ri_m2b', '拍車', 'riding', 'C', ['swift'], { type: 'buff', cost: 0, draw: 1 }),
  cmind('ri_m2c', '馬上の誇り', 'riding', 'C', ['noble'], 'vsLeader', { dmg: 4 }),
  kmind('ri_m2d', '引き上げ', 'riding', 'C', ['support'], { type: 'guard', cover: true, self: 1 }),
  art('ri_art2', '突撃', 'riding', 'B', [], { type: 'atk', mul: 1.4 }, { weapons: undefined }),
  art('ri_a2b', '蹴散らし', 'riding', 'B', ['atk', 'heavy'], { type: 'atk', aoe: true, mul: 0.7 }, { weapons: undefined }),
  art('ri_a2c', '回りこみ', 'riding', 'B', ['trick'], { type: 'atk', mul: 1.2, pierce: 5 }, { weapons: undefined }),
  art('ri_a2d', '疾駆二撃', 'riding', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.75 }, { weapons: undefined }),
  mind('ri_mind3', '騎士の誇り', 'riding', 'A', [], { hit: 8 }),
  cmind('ri_m3b', '戦場の風', 'riding', 'A', ['swift'], 'allyDown', { dmg: 4, avo: 10 }),
  kmind('ri_m3c', '騎士の盾', 'riding', 'A', ['guard'], { type: 'guard', wall: 3 }),
  mind('ri_m3d', '疾風の騎手', 'riding', 'A', ['swift'], { avo: 8 }),
  art('ri_art3', '怒濤の騎行', 'riding', 'S', [], { type: 'atk', mul: 1.4, flat: 4, crit: 15, cost: 2 }, { weapons: undefined }),
  art('ri_a3b', '大突撃', 'riding', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }, { weapons: undefined }),
  art('ri_a3c', '千里の駆け', 'riding', 'S', ['swift'], { type: 'atk', hits: 3, mul: 0.7, cost: 2 }, { weapons: undefined }),
  art('ri_a3d', '騎士王の一撃', 'riding', 'S', ['noble'], { type: 'atk', mul: 1.9, cost: 2 }, { weapons: undefined, rare: true }),
  // ======== 重装 ========
  mind('he_mind1', '鎧の重み', 'heavy', 'E+', [], { prot: 1 }),
  kmind('he_m1b', 'かばう', 'heavy', 'E+', ['guard', 'support'], { type: 'guard', cover: true }),
  cmind('he_m1c', '鉄の意地', 'heavy', 'E+', ['guard'], 'lowHp', { prot: 3 }),
  cmind('he_m1d', '重い踏みこみ', 'heavy', 'E+', ['heavy', 'atk'], 'first', { dmg: 3 }),
  art('he_art1', '体当たり', 'heavy', 'D', [], { type: 'atk', flat: 3 }, { weapons: undefined }),
  art('he_a1b', '盾構え', 'heavy', 'D', ['guard'], { type: 'guard', self: 6, counter: 0.7 }),
  art('he_a1c', '押し潰し', 'heavy', 'D', ['heavy'], { type: 'atk', mul: 1, stun: true }, { weapons: undefined }),
  art('he_a1d', '盾の殴打', 'heavy', 'D', ['trick'], { type: 'atk', mul: 0.8, debuff: 'atk', amt: 4 }, { weapons: undefined }),
  mind('he_mind2', '鉄の守り', 'heavy', 'C', [], { prot: 2 }),
  kmind('he_m2b', '鉄壁', 'heavy', 'C', ['guard'], { type: 'guard', wall: 3 }),
  kmind('he_m2c', '仁王の構え', 'heavy', 'C', ['guard', 'noble'], { type: 'guard', cover: true, self: 2 }),
  cmind('he_m2d', '不動心', 'heavy', 'C', ['heavy'], 'allyDown', { prot: 3, dmg: 2 }),
  art('he_art2', '盾打ち', 'heavy', 'B', [], { type: 'atk', flat: 3, hit: 10 }, { weapons: undefined }),
  art('he_a2b', '地ならし', 'heavy', 'B', ['heavy'], { type: 'atk', aoe: true, mul: 0.7 }, { weapons: undefined }),
  art('he_a2c', '鉄の反撃', 'heavy', 'B', ['guard'], { type: 'guard', self: 4, counter: 1.1 }),
  art('he_a2d', '重装突進', 'heavy', 'B', ['atk'], { type: 'atk', mul: 1.5 }, { weapons: undefined }),
  mind('he_mind3', '城壁', 'heavy', 'A', [], { adjAllyDef: 1 }),
  cmind('he_m3b', '不沈', 'heavy', 'A', ['guard'], 'lowHp', { prot: 5 }),
  kmind('he_m3c', '守護者', 'heavy', 'A', ['support'], { type: 'guard', cover: true, wall: 1 }),
  cmind('he_m3d', '重鎧の誇り', 'heavy', 'A', ['noble'], 'vsLeader', { dmg: 4, prot: 2 }),
  art('he_art3', '山崩し', 'heavy', 'S', [], { type: 'atk', mul: 1.6, cost: 2 }, { weapons: undefined }),
  art('he_a3b', '不落の城', 'heavy', 'S', ['guard'], { type: 'guard', wall: 6, cost: 2 }),
  art('he_a3c', '鉄槌', 'heavy', 'S', ['heavy'], { type: 'atk', mul: 1.8, stun: true, cost: 2 }, { weapons: undefined, rare: true }),
  art('he_a3d', '大地の怒り', 'heavy', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }, { weapons: undefined }),
  // ======== 飛行 ========
  mind('fl_mind1', '風に乗る', 'flying', 'E+', [], { avo: 3 }),
  mind('fl_m1b', '空からの目', 'flying', 'E+', ['trick'], { hit: 8 }),
  kmind('fl_m1c', '舞い上がり', 'flying', 'E+', ['swift', 'guard'], { type: 'guard', self: 5 }),
  cmind('fl_m1d', '急旋回', 'flying', 'E+', ['swift'], 'lowHp', { avo: 15 }),
  art('fl_art1', '急降下', 'flying', 'D', [], { type: 'atk', flat: 3 }, { weapons: undefined }),
  art('fl_a1b', '翼打ち', 'flying', 'D', ['trick'], { type: 'atk', mul: 0.8, stun: true }, { weapons: undefined }),
  art('fl_a1c', '空の連撃', 'flying', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.65 }, { weapons: undefined }),
  art('fl_a1d', '天からの一撃', 'flying', 'D', ['atk'], { type: 'atk', mul: 1.4, hit: -10 }, { weapons: undefined }),
  mind('fl_mind2', '風読み', 'flying', 'C', [], { avo: 8 }),
  kmind('fl_m2b', '風の加護', 'flying', 'C', ['support'], { type: 'guard', wall: 2 }),
  cmind('fl_m2c', '先駆け', 'flying', 'C', ['swift'], 'first', { crit: 15 }),
  cmind('fl_m2d', '天馬の誇り', 'flying', 'C', ['noble'], 'vsLeader', { dmg: 4 }),
  art('fl_art2', '天翔け', 'flying', 'B', [], { type: 'atk', flat: 2, hit: 15, mul: 1.1 }, { weapons: undefined }),
  art('fl_a2b', '羽ばたき払い', 'flying', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }, { weapons: undefined }),
  art('fl_a2c', '背後取り', 'flying', 'B', ['trick'], { type: 'atk', pierce: 8, mul: 1.1 }, { weapons: undefined }),
  art('fl_a2d', '舞い打ち', 'flying', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.8 }, { weapons: undefined, rare: true }),
  mind('fl_mind3', '空の王者', 'flying', 'A', [], { crit: 8 }),
  kmind('fl_m3b', '空の守り手', 'flying', 'A', ['guard'], { type: 'guard', cover: true }),
  cmind('fl_m3c', '怒りの翼', 'flying', 'A', ['atk'], 'allyDown', { dmg: 5 }),
  mind('fl_m3d', '雲上', 'flying', 'A', ['swift'], { avo: 10 }),
  art('fl_art3', '天馬昇撃', 'flying', 'S', [], { type: 'atk', mul: 1.6, cost: 2 }, { weapons: undefined }),
  art('fl_a3b', '嵐の舞', 'flying', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }, { weapons: undefined }),
  art('fl_a3c', '流れ星', 'flying', 'S', ['swift'], { type: 'atk', hits: 4, mul: 0.5, cost: 2 }, { weapons: undefined }),
  art('fl_a3d', '天空の裁き', 'flying', 'S', ['noble'], { type: 'atk', mul: 1.7, crit: 25, cost: 2 }, { weapons: undefined, rare: true }),
  // ======== 銃 ========
  mind('gu_mind1', '銃の基本', 'gun', 'E+', [], { hit: 5, wtype: ['gun'] }),
  cmind('gu_m1b', '落ち着き', 'gun', 'E+', ['guard'], 'fullHp', { hit: 15 }),
  cmind('gu_m1c', '早撃ち', 'gun', 'E+', ['swift'], 'first', { dmg: 3 }),
  kmind('gu_m1d', '威嚇射撃', 'gun', 'E+', ['trick'], { type: 'guard', wall: 2 }),
  art('gu_art1', '狙い撃ち', 'gun', 'D', [], { type: 'atk', mul: 1.2, hit: 15 }),
  art('gu_a1b', '二連射', 'gun', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.6 }),
  art('gu_a1c', '足撃ち', 'gun', 'D', ['trick'], { type: 'atk', mul: 0.7, stun: true }),
  art('gu_a1d', '散弾', 'gun', 'D', ['atk'], { type: 'atk', aoe: true, mul: 0.55 }),
  mind('gu_mind2', '銃の心得', 'gun', 'C', [], { crit: 8, wtype: ['gun'] }),
  kmind('gu_m2b', '援護の銃火', 'gun', 'C', ['support'], { type: 'buff', team: { hit: 10, dmg: 1 } }),
  cmind('gu_m2c', '冷たい銃口', 'gun', 'C', ['trick'], 'vsLeader', { crit: 15 }),
  kmind('gu_m2d', '弾帯', 'gun', 'C', ['swift'], { type: 'buff', cost: 0, draw: 1 }),
  art('gu_art2', '徹甲弾', 'gun', 'B', [], { type: 'atk', pierce: 8, mul: 1.1 }),
  art('gu_a2b', '制圧射撃', 'gun', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.75 }),
  art('gu_a2c', '急所狙い', 'gun', 'B', ['trick'], { type: 'atk', crit: 35, mul: 1.1 }),
  art('gu_a2d', '重弾', 'gun', 'B', ['heavy'], { type: 'atk', mul: 1.5, hit: -10 }, { rare: true }),
  mind('gu_mind3', '早込め', 'gun', 'A', [], { avo: 8, wtype: ['gun'] }),
  cmind('gu_m3b', '不退転', 'gun', 'A', ['atk'], 'lowHp', { dmg: 5 }),
  kmind('gu_m3c', '硝煙の幕', 'gun', 'A', ['guard'], { type: 'guard', wall: 3 }),
  mind('gu_m3d', '名射手', 'gun', 'A', ['noble'], { hit: 10, wtype: ['gun'] }),
  art('gu_art3', '必中の一弾', 'gun', 'S', [], { type: 'atk', mul: 1.7, hit: 20, cost: 2 }),
  art('gu_a3b', '一斉射撃', 'gun', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }),
  art('gu_a3c', '銀の弾丸', 'gun', 'S', ['trick'], { type: 'atk', mul: 1.5, pierce: 15, cost: 2 }, { rare: true }),
  art('gu_a3d', '三連の銃声', 'gun', 'S', ['swift'], { type: 'atk', hits: 3, mul: 0.7, cost: 2 }),
  // ======== 軍略 ========
  mind('ta_mind1', '地の利', 'tactics', 'E+', [], { avo: 3 }),
  kmind('ta_m1b', '読み', 'tactics', 'E+', ['trick'], { type: 'buff', cost: 0, draw: 1 }),
  kmind('ta_m1c', '備え', 'tactics', 'E+', ['guard'], { type: 'guard', wall: 2 }),
  cmind('ta_m1d', '先手必勝', 'tactics', 'E+', ['swift'], 'first', { hit: 15, dmg: 1 }),
  art('ta_art1', '虚を突く', 'tactics', 'D', [], { type: 'atk', hit: 15, mul: 1.1 }, { weapons: undefined }),
  art('ta_a1b', '陽動', 'tactics', 'D', ['trick'], { type: 'atk', mul: 0.5, debuff: 'atk', amt: 4 }, { weapons: undefined }),
  art('ta_a1c', '隙突き', 'tactics', 'D', ['swift'], { type: 'atk', crit: 25 }, { weapons: undefined }),
  art('ta_a1d', '足止め', 'tactics', 'D', ['guard'], { type: 'atk', mul: 0.6, stun: true }, { weapons: undefined }),
  mind('ta_mind2', '先読み', 'tactics', 'C', [], { avo: 6 }),
  kmind('ta_m2b', '号令の旗', 'tactics', 'C', ['noble'], { type: 'buff', team: { hit: 10 } }),
  cmind('ta_m2c', '冷静', 'tactics', 'C', ['guard'], 'allyDown', { hit: 15, avo: 10 }),
  kmind('ta_m2d', '兵站', 'tactics', 'C', ['support'], { type: 'heal', heal: 5, all: true }),
  art('ta_art2', '弱点看破', 'tactics', 'B', [], { type: 'atk', pierce: 6, mul: 1.1 }, { weapons: undefined }),
  art('ta_a2b', '撹乱', 'tactics', 'B', ['trick'], { type: 'atk', aoe: true, mul: 0.4, debuff: 'atk', amt: 3 }, { weapons: undefined }),
  art('ta_a2c', '急所の読み', 'tactics', 'B', ['swift'], { type: 'atk', crit: 30, mul: 1.1 }, { weapons: undefined }),
  art('ta_a2d', '采配', 'tactics', 'B', ['support'], { type: 'buff', draw: 2 }, { rare: true }),
  mind('ta_mind3', '軍師の眼', 'tactics', 'A', [], { hit: 8, avo: 4 }),
  cmind('ta_m3b', '窮地の知恵', 'tactics', 'A', ['trick'], 'lowHp', { avo: 15, hit: 10 }),
  kmind('ta_m3c', '布陣', 'tactics', 'A', ['guard'], { type: 'guard', wall: 4, cost: 2 }),
  cmind('ta_m3d', '名将の勘', 'tactics', 'A', ['noble'], 'vsLeader', { crit: 15 }),
  art('ta_art3', '必勝の策', 'tactics', 'S', [], { type: 'atk', mul: 1.4, crit: 30, cost: 2 }, { weapons: undefined }),
  art('ta_a3b', '十面の伏せ', 'tactics', 'S', ['trick'], { type: 'atk', aoe: true, mul: 1, cost: 2 }, { weapons: undefined }),
  art('ta_a3c', '背水の陣', 'tactics', 'S', ['atk'], { type: 'buff', team: { dmg: 4, crit: 10 }, cost: 2 }),
  art('ta_a3d', '千手先', 'tactics', 'S', ['trick'], { type: 'atk', mul: 0.8, stun: true, cost: 1 }, { weapons: undefined, rare: true }),
  // ======== 統率 ========
  mind('co_mind1', '声かけ', 'command', 'E+', [], { adjAllyDef: 1 }),
  kmind('co_m1b', '励まし', 'command', 'E+', ['support'], { type: 'heal', heal: 6 }),
  kmind('co_m1c', '号令の声', 'command', 'E+', ['noble'], { type: 'buff', team: { hit: 10 } }),
  kmind('co_m1d', '盾となる将', 'command', 'E+', ['guard'], { type: 'guard', cover: true }),
  art('co_art1', '叱咤', 'command', 'D', [], { type: 'atk', flat: 2, hit: 5 }, { weapons: undefined }),
  art('co_a1b', '先陣', 'command', 'D', ['atk'], { type: 'atk', mul: 1.3, hit: -5 }, { weapons: undefined }),
  art('co_a1c', '檄', 'command', 'D', ['support'], { type: 'buff', team: { dmg: 2 } }),
  art('co_a1d', '指揮の一撃', 'command', 'D', ['noble'], { type: 'atk', mul: 1.1, hit: 10 }, { weapons: undefined }),
  mind('co_mind2', '号令', 'command', 'C', [], { hit: 5 }),
  cmind('co_m2b', '仲間の仇', 'command', 'C', ['atk'], 'allyDown', { dmg: 5 }),
  kmind('co_m2c', '円陣', 'command', 'C', ['guard'], { type: 'guard', wall: 3 }),
  cmind('co_m2d', '将の余裕', 'command', 'C', ['noble'], 'fullHp', { crit: 10 }),
  art('co_art2', '陣頭の一撃', 'command', 'B', [], { type: 'atk', mul: 1.4 }, { weapons: undefined }),
  art('co_a2b', '総攻撃の合図', 'command', 'B', ['atk'], { type: 'buff', team: { dmg: 3, hit: 5 } }),
  art('co_a2c', '立て直し', 'command', 'B', ['support'], { type: 'heal', heal: 8, all: true, cost: 2 }),
  art('co_a2d', '牽制の号令', 'command', 'B', ['trick'], { type: 'atk', aoe: true, mul: 0.4, debuff: 'atk', amt: 3 }, { weapons: undefined }),
  mind('co_mind3', '将の器', 'command', 'A', [], { adjAllyProt: 1 }),
  cmind('co_m3b', '不退の将', 'command', 'A', ['guard'], 'lowHp', { prot: 3, dmg: 3 }),
  kmind('co_m3c', '采配の妙', 'command', 'A', ['trick'], { type: 'buff', draw: 2 }),
  cmind('co_m3d', '覇道', 'command', 'A', ['atk'], 'vsLeader', { dmg: 5 }),
  art('co_art3', '覇気', 'command', 'S', [], { type: 'atk', mul: 1.4, flat: 5, crit: 15, cost: 2 }, { weapons: undefined }),
  art('co_a3b', '全軍突撃', 'command', 'S', ['atk'], { type: 'buff', team: { dmg: 5, crit: 10 }, cost: 2 }),
  art('co_a3c', '鉄の軍律', 'command', 'S', ['guard'], { type: 'guard', wall: 5, cost: 2 }),
  art('co_a3d', '王者の号令', 'command', 'S', ['noble'], { type: 'buff', ap: 2 }, { rare: true }),
  // ======== 開花した子だけの固有の戦技（技能ごとに3通り。覚える表で1つ） ========
  ...bloomArts(),
];

function bloomArts(): ArtDef[] {
  const names: Record<SkillId, [string, string]> = {
    sword: ['目覚めの太刀', '胸に咲く一閃'], lance: ['目覚めの穂先', '星を穿つ槍'], axe: ['目覚めの大斧', '眠り獅子'], bow: ['目覚めの矢', '夜明けの一矢'],
    magic: ['目覚めの魔力', '秘めた詠唱'], faith: ['目覚めの祈り', '小さな奇跡'], riding: ['目覚めの騎行', '蹄の誓い'], heavy: ['目覚めの鉄壁', '眠れる巨岩'],
    flying: ['目覚めの翼', '遥かな空へ'], gun: ['目覚めの一発', '静かな銃声'], tactics: ['目覚めの策', '見えた勝ち筋'], command: ['目覚めの号令', '背中で語る将'],
  };
  const out: ArtDef[] = [];
  for (const k of Object.keys(names) as SkillId[]) {
    const wp = W[k];
    out.push(art(`bl_${k}`, '眠りからの一撃', k, 'D+', ['atk'], { type: 'atk', mul: 1.6, crit: 10 }, { bloom: true, weapons: wp, chance: 30 }));
    out.push(art(`bl_${k}_2`, names[k][0], k, 'D+', ['swift', 'trick'], { type: 'atk', hits: 2, mul: 0.9, crit: 10 }, { bloom: true, weapons: wp, chance: 30 }));
    out.push(k === 'heavy' || k === 'faith' || k === 'command'
      ? art(`bl_${k}_3`, names[k][1], k, 'D+', ['guard', 'support', 'noble'], k === 'faith' ? { type: 'heal', heal: 14, all: true } : { type: 'guard', wall: 4, cover: true }, { bloom: true })
      : art(`bl_${k}_3`, names[k][1], k, 'D+', ['guard', 'heavy', 'noble'], { type: 'atk', mul: 1.4, stun: true }, { bloom: true, weapons: wp, chance: 30 }));
  }
  return out;
}

export const ARTS: Record<string, ArtDef> = Object.fromEntries(ART_LIST.map((a) => [a.id, a]));
/** 持てる数の上限。15夜目：art は「戦技と魔法」を合わせた数（5つまで）。mind は「スキル」（呼び名を心得から変えた） */
export const ART_SLOTS = { art: 5, mind: 5 };
/** 使う見込みの上乗せ（古いマス目の戦い） */
export const ART_CHANCE = { leader: 15, lowHp: 10, max: 60, vsMoveDmg: 6 };
/** 覚える表の節目（この順で1つずつ） */
export const ART_MILESTONES: Rank[] = ['E+', 'D', 'C', 'B', 'A', 'S'];
/** 覚える表の決め方：性格・夢・出身・家柄の傾き */
export const ART_TASTE = {
  personality: { hot: ['atk', 'heavy'], competitive: ['atk', 'swift'], cheerful: ['atk', 'support'], calm: ['guard', 'trick'], serious: ['guard', 'noble'], timid: ['guard', 'support'], shy: ['support', 'trick'], gentle: ['support', 'guard'], cynic: ['trick', 'swift'], whimsical: ['trick', 'swift'] } as Record<string, ArtStyle[]>,
  origin: { kingdom: ['heavy', 'noble'], empire: ['swift', 'atk'], alliance: ['trick', 'support'], frontier: [] } as Record<string, ArtStyle[]>,
  house: { noble: ['noble'], commoner: [], orphan: ['trick'] } as Record<string, ArtStyle[]>,
  dream: { kingdom_knight: ['noble', 'guard'], feed_family: ['heavy'], scholar: ['trick'], fame: ['atk'], protect_home: ['guard'], peace: ['support'], healer: ['support'], sky: ['swift'], strategist: ['trick'], statesman: ['noble'], teacher: ['support'], free: ['swift'] } as Record<string, ArtStyle[]>,
  /** 傾きが1つ合うごとの重み、もとの重み */
  per: 2, base: 1,
  /** 札が強くなる：覚えたランクから節目を2つ上がると「＋」 */
  plusSteps: 2, plusMul: 1.25,
};
/** スキルを戦いの固有スキル（ABILITIES）として登録するための形。条件で効くものと札のものは、いつもの補正には入れない */
export function mindAbility(a: ArtDef): AbilityDef { return { id: a.id, name: a.name, desc: a.desc, ...(a.cond || a.card ? {} : a.ability ?? {}) }; }
