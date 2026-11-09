// 戦技とスキル（12夜目。16夜目：生徒ごとに覚えるものが違う・札になる）
// 技能×節目（E+・D・C・B・A・S）ごとに4通りの候補があり、入学のときに「覚える表」で1つずつ決まる（core/arts.ts の makeArtPlan）。
// 戦技（art）：戦いで使う札。スキル（mind）：いつも効く・条件で効く、または札になる（かばう・鉄壁など）。
// データを足すだけで増やせる：同じ技能・同じ節目に足せば、覚える表の候補に入る。
import type { Rank, SkillId, WeaponType, MoveType, AbilityDef } from '../core/types';

/** 覚える表の決め方に使う傾き：攻め・守り・速さ（帝国）・重さ（王国）・搦め手（同盟）・仲間を助ける・格式（家柄） */
export type ArtStyle = 'atk' | 'guard' | 'swift' | 'heavy' | 'trick' | 'support' | 'noble';
/**
 * 条件で効くスキル（16夜目：HPが半分以下・仲間が倒れた・そのターンの最初の札・敵将と戦う・HPが満タン）
 * 18夜目：武器の相性が有利・前列／後列にいる・森や霧・晴れ・最後のターン・1ターン目・自分より強い敵・止めた／弱めた敵 を足した
 */
export type SkillCond = 'lowHp' | 'allyDown' | 'first' | 'vsLeader' | 'fullHp' | 'tri' | 'front' | 'back' | 'field' | 'clear' | 'lastTurn' | 'turn1' | 'vsStrong' | 'vsStun';
export const COND_LABEL: Record<SkillCond, string> = {
  lowHp: 'HPが半分以下のとき', allyDown: '仲間が倒れたとき', first: '先に攻撃したとき', vsLeader: '敵将と戦うとき', fullHp: 'HPが満タンのとき',
  tri: '武器の相性が有利なとき', front: '前列にいるとき', back: '後列にいるとき', field: '森や霧の戦いで', clear: '晴れた日の戦いで',
  lastTurn: '最後のターンに', turn1: '1ターン目に', vsStrong: '自分よりレベルの高い敵に', vsStun: '足を止めた敵・弱めた敵に',
};
/**
 * 18夜目：数の補正だけでは表せないスキルの効き目（core/battle/cards.ts で使う）。n は強さ
 * selfCombo：同じターンに自分の札を2枚出すと、2枚目の攻撃で追い打ち（威力×n/100）
 * drawPlus：ターンのはじめに札をn枚多く引く／coverCounter：かばったあと反撃（威力×n/100）／spellCost：魔法の札の行動力−1（1ターンに1回）
 * trustCrit：信頼が高いほど必殺+（信頼÷n）／hp：最大HP+n／regen：ターンのはじめに自分のHP+n／guardPlus：守りの札で減らす傷+n
 * buffPlus：強めの札で上がる威力+n・命中+n×5／stratPlus：策の札が決まる見込み+n%／killAp：敵を倒すと次のターン行動力+1（1ターンに1回）
 * killHeal：敵を倒すとHP+n／endure：1戦に1回、倒れるはずの攻撃をHP1で耐える／counter：攻撃されるとn%で反撃
 * teamProt：前列の仲間みんなの受ける傷−n／aoePlus：前の敵すべてへの札の威力+n／multiPlus：2回以上攻撃する札の1回ごとの威力+n
 * taunt：敵の狙いを引きつける／backHeal：回復の札+n（後列にいるとき）／apOnce：行動力+1（1戦に1回。条件で決まる）
 * coverPlus：かばうとき受ける傷がさらに減る（n%）
 */
export type PerkId = 'selfCombo' | 'drawPlus' | 'coverCounter' | 'spellCost' | 'trustCrit' | 'hp' | 'regen' | 'guardPlus' | 'buffPlus' | 'stratPlus' | 'killAp' | 'killHeal' | 'endure' | 'counter' | 'teamProt' | 'aoePlus' | 'multiPlus' | 'taunt' | 'backHeal' | 'apOnce' | 'coverPlus';
export interface Perk { id: PerkId; n: number }

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
  /** 18夜目：数の補正だけでは表せない効き目 */
  perk?: Perk;
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
  if (ab.pierce) t.push(`守りを${ab.pierce}低く見る`);
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
/** 18夜目：スキルの効き目の文 */
export function perkText(p: Perk): string {
  const n = p.n;
  switch (p.id) {
    case 'selfCombo': return `同じターンに自分の札を2枚出すと、2枚目の攻撃のあとに追い打ち`;
    case 'drawPlus': return `ターンのはじめに札を${n}枚多く引く`;
    case 'coverCounter': return `かばったあと、その敵に反撃`;
    case 'spellCost': return `魔法の札の行動力−1（1ターンに1回）`;
    case 'trustCrit': return `先生への信頼が高いほど必殺+（信頼${n}ごとに+1）`;
    case 'hp': return `最大HP+${n}`;
    case 'regen': return `ターンのはじめに自分のHP+${n}`;
    case 'guardPlus': return `守りの札で減らす傷+${n}`;
    case 'buffPlus': return `強めの札で上がる威力+${n}・命中+${n * 5}`;
    case 'stratPlus': return `出撃していると、先生の策が決まる見込み+${n}%`;
    case 'killAp': return `敵を倒すと、次のターンの行動力+1（1ターンに1回）`;
    case 'killHeal': return `敵を倒すと、自分のHP+${n}`;
    case 'endure': return `1戦に1回、倒れるはずの攻撃をHP1で踏みとどまる`;
    case 'counter': return `前列で攻撃されると、${n}%で反撃`;
    case 'teamProt': return `前列にいると、前列の仲間みんなの受ける傷−${n}`;
    case 'aoePlus': return `前の敵すべてへの札の威力+${n}`;
    case 'multiPlus': return `2回以上攻撃する札の、1回ごとの威力+${n}`;
    case 'taunt': return `敵の狙いを自分に引きつける`;
    case 'backHeal': return `回復の札の量+${n}`;
    case 'apOnce': return `行動力+1（1戦に1回）`;
    case 'coverPlus': return `かばうとき、受ける傷がさらに${n}%減る`;
  }
}
/** 18夜目：スキル（いつも効く・条件で効く。札にはならない） */
const sk = (id: string, name: string, skill: SkillId, rank: Rank, style: ArtStyle[], e: { cond?: SkillCond; ab?: ArtDef['ability']; perk?: Perk }): ArtDef => {
  const wt = e.ab?.wtype?.map((w) => WT_NAME[w]).join('・');
  const body = e.perk ? perkText(e.perk) : abText(e.ab);
  const desc = `${e.cond ? `${COND_LABEL[e.cond]}、` : ''}${wt ? `${wt}を持つと` : ''}${body}`;
  return { id, name, skill, rank, kind: 'mind', desc, ability: e.ab, cond: e.cond, perk: e.perk, style };
};
/** もとは札になるスキル（かばう・鉄壁など）。18夜目から「戦技と魔法」の札（節目は E+→D・C→B・A→S） */
const KRANK: Partial<Record<Rank, Rank>> = { 'E+': 'D', C: 'B', A: 'S' };
const kmind = (id: string, name: string, skill: SkillId, rank: Rank, style: ArtStyle[], card: CardFx): ArtDef =>
  ({ id, name, skill, rank: KRANK[rank] ?? rank, kind: 'art', desc: fxText(card), style, card, chance: 0 });

/**
 * 18夜目：スキルを少なく、強く、違うものに。技能×節目（E+・C・A）に2つずつ、72個。
 * 効果（条件×効き目）は45種、同じ効果は技能をまたいでも2つまで。覚える表では、1人に同じ効果が入らない（core/arts.ts）
 */
export const SKILL_LIST: ArtDef[] = [
  // 剣：先手・相性・連ね
  sk('sw_mind1', '剣の基本', 'sword', 'E+', ['noble', 'heavy'], { cond: 'tri', ab: { dmg: 4 } }),
  sk('sw_m1c', '踏みこみ', 'sword', 'E+', ['atk', 'swift'], { cond: 'first', ab: { dmg: 5 } }),
  sk('sw_m2c', '背水の剣', 'sword', 'C', ['atk'], { cond: 'lowHp', ab: { dmg: 7 } }),
  sk('sw_c2', '連ね太刀', 'sword', 'C', ['swift', 'trick'], { perk: { id: 'selfCombo', n: 60 } }),
  sk('sw_m3b', '先の先', 'sword', 'A', ['swift', 'trick'], { cond: 'first', ab: { crit: 25 } }),
  sk('sw_m3c', '不屈', 'sword', 'A', ['atk', 'support', 'guard'], { cond: 'allyDown', ab: { dmg: 7 } }),
  // 槍：守りと返し
  sk('la_mind1', '槍の基本', 'lance', 'E+', ['heavy', 'noble'], { ab: { pierce: 3, wtype: ['lance'] } }),
  sk('la_m1c', '間合い取り', 'lance', 'E+', ['guard', 'trick'], { perk: { id: 'counter', n: 35 } }),
  sk('la_mind2', '槍の心得', 'lance', 'C', ['atk', 'swift'], { cond: 'tri', ab: { dmg: 5 } }),
  sk('la_c2', '返し槍', 'lance', 'C', ['guard', 'noble'], { perk: { id: 'coverCounter', n: 100 } }),
  sk('la_m3c', '槍騎の誉れ', 'lance', 'A', ['noble', 'atk'], { cond: 'vsLeader', ab: { dmg: 7 } }),
  sk('la_m3d', '踏みとどまり', 'lance', 'A', ['guard', 'heavy'], { perk: { id: 'endure', n: 1 } }),
  // 斧：力と勢い
  sk('ax_mind1', '斧の基本', 'axe', 'E+', ['heavy', 'noble'], { ab: { dmg: 2, wtype: ['axe'] } }),
  sk('ax_m1b', '力み', 'axe', 'E+', ['atk'], { cond: 'lowHp', ab: { dmg: 5 } }),
  sk('ax_m2c', '血の滾り', 'axe', 'C', ['atk', 'support'], { cond: 'allyDown', ab: { dmg: 6 } }),
  sk('ax_m1c', '頑丈', 'axe', 'C', ['guard', 'heavy'], { perk: { id: 'hp', n: 8 } }),
  sk('ax_m3d', '豪傑', 'axe', 'A', ['heavy', 'noble'], { cond: 'vsLeader', ab: { dmg: 8 } }),
  sk('ax_m3b', '狂戦の血', 'axe', 'A', ['atk', 'swift'], { perk: { id: 'killAp', n: 1 } }),
  // 弓：狙いと広がり
  sk('bo_mind1', '弓の基本', 'bow', 'E+', ['noble', 'atk'], { ab: { hit: 12, wtype: ['bow'] } }),
  sk('bo_m2d', '狩人の勘', 'bow', 'E+', ['swift', 'trick'], { cond: 'field', ab: { avo: 15 } }),
  sk('bo_m2b', '狙撃手の息', 'bow', 'C', ['trick', 'guard'], { cond: 'fullHp', ab: { crit: 20 } }),
  sk('bo_c2', '群れ狙い', 'bow', 'C', ['atk', 'heavy'], { perk: { id: 'aoePlus', n: 3 } }),
  sk('bo_m3b', '静かな狙い', 'bow', 'A', ['trick', 'swift'], { cond: 'first', ab: { crit: 25 } }),
  sk('bo_mind3', '鷹の眼差し', 'bow', 'A', ['noble', 'atk'], { ab: { crit: 12, wtype: ['bow'] } }),
  // 魔道：詠唱の工夫
  sk('ma_m1c', '先駆けの詠唱', 'magic', 'E+', ['swift', 'atk'], { perk: { id: 'spellCost', n: 1 } }),
  sk('ma_e2', '守りの紋', 'magic', 'E+', ['guard', 'support'], { perk: { id: 'guardPlus', n: 2 } }),
  sk('ma_mind2', '魔道の心得', 'magic', 'C', ['noble', 'heavy'], { ab: { dmg: 2, wtype: ['magic'] } }),
  sk('ma_c2', '重ね詠み', 'magic', 'C', ['swift', 'trick'], { perk: { id: 'multiPlus', n: 3 } }),
  sk('ma_mind3', '詠唱短縮', 'magic', 'A', ['trick', 'swift'], { perk: { id: 'drawPlus', n: 1 } }),
  sk('ma_m3d', '魔の叡智', 'magic', 'A', ['noble', 'atk'], { perk: { id: 'aoePlus', n: 4 } }),
  // 信仰：回復と支え
  sk('fa_m1d', '清らかな心', 'faith', 'E+', ['noble', 'guard'], { cond: 'fullHp', ab: { hit: 15 } }),
  sk('fa_mind1', '祈りの基本', 'faith', 'E+', ['support', 'guard'], { perk: { id: 'regen', n: 3 } }),
  sk('fa_mind2', '慈愛', 'faith', 'C', ['support'], { ab: { auraHeal: 3 } }),
  sk('fa_c2', '後ろからの祈り', 'faith', 'C', ['support', 'trick'], { cond: 'back', perk: { id: 'backHeal', n: 6 } }),
  sk('fa_m3b', '奇跡', 'faith', 'A', ['guard', 'noble'], { cond: 'lowHp', ab: { prot: 5 } }),
  sk('fa_mind3', '加護', 'faith', 'A', ['support', 'guard'], { perk: { id: 'coverPlus', n: 40 } }),
  // 騎乗：動きと先手
  sk('ri_m1b', '騎馬の勢い', 'riding', 'E+', ['atk', 'swift'], { cond: 'first', ab: { dmg: 5 } }),
  sk('ri_mind1', '手綱さばき', 'riding', 'E+', ['swift', 'noble'], { ab: { avo: 10 } }),
  sk('ri_c2', '追い拍車', 'riding', 'C', ['atk', 'swift'], { perk: { id: 'killAp', n: 1 } }),
  sk('ri_m2c', '馬上の誇り', 'riding', 'C', ['noble', 'guard'], { cond: 'vsLeader', ab: { prot: 4 } }),
  sk('ri_m3d', '疾風の騎手', 'riding', 'A', ['swift', 'trick'], { cond: 'turn1', perk: { id: 'apOnce', n: 1 } }),
  sk('ri_mind3', '騎士の誇り', 'riding', 'A', ['noble', 'support'], { perk: { id: 'trustCrit', n: 5 } }),
  // 重装：守りとかばう
  sk('he_mind1', '鎧の重み', 'heavy', 'E+', ['heavy', 'guard'], { ab: { prot: 2 } }),
  sk('he_m1c', '鉄の意地', 'heavy', 'E+', ['guard', 'atk'], { cond: 'lowHp', ab: { prot: 4 } }),
  sk('he_c2', '引きつけ', 'heavy', 'C', ['guard', 'support'], { cond: 'front', perk: { id: 'taunt', n: 1 } }),
  sk('he_mind2', '鉄の守り', 'heavy', 'C', ['guard', 'heavy'], { perk: { id: 'guardPlus', n: 2 } }),
  sk('he_m3b', '不沈', 'heavy', 'A', ['guard', 'heavy'], { perk: { id: 'endure', n: 1 } }),
  sk('he_mind3', '城壁', 'heavy', 'A', ['support', 'noble'], { cond: 'front', perk: { id: 'teamProt', n: 2 } }),
  // 飛行：かわす・空の狩り
  sk('fl_mind1', '風に乗る', 'flying', 'E+', ['swift', 'noble'], { ab: { avo: 10 } }),
  sk('fl_m1d', '急旋回', 'flying', 'E+', ['swift', 'guard'], { cond: 'lowHp', ab: { avo: 20 } }),
  sk('fl_c1', '晴天の翼', 'flying', 'C', ['atk', 'noble'], { cond: 'clear', ab: { dmg: 4 } }),
  sk('fl_c2', '空の狩り', 'flying', 'C', ['atk', 'trick'], { perk: { id: 'killHeal', n: 8 } }),
  sk('fl_mind3', '空の王者', 'flying', 'A', ['atk', 'heavy'], { cond: 'vsStrong', ab: { dmg: 6 } }),
  sk('fl_m3d', '雲上', 'flying', 'A', ['swift', 'trick'], { perk: { id: 'multiPlus', n: 3 } }),
  // 銃：狙いと早込め
  sk('gu_mind1', '銃の基本', 'gun', 'E+', ['noble', 'atk'], { ab: { hit: 12, wtype: ['gun'] } }),
  sk('gu_m1b', '落ち着き', 'gun', 'E+', ['guard', 'trick'], { cond: 'fullHp', ab: { hit: 15 } }),
  sk('gu_mind2', '銃の心得', 'gun', 'C', ['atk', 'swift'], { ab: { crit: 10, wtype: ['gun'] } }),
  sk('gu_m2c', '冷たい銃口', 'gun', 'C', ['trick', 'heavy'], { ab: { pierce: 4, wtype: ['gun'] } }),
  sk('gu_m3b', '不退転', 'gun', 'A', ['atk', 'guard'], { cond: 'lastTurn', ab: { dmg: 8 } }),
  sk('gu_mind3', '早込め', 'gun', 'A', ['swift', 'trick'], { perk: { id: 'selfCombo', n: 60 } }),
  // 軍略：策と読み
  sk('ta_mind1', '地の利', 'tactics', 'E+', ['trick', 'guard'], { cond: 'field', ab: { avo: 15 } }),
  sk('ta_e2', '策の下読み', 'tactics', 'E+', ['trick', 'support'], { perk: { id: 'stratPlus', n: 10 } }),
  sk('ta_m2c', '冷静', 'tactics', 'C', ['guard', 'noble'], { cond: 'allyDown', perk: { id: 'apOnce', n: 1 } }),
  sk('ta_mind2', '隙を読む', 'tactics', 'C', ['trick', 'atk'], { cond: 'vsStun', ab: { dmg: 5 } }),
  sk('ta_mind3', '軍師の眼', 'tactics', 'A', ['trick', 'support'], { perk: { id: 'drawPlus', n: 1 } }),
  sk('ta_m3d', '名将の勘', 'tactics', 'A', ['noble', 'atk'], { cond: 'vsStrong', ab: { dmg: 6 } }),
  // 統率：仲間に効く
  sk('co_mind1', '声かけ', 'command', 'E+', ['support', 'noble'], { perk: { id: 'buffPlus', n: 1 } }),
  sk('co_e2', '軍配の心得', 'command', 'E+', ['trick', 'noble'], { perk: { id: 'stratPlus', n: 10 } }),
  sk('co_m2d', '将の余裕', 'command', 'C', ['noble', 'guard'], { cond: 'fullHp', ab: { crit: 20 } }),
  sk('co_mind2', '先手の号令', 'command', 'C', ['atk', 'swift'], { cond: 'turn1', perk: { id: 'apOnce', n: 1 } }),
  sk('co_mind3', '将の器', 'command', 'A', ['support', 'noble'], { ab: { auraHeal: 3 } }),
  sk('co_m2b', '仲間の仇', 'command', 'A', ['atk', 'support'], { cond: 'allyDown', perk: { id: 'apOnce', n: 1 } }),
];
/**
 * 18夜目：スキルの「効果」（条件×効き目の種類）。数の大きさは見ない。
 * 同じ効果は技能をまたいでも2つまで、1人の覚える表に同じ効果は入れない
 */
export function skillKey(a: ArtDef): string {
  const what = a.perk ? `perk:${a.perk.id}` : Object.keys(a.ability ?? {}).filter((k) => k !== 'wtype').sort().join('+');
  return `${a.cond ?? 'always'}|${what}`;
}
/** 18夜目：なくした・入れ替えたスキルの id → 新しい id（古いセーブの整理） */
export const ART_REMAP: Record<string, string> = {
  sw_mind2: 'sw_c2', sw_mind3: 'sw_m3b', la_m2c: 'la_c2', la_mind3: 'la_m3d', ax_mind2: 'ax_m1c', ax_mind3: 'ax_m3d',
  bo_m1b: 'bo_mind1', bo_m1c: 'bo_m2d', bo_mind2: 'bo_c2', bo_m3c: 'bo_mind3', ma_mind1: 'ma_m1c', ma_m1d: 'ma_e2', ma_m2c: 'ma_c2', ma_m2d: 'ma_c2', ma_m3b: 'ma_m3d',
  fa_m2c: 'fa_c2', fa_m3d: 'fa_m3b', ri_m1d: 'ri_mind1', ri_mind2: 'ri_c2', ri_m3b: 'ri_m3d', he_m1d: 'he_mind1', he_m2d: 'he_c2', he_m3d: 'he_m3b',
  fl_m1b: 'fl_mind1', fl_mind2: 'fl_c1', fl_m2c: 'fl_c2', fl_m2d: 'fl_c2', fl_m3c: 'fl_mind3', gu_m1c: 'gu_mind1', gu_m3d: 'gu_mind3',
  ta_m1d: 'ta_e2', ta_m3b: 'ta_mind3', co_m3b: 'co_mind3', co_m3d: 'co_mind3',
};

const SLEEP: Record<SkillId, string> = { sword: '眠りからの一太刀', lance: '眠りからの一突き', axe: '眠りからの一振り', bow: '眠りからの一矢', magic: '眠りからの魔撃', faith: '眠りからの光', riding: '眠りからの蹄', heavy: '眠りからの盾撃', flying: '眠りからの急襲', gun: '眠りからの一発', tactics: '眠りからの奇策', command: '眠りからの喝' };
export const ART_LIST: ArtDef[] = [
  // ======== 剣 ========
  kmind('sw_m1b', '受け流し', 'sword', 'E+', ['guard'], { type: 'guard', self: 5, counter: 0.6 }),
  kmind('sw_m1d', '礼の構え', 'sword', 'E+', ['noble'], { type: 'buff', team: { hit: 10, crit: 5 } }),
  art('sw_art1', '燕返し', 'sword', 'D', ['swift', 'atk'], { type: 'atk', hits: 2, mul: 0.7 }),
  art('sw_a1b', '踏みこみ斬り', 'sword', 'D', ['atk', 'heavy'], { type: 'atk', mul: 1.3 }),
  art('sw_a1c', '居合い', 'sword', 'D', ['swift', 'trick'], { type: 'atk', crit: 25, hit: 10 }),
  art('sw_a1d', '峰打ち', 'sword', 'D', ['trick', 'guard'], { type: 'atk', mul: 0.7, stun: true }),
  kmind('sw_m2b', '返し刃', 'sword', 'C', ['guard', 'trick'], { type: 'guard', self: 3, counter: 1 }),
  kmind('sw_m2d', '剣気', 'sword', 'C', ['noble', 'support'], { type: 'buff', team: { hit: 10, dmg: 1 } }),
  art('sw_art2', '影抜き', 'sword', 'B', ['trick'], { type: 'atk', pierce: 5, hit: 5, mul: 1.1 }),
  art('sw_a2b', '突き崩し', 'sword', 'B', ['heavy'], { type: 'atk', mul: 1.2, debuff: 'def', amt: 3 }),
  art('sw_a2c', '三段斬り', 'sword', 'B', ['swift'], { type: 'atk', hits: 3, mul: 0.55 }),
  art('sw_a2d', '鎧通し', 'sword', 'B', ['heavy', 'noble'], { type: 'atk', pierce: 9, mul: 1.1 }, { rare: true }),
  kmind('sw_m3d', '守りの剣', 'sword', 'A', ['guard', 'noble'], { type: 'guard', cover: true, self: 2 }),
  art('sw_art3', '月下一閃', 'sword', 'S', [], { type: 'atk', mul: 1.5, crit: 30, flat: 3, cost: 2 }),
  art('sw_a3b', '千鳥', 'sword', 'S', ['swift'], { type: 'atk', hits: 4, mul: 0.5, cost: 2 }),
  art('sw_a3c', '王道の一太刀', 'sword', 'S', ['heavy', 'noble'], { type: 'atk', mul: 2, cost: 2 }, { rare: true }),
  art('sw_a3d', '薙ぎ払い', 'sword', 'S', ['atk'], { type: 'atk', aoe: true, mul: 0.9, cost: 2 }),
  // ======== 槍 ========
  kmind('la_m1b', '槍ぶすま', 'lance', 'E+', ['guard', 'heavy'], { type: 'guard', wall: 2 }),
  kmind('la_m1d', '騎士の礼', 'lance', 'E+', ['noble'], { type: 'buff', team: { hit: 8, dmg: 1 } }),
  art('la_art1', '穂先崩し', 'lance', 'D', [], { type: 'atk', mul: 1.1, vsMove: ['armor'] }),
  art('la_a1b', '突進突き', 'lance', 'D', ['atk', 'swift'], { type: 'atk', mul: 1.4, hit: -10 }),
  art('la_a1c', '足払い', 'lance', 'D', ['trick'], { type: 'atk', mul: 0.7, stun: true }),
  art('la_a1d', '構え突き', 'lance', 'D', ['guard'], { type: 'atk', mul: 1.1, self: 3 } as CardFx),
  kmind('la_m2b', '迎え撃ち', 'lance', 'C', ['guard'], { type: 'guard', self: 2, counter: 1.1 }),
  kmind('la_m2d', '守護の誓い', 'lance', 'C', ['guard', 'noble'], { type: 'guard', cover: true }),
  art('la_art2', '連ね突き', 'lance', 'B', [], { type: 'atk', hits: 2, mul: 0.8 }),
  art('la_a2b', '薙ぎ槍', 'lance', 'B', ['heavy'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('la_a2c', '急所突き', 'lance', 'B', ['trick'], { type: 'atk', crit: 30, mul: 1.1 }, { rare: true }),
  art('la_a2d', '回し突き', 'lance', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.7, debuff: 'atk', amt: 3 }),
  kmind('la_m3b', '堅陣', 'lance', 'A', ['guard'], { type: 'guard', wall: 3 }),
  art('la_art3', '天穿ち', 'lance', 'S', [], { type: 'atk', mul: 1.6, pierce: 10, cost: 2 }),
  art('la_a3b', '百花突き', 'lance', 'S', ['swift'], { type: 'atk', hits: 5, mul: 0.42, cost: 2 }),
  art('la_a3c', '城門破り', 'lance', 'S', ['heavy'], { type: 'atk', mul: 1.8, vsMove: ['armor'], cost: 2 }, { rare: true }),
  art('la_a3d', '槍陣一閃', 'lance', 'S', ['noble', 'atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }),
  // ======== 斧 ========
  kmind('ax_m1d', '鬨の声', 'axe', 'E+', ['atk', 'support'], { type: 'buff', team: { dmg: 2 } }),
  art('ax_art1', '兜割り', 'axe', 'D', [], { type: 'atk', flat: 4, hit: -10 }),
  art('ax_a1b', '振り回し', 'axe', 'D', ['atk'], { type: 'atk', aoe: true, mul: 0.6 }),
  art('ax_a1c', '叩き伏せ', 'axe', 'D', ['heavy'], { type: 'atk', mul: 0.9, stun: true }),
  art('ax_a1d', '投げ斧', 'axe', 'D', ['trick'], { type: 'atk', mul: 1, hit: 20 }),
  kmind('ax_m2b', '仁王立ち', 'axe', 'C', ['guard'], { type: 'guard', cover: true, self: 2 }),
  kmind('ax_m2d', '鉄の胃袋', 'axe', 'C', ['heavy'], { type: 'guard', self: 6 }),
  art('ax_art2', '大地割り', 'axe', 'B', [], { type: 'atk', mul: 1.5, hit: -5 }),
  art('ax_a2b', '竜巻斧', 'axe', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.8 }),
  art('ax_a2c', '骨砕き', 'axe', 'B', ['heavy'], { type: 'atk', mul: 1.2, debuff: 'def', amt: 4 }, { rare: true }),
  art('ax_a2d', '返し斧', 'axe', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.75 }),
  kmind('ax_m3c', '大樹の構え', 'axe', 'A', ['guard'], { type: 'guard', wall: 2, self: 4 }),
  art('ax_art3', '鬼神断ち', 'axe', 'S', [], { type: 'atk', mul: 1.4, crit: 25, flat: 4, cost: 2 }),
  art('ax_a3b', '地響き', 'axe', 'S', ['heavy'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }),
  art('ax_a3c', '渾身の大斧', 'axe', 'S', ['atk'], { type: 'atk', mul: 2.2, hit: -15, cost: 2 }, { rare: true }),
  art('ax_a3d', '山嵐', 'axe', 'S', ['swift'], { type: 'atk', hits: 3, mul: 0.7, cost: 2 }),
  // ======== 弓 ========
  kmind('bo_m1d', '援護射撃', 'bow', 'E+', ['support'], { type: 'buff', team: { hit: 10 }, draw: 1 }),
  art('bo_art1', '影縫い', 'bow', 'D', [], { type: 'atk', mul: 0.6, hit: 15, debuff: 'avo', amt: 20 }),
  art('bo_a1b', '狙い射ち', 'bow', 'D', ['atk'], { type: 'atk', mul: 1.25, hit: 20 }),
  art('bo_a1c', '二本射ち', 'bow', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.65 }),
  art('bo_a1d', '牽制の矢', 'bow', 'D', ['guard', 'trick'], { type: 'atk', mul: 0.6, debuff: 'atk', amt: 4 }),
  kmind('bo_m2c', '守り矢', 'bow', 'C', ['guard', 'support'], { type: 'guard', wall: 2 }),
  art('bo_art2', '落鳥', 'bow', 'B', [], { type: 'atk', mul: 1.1, vsMove: ['flying'] }),
  art('bo_a2b', '雨の矢', 'bow', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('bo_a2c', '縫い止め', 'bow', 'B', ['trick'], { type: 'atk', mul: 0.8, stun: true }, { rare: true }),
  art('bo_a2d', '鎧抜きの矢', 'bow', 'B', ['heavy'], { type: 'atk', pierce: 8, mul: 1.1 }),
  kmind('bo_m3d', '号矢', 'bow', 'A', ['noble'], { type: 'buff', team: { dmg: 2, crit: 5 } }),
  art('bo_art3', '流星の矢', 'bow', 'S', [], { type: 'atk', mul: 1.7, cost: 2 }),
  art('bo_a3b', '千本の雨', 'bow', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }),
  art('bo_a3c', '一矢必中', 'bow', 'S', ['trick'], { type: 'atk', mul: 1.6, hit: 50, crit: 20, cost: 2 }, { rare: true }),
  art('bo_a3d', '五月雨', 'bow', 'S', ['swift'], { type: 'atk', hits: 4, mul: 0.5, cost: 2 }),
  // ======== 魔道 ========
  kmind('ma_m1b', '魔力の盾', 'magic', 'E+', ['guard'], { type: 'guard', wall: 2 }),
  art('ma_art1', '魔力集中', 'magic', 'D', [], { type: 'atk', flat: 4 }),
  art('ma_a1b', '二重詠唱', 'magic', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.6 }),
  art('ma_a1c', '惑わしの霧', 'magic', 'D', ['trick'], { type: 'atk', mul: 0.5, debuff: 'atk', amt: 4 }),
  art('ma_a1d', '的確な詠唱', 'magic', 'D', ['atk'], { type: 'atk', mul: 1.1, hit: 20 }),
  kmind('ma_m2b', '魔力の巡り', 'magic', 'C', ['trick'], { type: 'buff', cost: 0, draw: 1 }),
  art('ma_art2', '魔障破り', 'magic', 'B', [], { type: 'atk', pierce: 6, mul: 1.1 }),
  art('ma_a2b', '魔力の嵐', 'magic', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('ma_a2c', '封じの呪', 'magic', 'B', ['trick'], { type: 'atk', mul: 0.6, stun: true }),
  art('ma_a2d', '魔力爆発', 'magic', 'B', ['heavy'], { type: 'atk', mul: 1.5, hit: -10 }, { rare: true }),
  kmind('ma_m3c', '結界', 'magic', 'A', ['guard', 'support'], { type: 'guard', wall: 3 }),
  art('ma_art3', '大詠唱', 'magic', 'S', [], { type: 'atk', mul: 1.8, hit: -5, cost: 2 }),
  art('ma_a3b', '天変', 'magic', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }),
  art('ma_a3c', '時の縛め', 'magic', 'S', ['trick'], { type: 'atk', mul: 1.2, stun: true, cost: 2 }, { rare: true }),
  art('ma_a3d', '星読みの一撃', 'magic', 'S', ['noble'], { type: 'atk', mul: 1.6, crit: 30, cost: 2 }),
  // ======== 信仰 ========
  kmind('fa_m1b', '癒やしの手', 'faith', 'E+', ['support'], { type: 'heal', heal: 8 }),
  kmind('fa_m1c', '小さな加護', 'faith', 'E+', ['guard'], { type: 'guard', cover: true }),
  art('fa_art1', '裁きの光', 'faith', 'D', [], { type: 'atk', flat: 3, hit: 10 }),
  art('fa_a1b', '祈りの盾', 'faith', 'D', ['guard', 'support'], { type: 'guard', wall: 3 }),
  art('fa_a1c', '聖なる鎖', 'faith', 'D', ['trick'], { type: 'atk', mul: 0.6, stun: true }),
  art('fa_a1d', '癒やしの祈り', 'faith', 'D', ['support'], { type: 'heal', heal: 6, all: true, cost: 2 }),
  kmind('fa_m2b', '献身', 'faith', 'C', ['guard', 'support'], { type: 'guard', cover: true, self: 2 }),
  kmind('fa_m2d', '祝福', 'faith', 'C', ['noble'], { type: 'buff', team: { dmg: 1, hit: 10 } }),
  art('fa_art2', '浄めの光', 'faith', 'B', [], { type: 'atk', pierce: 6, mul: 1.1 }),
  art('fa_a2b', '光の雨', 'faith', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }),
  art('fa_a2c', '再起の祈り', 'faith', 'B', ['support'], { type: 'heal', heal: 20 }),
  art('fa_a2d', '聖域', 'faith', 'B', ['guard'], { type: 'guard', wall: 4, cost: 2 }, { rare: true }),
  kmind('fa_m3c', '癒やしの風', 'faith', 'A', ['support'], { type: 'heal', heal: 8, all: true, cost: 2 }),
  art('fa_art3', '天の審判', 'faith', 'S', [], { type: 'atk', mul: 1.6, hit: 10, cost: 2 }),
  art('fa_a3b', '大いなる癒やし', 'faith', 'S', ['support'], { type: 'heal', heal: 18, all: true, cost: 2 }),
  art('fa_a3c', '光の柱', 'faith', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }),
  art('fa_a3d', '不落の祈り', 'faith', 'S', ['guard'], { type: 'guard', wall: 6, cost: 2 }, { rare: true }),
  // ======== 騎乗 ========
  kmind('ri_m1c', '乗り手の盾', 'riding', 'E+', ['guard', 'noble'], { type: 'guard', cover: true }),
  art('ri_art1', '駆け抜け', 'riding', 'D', [], { type: 'atk', flat: 3 }, { weapons: undefined }),
  art('ri_a1b', '蹄の一撃', 'riding', 'D', ['heavy'], { type: 'atk', mul: 0.9, stun: true }, { weapons: undefined }),
  art('ri_a1c', '一撃離脱', 'riding', 'D', ['swift', 'trick'], { type: 'atk', mul: 1.1, self: 4 } as CardFx, { weapons: undefined }),
  art('ri_a1d', '騎馬突撃', 'riding', 'D', ['atk'], { type: 'atk', mul: 1.4, hit: -10 }, { weapons: undefined }),
  kmind('ri_m2b', '拍車', 'riding', 'C', ['swift'], { type: 'buff', cost: 0, draw: 1 }),
  kmind('ri_m2d', '引き上げ', 'riding', 'C', ['support'], { type: 'guard', cover: true, self: 1 }),
  art('ri_art2', '馬上突撃', 'riding', 'B', [], { type: 'atk', mul: 1.4 }, { weapons: undefined }),
  art('ri_a2b', '蹴散らし', 'riding', 'B', ['atk', 'heavy'], { type: 'atk', aoe: true, mul: 0.7 }, { weapons: undefined }),
  art('ri_a2c', '回りこみ', 'riding', 'B', ['trick'], { type: 'atk', mul: 1.2, pierce: 5 }, { weapons: undefined }),
  art('ri_a2d', '疾駆二撃', 'riding', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.75 }, { weapons: undefined }),
  kmind('ri_m3c', '騎士の盾', 'riding', 'A', ['guard'], { type: 'guard', wall: 3 }),
  art('ri_art3', '怒濤の騎行', 'riding', 'S', [], { type: 'atk', mul: 1.4, flat: 4, crit: 15, cost: 2 }, { weapons: undefined }),
  art('ri_a3b', '大突撃', 'riding', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }, { weapons: undefined }),
  art('ri_a3c', '千里の駆け', 'riding', 'S', ['swift'], { type: 'atk', hits: 3, mul: 0.7, cost: 2 }, { weapons: undefined }),
  art('ri_a3d', '騎士王の一撃', 'riding', 'S', ['noble'], { type: 'atk', mul: 1.9, cost: 2 }, { weapons: undefined, rare: true }),
  // ======== 重装 ========
  kmind('he_m1b', 'かばう', 'heavy', 'E+', ['guard', 'support'], { type: 'guard', cover: true }),
  art('he_art1', '体当たり', 'heavy', 'D', [], { type: 'atk', flat: 3 }, { weapons: undefined }),
  art('he_a1b', '盾構え', 'heavy', 'D', ['guard'], { type: 'guard', self: 6, counter: 0.7 }),
  art('he_a1c', '押し潰し', 'heavy', 'D', ['heavy'], { type: 'atk', mul: 1, stun: true }, { weapons: undefined }),
  art('he_a1d', '盾の殴打', 'heavy', 'D', ['trick'], { type: 'atk', mul: 0.8, debuff: 'atk', amt: 4 }, { weapons: undefined }),
  kmind('he_m2b', '鉄壁の構え', 'heavy', 'C', ['guard'], { type: 'guard', wall: 3 }),
  kmind('he_m2c', '仁王の構え', 'heavy', 'C', ['guard', 'noble'], { type: 'guard', cover: true, self: 2 }),
  art('he_art2', '盾打ち', 'heavy', 'B', [], { type: 'atk', flat: 3, hit: 10 }, { weapons: undefined }),
  art('he_a2b', '地ならし', 'heavy', 'B', ['heavy'], { type: 'atk', aoe: true, mul: 0.7 }, { weapons: undefined }),
  art('he_a2c', '鉄の反撃', 'heavy', 'B', ['guard'], { type: 'guard', self: 4, counter: 1.1 }),
  art('he_a2d', '重装突進', 'heavy', 'B', ['atk'], { type: 'atk', mul: 1.5 }, { weapons: undefined }),
  kmind('he_m3c', '守護者', 'heavy', 'A', ['support'], { type: 'guard', cover: true, wall: 1 }),
  art('he_art3', '山崩し', 'heavy', 'S', [], { type: 'atk', mul: 1.6, cost: 2 }, { weapons: undefined }),
  art('he_a3b', '不落の城', 'heavy', 'S', ['guard'], { type: 'guard', wall: 6, cost: 2 }),
  art('he_a3c', '鉄槌', 'heavy', 'S', ['heavy'], { type: 'atk', mul: 1.8, stun: true, cost: 2 }, { weapons: undefined, rare: true }),
  art('he_a3d', '大地の怒り', 'heavy', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1, cost: 2 }, { weapons: undefined }),
  // ======== 飛行 ========
  kmind('fl_m1c', '舞い上がり', 'flying', 'E+', ['swift', 'guard'], { type: 'guard', self: 5 }),
  art('fl_art1', '急降下', 'flying', 'D', [], { type: 'atk', flat: 3 }, { weapons: undefined }),
  art('fl_a1b', '翼打ち', 'flying', 'D', ['trick'], { type: 'atk', mul: 0.8, stun: true }, { weapons: undefined }),
  art('fl_a1c', '空の連撃', 'flying', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.65 }, { weapons: undefined }),
  art('fl_a1d', '天からの一撃', 'flying', 'D', ['atk'], { type: 'atk', mul: 1.4, hit: -10 }, { weapons: undefined }),
  kmind('fl_m2b', '風の加護', 'flying', 'C', ['support'], { type: 'guard', wall: 2 }),
  art('fl_art2', '天翔け', 'flying', 'B', [], { type: 'atk', flat: 2, hit: 15, mul: 1.1 }, { weapons: undefined }),
  art('fl_a2b', '羽ばたき払い', 'flying', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.7 }, { weapons: undefined }),
  art('fl_a2c', '背後取り', 'flying', 'B', ['trick'], { type: 'atk', pierce: 8, mul: 1.1 }, { weapons: undefined }),
  art('fl_a2d', '舞い打ち', 'flying', 'B', ['swift'], { type: 'atk', hits: 2, mul: 0.8 }, { weapons: undefined, rare: true }),
  kmind('fl_m3b', '空の守り手', 'flying', 'A', ['guard'], { type: 'guard', cover: true }),
  art('fl_art3', '天馬昇撃', 'flying', 'S', [], { type: 'atk', mul: 1.6, cost: 2 }, { weapons: undefined }),
  art('fl_a3b', '嵐の舞', 'flying', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }, { weapons: undefined }),
  art('fl_a3c', '流れ星', 'flying', 'S', ['swift'], { type: 'atk', hits: 4, mul: 0.5, cost: 2 }, { weapons: undefined }),
  art('fl_a3d', '天空の裁き', 'flying', 'S', ['noble'], { type: 'atk', mul: 1.7, crit: 25, cost: 2 }, { weapons: undefined, rare: true }),
  // ======== 銃 ========
  kmind('gu_m1d', '威嚇射撃', 'gun', 'E+', ['trick'], { type: 'guard', wall: 2 }),
  art('gu_art1', '狙い撃ち', 'gun', 'D', [], { type: 'atk', mul: 1.2, hit: 15 }),
  art('gu_a1b', '二連射', 'gun', 'D', ['swift'], { type: 'atk', hits: 2, mul: 0.6 }),
  art('gu_a1c', '足撃ち', 'gun', 'D', ['trick'], { type: 'atk', mul: 0.7, stun: true }),
  art('gu_a1d', '散弾', 'gun', 'D', ['atk'], { type: 'atk', aoe: true, mul: 0.55 }),
  kmind('gu_m2b', '援護の銃火', 'gun', 'C', ['support'], { type: 'buff', team: { hit: 10, dmg: 1 } }),
  kmind('gu_m2d', '弾帯', 'gun', 'C', ['swift'], { type: 'buff', cost: 0, draw: 1 }),
  art('gu_art2', '徹甲弾', 'gun', 'B', [], { type: 'atk', pierce: 8, mul: 1.1 }),
  art('gu_a2b', '制圧射撃', 'gun', 'B', ['atk'], { type: 'atk', aoe: true, mul: 0.75 }),
  art('gu_a2c', '急所狙い', 'gun', 'B', ['trick'], { type: 'atk', crit: 35, mul: 1.1 }),
  art('gu_a2d', '重弾', 'gun', 'B', ['heavy'], { type: 'atk', mul: 1.5, hit: -10 }, { rare: true }),
  kmind('gu_m3c', '硝煙の幕', 'gun', 'A', ['guard'], { type: 'guard', wall: 3 }),
  art('gu_art3', '必中の一弾', 'gun', 'S', [], { type: 'atk', mul: 1.7, hit: 20, cost: 2 }),
  art('gu_a3b', '一斉射撃', 'gun', 'S', ['atk'], { type: 'atk', aoe: true, mul: 1.1, cost: 2 }),
  art('gu_a3c', '銀の弾丸', 'gun', 'S', ['trick'], { type: 'atk', mul: 1.5, pierce: 15, cost: 2 }, { rare: true }),
  art('gu_a3d', '三連の銃声', 'gun', 'S', ['swift'], { type: 'atk', hits: 3, mul: 0.7, cost: 2 }),
  // ======== 軍略 ========
  kmind('ta_m1b', '読み', 'tactics', 'E+', ['trick'], { type: 'buff', cost: 0, draw: 1 }),
  kmind('ta_m1c', '備え', 'tactics', 'E+', ['guard'], { type: 'guard', wall: 2 }),
  art('ta_art1', '虚を突く', 'tactics', 'D', [], { type: 'atk', hit: 15, mul: 1.1 }, { weapons: undefined }),
  art('ta_a1b', '誘いの一手', 'tactics', 'D', ['trick'], { type: 'atk', mul: 0.5, debuff: 'atk', amt: 4 }, { weapons: undefined }),
  art('ta_a1c', '隙突き', 'tactics', 'D', ['swift'], { type: 'atk', crit: 25 }, { weapons: undefined }),
  art('ta_a1d', '足止め', 'tactics', 'D', ['guard'], { type: 'atk', mul: 0.6, stun: true }, { weapons: undefined }),
  kmind('ta_m2b', '号令の旗', 'tactics', 'C', ['noble'], { type: 'buff', team: { hit: 10 } }),
  kmind('ta_m2d', '兵站', 'tactics', 'C', ['support'], { type: 'heal', heal: 5, all: true }),
  art('ta_art2', '弱点看破', 'tactics', 'B', [], { type: 'atk', pierce: 6, mul: 1.1 }, { weapons: undefined }),
  art('ta_a2b', '撹乱', 'tactics', 'B', ['trick'], { type: 'atk', aoe: true, mul: 0.4, debuff: 'atk', amt: 3 }, { weapons: undefined }),
  art('ta_a2c', '急所の読み', 'tactics', 'B', ['swift'], { type: 'atk', crit: 30, mul: 1.1 }, { weapons: undefined }),
  art('ta_a2d', '采配', 'tactics', 'B', ['support'], { type: 'buff', draw: 2 }, { rare: true }),
  kmind('ta_m3c', '布陣', 'tactics', 'A', ['guard'], { type: 'guard', wall: 4, cost: 2 }),
  art('ta_art3', '必勝の策', 'tactics', 'S', [], { type: 'atk', mul: 1.4, crit: 30, cost: 2 }, { weapons: undefined }),
  art('ta_a3b', '十面の伏せ', 'tactics', 'S', ['trick'], { type: 'atk', aoe: true, mul: 1, cost: 2 }, { weapons: undefined }),
  art('ta_a3c', '背水の陣', 'tactics', 'S', ['atk'], { type: 'buff', team: { dmg: 4, crit: 10 }, cost: 2 }),
  art('ta_a3d', '千手先', 'tactics', 'S', ['trick'], { type: 'atk', mul: 0.8, stun: true, cost: 1 }, { weapons: undefined, rare: true }),
  // ======== 統率 ========
  kmind('co_m1b', '励まし', 'command', 'E+', ['support'], { type: 'heal', heal: 6 }),
  kmind('co_m1c', '号令の声', 'command', 'E+', ['noble'], { type: 'buff', team: { hit: 10 } }),
  kmind('co_m1d', '盾となる将', 'command', 'E+', ['guard'], { type: 'guard', cover: true }),
  art('co_art1', '叱咤', 'command', 'D', [], { type: 'atk', flat: 2, hit: 5 }, { weapons: undefined }),
  art('co_a1b', '先陣', 'command', 'D', ['atk'], { type: 'atk', mul: 1.3, hit: -5 }, { weapons: undefined }),
  art('co_a1c', '檄', 'command', 'D', ['support'], { type: 'buff', team: { dmg: 2 } }),
  art('co_a1d', '指揮の一撃', 'command', 'D', ['noble'], { type: 'atk', mul: 1.1, hit: 10 }, { weapons: undefined }),
  kmind('co_m2c', '円陣', 'command', 'C', ['guard'], { type: 'guard', wall: 3 }),
  art('co_art2', '陣頭の一撃', 'command', 'B', [], { type: 'atk', mul: 1.4 }, { weapons: undefined }),
  art('co_a2b', '総攻撃の合図', 'command', 'B', ['atk'], { type: 'buff', team: { dmg: 3, hit: 5 } }),
  art('co_a2c', '立て直し', 'command', 'B', ['support'], { type: 'heal', heal: 8, all: true, cost: 2 }),
  art('co_a2d', '牽制の号令', 'command', 'B', ['trick'], { type: 'atk', aoe: true, mul: 0.4, debuff: 'atk', amt: 3 }, { weapons: undefined }),
  kmind('co_m3c', '采配の妙', 'command', 'A', ['trick'], { type: 'buff', draw: 2 }),
  art('co_art3', '覇王の気迫', 'command', 'S', [], { type: 'atk', mul: 1.4, flat: 5, crit: 15, cost: 2 }, { weapons: undefined }),
  art('co_a3b', '全軍突撃', 'command', 'S', ['atk'], { type: 'buff', team: { dmg: 5, crit: 10 }, cost: 2 }),
  art('co_a3c', '鉄の軍律', 'command', 'S', ['guard'], { type: 'guard', wall: 5, cost: 2 }),
  art('co_a3d', '王者の号令', 'command', 'S', ['noble'], { type: 'buff', ap: 2 }, { rare: true }),
  // ======== 開花した子だけの固有の戦技（技能ごとに3通り。覚える表で1つ） ========
  ...bloomArts(),
  // ======== スキル（18夜目：技能×節目E+・C・Aに2つずつ。効果は45種、同じ効果は2つまで） ========
  ...SKILL_LIST,
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
    out.push(art(`bl_${k}`, SLEEP[k], k, 'D+', ['atk'], { type: 'atk', mul: 1.6, crit: 10 }, { bloom: true, weapons: wp, chance: 30 }));
    out.push(art(`bl_${k}_2`, names[k][0], k, 'D+', ['swift', 'trick'], { type: 'atk', hits: 2, mul: 0.9, crit: 10 }, { bloom: true, weapons: wp, chance: 30 }));
    out.push(k === 'heavy' || k === 'faith' || k === 'command'
      ? art(`bl_${k}_3`, names[k][1], k, 'D+', ['guard', 'support', 'noble'], k === 'faith' ? { type: 'heal', heal: 14, all: true } : { type: 'guard', wall: 4, cover: true }, { bloom: true })
      : art(`bl_${k}_3`, names[k][1], k, 'D+', ['guard', 'heavy', 'noble'], { type: 'atk', mul: 1.4, stun: true }, { bloom: true, weapons: wp, chance: 30 }));
  }
  return out;
}

export const ARTS: Record<string, ArtDef> = Object.fromEntries(ART_LIST.map((a) => [a.id, a]));
/** 持てる数の上限。15夜目：art は「戦技と魔法」を合わせた数（5つまで）。mind は「スキル」（18夜目：5→3。そのぶん1つ1つを強く） */
export const ART_SLOTS = { art: 5, mind: 3 };
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
