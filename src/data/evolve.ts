// 技の進化（18夜目）：戦技・魔法の札は、使うたびに「熟練」がたまる。満ちると、2つの進化先から1つを選ぶ。
// 進化は1つの技につき2段まで。1段目は技ごとに2つの進化先、2段目は「極める（同じ道をもう一度）」か「別の道を足す」。
// 進化先と名前は、札の効き目から決まる（EVO_OVERRIDE に書けば、その技だけ別の進化先・名前にできる。データを足すだけで増やせる）。
import type { CardFx, ArtStyle } from './arts';

/** 進化の道 */
export type EvoBranch = 'power' | 'swift' | 'guard' | 'keen' | 'break' | 'wide' | 'thrift' | 'wall' | 'counter' | 'cover' | 'more' | 'widen' | 'ward' | 'rally' | 'tempo';

export interface BranchDef {
  /** 画面に出す短い言葉（攻め・反撃 など） */
  label: string;
  /** 名前につける字（「燕返し・剛」） */
  suf: string;
  /** 1段ぶんの変わり方の説明 */
  tip: string;
  /** その子の性格に合うか（おまかせで選ぶとき） */
  taste: ArtStyle[];
  apply: (f: CardFx) => CardFx;
}
const r2 = (x: number) => Math.round(x * 100) / 100;
export const EVO_BRANCH: Record<EvoBranch, BranchDef> = {
  power: { label: '攻め', suf: '剛', tip: '威力が上がる', taste: ['atk', 'heavy'], apply: (f) => ({ ...f, mul: r2((f.mul ?? 1) * 1.25), flat: (f.flat ?? 0) + 2 }) },
  swift: { label: '連撃', suf: '連', tip: '打つ回数が1回増える', taste: ['swift'], apply: (f) => ((f.hits ?? 1) > 1 ? { ...f, hits: (f.hits ?? 1) + 1, mul: r2((f.mul ?? 1) * 0.9) } : { ...f, hits: 2, mul: r2((f.mul ?? 1) * 0.7) }) },
  guard: { label: '反撃', suf: '守', tip: '打ったあと身を固め、攻撃されたら反撃する', taste: ['guard'], apply: (f) => ({ ...f, self: (f.self ?? 0) + 4, counter: Math.max(f.counter ?? 0, 0.7) }) },
  keen: { label: '必殺', suf: '冴', tip: '必殺と命中が上がる', taste: ['trick', 'noble'], apply: (f) => ({ ...f, crit: (f.crit ?? 0) + 20, hit: (f.hit ?? 0) + 15 }) },
  break: { label: '崩し', suf: '崩', tip: '相手の守りを下げる（止める札は、さらに強く）', taste: ['trick', 'heavy'], apply: (f) => (f.stun ? { ...f, mul: r2((f.mul ?? 1) * 1.3) } : { ...f, debuff: f.debuff ?? 'def', amt: (f.amt ?? 0) + 4 }) },
  wide: { label: '広がり', suf: '嵐', tip: '前の敵すべてに届く（もう届く札は、威力が上がる）', taste: ['atk', 'noble'], apply: (f) => (f.aoe ? { ...f, mul: r2((f.mul ?? 1) * 1.25) } : { ...f, aoe: true, mul: r2((f.mul ?? 1) * 0.75) }) },
  thrift: { label: '軽さ', suf: '疾', tip: '使う行動力が1少なくなる', taste: ['swift', 'trick'], apply: (f) => ({ ...f, cost: Math.max(1, (f.cost ?? 1) - 1), mul: f.type === 'atk' ? r2((f.mul ?? 1) * 0.9) : f.mul }) },
  wall: { label: '堅さ', suf: '堅', tip: '減らす傷が増える', taste: ['guard', 'heavy'], apply: (f) => (f.wall ? { ...f, wall: f.wall + 2 } : { ...f, self: (f.self ?? 0) + 4 }) },
  counter: { label: '返し', suf: '返', tip: '攻撃されたら強く反撃する', taste: ['atk', 'trick'], apply: (f) => ({ ...f, counter: r2(Math.max(f.counter ?? 0, 0.6) + 0.4), self: f.self ?? 2 }) },
  cover: { label: '護り', suf: '護', tip: 'いちばん危ない仲間もかばう', taste: ['support', 'guard'], apply: (f) => (f.cover ? { ...f, self: (f.self ?? 0) + 3, wall: (f.wall ?? 0) + 1 } : { ...f, cover: true }) },
  more: { label: '癒やし', suf: '満', tip: '治す量が増える', taste: ['support'], apply: (f) => ({ ...f, heal: Math.round((f.heal ?? 8) * 1.4) }) },
  widen: { label: '広く', suf: '広', tip: '仲間みんなを治す（もうみんななら、量が増える）', taste: ['support', 'noble'], apply: (f) => (f.all ? { ...f, heal: Math.round((f.heal ?? 8) * 1.3) } : { ...f, all: true, heal: Math.round((f.heal ?? 8) * 0.6) }) },
  ward: { label: '守り', suf: '盾', tip: 'このターン、仲間みんなの受ける傷も減らす', taste: ['guard', 'support'], apply: (f) => ({ ...f, wall: (f.wall ?? 0) + 2 }) },
  rally: { label: '鼓舞', suf: '鼓', tip: '上がる威力・命中が増える', taste: ['atk', 'support'], apply: (f) => ({ ...f, team: { dmg: (f.team?.dmg ?? 0) + 2, hit: (f.team?.hit ?? 0) + 10, crit: f.team?.crit } }) },
  tempo: { label: '先手', suf: '速', tip: '次のターンの札が1枚増える', taste: ['swift', 'trick'], apply: (f) => ({ ...f, draw: (f.draw ?? 0) + 1 }) },
};
/** 2段目：極める（同じ道）のほかに選べる道 */
export const EVO_SECOND: Record<EvoBranch, EvoBranch> = {
  power: 'keen', swift: 'keen', guard: 'power', keen: 'power', break: 'power', wide: 'power', thrift: 'power',
  wall: 'counter', counter: 'wall', cover: 'wall', more: 'widen', widen: 'more', ward: 'more', rally: 'tempo', tempo: 'rally',
};
/** その技だけの進化先・名前（なければ札の効き目から決まる） */
export const EVO_OVERRIDE: Record<string, { opts?: [EvoBranch, EvoBranch]; names?: Partial<Record<string, string>> }> = {
  // feedback の例：燕返し → 二段燕（攻め）／燕返し・守（反撃）
  sw_art1: { opts: ['power', 'guard'], names: { power: '二段燕', guard: '燕返し・守', 'power/power': '真・二段燕', 'power/keen': '二段燕・冴', 'guard/guard': '真・燕返し・守', 'guard/power': '燕返し・守剛' } },
  la_art1: { opts: ['power', 'break'], names: { power: '穂先砕き', break: '穂先崩し・深' } },
  ax_art1: { opts: ['power', 'guard'], names: { power: '兜砕き', guard: '兜割り・守' } },
  bo_art1: { opts: ['keen', 'wide'], names: { keen: '影縫い・冴', wide: '影の雨' } },
  ma_art1: { opts: ['power', 'thrift'], names: { power: '魔力凝縮', thrift: '魔力集中・疾' } },
  fa_art1: { opts: ['power', 'wide'], names: { power: '裁きの光・剛', wide: '裁きの光雨' } },
  ri_art1: { opts: ['power', 'swift'], names: { power: '駆け抜け・剛', swift: '駆け抜け二段' } },
  he_m1b: { opts: ['cover', 'counter'], names: { cover: 'かばい通す', counter: 'かばい返し' } },
  fl_art1: { opts: ['power', 'keen'], names: { power: '急降下・剛', keen: '急降下・冴' } },
  gu_art1: { opts: ['keen', 'power'], names: { keen: '狙い撃ち・冴', power: '撃ち抜き' } },
  ta_art1: { opts: ['keen', 'break'], names: { keen: '虚を突く・冴', break: '虚を崩す' } },
  co_art1: { opts: ['power', 'rally'], names: { power: '叱咤・剛', rally: '叱咤激励' } },
};
/** おまかせで選ぶとき：性格ごとに好む道（前ほど好む） */
export const EVO_TASTE: Record<string, EvoBranch[]> = {
  hot: ['power', 'wide', 'swift'], competitive: ['power', 'swift', 'keen'], cheerful: ['wide', 'rally', 'more'], calm: ['guard', 'keen', 'wall'],
  serious: ['guard', 'wall', 'power'], timid: ['guard', 'cover', 'ward'], shy: ['keen', 'more', 'thrift'], gentle: ['more', 'cover', 'widen'],
  cynic: ['break', 'keen', 'thrift'], whimsical: ['swift', 'break', 'tempo'],
};
