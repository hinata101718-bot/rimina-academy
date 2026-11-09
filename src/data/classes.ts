// 兵種データ（20夜目：docs/new/classes.md の確定の木）
// 4段階：初級（入学）→ 中級（1年目の終わりから）→ 上級（3年目）→ 最上級（卒業後、なる条件の出来事を成し遂げた子だけ）。
// ほかに、出来事で道が開く隠れた兵種が2つ（隻眼の射手・呪いの子）。合わせて86。
import type { ClassDef, MoveType, SkillId, Rank, Stats, WeaponType } from '../core/types';
import type { AtkType } from './tactics';

/** 兵種の特技（くわしい効き目は core/tactics/engine.ts）。part＝一部だけ効く、todo＝説明だけ */
export interface TraitDef { id: string; name: string; desc: string; /** まだ戦いの中で効かない（説明だけ） */ todo?: boolean; /** 一部だけ効く（効かない部分の説明） */ part?: string }
export const TRAITS_C: Record<string, TraitDef> = {
  // ---- 剣 ----
  step: { id: 'step', name: '踏み込み', desc: '敵の隣へ1マス詰めて斬る（動ける歩数+1）' },
  twin: { id: 'twin', name: '二の太刀', desc: '速さで少しでも勝れば、ふつうの攻撃が2回' },
  mikiri: { id: 'mikiri', name: '見切り', desc: '戦いで一度だけ、敵の攻撃をかわして斬り返す' },
  mikiri_all: { id: 'mikiri_all', name: '見切り（毎番）', desc: '見切りを、敵の番ごとに一度使える' },
  flameblade: { id: 'flameblade', name: '焔刃', desc: '斬りながら炎も当てる（2つの弱点を同時に突ける）' },
  rune: { id: 'rune', name: 'ルーン', desc: '剣に炎・雷・氷のどれかをまとって斬る（斬と、選んだ種類を同時に）' },
  allarts: { id: 'allarts', name: 'すべての理', desc: '炎・雷・氷・光・闇をすべて使う' },
  veteran: { id: 'veteran', name: '場数', desc: '剣・斧・槍を少しずつ使える。雑兵への傷+3' },
  twoarms: { id: 'twoarms', name: '二つの得物', desc: '剣と斧を高く使い分ける（斬・砕の傷+3）' },
  herald: { id: 'herald', name: '英雄の声', desc: '仲間全員の闘志を上げる（全員の傷+2）' },
  // ---- 槍 ----
  reach: { id: 'reach', name: '間合い', desc: '2マス先まで届く' },
  fly: { id: 'fly', name: '天駆け', desc: '岩を飛び越える。射に弱い（受ける傷1.5倍）' },
  hitrun: { id: 'hitrun', name: '一撃離脱', desc: '突いたあと、残りの歩数で安全なところへ飛び去る' },
  skyward: { id: 'skyward', name: '天翔', desc: '盤のどこへでも飛んで突ける' },
  banner: { id: 'banner', name: '軍旗', desc: '隣の仲間の傷+2。宿敵の前ですくむ心を消す' },
  general_flag: { id: 'general_flag', name: '大軍旗', desc: '軍旗が、盤の仲間全員に届く' },
  warflag: { id: 'warflag', name: '軍神旗', desc: '旗の下では、だれも心が折れない（すくまない・宿敵の大技の傷が半分）' },
  spear: { id: 'spear', name: '槍の冴え', desc: '3マス先まで届き、突の傷+2' },
  pike: { id: 'pike', name: '槍衾', desc: '隣に来た敵を、敵の番に先に突く' },
  unmoving: { id: 'unmoving', name: '不動', desc: '動かない番、敵はこの子の隣を抜けられない' },
  // ---- 斧 ----
  smash: { id: 'smash', name: '叩き割り', desc: '技「兜割り」は、弱点でなくても盾を1つ割る' },
  guard: { id: 'guard', name: 'かばう', desc: '隣の仲間への攻撃を、代わりに受ける' },
  counter: { id: 'counter', name: '守りの反撃', desc: '攻撃を受けたあと、届けば反撃する' },
  unfallen: { id: 'unfallen', name: '不落', desc: 'かばっているあいだ、倒れない（体力1で残る）' },
  barrage: { id: 'barrage', name: '連打', desc: '技「連打」で3回打つ（盾を割りやすい）' },
  shura: { id: 'shura', name: '修羅の連打', desc: 'ブレイクした敵への連打が5回に' },
  ashura: { id: 'ashura', name: '阿修羅', desc: '連打が、まわりの敵すべてに当たる' },
  frenzy: { id: 'frenzy', name: '血の滾り', desc: '闘志が高いほど傷が増える（最大+4）。守り−2' },
  berserk: { id: 'berserk', name: '狂乱', desc: '体力が減るほど傷が増える（最大+6）。闘志が高いとさらに+2' },
  wargod: { id: 'wargod', name: '戦神', desc: '戦いで一度、体力0でも倒れず、次の自分の番の終わりまで戦う' },
  axeplus: { id: 'axeplus', name: '剛斧', desc: '砕の傷+2' },
  axebow: { id: 'axebow', name: '斧と弓', desc: '近くは砕、2〜3マス先は射' },
  kingsaxe: { id: 'kingsaxe', name: '覇王の斧', desc: '叩き割りで盾を2つ割る' },
  // ---- 弓 ----
  longshot: { id: 'longshot', name: '遠矢', desc: '2〜3マス先を撃つ。隣は撃てない' },
  aim: { id: 'aim', name: '狙い澄まし', desc: '2〜4マス先まで届く。動かずに撃つと傷+2' },
  farshot: { id: 'farshot', name: '遠撃ち', desc: '動かずに撃つと5マス先まで。遠いほど傷が増える' },
  thousand: { id: 'thousand', name: '千里の矢', desc: '盤のどこへでも届く' },
  forest: { id: 'forest', name: '森歩き', desc: '森の中では守り+2、敵に狙われにくい' },
  snare: { id: 'snare', name: '罠', desc: '宿敵の逃げ道をふさぐ（追いつめた宿敵が、すぐには逃げられない）' },
  huntking: { id: 'huntking', name: '狩りの王', desc: 'この子がいる戦では、宿敵は逃げられない' },
  firearrow: { id: 'firearrow', name: '火矢', desc: '射と炎を同時に当てる。「火矢」で森（数ターン燃え、通る者が傷を負う）や砦の木の門に火をつける' },
  burn: { id: 'burn', name: '燃える地面', desc: '射ったマスが2ターン燃え、そこにいる敵は敵の番のはじめに傷を負う' },
  inferno: { id: 'inferno', name: '劫火', desc: '戦いで一度、射った敵のいる横一列をまとめて燃やす' },
  // ---- 魔法 ----
  tri: { id: 'tri', name: '三つの理', desc: '炎・雷・氷を使い分ける' },
  splash: { id: 'splash', name: '広がる魔法', desc: '魔法が、当てた敵の隣の敵にも半分当たる' },
  layer: { id: 'layer', name: '理の重ね', desc: '魔法を、2つの種類で同時に撃つ（2つの弱点を同時に突ける）' },
  curse: { id: 'curse', name: '呪縛', desc: '闇を当てた敵の守り−2。宿敵の執念（一度持ちこたえる力）を削る' },
  hex: { id: 'hex', name: '刻印', desc: '呪った敵は、隠れた弱点が1つ見える' },
  cursearea: { id: 'cursearea', name: '呪王の気', desc: '自分の番のはじめに、まわり2マスの敵すべての守りを下げる' },
  raise: { id: 'raise', name: '起こす', desc: '倒れた敵兵を一度だけ起こし、味方として動かす' },
  raise2: { id: 'raise2', name: '冥府の門', desc: '倒れた敵兵を2人まで起こす' },
  barrier: { id: 'barrier', name: '結界', desc: '戦いのはじめに、前に光の壁を立てる（敵は通れない）。隣の仲間の守り+2' },
  seal: { id: 'seal', name: '封印', desc: '宿敵や敵将の大技（渾身の一撃）を、その戦いのあいだ封じる' },
  forbid: { id: 'forbid', name: '禁呪', desc: 'この子のいる戦で討った宿敵は、二度と蘇らない' },
  // ---- 癒し ----
  mend: { id: 'mend', name: '手当て', desc: '隣の仲間の体力を戻す' },
  prayer: { id: 'prayer', name: '祈り', desc: '2マス先まで癒す。「命の危険」の一撃を、その戦いで一度だけ防ぐ' },
  ring: { id: 'ring', name: '癒しの輪', desc: '自分の番の終わりに、まわり2マスの仲間すべての体力を少し戻す' },
  miracle: { id: 'miracle', name: '奇跡', desc: '戦いで一度、仲間が深く傷ついたとき、全員の傷を癒す' },
  judge: { id: 'judge', name: '裁きの光', desc: '蘇った者・闇の者への傷+4' },
  sanctuary: { id: 'sanctuary', name: '聖域', desc: 'まわり2マスの仲間は、闇の傷が半分' },
  lightburst: { id: 'lightburst', name: '光の王', desc: '光の攻撃が、当てた敵のまわりの敵すべてにも当たる' },
  // ---- 密偵 ----
  spot: { id: 'spot', name: '見抜き', desc: '戦いのはじめに、敵将の弱点を1つ明かす' },
  backstab: { id: 'backstab', name: '背討ち', desc: '敵の背中側（狙っている相手と反対側）からなら、傷が2倍' },
  shadowstep: { id: 'shadowstep', name: '影渡り', desc: '近くの敵の背後へ跳んで攻撃できる' },
  ambush: { id: 'ambush', name: '闇討ち', desc: '戦いのはじめに、敵将1人をブレイク状態に' },
  trap: { id: 'trap', name: '罠と見張り', desc: '戦いのはじめに、罠で敵1人に傷を負わせる', part: '敵の狙いは、いまもだれでも1手先まで見える（2手先は千里眼から）' },
  farsight: { id: 'farsight', name: '読み切り', desc: '敵将の隠れた弱点をすべて明かし、宿敵の逃げ道をふさぐ。敵の狙いが2手先まで（薄い矢印で）見える' },
  allseeing: { id: 'allseeing', name: '天眼', desc: '戦いのはじめに、宿敵の隠れた弱点がすべて見える。敵の狙いが2手先まで見える' },
  steal: { id: 'steal', name: '盗む', desc: '勝った戦いで、お金が少し多く手に入る。盤の宝箱（薬や武器）と扉を開けられる' },
  swap: { id: 'swap', name: '入れ替え', desc: '3マス以内の仲間と場所を入れ替える（紫に光る相手をタップ）' },
  swap2: { id: 'swap2', name: '道化の手', desc: '4マス以内の仲間や敵と入れ替え、敵どうしの場所も入れ替えられる' },
  // ---- 騎兵 ----
  ride: { id: 'ride', name: '駆け抜け', desc: '攻撃のあと、残りの歩数で安全なところへ下がる' },
  charge: { id: 'charge', name: '突撃', desc: '3マス以上走って当てると、傷+3' },
  paladin: { id: 'paladin', name: '主を守る', desc: '先生の隣にいると、先生への攻撃をかばう' },
  paladin2: { id: 'paladin2', name: '主の盾', desc: '先生の2マス以内なら、どこからでもかばう' },
  push: { id: 'push', name: '押し込み', desc: '守り+2。突撃で当てた敵を1マス押し下げる' },
  trample: { id: 'trample', name: '蹂躙', desc: '突撃のとき、駆け抜けた線の敵すべてに半分の傷' },
  roar: { id: 'roar', name: '竜の咆哮', desc: '岩を飛び越える。攻撃したマスのまわりの敵をひるませる（盾−1）。射に弱い' },
  scales: { id: 'scales', name: '硬い鱗', desc: '守り+2。射に弱くなくなる' },
  breath: { id: 'breath', name: '竜の息', desc: '攻撃のとき、前の3マスの敵を炎で焼く' },
  runshot: { id: 'runshot', name: '走り撃ち', desc: '撃ったあとに、安全なところへ下がる' },
  bowsword: { id: 'bowsword', name: '弓と剣', desc: '隣は剣で斬り、2〜3マス先は弓で射る' },
  volley: { id: 'volley', name: '駆け撃ち', desc: '動いてから撃つと、ふつうの攻撃が3回' },
  // ---- 隠れた兵種 ----
  oneeye: { id: 'oneeye', name: '隻眼', desc: '届くのは2マス先まで。2マス先への射は、必ず盾を割る' },
  cursed: { id: 'cursed', name: '呪いの子', desc: '闇を使える。光に弱い（受ける傷1.5倍）。仲間との会話で、蘇ったときの記憶を語る' },
};

type Def = {
  id: string; name: string; tier: 1 | 2 | 3 | 4; prereq: string[]; req: Partial<Record<SkillId, Rank>>; move: number; moveType: MoveType;
  weapons: WeaponType[]; atk: AtkType[]; traits: string[]; bonus: Partial<Stats>; growth: Partial<Stats>; desc: string; line: string;
  hidden?: boolean; unlock?: string; deed?: string; need?: number;
};
export interface ClassDefX extends ClassDef { atk: AtkType[]; traits: string[]; line: string; unlock?: string; /** 最上級：なる条件の出来事（Student.deeds の鍵）と、要る回数 */ deed?: string; need?: number }

const list: Def[] = [
  // ======================= 初級（8）入学のときに =======================
  { id: 'swordsman', name: '剣士', tier: 1, line: 'sword', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['step'], bonus: { hp: 1, str: 1, skl: 1, spd: 2 }, growth: { skl: 5, spd: 10 }, desc: '剣で斬る、身軽な兵。' },
  { id: 'lancer', name: '槍兵', tier: 1, line: 'lance', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach'], bonus: { hp: 1, str: 1, def: 2 }, growth: { hp: 5, def: 10 }, desc: '槍で突く。2マス先まで届く。' },
  { id: 'fighter', name: '斧兵', tier: 1, line: 'axe', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['smash'], bonus: { hp: 2, str: 2, def: 1 }, growth: { hp: 10, str: 10, spd: -5 }, desc: '斧で砕く力自慢。' },
  { id: 'archer', name: '弓兵', tier: 1, line: 'bow', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot'], bonus: { str: 1, skl: 3, spd: 1 }, growth: { skl: 10, def: -5 }, desc: '離れたところから射る。' },
  { id: 'mage', name: '魔道士', tier: 1, line: 'magic', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['fire', 'thunder', 'ice'], traits: ['tri'], bonus: { mag: 3, def: 1 }, growth: { mag: 10, def: -5 }, desc: '炎・雷・氷の魔法を使い分ける。' },
  { id: 'cleric', name: '癒し手', tier: 1, line: 'heal', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['mend'], bonus: { mag: 2, def: 1 }, growth: { mag: 5, hp: 5 }, desc: '仲間の傷を癒し、光で戦う。' },
  { id: 'thief', name: '密偵', tier: 1, line: 'dagger', prereq: [], req: {}, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash', 'thrust'], traits: ['spot'], bonus: { skl: 2, spd: 3 }, growth: { spd: 15, str: -5 }, desc: '短剣を使う。敵の弱点を見抜く。' },
  { id: 'cavalier', name: '騎兵', tier: 1, line: 'cavalry', prereq: [], req: {}, move: 4, moveType: 'cavalry', weapons: ['sword', 'lance'], atk: ['slash', 'thrust'], traits: ['ride'], bonus: { hp: 2, str: 1, def: 1 }, growth: { hp: 5, str: 5 }, desc: '馬で戦場を駆け抜ける。' },
  // ======================= 中級（24）1年目の終わりから =======================
  { id: 'kensei', name: '剣豪', tier: 2, line: 'sword', prereq: ['swordsman'], req: { sword: 'C' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['step', 'twin'], bonus: { hp: 2, str: 2, skl: 3, spd: 3 }, growth: { skl: 10, spd: 10 }, desc: '速さで勝れば2回斬る。' },
  { id: 'spellblade', name: '魔剣士', tier: 2, line: 'sword', prereq: ['swordsman'], req: { sword: 'C', magic: 'D' }, move: 3, moveType: 'infantry', weapons: ['sword', 'magic'], atk: ['slash', 'fire'], traits: ['step', 'flameblade'], bonus: { hp: 1, str: 2, mag: 2, skl: 1, spd: 1 }, growth: { mag: 10, str: 5 }, desc: '斬りながら炎も当てる。' },
  { id: 'mercenary', name: '傭兵', tier: 2, line: 'sword', prereq: ['swordsman'], req: { sword: 'C', axe: 'D' }, move: 3, moveType: 'infantry', weapons: ['sword', 'axe', 'lance'], atk: ['slash', 'crush', 'thrust'], traits: ['step', 'veteran'], bonus: { hp: 3, str: 3, def: 1 }, growth: { hp: 10, str: 5 }, desc: '剣も斧も槍も、少しずつ使う戦場慣れした兵。' },
  { id: 'pegasus_rider', name: 'ペガサスナイト', tier: 2, line: 'lance', prereq: ['lancer'], req: { lance: 'C', flying: 'D' }, move: 5, moveType: 'flying', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'fly'], bonus: { str: 1, skl: 2, spd: 3, def: 1 }, growth: { spd: 10 }, desc: '天馬で空を行く。射に弱い。' },
  { id: 'standard', name: '旗手', tier: 2, line: 'lance', prereq: ['lancer'], req: { lance: 'C', command: 'D' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'banner'], bonus: { hp: 2, def: 2, skl: 1 }, growth: { hp: 5, def: 5 }, desc: '軍旗を掲げ、まわりの仲間を奮い立たせる。' },
  { id: 'highlancer', name: '上槍兵', tier: 2, line: 'lance', prereq: ['lancer'], req: { lance: 'C' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'spear'], bonus: { hp: 2, str: 2, def: 2 }, growth: { str: 5, def: 10 }, desc: '槍の道をまっすぐ極める。' },
  { id: 'armor_knight', name: '重装兵', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C', heavy: 'D' }, move: 2, moveType: 'armor', weapons: ['axe'], atk: ['crush'], traits: ['smash', 'guard'], bonus: { hp: 3, str: 2, def: 5, spd: -1 }, growth: { def: 15, spd: -10 }, desc: '分厚い鎧で仲間をかばう。' },
  { id: 'brawler', name: '拳闘士', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C' }, move: 4, moveType: 'infantry', weapons: [], atk: ['blunt'], traits: ['smash', 'barrage'], bonus: { hp: 2, str: 2, spd: 3 }, growth: { str: 5, spd: 10 }, desc: '拳で打つ。何度も打って盾を割る。' },
  { id: 'berserker_m', name: '狂戦士', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['smash', 'frenzy'], bonus: { hp: 3, str: 4, def: -1 }, growth: { hp: 10, str: 15, def: -5 }, desc: '闘志が高いほど強い。守りは低く、引けない。' },
  { id: 'highaxe', name: '上斧兵', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['smash', 'axeplus'], bonus: { hp: 3, str: 3, def: 2 }, growth: { hp: 10, str: 10 }, desc: '斧の道をまっすぐ極める。' },
  { id: 'sharpshooter', name: '狙撃手', tier: 2, line: 'bow', prereq: ['archer'], req: { bow: 'C' }, move: 2, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'aim'], bonus: { skl: 4, str: 1 }, growth: { skl: 15 }, desc: '動かずに撃てば、遠くまで重く届く。' },
  { id: 'hunter', name: '狩人', tier: 2, line: 'bow', prereq: ['archer'], req: { bow: 'C' }, move: 4, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'forest'], bonus: { skl: 2, spd: 3 }, growth: { spd: 10 }, desc: '森を楽に歩き、森の中では狙われにくい。' },
  { id: 'firearcher', name: '火矢兵', tier: 2, line: 'bow', prereq: ['archer'], req: { bow: 'C', magic: 'E+' }, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot', 'fire'], traits: ['longshot', 'firearrow'], bonus: { skl: 2, mag: 2 }, growth: { mag: 5, skl: 5 }, desc: '燃える矢で、射と炎を同時に。' },
  { id: 'elementalist', name: '元素術師', tier: 2, line: 'magic', prereq: ['mage'], req: { magic: 'C' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['fire', 'thunder', 'ice'], traits: ['tri', 'splash'], bonus: { mag: 4, skl: 1 }, growth: { mag: 15 }, desc: '炎・雷・氷を、まわりのマスにも広げる。' },
  { id: 'hexer', name: '呪術師', tier: 2, line: 'magic', prereq: ['mage'], req: { magic: 'C' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark', 'fire', 'thunder', 'ice'], traits: ['tri', 'curse'], bonus: { mag: 3, def: 1 }, growth: { mag: 10 }, desc: '闇の呪いで、敵の守りを削る。宿敵の執念も削る。' },
  { id: 'warder', name: '結界術師', tier: 2, line: 'magic', prereq: ['mage'], req: { magic: 'C', faith: 'D' }, move: 3, moveType: 'infantry', weapons: ['staff', 'magic'], atk: ['light', 'fire', 'thunder', 'ice'], traits: ['tri', 'barrier'], bonus: { mag: 2, def: 3 }, growth: { def: 10 }, desc: '光の壁を立て、敵の足を止める。' },
  { id: 'priest', name: '司祭', tier: 2, line: 'heal', prereq: ['cleric'], req: { faith: 'C' }, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['mend', 'prayer'], bonus: { mag: 3, def: 2 }, growth: { mag: 10 }, desc: '祈りで、命の危険を一度だけ防ぐ。' },
  { id: 'lightmage', name: '光術士', tier: 2, line: 'heal', prereq: ['cleric'], req: { faith: 'C', magic: 'D' }, move: 3, moveType: 'infantry', weapons: ['holy', 'magic'], atk: ['light'], traits: ['mend', 'judge'], bonus: { mag: 4, skl: 1 }, growth: { mag: 10, skl: 5 }, desc: '裁きの光で、蘇った者を討つ。' },
  { id: 'assassin', name: '暗殺者', tier: 2, line: 'dagger', prereq: ['thief'], req: { sword: 'C' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash', 'thrust'], traits: ['spot', 'backstab'], bonus: { str: 2, skl: 2, spd: 4 }, growth: { spd: 10, str: 5 }, desc: '敵の背中側から、深く斬る。' },
  { id: 'scout', name: '斥候', tier: 2, line: 'dagger', prereq: ['thief'], req: { sword: 'D', bow: 'D' }, move: 4, moveType: 'infantry', weapons: ['sword', 'bow'], atk: ['thrust', 'shot'], traits: ['spot', 'trap'], bonus: { skl: 3, spd: 3 }, growth: { skl: 10 }, desc: '罠を仕掛け、敵を見張る。' },
  { id: 'rogue', name: '盗賊', tier: 2, line: 'dagger', prereq: ['thief'], req: { sword: 'C' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['spot', 'steal'], bonus: { skl: 2, spd: 4 }, growth: { spd: 15 }, desc: '身軽で、敵の持ち物を盗む。' },
  { id: 'knight', name: '騎士', tier: 2, line: 'cavalry', prereq: ['cavalier'], req: { lance: 'C', riding: 'C' }, move: 4, moveType: 'cavalry', weapons: ['sword', 'lance'], atk: ['slash', 'thrust'], traits: ['ride', 'charge'], bonus: { hp: 3, str: 2, def: 2 }, growth: { hp: 5, str: 5, def: 5 }, desc: '走って当てる突撃が得意。' },
  { id: 'dragoon', name: 'ドラグーン', tier: 2, line: 'cavalry', prereq: ['cavalier'], req: { riding: 'C', flying: 'D' }, move: 4, moveType: 'flying', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['ride', 'roar'], bonus: { hp: 3, str: 3, def: 2, spd: -1 }, growth: { str: 10, def: 5 }, desc: '飛竜にまたがる。降りたところで咆える。射に弱い。' },
  { id: 'bowrider', name: '弓騎兵', tier: 2, line: 'cavalry', prereq: ['cavalier'], req: { bow: 'C', riding: 'D' }, move: 5, moveType: 'cavalry', weapons: ['bow'], atk: ['shot'], traits: ['ride', 'runshot'], bonus: { skl: 2, spd: 2 }, growth: { skl: 5, spd: 5 }, desc: '馬の上から撃ち、撃ったあとに下がる。' },
  // ======================= 上級（26）3年目から =======================
  { id: 'swordmaster', name: 'ソードマスター', tier: 3, line: 'sword', prereq: ['kensei'], req: { sword: 'B' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['step', 'twin', 'mikiri'], bonus: { hp: 3, str: 3, skl: 5, spd: 5 }, growth: { skl: 15, spd: 15 }, desc: '一度だけ、敵の攻撃をかわして斬り返す。' },
  { id: 'runeknight', name: 'ルーンナイト', tier: 3, line: 'sword', prereq: ['spellblade'], req: { sword: 'B', magic: 'C' }, move: 3, moveType: 'infantry', weapons: ['sword', 'magic'], atk: ['slash', 'fire', 'thunder', 'ice'], traits: ['step', 'flameblade', 'rune'], bonus: { hp: 2, str: 3, mag: 4, skl: 2 }, growth: { mag: 10, str: 10 }, desc: '剣に炎・雷・氷のどれかをまとって斬る。' },
  { id: 'brave', name: '勇者', tier: 3, line: 'sword', prereq: ['mercenary'], req: { sword: 'B', axe: 'C' }, move: 3, moveType: 'infantry', weapons: ['sword', 'axe'], atk: ['slash', 'crush'], traits: ['step', 'veteran', 'twoarms'], bonus: { hp: 4, str: 4, skl: 2, def: 2 }, growth: { hp: 10, str: 10 }, desc: '剣と斧を、高く使い分ける。' },
  { id: 'falcon_knight', name: 'ファルコンナイト', tier: 3, line: 'lance', prereq: ['pegasus_rider'], req: { lance: 'B', flying: 'C' }, move: 6, moveType: 'flying', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'fly', 'hitrun'], bonus: { str: 2, skl: 3, spd: 5, def: 2 }, growth: { spd: 15 }, desc: '突いたあと、残りの歩数で飛び去る。' },
  { id: 'warbanner', name: '将軍旗', tier: 3, line: 'lance', prereq: ['standard'], req: { lance: 'B', command: 'C' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'banner', 'general_flag'], bonus: { hp: 3, def: 3, skl: 2 }, growth: { def: 10 }, desc: '大軍旗で、盤の仲間全員を奮い立たせる。' },
  { id: 'ironlancer', name: '鉄槍将', tier: 3, line: 'lance', prereq: ['highlancer'], req: { lance: 'B' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'spear', 'pike'], bonus: { hp: 3, str: 3, def: 4 }, growth: { str: 10, def: 10 }, desc: '近づいた敵を、まわりすべて突く。' },
  { id: 'general', name: 'ジェネラル', tier: 3, line: 'axe', prereq: ['armor_knight'], req: { axe: 'B', heavy: 'C' }, move: 2, moveType: 'armor', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['smash', 'guard', 'counter'], bonus: { hp: 5, str: 3, def: 7, spd: -1 }, growth: { def: 20, hp: 10 }, desc: '守りながら、斧と槍で反撃する。' },
  { id: 'shura', name: '修羅', tier: 3, line: 'axe', prereq: ['brawler'], req: { axe: 'B' }, move: 4, moveType: 'infantry', weapons: [], atk: ['blunt'], traits: ['smash', 'barrage', 'shura'], bonus: { hp: 3, str: 4, spd: 4 }, growth: { str: 10, spd: 10 }, desc: '崩れた敵への連打が5回になる。' },
  { id: 'berserker', name: 'ベルセルク', tier: 3, line: 'axe', prereq: ['berserker_m'], req: { axe: 'B' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['smash', 'frenzy', 'berserk'], bonus: { hp: 5, str: 6, def: -1 }, growth: { hp: 15, str: 15 }, desc: '体力が減るほど力が上がる。闘志が高いと止まらない。' },
  { id: 'warrior', name: 'ウォーリアー', tier: 3, line: 'axe', prereq: ['highaxe'], req: { axe: 'B' }, move: 3, moveType: 'infantry', weapons: ['axe', 'bow'], atk: ['crush', 'shot'], traits: ['smash', 'axeplus', 'axebow'], bonus: { hp: 5, str: 5, def: 2 }, growth: { hp: 10, str: 15 }, desc: '近くは斧で砕き、遠くは弓で射る。' },
  { id: 'sniper', name: 'スナイパー', tier: 3, line: 'bow', prereq: ['sharpshooter'], req: { bow: 'B' }, move: 2, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'aim', 'farshot'], bonus: { skl: 6, str: 2 }, growth: { skl: 20 }, desc: '動かなかった番は5マス先まで。遠いほど傷が増える。' },
  { id: 'ranger', name: 'レンジャー', tier: 3, line: 'bow', prereq: ['hunter'], req: { bow: 'B' }, move: 4, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'forest', 'snare'], bonus: { skl: 3, spd: 4, def: 1 }, growth: { spd: 10, skl: 5 }, desc: '森を駆け、罠で宿敵の逃げ道をふさぐ。' },
  { id: 'flamebow', name: '焔弓', tier: 3, line: 'bow', prereq: ['firearcher'], req: { bow: 'B', magic: 'D' }, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot', 'fire'], traits: ['longshot', 'firearrow', 'burn'], bonus: { skl: 3, mag: 4 }, growth: { mag: 10, skl: 10 }, desc: '射ったマスが燃え、通る敵が傷を負う。' },
  { id: 'archmage', name: '大魔道', tier: 3, line: 'magic', prereq: ['elementalist'], req: { magic: 'B' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['fire', 'thunder', 'ice'], traits: ['tri', 'splash', 'layer'], bonus: { mag: 6, skl: 2 }, growth: { mag: 20 }, desc: '同じ番に、2つの種類を重ねて撃つ。' },
  { id: 'warlock', name: '呪詛師', tier: 3, line: 'magic', prereq: ['hexer'], req: { magic: 'B' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark', 'fire', 'thunder', 'ice'], traits: ['tri', 'curse', 'hex'], bonus: { mag: 5, def: 1 }, growth: { mag: 15 }, desc: '呪った敵の、隠れた弱点を見る。' },
  { id: 'necromancer', name: '死霊術士', tier: 3, line: 'magic', prereq: ['hexer'], req: { magic: 'B' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark', 'fire', 'thunder', 'ice'], traits: ['tri', 'curse', 'raise'], bonus: { mag: 6 }, growth: { mag: 15, hp: 5 }, desc: '倒れた敵兵を一度だけ起こし、味方として動かす。' },
  { id: 'sealer', name: '封印術師', tier: 3, line: 'magic', prereq: ['warder'], req: { magic: 'B', faith: 'C' }, move: 3, moveType: 'infantry', weapons: ['staff', 'magic'], atk: ['light', 'fire', 'thunder', 'ice'], traits: ['tri', 'barrier', 'seal'], bonus: { mag: 4, def: 4 }, growth: { def: 10, mag: 5 }, desc: '敵の大技を、その戦いのあいだ封じる。' },
  { id: 'bishop', name: 'ビショップ', tier: 3, line: 'heal', prereq: ['priest'], req: { faith: 'B' }, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['mend', 'prayer', 'ring'], bonus: { mag: 5, def: 3 }, growth: { mag: 15 }, desc: 'まわりの仲間すべてを、少しずつ癒す。' },
  { id: 'holyknight', name: '聖騎士', tier: 3, line: 'heal', prereq: ['lightmage'], req: { faith: 'B', riding: 'D' }, move: 4, moveType: 'cavalry', weapons: ['holy', 'lance'], atk: ['light', 'thrust'], traits: ['mend', 'judge', 'sanctuary'], bonus: { hp: 3, mag: 4, def: 3 }, growth: { mag: 10, def: 5 }, desc: '馬に乗る。まわりの仲間を闇から守る。' },
  { id: 'shadow', name: 'シャドウ', tier: 3, line: 'dagger', prereq: ['assassin'], req: { sword: 'B' }, move: 5, moveType: 'infantry', weapons: ['sword'], atk: ['slash', 'thrust'], traits: ['spot', 'backstab', 'shadowstep'], bonus: { str: 3, skl: 3, spd: 6 }, growth: { spd: 15 }, desc: '影を渡り、敵の背後へ跳ぶ。' },
  { id: 'farsight', name: '千里眼', tier: 3, line: 'dagger', prereq: ['scout'], req: { sword: 'C', bow: 'C' }, move: 4, moveType: 'infantry', weapons: ['sword', 'bow'], atk: ['thrust', 'shot'], traits: ['spot', 'trap', 'farsight'], bonus: { skl: 5, spd: 3 }, growth: { skl: 15 }, desc: '敵の狙いを読み切り、宿敵の逃げ道が分かる。' },
  { id: 'trickster', name: 'トリックスター', tier: 3, line: 'dagger', prereq: ['rogue'], req: { sword: 'B' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['spot', 'steal', 'swap'], bonus: { skl: 3, spd: 5, mag: 2 }, growth: { spd: 10, mag: 5 }, desc: '仲間と場所を入れ替える。' },
  { id: 'paladin', name: 'パラディン', tier: 3, line: 'cavalry', prereq: ['knight'], req: { lance: 'B', riding: 'B' }, move: 4, moveType: 'cavalry', weapons: ['sword', 'lance'], atk: ['slash', 'thrust'], traits: ['ride', 'charge', 'paladin'], bonus: { hp: 4, str: 3, def: 3, skl: 2 }, growth: { hp: 10, def: 10 }, desc: '先生を守る騎士。' },
  { id: 'greatknight', name: 'グレートナイト', tier: 3, line: 'cavalry', prereq: ['knight'], req: { lance: 'B', heavy: 'C' }, move: 3, moveType: 'cavalry', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['ride', 'charge', 'push'], bonus: { hp: 5, str: 4, def: 5, spd: -1 }, growth: { def: 15, str: 5 }, desc: '重い鎧の馬。突撃で敵を押し下げる。' },
  { id: 'wyvernlord', name: 'ワイバーンロード', tier: 3, line: 'cavalry', prereq: ['dragoon'], req: { riding: 'B', flying: 'C' }, move: 5, moveType: 'flying', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['ride', 'roar', 'scales'], bonus: { hp: 4, str: 5, def: 3 }, growth: { str: 15, def: 5 }, desc: '硬い鱗で、射にも弱くない。' },
  { id: 'bowknight', name: 'ボウナイト', tier: 3, line: 'cavalry', prereq: ['bowrider'], req: { bow: 'B', riding: 'C' }, move: 5, moveType: 'cavalry', weapons: ['bow', 'sword'], atk: ['shot', 'slash'], traits: ['ride', 'runshot', 'bowsword'], bonus: { skl: 4, spd: 3, str: 2 }, growth: { skl: 10, spd: 5 }, desc: '近くも遠くも戦える騎兵。' },
  // ======================= 最上級（26）卒業後、なる条件の出来事を成し遂げた子だけ。上級ごとに1つ =======================
  { id: 'kenshin', name: '剣神', tier: 4, line: 'sword', prereq: ['swordmaster'], req: { sword: 'A' }, move: 5, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['step', 'twin', 'mikiri', 'mikiri_all'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '見切りを毎番使う、剣の神。', deed: 'unhurt', need: 10, unlock: '10の戦で傷を負わない' },
  { id: 'runelord', name: 'ルーンロード', tier: 4, line: 'sword', prereq: ['runeknight'], req: { sword: 'A', magic: 'B' }, move: 4, moveType: 'infantry', weapons: ['sword', 'magic'], atk: ['slash', 'fire', 'thunder', 'ice', 'light', 'dark'], traits: ['step', 'flameblade', 'rune', 'allarts'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: 'すべての理を剣にまとう。', deed: 'overcome', need: 1, unlock: '弱点を克服した宿敵を退ける' },
  { id: 'hero', name: '英雄', tier: 4, line: 'sword', prereq: ['brave'], req: { sword: 'A', axe: 'B' }, move: 4, moveType: 'infantry', weapons: ['sword', 'axe'], atk: ['slash', 'crush'], traits: ['step', 'veteran', 'twoarms', 'herald'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '仲間全員の闘志を上げる英雄。', deed: 'turnTide', need: 1, unlock: '大きな戦で負け戦をひっくり返す' },
  { id: 'tenshou', name: '天翔', tier: 4, line: 'lance', prereq: ['falcon_knight'], req: { lance: 'A', flying: 'B' }, move: 6, moveType: 'flying', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'fly', 'hitrun', 'skyward'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '盤のどこへでも飛んで突ける。', deed: 'skyChase', need: 1, unlock: '逃げる宿敵を空から追いつめる' },
  { id: 'gunshinki', name: '軍神旗', tier: 4, line: 'lance', prereq: ['warbanner'], req: { lance: 'A', command: 'B' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'banner', 'general_flag', 'warflag'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '旗の下では、だれも心が折れない。', deed: 'ledArmy', need: 1, unlock: '率いた軍で大きな戦に勝つ' },
  { id: 'sousei', name: '槍聖', tier: 4, line: 'lance', prereq: ['ironlancer'], req: { lance: 'A' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'spear', 'pike', 'unmoving'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '動かない番、だれも隣を抜けない。', deed: 'holdGeneral', need: 1, unlock: '守り抜く戦で将を退ける' },
  { id: 'furakushou', name: '不落将', tier: 4, line: 'axe', prereq: ['general'], req: { axe: 'A', heavy: 'B' }, move: 2, moveType: 'armor', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['smash', 'guard', 'counter', 'unfallen'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: 'かばっているあいだ、倒れない。', deed: 'guardLethal', need: 1, unlock: '仲間をかばって、命の危険の一撃を受けきる' },
  { id: 'ashura', name: '阿修羅', tier: 4, line: 'axe', prereq: ['shura'], req: { axe: 'A' }, move: 4, moveType: 'infantry', weapons: [], atk: ['blunt'], traits: ['smash', 'barrage', 'shura', 'ashura'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: 'まわりの敵すべてに連打する。', deed: 'surrounded', need: 1, unlock: '囲まれて生き延びる' },
  { id: 'senjin', name: '戦神', tier: 4, line: 'axe', prereq: ['berserker'], req: { axe: 'A' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['smash', 'frenzy', 'berserk', 'wargod'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '体力0でも、その番の終わりまで戦う。', deed: 'lastBreath', need: 1, unlock: '体力1で将を討つ' },
  { id: 'haouono', name: '覇王斧', tier: 4, line: 'axe', prereq: ['warrior'], req: { axe: 'A' }, move: 3, moveType: 'infantry', weapons: ['axe', 'bow'], atk: ['crush', 'shot'], traits: ['smash', 'axeplus', 'axebow', 'kingsaxe'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '叩き割りで、盾を2つ割る。', deed: 'axeBoss', need: 1, unlock: '大将を斧で討つ' },
  { id: 'bow_saint', name: '弓聖', tier: 4, line: 'bow', prereq: ['sniper'], req: { bow: 'A' }, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'aim', 'farshot', 'thousand'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '千里の矢は、盤のどこへでも届く。', deed: 'snipeNemesis', need: 1, unlock: '宿敵を遠くから射止める' },
  { id: 'huntking', name: '狩りの王', tier: 4, line: 'bow', prereq: ['ranger'], req: { bow: 'A' }, move: 4, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'forest', 'snare', 'huntking'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: 'この子がいる戦では、宿敵は逃げられない。', deed: 'chaseKill', need: 1, unlock: '逃げた宿敵を追って討つ' },
  { id: 'gouka', name: '劫火', tier: 4, line: 'bow', prereq: ['flamebow'], req: { bow: 'A', magic: 'C' }, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot', 'fire'], traits: ['longshot', 'firearrow', 'burn', 'inferno'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '一度、盤の一列をまとめて燃やす。', deed: 'burnFort', need: 1, unlock: '敵の砦を焼き落とす' },
  { id: 'archsage', name: '賢者', tier: 4, line: 'magic', prereq: ['archmage'], req: { magic: 'A' }, move: 3, moveType: 'infantry', weapons: ['magic', 'holy'], atk: ['fire', 'thunder', 'ice', 'light', 'dark'], traits: ['tri', 'splash', 'layer', 'allarts'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '炎・雷・氷・光・闇をすべて使う。', deed: 'mentor', need: 1, unlock: '卒業生として学校に戻り、教え子を導く' },
  { id: 'cursemaster', name: '呪王', tier: 4, line: 'magic', prereq: ['warlock'], req: { magic: 'A' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark', 'fire', 'thunder', 'ice'], traits: ['tri', 'curse', 'hex', 'cursearea'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: 'まわりの敵すべての守りを下げる。', deed: 'curseMaster', need: 8, unlock: '呪いの力を使いこなす（呪いを8度当てる）' },
  { id: 'netherlord', name: '冥府の主', tier: 4, line: 'magic', prereq: ['necromancer'], req: { magic: 'A' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark', 'fire', 'thunder', 'ice'], traits: ['tri', 'curse', 'raise', 'raise2'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '倒れた敵兵を2人まで起こす。', deed: 'lastWords', need: 1, unlock: '討った宿敵の最期の言葉を聞く' },
  { id: 'forbidkeeper', name: '禁呪の番人', tier: 4, line: 'magic', prereq: ['sealer'], req: { magic: 'A', faith: 'B' }, move: 3, moveType: 'infantry', weapons: ['staff', 'magic'], atk: ['light', 'fire', 'thunder', 'ice'], traits: ['tri', 'barrier', 'seal', 'forbid'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: 'この子が封じた者は、二度と蘇らない。', deed: 'sealRevived', need: 1, unlock: '呪いで蘇った宿敵を封じる' },
  { id: 'holy_saint', name: '聖者', tier: 4, line: 'heal', prereq: ['bishop'], req: { faith: 'A' }, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['mend', 'prayer', 'ring', 'miracle'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '奇跡：戦いで一度、全員の傷を癒す。', deed: 'saveLife', need: 3, unlock: '戦場で仲間の死を3度防ぐ' },
  { id: 'lightking', name: '光の王', tier: 4, line: 'heal', prereq: ['holyknight'], req: { faith: 'A', riding: 'B' }, move: 4, moveType: 'cavalry', weapons: ['holy', 'lance'], atk: ['light', 'thrust'], traits: ['mend', 'judge', 'sanctuary', 'lightburst'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '光の攻撃が、まわりの敵すべてに届く。', deed: 'darkNemesis', need: 1, unlock: '闇の宿敵を討つ' },
  { id: 'shadow_king', name: '影の王', tier: 4, line: 'dagger', prereq: ['shadow'], req: { sword: 'A' }, move: 5, moveType: 'infantry', weapons: ['sword'], atk: ['slash', 'thrust'], traits: ['spot', 'backstab', 'shadowstep', 'ambush'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '戦いのはじめ、敵将1人をブレイクさせる。', deed: 'topple', need: 1, unlock: '密偵として敵の将を失脚させる' },
  { id: 'allseeing', name: '天眼', tier: 4, line: 'dagger', prereq: ['farsight'], req: { sword: 'B', bow: 'A' }, move: 4, moveType: 'infantry', weapons: ['sword', 'bow'], atk: ['thrust', 'shot'], traits: ['spot', 'trap', 'farsight', 'allseeing'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '宿敵の弱点と狙いが、すべて見える。', deed: 'seeTrap', need: 1, unlock: '宿敵の罠を見抜いて仲間を救う' },
  { id: 'jesterking', name: '道化王', tier: 4, line: 'dagger', prereq: ['trickster'], req: { sword: 'A' }, move: 5, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['spot', 'steal', 'swap', 'swap2'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '敵どうしの場所も入れ替える。', deed: 'outwit', need: 1, unlock: '宿敵を出し抜いて逃げきる' },
  { id: 'greatpaladin', name: 'グレートパラディン', tier: 4, line: 'cavalry', prereq: ['paladin'], req: { lance: 'A', riding: 'A' }, move: 5, moveType: 'cavalry', weapons: ['sword', 'lance'], atk: ['slash', 'thrust'], traits: ['ride', 'charge', 'paladin', 'paladin2'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '先生の2マス以内なら、どこからでもかばう。', deed: 'shieldTeacher', need: 1, unlock: '先生を宿敵の一撃からかばいきる' },
  { id: 'masterknight', name: 'マスターナイト', tier: 4, line: 'cavalry', prereq: ['greatknight'], req: { riding: 'A', heavy: 'B' }, move: 4, moveType: 'cavalry', weapons: ['sword', 'axe', 'lance'], atk: ['slash', 'crush', 'thrust'], traits: ['ride', 'charge', 'push', 'trample'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '蹂躙：駆け抜けた線の敵すべてに当てる。', deed: 'breakLine', need: 1, unlock: '大きな戦で敵の陣を突き破る' },
  { id: 'dragonking', name: '竜王', tier: 4, line: 'cavalry', prereq: ['wyvernlord'], req: { riding: 'A', flying: 'B' }, move: 5, moveType: 'flying', weapons: ['axe', 'lance'], atk: ['crush', 'thrust', 'fire'], traits: ['ride', 'roar', 'scales', 'breath'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '竜の息で、前の3マスを焼く。', deed: 'skyKill', need: 1, unlock: '空から宿敵を討つ' },
  { id: 'bowmaster', name: 'ボウマスター', tier: 4, line: 'cavalry', prereq: ['bowknight'], req: { bow: 'A', riding: 'B' }, move: 5, moveType: 'cavalry', weapons: ['bow', 'sword'], atk: ['shot', 'slash'], traits: ['ride', 'runshot', 'bowsword', 'volley'], bonus: { hp: 5, str: 4, mag: 4, skl: 4, spd: 3, def: 3 }, growth: { str: 5, mag: 5 }, desc: '駆けながら、3回撃つ。', deed: 'rearguard', need: 1, unlock: '逃げきる戦で殿を務める' },
  // ======================= 隠れた兵種（2）：出来事で横道が開く =======================
  { id: 'oneeye', name: '隻眼の射手', tier: 2, line: 'bow', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'oneeye'], bonus: { skl: 5 }, growth: { skl: 15 }, desc: '宿敵に片目を奪われてなお、射る。', hidden: true, unlock: '宿敵に片目を奪われる（弓・密偵の系統）' },
  { id: 'cursechild', name: '呪いの子', tier: 2, line: 'any', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['magic', 'sword'], atk: ['dark', 'slash'], traits: ['cursed', 'curse'], bonus: { mag: 4, str: 2 }, growth: { mag: 10 }, desc: '呪いで蘇った。闇を使い、光に弱い。', hidden: true, unlock: '呪いで蘇る' },
];

function cls(d: Def): ClassDefX {
  return { id: d.id, name: d.name, tier: d.tier, prereq: d.prereq, req: d.req, move: d.move, moveType: d.moveType, weapons: d.weapons, bonus: d.bonus, growth: d.growth, desc: d.desc, atk: d.atk, traits: d.traits, line: d.line, ...(d.hidden ? { hidden: true } : {}), ...(d.unlock ? { unlock: d.unlock } : {}), ...(d.deed ? { deed: d.deed, need: d.need ?? 1 } : {}) };
}
/** 入学のときの見習い（古いセーブ・名もない兵の受け皿。木の外） */
const NOVICE: ClassDefX = { id: 'novice', name: '見習い', tier: 0, prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['sword', 'lance', 'axe', 'bow', 'magic', 'staff'], bonus: {}, growth: {}, desc: 'まだ道を決めていない生徒。', atk: ['slash'], traits: [], line: 'none' };

export const CLASSES: Record<string, ClassDefX> = { novice: NOVICE, ...Object.fromEntries(list.map((d) => [d.id, cls(d)])) };
/** 木にのる兵種（見習いを除く） */
export const CLASS_LIST: ClassDefX[] = Object.values(CLASSES).filter((c) => c.id !== 'novice');
export const TIER_NAMES = ['見習い', '初級', '中級', '上級', '最上級'];
/** 初級の兵種（入学のときに選ばれる） */
export const ENTRY_CLASSES = CLASS_LIST.filter((c) => c.tier === 1 && !c.hidden).map((c) => c.id);

/** 入学のときの兵種：いちばん育った技能・夢から */
export function entryClassFor(skills: Partial<Record<SkillId, number>>, stats?: Partial<Stats>): string {
  const sc = (k: SkillId) => skills[k] ?? 0;
  const cand: [string, number][] = [
    ['swordsman', sc('sword')], ['lancer', sc('lance')], ['fighter', sc('axe') + sc('heavy') * 0.3], ['archer', sc('bow') + sc('gun')],
    ['mage', sc('magic')], ['cleric', sc('faith')], ['thief', sc('sword') * 0.6 + sc('tactics') * 0.6], ['cavalier', sc('riding') + sc('flying') * 0.5 + sc('lance') * 0.3],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  // 20夜目：剣が得意で、力より速さのある子は密偵に（密偵の系統の子が学校にいなくならないように）
  if (cand[0][0] === 'swordsman' && stats && (stats.spd ?? 0) > (stats.str ?? 0)) return 'thief';
  return cand[0][1] > 0 ? cand[0][0] : 'swordsman';
}

/** 19夜目：古い兵種（68種・14種のたたき台）→ 新しい木。20夜目：仮だった最上級・隠れた兵種 → いちばん近い兵種 */
const OLD_MAP: Record<string, string> = {
  monk: 'cleric', gunner: 'archer', fencer: 'kensei', hunter: 'hunter', bow_rider: 'bowrider', sorcerer: 'elementalist', hexer: 'hexer',
  battle_monk: 'priest', musketeer: 'sharpshooter', spellblade: 'spellblade', assassin: 'assassin', paladin: 'paladin', mage_knight: 'holyknight',
  pegasus_knight: 'falcon_knight', general: 'general', berserker: 'berserker', brave: 'brave', sniper: 'sniper', bow_knight: 'bowknight',
  dark_mage: 'warlock', bishop: 'bishop', saint: 'bishop', templar: 'holyknight', sharpshooter: 'sharpshooter', sword_saint: 'swordmaster', rune_knight: 'runeknight',
  shadow: 'shadow', great_knight: 'greatknight', dark_knight: 'greatknight', falcon_knight: 'falcon_knight', great_general: 'general', warlord: 'warrior',
  champion: 'warrior', hawkeye: 'sniper', bow_lord: 'ranger', archsage: 'archmage', necromancer: 'necromancer', archbishop: 'bishop', oracle: 'sealer',
  crusader: 'paladin', deadeye: 'sniper', holy_knight: 'holyknight', fortress: 'general', royal_guard: 'general', white_wing: 'falcon_knight',
  gun_cavalry: 'bowknight', magic_general: 'sealer', dominator: 'warlock', imperial_guard: 'general', high_wizard: 'archmage', dragon_knight: 'wyvernlord',
  bow_master: 'ranger', high_priest: 'bishop', hero: 'swordmaster', warrior: 'warrior', pegasus_rider: 'pegasus_rider', armor_knight: 'armor_knight',
  cavalier: 'cavalier', thief: 'thief', cleric: 'cleric', fighter: 'fighter', sage: 'archmage', swordmaster: 'swordmaster',
  // 20夜目：19夜目の仮の最上級（名前が変わった）
  deathlord: 'netherlord', sealmaster: 'forbidkeeper', holylord: 'lightking', phantom: 'jesterking', overlord: 'greatpaladin', ironrider: 'masterknight', bowlord: 'bowmaster',
  // 20夜目：はずした隠れた兵種（いちばん近い兵種へ）
  avenger: 'mercenary', undying: 'mercenary', nemhunter: 'brave', oathshield: 'armor_knight', bareblade: 'brawler', twinstar: 'spellblade', storyteller: 'bishop',
};
export function newClassId(old: string | null | undefined, skills?: Partial<Record<SkillId, number>>): string {
  if (!old) return skills ? entryClassFor(skills) : 'swordsman';
  if (old === 'novice') return skills ? entryClassFor(skills) : 'novice';
  if (CLASSES[old]) return old;
  if (OLD_MAP[old] && CLASSES[OLD_MAP[old]]) return OLD_MAP[old];
  return skills ? entryClassFor(skills) : 'swordsman';
}
export function traitsOf(classId: string): string[] { return CLASSES[classId]?.traits ?? []; }
export function hasTrait(classId: string, t: string): boolean { return traitsOf(classId).includes(t); }
