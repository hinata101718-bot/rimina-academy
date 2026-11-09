// 連携技（18夜目）：支援が深まった2人（支援B以上）だけの合体の札。名前は2人の得意な技能と性格から作る。
// 同じターンに2人の札を続けて出すと、2枚が合わさって発動する（行動力は2枚分、効果はそれより強い）。
import type { SkillId } from '../core/types';

export type ComboKind = 'friend' | 'love' | 'rival' | 'senpai';
/** 関係の種類ごとの呼び名と、効き目の説明 */
export const COMBO_KIND: Record<ComboKind, { label: string; tip: string }> = {
  friend: { label: '息の合った連携技', tip: '2枚とも威力×1.3・命中+20（狙いを合わせて同じ敵へ）' },
  love: { label: '恋人の連携技', tip: '2枚とも威力×1.25。打ったあと、2人とも身を固め（受ける傷−5）、互いの傷を少し癒やす' },
  rival: { label: '好敵手の連携技', tip: '2枚とも威力×1.25、攻撃の札は打つ回数が1回増える（競い合う連撃）' },
  senpai: { label: '先輩と後輩の連携技', tip: '先輩の札が道を開き（守り−4）、後輩の札が決める（威力×1.4・必殺+30）' },
};
/** 名前の前半（はじめの人の得意な技能） */
export const COMBO_HEAD: Record<SkillId, string[]> = {
  sword: ['燕', '月影', '白刃'], lance: ['穂先', '流星', '槍衾'], axe: ['大地', '岩砕', '剛腕'], bow: ['影縫い', '鷹', '星降り'],
  magic: ['焔', '雷鳴', '星屑'], faith: ['光', '祈り', '聖'], riding: ['疾風', '蹄', '早駆け'], heavy: ['鉄壁', '城', '大盾'],
  flying: ['天翔', '風', '白翼'], gun: ['硝煙', '銀弾', '照星'], tactics: ['伏兵', '虚', '奇手'], command: ['陣', '号令', '旗'],
};
/** 名前の後半（もうひとりの得意な技能）。「影縫い」＋「斬り」＝影縫い斬り */
export const COMBO_TAIL: Record<SkillId, string[]> = {
  sword: ['斬り', '一閃', '返し'], lance: ['突き', '穿ち', '貫き'], axe: ['砕き', '割り', '断ち'], bow: ['射ち', 'の一矢', 'の矢雨'],
  magic: ['の陣', 'の詠唱', 'の魔撃'], faith: ['の祈り', 'の裁き', 'の加護'], riding: ['駆け', 'の突撃', 'の蹄'], heavy: ['崩し', 'の盾', 'の砦'],
  flying: ['落とし', '翔け', 'の急襲'], gun: ['撃ち', 'の連射', 'の一弾'], tactics: ['の計', '崩し', 'の奇襲'], command: ['の号令', 'の布陣', 'の進撃'],
};
/** 関係の種類ごとの頭の言葉（ふつうの仲は、なし） */
export const COMBO_AFFIX: Record<ComboKind, string[]> = {
  friend: ['', '', ''], love: ['比翼・', '双つ星・', '寄り添い・'], rival: ['競い・', '双龍・', '張り合い・'], senpai: ['導き・', '継承・', '託し・'],
};
/** 性格ごとに選びやすい言葉の番号（0〜2） */
export const COMBO_TASTE: Record<string, number> = { hot: 2, competitive: 1, cheerful: 0, calm: 1, serious: 2, timid: 0, shy: 1, gentle: 0, cynic: 2, whimsical: 1 };
/** 連携技の強さ */
export const COMBO = { friendMul: 1.3, friendHit: 20, loveMul: 1.25, loveSelf: 5, loveHealPct: 0.1, rivalMul: 1.25, senpaiDef: 4, seniorMul: 1.2, juniorMul: 1.4, juniorCrit: 30 };
/** 合体の演出のひとこと（はじめの人・もうひとり） */
export const COMBO_SAY: Record<ComboKind, [string, string][]> = {
  friend: [['合わせるぞ！', '任せて！'], ['いまだ！', 'ああ、一緒に！'], ['続いて！', '言われなくても！']],
  love: [['背中は預けた', 'うん、離れないで'], ['一緒なら', '負けない'], ['守るから', 'こっちも守る']],
  rival: [['遅れるなよ', 'そっちこそ'], ['先に決めるのはこっちだ', '冗談でしょ'], ['見てろ', '見せてやる']],
  senpai: [['道は開いた、決めろ！', 'はい、先輩！'], ['ここだ、行け！', '任せてください！'], ['あとは頼んだ', '必ず！']],
};
