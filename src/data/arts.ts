// 戦技と心得（12夜目）。技能ランクが上がると覚える。データを足すだけで増やせる
// 戦技（art）：攻撃の技。戦いの中で自動で使う（敵将や、相手が弱ったときなど、ここぞのときに使いやすい）
// 心得（mind）：いつも効く。武器の種類を決めたものは、その武器を持っているときだけ
import type { Rank, SkillId, WeaponType, MoveType, AbilityDef } from '../core/types';

export interface ArtDef {
  id: string; name: string; skill: SkillId; rank: Rank; kind: 'art' | 'mind'; desc: string;
  /** 戦技：使える武器（なければどの武器でも）。使う見込み（%）と効き目 */
  weapons?: WeaponType[]; chance?: number; hit?: number; dmg?: number; crit?: number; pierce?: number; mul?: number; vsMove?: MoveType[];
  /** 心得：いつも効く補正（AbilityDef と同じ書き方） */
  ability?: Omit<AbilityDef, 'id' | 'name' | 'desc'>;
  /** 開花した子だけの固有の戦技 */
  bloom?: boolean;
}

const W: Partial<Record<SkillId, WeaponType[]>> = { sword: ['sword'], lance: ['lance'], axe: ['axe'], bow: ['bow'], magic: ['magic'], faith: ['holy'], gun: ['gun'] };
const art = (id: string, name: string, skill: SkillId, rank: Rank, desc: string, e: Partial<ArtDef>): ArtDef => ({ id, name, skill, rank, kind: 'art', desc, weapons: W[skill], chance: 25, ...e });
const mind = (id: string, name: string, skill: SkillId, rank: Rank, desc: string, ab: ArtDef['ability']): ArtDef => ({ id, name, skill, rank, kind: 'mind', desc, ability: ab });

export const ART_LIST: ArtDef[] = [
  // ---- 剣 ----
  mind('sw_mind1', '剣の基本', 'sword', 'E+', '剣を持つと命中+5', { hit: 5, wtype: ['sword'] }),
  art('sw_art1', '燕返し', 'sword', 'D', '返す刃でもう一太刀。威力×1.5、命中−10', { mul: 1.5, hit: -10 }),
  mind('sw_mind2', '剣の心得', 'sword', 'C', '剣を持つと命中+10', { hit: 10, wtype: ['sword'] }),
  art('sw_art2', '影抜き', 'sword', 'B', '相手の守りの影を抜ける一撃。守備を5低く見て斬る', { pierce: 5, hit: 5 }),
  mind('sw_mind3', '見切り', 'sword', 'A', '剣を持つと回避+10', { avo: 10, wtype: ['sword'] }),
  art('sw_art3', '月下一閃', 'sword', 'S', '必殺+30の一太刀', { crit: 30, dmg: 3, chance: 30 }),
  // ---- 槍 ----
  mind('la_mind1', '槍の基本', 'lance', 'E+', '槍を持つと命中+5', { hit: 5, wtype: ['lance'] }),
  art('la_art1', '穂先崩し', 'lance', 'D', '重装に強い突き。重装の敵に威力+6', { dmg: 2, vsMove: ['armor'] }),
  mind('la_mind2', '槍の心得', 'lance', 'C', '槍を持つと受けるダメージ−1', { prot: 1, wtype: ['lance'] }),
  art('la_art2', '連ね突き', 'lance', 'B', '二度突く。威力×1.6、命中−10', { mul: 1.6, hit: -10 }),
  mind('la_mind3', '不動の構え', 'lance', 'A', '槍を持つと守備+2', { prot: 2, wtype: ['lance'] }),
  art('la_art3', '天穿ち', 'lance', 'S', '守備を10低く見て貫く', { pierce: 10, dmg: 2, chance: 30 }),
  // ---- 斧 ----
  mind('ax_mind1', '斧の基本', 'axe', 'E+', '斧を持つと与えるダメージ+1', { dmg: 1, wtype: ['axe'] }),
  art('ax_art1', '兜割り', 'axe', 'D', '兜ごと叩き割る。威力+4、命中−10', { dmg: 4, hit: -10 }),
  mind('ax_mind2', '斧の心得', 'axe', 'C', '斧を持つと命中+10', { hit: 10, wtype: ['axe'] }),
  art('ax_art2', '大地割り', 'axe', 'B', '地面ごと叩きつける。威力×1.5', { mul: 1.5, hit: -5 }),
  mind('ax_mind3', '剛力', 'axe', 'A', '斧を持つと与えるダメージ+2', { dmg: 2, wtype: ['axe'] }),
  art('ax_art3', '鬼神断ち', 'axe', 'S', '必殺+25、威力+4', { crit: 25, dmg: 4, chance: 30 }),
  // ---- 弓 ----
  mind('bo_mind1', '弓の基本', 'bow', 'E+', '弓を持つと命中+5', { hit: 5, wtype: ['bow'] }),
  art('bo_art1', '影縫い', 'bow', 'D', '影を射抜いて足を止める。命中+15', { hit: 15, dmg: 1 }),
  mind('bo_mind2', '弓の心得', 'bow', 'C', '弓を持つと命中+10', { hit: 10, wtype: ['bow'] }),
  art('bo_art2', '落鳥', 'bow', 'B', '飛ぶ敵を落とす。飛行の敵に威力+6', { dmg: 2, vsMove: ['flying'] }),
  mind('bo_mind3', '鷹の目', 'bow', 'A', '弓を持つと必殺+10', { crit: 10, wtype: ['bow'] }),
  art('bo_art3', '流星', 'bow', 'S', '光のような矢。威力×1.7', { mul: 1.7, chance: 30 }),
  // ---- 魔道 ----
  mind('ma_mind1', '魔道の基本', 'magic', 'E+', '魔道書を持つと命中+5', { hit: 5, wtype: ['magic'] }),
  art('ma_art1', '魔力集中', 'magic', 'D', '魔力をためて放つ。威力+4', { dmg: 4 }),
  mind('ma_mind2', '魔道の心得', 'magic', 'C', '魔道書を持つと与えるダメージ+1', { dmg: 1, wtype: ['magic'] }),
  art('ma_art2', '魔障破り', 'magic', 'B', '魔防を6低く見て撃つ', { pierce: 6 }),
  mind('ma_mind3', '詠唱短縮', 'magic', 'A', '魔道書を持つと回避+8', { avo: 8, wtype: ['magic'] }),
  art('ma_art3', '天雷', 'magic', 'S', '威力×1.8の大魔法', { mul: 1.8, hit: -5, chance: 30 }),
  // ---- 信仰 ----
  mind('fa_mind1', '祈りの基本', 'faith', 'E+', '受けるダメージ−1', { prot: 1 }),
  art('fa_art1', '裁きの光', 'faith', 'D', '光で打つ。威力+3、命中+10', { dmg: 3, hit: 10 }),
  mind('fa_mind2', '慈愛', 'faith', 'C', 'ターン開始時、周囲2マスの味方のHP+2', { auraHeal: 2 }),
  art('fa_art2', '浄めの光', 'faith', 'B', '魔防を6低く見て撃つ', { pierce: 6 }),
  mind('fa_mind3', '加護', 'faith', 'A', '受けるダメージ−2', { prot: 2 }),
  art('fa_art3', '天の審判', 'faith', 'S', '威力×1.6、命中+10', { mul: 1.6, hit: 10, chance: 30 }),
  // ---- 騎乗 ----
  mind('ri_mind1', '手綱さばき', 'riding', 'E+', '回避+3', { avo: 3 }),
  art('ri_art1', '駆け抜け', 'riding', 'D', '馬の勢いで打つ。威力+3', { dmg: 3, weapons: undefined }),
  mind('ri_mind2', '人馬の呼吸', 'riding', 'C', '回避+6', { avo: 6 }),
  art('ri_art2', '突撃', 'riding', 'B', '勢いのまま突っこむ。威力×1.4', { mul: 1.4, weapons: undefined }),
  mind('ri_mind3', '騎士の誇り', 'riding', 'A', '命中+8', { hit: 8 }),
  art('ri_art3', '疾風怒濤', 'riding', 'S', '威力+4、必殺+15', { dmg: 4, crit: 15, weapons: undefined, chance: 30 }),
  // ---- 重装 ----
  mind('he_mind1', '鎧の重み', 'heavy', 'E+', '受けるダメージ−1', { prot: 1 }),
  art('he_art1', '体当たり', 'heavy', 'D', '鎧ごとぶつかる。威力+3', { dmg: 3, weapons: undefined }),
  mind('he_mind2', '鉄の守り', 'heavy', 'C', '受けるダメージ−2', { prot: 2 }),
  art('he_art2', '盾打ち', 'heavy', 'B', '盾で打ち据える。命中+10、威力+3', { hit: 10, dmg: 3, weapons: undefined }),
  mind('he_mind3', '城壁', 'heavy', 'A', '隣の味方の守備+1', { adjAllyDef: 1 }),
  art('he_art3', '山崩し', 'heavy', 'S', '威力×1.6', { mul: 1.6, weapons: undefined, chance: 30 }),
  // ---- 飛行 ----
  mind('fl_mind1', '風に乗る', 'flying', 'E+', '回避+3', { avo: 3 }),
  art('fl_art1', '急降下', 'flying', 'D', '空から舞い降りて打つ。威力+3', { dmg: 3, weapons: undefined }),
  mind('fl_mind2', '風読み', 'flying', 'C', '回避+8', { avo: 8 }),
  art('fl_art2', '天翔け', 'flying', 'B', '命中+15、威力+2', { hit: 15, dmg: 2, weapons: undefined }),
  mind('fl_mind3', '空の王者', 'flying', 'A', '必殺+8', { crit: 8 }),
  art('fl_art3', '天馬昇撃', 'flying', 'S', '威力×1.6', { mul: 1.6, weapons: undefined, chance: 30 }),
  // ---- 銃 ----
  mind('gu_mind1', '銃の基本', 'gun', 'E+', '銃を持つと命中+5', { hit: 5, wtype: ['gun'] }),
  art('gu_art1', '狙い撃ち', 'gun', 'D', 'ねらいすました一発。命中+15', { hit: 15 }),
  mind('gu_mind2', '銃の心得', 'gun', 'C', '銃を持つと必殺+8', { crit: 8, wtype: ['gun'] }),
  art('gu_art2', '徹甲弾', 'gun', 'B', '守備を8低く見て撃つ', { pierce: 8 }),
  mind('gu_mind3', '早込め', 'gun', 'A', '銃を持つと回避+8', { avo: 8, wtype: ['gun'] }),
  art('gu_art3', '必中の一弾', 'gun', 'S', '威力×1.7、命中+20', { mul: 1.7, hit: 20, chance: 30 }),
  // ---- 軍略 ----
  mind('ta_mind1', '地の利', 'tactics', 'E+', '回避+3', { avo: 3 }),
  art('ta_art1', '虚を突く', 'tactics', 'D', '相手の隙を読む。命中+15', { hit: 15, weapons: undefined }),
  mind('ta_mind2', '先読み', 'tactics', 'C', '回避+6', { avo: 6 }),
  art('ta_art2', '弱点看破', 'tactics', 'B', '守りの薄いところを突く。守備を6低く見る', { pierce: 6, weapons: undefined }),
  mind('ta_mind3', '軍師の眼', 'tactics', 'A', '命中+8・回避+4', { hit: 8, avo: 4 }),
  art('ta_art3', '必勝の策', 'tactics', 'S', '必殺+30', { crit: 30, weapons: undefined, chance: 30 }),
  // ---- 統率 ----
  mind('co_mind1', '声かけ', 'command', 'E+', '隣の味方の守備+1', { adjAllyDef: 1 }),
  art('co_art1', '叱咤', 'command', 'D', '自らを奮い立たせる。威力+2、命中+5', { dmg: 2, hit: 5, weapons: undefined }),
  mind('co_mind2', '号令', 'command', 'C', '命中+5', { hit: 5 }),
  art('co_art2', '陣頭の一撃', 'command', 'B', '先頭に立って打つ。威力×1.4', { mul: 1.4, weapons: undefined }),
  mind('co_mind3', '将の器', 'command', 'A', '隣の味方の受けるダメージ−1', { adjAllyProt: 1 }),
  art('co_art3', '覇気', 'command', 'S', '威力+5、必殺+15', { dmg: 5, crit: 15, weapons: undefined, chance: 30 }),
  // ---- 開花した子だけの固有の戦技 ----
  ...(['sword', 'lance', 'axe', 'bow', 'magic', 'faith', 'riding', 'heavy', 'flying', 'gun', 'tactics', 'command'] as SkillId[]).map((k) => art(`bl_${k}`, '眠りからの一撃', k, 'D+', '開花した才能で放つ、その子だけの技。威力×1.5、必殺+10', { mul: 1.5, crit: 10, bloom: true, chance: 30, weapons: W[k] })),
];
export const ARTS: Record<string, ArtDef> = Object.fromEntries(ART_LIST.map((a) => [a.id, a]));
/** 持てる数の上限。15夜目：art は「戦技と魔法」を合わせた数（5つまで）。mind は「スキル」（呼び名を心得から変えた） */
export const ART_SLOTS = { art: 5, mind: 5 };
/** 使う見込みの上乗せ：敵将・名のある敵を相手に、相手のHPが半分以下のとき */
export const ART_CHANCE = { leader: 15, lowHp: 10, max: 60, vsMoveDmg: 6 };
/** 心得を、戦いの固有スキル（ABILITIES）として登録するための形 */
export function mindAbility(a: ArtDef): AbilityDef { return { id: a.id, name: a.name, desc: a.desc, ...(a.ability ?? {}) }; }
