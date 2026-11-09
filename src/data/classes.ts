// 兵種データ（19夜目：兵種のヒアリング 問78〜問102 に沿った木）
// 4段階：初級（入学）→ 中級（1年目の終わりから）→ 上級（3年目）→ 最上級（卒業後、名を上げた子だけ）。ほかに出来事で開く隠れた兵種。
// 最上級と隠れた兵種は、docs/new/classes.md のたたき台のまま（ヒナタさんの直し待ち）。
import type { ClassDef, MoveType, SkillId, Rank, Stats, WeaponType } from '../core/types';
import type { AtkType } from './tactics';

/** 兵種の特技（戦いの中で効くもの。くわしい効き目は core/tactics/engine.ts） */
export interface TraitDef { id: string; name: string; desc: string; /** まだ戦いの中で効かない（説明だけ） */ todo?: boolean }
export const TRAITS_C: Record<string, TraitDef> = {
  step: { id: 'step', name: '踏み込み', desc: '動ける歩数が1多い' },
  reach: { id: 'reach', name: '間合い', desc: '2マス先まで届く' },
  smash: { id: 'smash', name: '叩き割り', desc: '技「兜割り」は、弱点でなくても盾を1つ割る' },
  longshot: { id: 'longshot', name: '遠矢', desc: '2〜3マス先を撃つ。隣は撃てない' },
  tri: { id: 'tri', name: '三つの理', desc: '炎・雷・氷を使い分ける' },
  mend: { id: 'mend', name: '手当て', desc: '隣の仲間の体力を戻す（何度でも）' },
  spot: { id: 'spot', name: '見抜き', desc: '戦いのはじめに、敵将の弱点を1つ明かす' },
  ride: { id: 'ride', name: '駆け抜け', desc: '動ける歩数が多い' },
  twin: { id: 'twin', name: '二の太刀', desc: '速さで少しでも勝れば、ふつうの攻撃が2回' },
  flameblade: { id: 'flameblade', name: '焔刃', desc: '斬りながら炎も当てる（2つの弱点を同時に突ける）' },
  veteran: { id: 'veteran', name: '場数', desc: '雑兵への攻撃の傷+3' },
  fly: { id: 'fly', name: '天駆け', desc: '岩を飛び越える。射に弱い（受ける傷1.5倍）' },
  banner: { id: 'banner', name: '旗印', desc: '隣にいる仲間の攻撃の傷+2' },
  spear: { id: 'spear', name: '槍の冴え', desc: '2マス先まで届き、突の傷+2' },
  guard: { id: 'guard', name: 'かばう', desc: '隣の仲間への攻撃を、代わりに受ける' },
  barrage: { id: 'barrage', name: '連打', desc: '技「連打」で3回打つ（盾を割りやすい）' },
  frenzy: { id: 'frenzy', name: '血の滾り', desc: '体力が半分を切ると、傷+4' },
  axeplus: { id: 'axeplus', name: '剛斧', desc: '砕の傷+2' },
  aim: { id: 'aim', name: '狙い澄まし', desc: '2〜4マス先まで届く。動かずに撃つと傷+2' },
  hunt: { id: 'hunt', name: '獣狩り', desc: '騎兵・魔獣への傷+4' },
  firearrow: { id: 'firearrow', name: '火矢', desc: '射と炎を同時に当てる' },
  element: { id: 'element', name: '元素の理', desc: '炎・雷・氷を使い分け、魔法の傷+2' },
  curse: { id: 'curse', name: '呪縛', desc: '闇の攻撃を当てた敵の守りを2下げる' },
  barrier: { id: 'barrier', name: '結界', desc: '隣にいる仲間の守り+2' },
  prayer: { id: 'prayer', name: '祈り', desc: '「命の危険」の一撃を、その戦いで一度だけ防ぐ' },
  judge: { id: 'judge', name: '裁きの光', desc: '蘇った者・闇の者への傷+4' },
  backstab: { id: 'backstab', name: '挟み討ち', desc: '仲間がとなりにいる敵への傷+4' },
  trap: { id: 'trap', name: '罠と見張り', desc: '戦いのはじめに、罠で敵1人に傷を負わせる' },
  pilfer: { id: 'pilfer', name: 'かすめ取り', desc: '勝った戦いで、お金が少し多く手に入る' },
  charge: { id: 'charge', name: '突撃', desc: '3マス以上走って当てると、傷+3' },
  roar: { id: 'roar', name: '竜の咆哮', desc: '岩を飛び越える。射に弱い。砕と突を使う' },
  runshot: { id: 'runshot', name: '走り撃ち', desc: '弓を持ったまま速く動ける' },
  // 上級で足される特技
  master: { id: 'master', name: '剣の極み', desc: '剣の技の傷+3' },
  rune: { id: 'rune', name: '刻印剣', desc: '斬・炎・雷を使い分ける' },
  brave: { id: 'brave', name: '勇者の一撃', desc: 'ふつうの攻撃がいつも2回' },
  falcon: { id: 'falcon', name: '疾風の翼', desc: '天駆けのうえ、動ける歩数がさらに1多い' },
  general_flag: { id: 'general_flag', name: '将軍旗', desc: '旗印が隣だけでなく2マス先まで届く' },
  ironspear: { id: 'ironspear', name: '鉄槍', desc: '3マス先まで届く' },
  fortress: { id: 'fortress', name: '不落', desc: 'かばったとき、受ける傷が半分' },
  shura: { id: 'shura', name: '素手の極み', desc: 'ブレイク中の敵への傷+4' },
  berserk: { id: 'berserk', name: '止まらない', desc: '闘志が高いと、体力が減るほど力が上がる' },
  warrior: { id: 'warrior', name: '大斧', desc: '砕の傷+3' },
  sniper: { id: 'sniper', name: '一点', desc: '弱点に当てると、盾を2つ割る' },
  ranger: { id: 'ranger', name: '野駆け', desc: '森の中でも傷+2、守り+2' },
  flamebow: { id: 'flamebow', name: '焔弓', desc: '火矢の傷+3' },
  archmage: { id: 'archmage', name: '理の重ね', desc: '魔法の傷+4' },
  hex: { id: 'hex', name: '刻印', desc: '呪った敵は、隠れた弱点が1つ見える' },
  necro: { id: 'necro', name: '死霊の声', desc: '闇の傷+3。宿敵の執念を削る' },
  seal: { id: 'seal', name: '封印', desc: '結界が2マス先まで届く' },
  bishop: { id: 'bishop', name: '大いなる癒し', desc: '癒しの量が増える' },
  holyknight: { id: 'holyknight', name: '聖域', desc: '馬に乗り、光の傷+2' },
  shadow: { id: 'shadow', name: '影渡り', desc: '動ける歩数が1多く、挟み討ちの傷がさらに+2' },
  farsight: { id: 'farsight', name: '読み切り', desc: '戦いのはじめに、敵将の隠れた弱点をすべて明かす' },
  trick: { id: 'trick', name: 'いたずら', desc: '戦いのはじめに、敵1人を混乱させる（盾−1）' },
  paladin: { id: 'paladin', name: '主を守る', desc: '先生の隣にいると、先生への攻撃をかばう' },
  greatknight: { id: 'greatknight', name: '重騎の突進', desc: '突撃の傷がさらに+3。守り+2' },
  wyvern: { id: 'wyvern', name: '急降下', desc: '空からの砕の傷+3' },
  bowknight: { id: 'bowknight', name: '矢の雨', desc: 'ふつうの攻撃が2回' },
  // 最上級（たたき台）
  saint_sword: { id: 'saint_sword', name: '無明', desc: '一度だけ、どんな盾も割る一閃', todo: true },
  unmoving: { id: 'unmoving', name: '不動', desc: '動かない番、だれも隣を抜けない', todo: true },
  breaker: { id: 'breaker', name: '城崩し', desc: '宿敵の戦場の壁を壊す', todo: true },
  thousand: { id: 'thousand', name: '千里の矢', desc: '盤のどこへでも届く' },
  allarts: { id: 'allarts', name: 'すべての理', desc: '炎・雷・氷・光・闇をすべて使う' },
  miracle: { id: 'miracle', name: '奇跡', desc: '戦いで一度、全員の傷を癒す', todo: true },
  ambush: { id: 'ambush', name: '闇討ち', desc: '戦いのはじめに、敵将1人をブレイク状態に' },
  trample: { id: 'trample', name: '蹂躙', desc: 'まっすぐ駆け抜けた線の敵すべてに当てる', todo: true },
  // 隠れた兵種（たたき台）
  oneeye: { id: 'oneeye', name: '隻眼', desc: '2マス先への射が必ず盾を割る' },
  avenger: { id: 'avenger', name: '仇討ち', desc: 'その宿敵との戦いで、すべての傷+5' },
  undying: { id: 'undying', name: '死に損ない', desc: '体力0になっても、1度だけ立ち上がる' },
  hunter_n: { id: 'hunter_n', name: '宿敵狩り', desc: '宿敵の盾を、最初から1つ少なくする' },
  oath: { id: 'oath', name: '盾の誓い', desc: 'かばった仲間は、その戦いで倒れない', todo: true },
  bare: { id: 'bare', name: '無刃', desc: '武器を持たない。打の傷+4、盾を割りやすい' },
  cursed: { id: 'cursed', name: '呪いの子', desc: '闇を使える。光に弱い' },
  twinstar: { id: 'twinstar', name: '双星', desc: '両想いの相手が隣にいると傷+3' },
  traitor: { id: 'traitor', name: '背信の剣', desc: '学校で習った技をすべて使う（敵だけ）', todo: true },
  storyteller: { id: 'storyteller', name: '語り部', desc: '後ろから、仲間の心を整える', todo: true },
};

type Def = {
  id: string; name: string; tier: 1 | 2 | 3 | 4; prereq: string[]; req: Partial<Record<SkillId, Rank>>; move: number; moveType: MoveType;
  weapons: WeaponType[]; atk: AtkType[]; traits: string[]; bonus: Partial<Stats>; growth: Partial<Stats>; desc: string; line: string;
  hidden?: boolean; unlock?: string;
};
export interface ClassDefX extends ClassDef { atk: AtkType[]; traits: string[]; line: string; unlock?: string }

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
  { id: 'spellblade', name: '魔剣士', tier: 2, line: 'sword', prereq: ['swordsman'], req: { sword: 'C', magic: 'D' }, move: 3, moveType: 'infantry', weapons: ['sword', 'magic'], atk: ['slash', 'fire'], traits: ['flameblade'], bonus: { hp: 1, str: 2, mag: 2, skl: 1, spd: 1 }, growth: { mag: 10, str: 5 }, desc: '斬りながら炎も当てる。' },
  { id: 'mercenary', name: '傭兵', tier: 2, line: 'sword', prereq: ['swordsman'], req: { sword: 'C', axe: 'D' }, move: 3, moveType: 'infantry', weapons: ['sword', 'axe'], atk: ['slash', 'crush'], traits: ['veteran'], bonus: { hp: 3, str: 3, def: 1 }, growth: { hp: 10, str: 5 }, desc: '剣も斧も使う、戦場慣れした兵。' },
  { id: 'pegasus_rider', name: 'ペガサスナイト', tier: 2, line: 'lance', prereq: ['lancer'], req: { lance: 'C', flying: 'D' }, move: 5, moveType: 'flying', weapons: ['lance'], atk: ['thrust'], traits: ['fly'], bonus: { str: 1, skl: 2, spd: 3, def: 1 }, growth: { spd: 10 }, desc: '天馬で空を行く。射に弱い。' },
  { id: 'standard', name: '旗手', tier: 2, line: 'lance', prereq: ['lancer'], req: { lance: 'C', command: 'D' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'banner'], bonus: { hp: 2, def: 2, skl: 1 }, growth: { hp: 5, def: 5 }, desc: '旗を掲げ、隣の仲間を奮い立たせる。' },
  { id: 'highlancer', name: '上槍兵', tier: 2, line: 'lance', prereq: ['lancer'], req: { lance: 'C' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['spear'], bonus: { hp: 2, str: 2, def: 2 }, growth: { str: 5, def: 10 }, desc: '槍の道をまっすぐ極める。' },
  { id: 'armor_knight', name: '重装兵', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C', heavy: 'D' }, move: 2, moveType: 'armor', weapons: ['axe', 'lance'], atk: ['crush'], traits: ['guard'], bonus: { hp: 3, str: 2, def: 5, spd: -1 }, growth: { def: 15, spd: -10 }, desc: '分厚い鎧で仲間をかばう。' },
  { id: 'brawler', name: '拳闘士', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C' }, move: 4, moveType: 'infantry', weapons: [], atk: ['blunt'], traits: ['barrage'], bonus: { hp: 2, str: 2, spd: 3 }, growth: { str: 5, spd: 10 }, desc: '拳で打つ。何度も打って盾を割る。' },
  { id: 'berserker_m', name: '狂戦士', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['frenzy'], bonus: { hp: 3, str: 4, def: -1 }, growth: { hp: 10, str: 15, def: -5 }, desc: '傷を負うほど荒れ狂う。' },
  { id: 'highaxe', name: '上斧兵', tier: 2, line: 'axe', prereq: ['fighter'], req: { axe: 'C' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['smash', 'axeplus'], bonus: { hp: 3, str: 3, def: 2 }, growth: { hp: 10, str: 10 }, desc: '斧の道をまっすぐ極める。' },
  { id: 'sharpshooter', name: '狙撃手', tier: 2, line: 'bow', prereq: ['archer'], req: { bow: 'C' }, move: 2, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['aim'], bonus: { skl: 4, str: 1 }, growth: { skl: 15 }, desc: '動かずに撃てば、遠くまで重く届く。' },
  { id: 'hunter', name: '狩人', tier: 2, line: 'bow', prereq: ['archer'], req: { bow: 'C' }, move: 4, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'hunt'], bonus: { skl: 2, spd: 3 }, growth: { spd: 10 }, desc: '野を駆け、獣も騎兵も射とめる。' },
  { id: 'firearcher', name: '火矢兵', tier: 2, line: 'bow', prereq: ['archer'], req: { bow: 'C', magic: 'E+' }, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot', 'fire'], traits: ['firearrow'], bonus: { skl: 2, mag: 2 }, growth: { mag: 5, skl: 5 }, desc: '燃える矢で、射と炎を同時に。' },
  { id: 'elementalist', name: '元素術師', tier: 2, line: 'magic', prereq: ['mage'], req: { magic: 'C' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['fire', 'thunder', 'ice'], traits: ['element'], bonus: { mag: 4, skl: 1 }, growth: { mag: 15 }, desc: '炎・雷・氷を、より強く。' },
  { id: 'hexer', name: '呪術師', tier: 2, line: 'magic', prereq: ['mage'], req: { magic: 'C' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark'], traits: ['curse'], bonus: { mag: 3, def: 1 }, growth: { mag: 10 }, desc: '闇の呪いで、敵の守りを削る。' },
  { id: 'warder', name: '結界術師', tier: 2, line: 'magic', prereq: ['mage'], req: { magic: 'C', faith: 'D' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['ice', 'light'], traits: ['barrier'], bonus: { mag: 2, def: 3 }, growth: { def: 10 }, desc: '結界で隣の仲間を守る。' },
  { id: 'priest', name: '司祭', tier: 2, line: 'heal', prereq: ['cleric'], req: { faith: 'C' }, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['mend', 'prayer'], bonus: { mag: 3, def: 2 }, growth: { mag: 10 }, desc: '祈りで、命の危険を一度だけ防ぐ。' },
  { id: 'lightmage', name: '光術士', tier: 2, line: 'heal', prereq: ['cleric'], req: { faith: 'C', magic: 'D' }, move: 3, moveType: 'infantry', weapons: ['holy', 'magic'], atk: ['light'], traits: ['judge'], bonus: { mag: 4, skl: 1 }, growth: { mag: 10, skl: 5 }, desc: '裁きの光で、蘇った者を討つ。' },
  { id: 'assassin', name: '暗殺者', tier: 2, line: 'dagger', prereq: ['thief'], req: { sword: 'C' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash', 'thrust'], traits: ['backstab'], bonus: { str: 2, skl: 2, spd: 4 }, growth: { spd: 10, str: 5 }, desc: '仲間と挟めば、深く斬る。' },
  { id: 'scout', name: '斥候', tier: 2, line: 'dagger', prereq: ['thief'], req: { sword: 'D', bow: 'D' }, move: 4, moveType: 'infantry', weapons: ['sword', 'bow'], atk: ['thrust', 'shot'], traits: ['spot', 'trap'], bonus: { skl: 3, spd: 3 }, growth: { skl: 10 }, desc: '罠を仕掛け、敵を見張る。' },
  { id: 'rogue', name: '盗賊', tier: 2, line: 'dagger', prereq: ['thief'], req: { sword: 'C' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['spot', 'pilfer'], bonus: { skl: 2, spd: 4 }, growth: { spd: 15 }, desc: '身軽で、戦いのあと稼ぎを持ち帰る。' },
  { id: 'knight', name: '騎士', tier: 2, line: 'cavalry', prereq: ['cavalier'], req: { lance: 'C', riding: 'C' }, move: 4, moveType: 'cavalry', weapons: ['sword', 'lance'], atk: ['slash', 'thrust'], traits: ['ride', 'charge'], bonus: { hp: 3, str: 2, def: 2 }, growth: { hp: 5, str: 5, def: 5 }, desc: '走って当てる突撃が得意。' },
  { id: 'dragoon', name: 'ドラグーン', tier: 2, line: 'cavalry', prereq: ['cavalier'], req: { riding: 'C', flying: 'D' }, move: 4, moveType: 'flying', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['roar'], bonus: { hp: 3, str: 3, def: 2, spd: -1 }, growth: { str: 10, def: 5 }, desc: '飛竜にまたがる。射に弱い。' },
  { id: 'bowrider', name: '弓騎兵', tier: 2, line: 'cavalry', prereq: ['cavalier'], req: { bow: 'C', riding: 'D' }, move: 5, moveType: 'cavalry', weapons: ['bow'], atk: ['shot'], traits: ['runshot', 'longshot'], bonus: { skl: 2, spd: 2 }, growth: { skl: 5, spd: 5 }, desc: '馬の上から撃つ。' },
  // ======================= 上級（26）3年目から =======================
  { id: 'swordmaster', name: 'ソードマスター', tier: 3, line: 'sword', prereq: ['kensei'], req: { sword: 'B' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['step', 'twin', 'master'], bonus: { hp: 3, str: 3, skl: 5, spd: 5 }, growth: { skl: 15, spd: 15 }, desc: '剣の道を極めた者。' },
  { id: 'runeknight', name: 'ルーンナイト', tier: 3, line: 'sword', prereq: ['spellblade'], req: { sword: 'B', magic: 'C' }, move: 3, moveType: 'infantry', weapons: ['sword', 'magic'], atk: ['slash', 'fire', 'thunder'], traits: ['flameblade', 'rune'], bonus: { hp: 2, str: 3, mag: 4, skl: 2 }, growth: { mag: 10, str: 10 }, desc: '剣に刻んだ文字で、雷も炎も。' },
  { id: 'brave', name: '勇者', tier: 3, line: 'sword', prereq: ['mercenary'], req: { sword: 'B', axe: 'C' }, move: 3, moveType: 'infantry', weapons: ['sword', 'axe'], atk: ['slash', 'crush'], traits: ['veteran', 'brave'], bonus: { hp: 4, str: 4, skl: 2, def: 2 }, growth: { hp: 10, str: 10 }, desc: 'いつも2回斬りつける。' },
  { id: 'falcon_knight', name: 'ファルコンナイト', tier: 3, line: 'lance', prereq: ['pegasus_rider'], req: { lance: 'B', flying: 'C' }, move: 6, moveType: 'flying', weapons: ['lance', 'sword'], atk: ['thrust', 'slash'], traits: ['fly', 'falcon'], bonus: { str: 2, skl: 3, spd: 5, def: 2 }, growth: { spd: 15 }, desc: '風のように空を駆ける。' },
  { id: 'warbanner', name: '将軍旗', tier: 3, line: 'lance', prereq: ['standard'], req: { lance: 'B', command: 'C' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['reach', 'banner', 'general_flag'], bonus: { hp: 3, def: 3, skl: 2 }, growth: { def: 10 }, desc: '旗で、まわりの仲間を奮い立たせる。' },
  { id: 'ironlancer', name: '鉄槍将', tier: 3, line: 'lance', prereq: ['highlancer'], req: { lance: 'B' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['spear', 'ironspear'], bonus: { hp: 3, str: 3, def: 4 }, growth: { str: 10, def: 10 }, desc: '3マス先まで届く鉄の槍。' },
  { id: 'general', name: 'ジェネラル', tier: 3, line: 'axe', prereq: ['armor_knight'], req: { axe: 'B', heavy: 'C' }, move: 2, moveType: 'armor', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['guard', 'fortress'], bonus: { hp: 5, str: 3, def: 7, spd: -1 }, growth: { def: 20, hp: 10 }, desc: 'かばっても倒れない城壁。' },
  { id: 'shura', name: '修羅', tier: 3, line: 'axe', prereq: ['brawler'], req: { axe: 'B' }, move: 4, moveType: 'infantry', weapons: [], atk: ['blunt'], traits: ['barrage', 'shura'], bonus: { hp: 3, str: 4, spd: 4 }, growth: { str: 10, spd: 10 }, desc: '崩れた敵を、拳で打ち抜く。' },
  { id: 'berserker', name: 'ベルセルク', tier: 3, line: 'axe', prereq: ['berserker_m'], req: { axe: 'B' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush'], traits: ['frenzy', 'berserk'], bonus: { hp: 5, str: 6, def: -1 }, growth: { hp: 15, str: 15 }, desc: '闘志が燃えるほど、止まらない。' },
  { id: 'warrior', name: 'ウォーリアー', tier: 3, line: 'axe', prereq: ['highaxe'], req: { axe: 'B' }, move: 3, moveType: 'infantry', weapons: ['axe', 'bow'], atk: ['crush', 'shot'], traits: ['smash', 'axeplus', 'warrior'], bonus: { hp: 5, str: 5, def: 2 }, growth: { hp: 10, str: 15 }, desc: '大斧で打ち砕く。弓も引く。' },
  { id: 'sniper', name: 'スナイパー', tier: 3, line: 'bow', prereq: ['sharpshooter'], req: { bow: 'B' }, move: 2, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['aim', 'sniper'], bonus: { skl: 6, str: 2 }, growth: { skl: 20 }, desc: '弱点を射抜き、盾を2つ割る。' },
  { id: 'ranger', name: 'レンジャー', tier: 3, line: 'bow', prereq: ['hunter'], req: { bow: 'B' }, move: 4, moveType: 'infantry', weapons: ['bow', 'sword'], atk: ['shot', 'slash'], traits: ['longshot', 'hunt', 'ranger'], bonus: { skl: 3, spd: 4, def: 1 }, growth: { spd: 10, skl: 5 }, desc: '森を知りつくした狩りの名手。' },
  { id: 'flamebow', name: '焔弓', tier: 3, line: 'bow', prereq: ['firearcher'], req: { bow: 'B', magic: 'D' }, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot', 'fire'], traits: ['firearrow', 'flamebow'], bonus: { skl: 3, mag: 4 }, growth: { mag: 10, skl: 10 }, desc: '焔の矢を降らせる。' },
  { id: 'archmage', name: '大魔道', tier: 3, line: 'magic', prereq: ['elementalist'], req: { magic: 'B' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['fire', 'thunder', 'ice'], traits: ['element', 'archmage'], bonus: { mag: 6, skl: 2 }, growth: { mag: 20 }, desc: '元素の理を重ねる大魔道。' },
  { id: 'warlock', name: '呪詛師', tier: 3, line: 'magic', prereq: ['hexer'], req: { magic: 'B' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark', 'fire'], traits: ['curse', 'hex'], bonus: { mag: 5, def: 1 }, growth: { mag: 15 }, desc: '呪った敵の隠れた弱点を見る。' },
  { id: 'necromancer', name: '死霊術士', tier: 3, line: 'magic', prereq: ['hexer'], req: { magic: 'B' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['dark'], traits: ['curse', 'necro'], bonus: { mag: 6 }, growth: { mag: 15, hp: 5 }, desc: '死霊の声で、宿敵の執念を削る。' },
  { id: 'sealer', name: '封印術師', tier: 3, line: 'magic', prereq: ['warder'], req: { magic: 'B', faith: 'C' }, move: 3, moveType: 'infantry', weapons: ['magic'], atk: ['ice', 'light'], traits: ['barrier', 'seal'], bonus: { mag: 4, def: 4 }, growth: { def: 10, mag: 5 }, desc: '広い結界で仲間を守る。' },
  { id: 'bishop', name: 'ビショップ', tier: 3, line: 'heal', prereq: ['priest'], req: { faith: 'B' }, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['mend', 'prayer', 'bishop'], bonus: { mag: 5, def: 3 }, growth: { mag: 15 }, desc: '大いなる癒しで仲間を支える。' },
  { id: 'holyknight', name: '聖騎士', tier: 3, line: 'heal', prereq: ['lightmage'], req: { faith: 'B', riding: 'D' }, move: 4, moveType: 'cavalry', weapons: ['holy', 'lance'], atk: ['light', 'thrust'], traits: ['judge', 'holyknight'], bonus: { hp: 3, mag: 4, def: 3 }, growth: { mag: 10, def: 5 }, desc: '馬に乗り、光で闇を討つ。' },
  { id: 'shadow', name: 'シャドウ', tier: 3, line: 'dagger', prereq: ['assassin'], req: { sword: 'B' }, move: 5, moveType: 'infantry', weapons: ['sword'], atk: ['slash', 'thrust'], traits: ['backstab', 'shadow'], bonus: { str: 3, skl: 3, spd: 6 }, growth: { spd: 15 }, desc: '影のように回りこむ。' },
  { id: 'farsight', name: '千里眼', tier: 3, line: 'dagger', prereq: ['scout'], req: { sword: 'C', bow: 'C' }, move: 4, moveType: 'infantry', weapons: ['sword', 'bow'], atk: ['thrust', 'shot'], traits: ['trap', 'farsight'], bonus: { skl: 5, spd: 3 }, growth: { skl: 15 }, desc: '敵将の弱点をすべて読み切る。' },
  { id: 'trickster', name: 'トリックスター', tier: 3, line: 'dagger', prereq: ['rogue'], req: { sword: 'B' }, move: 4, moveType: 'infantry', weapons: ['sword', 'magic'], atk: ['slash', 'thunder'], traits: ['pilfer', 'trick'], bonus: { skl: 3, spd: 5, mag: 2 }, growth: { spd: 10, mag: 5 }, desc: 'いたずらで敵の守りを崩す。' },
  { id: 'paladin', name: 'パラディン', tier: 3, line: 'cavalry', prereq: ['knight'], req: { lance: 'B', riding: 'B' }, move: 4, moveType: 'cavalry', weapons: ['sword', 'lance'], atk: ['slash', 'thrust'], traits: ['ride', 'charge', 'paladin'], bonus: { hp: 4, str: 3, def: 3, skl: 2 }, growth: { hp: 10, def: 10 }, desc: '先生を守る騎士。' },
  { id: 'greatknight', name: 'グレートナイト', tier: 3, line: 'cavalry', prereq: ['knight'], req: { lance: 'B', heavy: 'C' }, move: 3, moveType: 'cavalry', weapons: ['lance', 'axe'], atk: ['thrust', 'crush'], traits: ['charge', 'greatknight'], bonus: { hp: 5, str: 4, def: 5, spd: -1 }, growth: { def: 15, str: 5 }, desc: '鎧の騎士。突進で打ち崩す。' },
  { id: 'wyvernlord', name: 'ワイバーンロード', tier: 3, line: 'cavalry', prereq: ['dragoon'], req: { riding: 'B', flying: 'C' }, move: 5, moveType: 'flying', weapons: ['axe', 'lance'], atk: ['crush', 'thrust'], traits: ['roar', 'wyvern'], bonus: { hp: 4, str: 5, def: 3 }, growth: { str: 15, def: 5 }, desc: '飛竜の王。空から打ち砕く。' },
  { id: 'bowknight', name: 'ボウナイト', tier: 3, line: 'cavalry', prereq: ['bowrider'], req: { bow: 'B', riding: 'C' }, move: 5, moveType: 'cavalry', weapons: ['bow', 'sword'], atk: ['shot', 'slash'], traits: ['runshot', 'longshot', 'bowknight'], bonus: { skl: 4, spd: 3, str: 2 }, growth: { skl: 10, spd: 5 }, desc: '馬上から矢の雨を降らせる。' },
  // ======================= 最上級（8）卒業後、名を上げた子だけ（たたき台） =======================
  { id: 'sword_saint', name: '剣聖', tier: 4, line: 'sword', prereq: ['swordmaster', 'runeknight', 'brave'], req: { sword: 'A' }, move: 4, moveType: 'infantry', weapons: ['sword'], atk: ['slash'], traits: ['twin', 'master', 'saint_sword'], bonus: { hp: 4, str: 5, skl: 7, spd: 6 }, growth: { skl: 15 }, desc: '剣の頂。', unlock: '宿敵を討つ' },
  { id: 'lance_saint', name: '槍聖', tier: 4, line: 'lance', prereq: ['falcon_knight', 'warbanner', 'ironlancer'], req: { lance: 'A' }, move: 3, moveType: 'infantry', weapons: ['lance'], atk: ['thrust'], traits: ['spear', 'ironspear', 'unmoving'], bonus: { hp: 5, str: 5, def: 6 }, growth: { def: 10 }, desc: '槍の頂。', unlock: '守り抜く戦で将を退ける' },
  { id: 'castlebreaker', name: '破城', tier: 4, line: 'axe', prereq: ['general', 'shura', 'berserker', 'warrior'], req: { axe: 'A' }, move: 3, moveType: 'infantry', weapons: ['axe'], atk: ['crush', 'blunt'], traits: ['smash', 'warrior', 'breaker'], bonus: { hp: 7, str: 7, def: 4 }, growth: { str: 10 }, desc: '城門すら打ち砕く。', unlock: '砦攻めで勝つ' },
  { id: 'bow_saint', name: '弓聖', tier: 4, line: 'bow', prereq: ['sniper', 'ranger', 'flamebow'], req: { bow: 'A' }, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot', 'fire'], traits: ['aim', 'sniper', 'thousand'], bonus: { skl: 8, str: 3, spd: 3 }, growth: { skl: 15 }, desc: '弓の頂。', unlock: '逃げる宿敵を射とめる' },
  { id: 'sage', name: '賢者', tier: 4, line: 'magic', prereq: ['archmage', 'warlock', 'necromancer', 'sealer'], req: { magic: 'A' }, move: 3, moveType: 'infantry', weapons: ['magic', 'holy'], atk: ['fire', 'thunder', 'ice', 'light', 'dark'], traits: ['archmage', 'allarts'], bonus: { mag: 8, skl: 3, def: 2 }, growth: { mag: 15 }, desc: 'すべての理を使う。', unlock: '蘇った宿敵を退ける' },
  { id: 'holy_saint', name: '聖者', tier: 4, line: 'heal', prereq: ['bishop', 'holyknight'], req: { faith: 'A' }, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['mend', 'prayer', 'bishop', 'miracle'], bonus: { mag: 7, def: 4 }, growth: { mag: 10 }, desc: '奇跡を起こす癒し手。', unlock: '仲間の死を防ぐ' },
  { id: 'shadow_king', name: '影の王', tier: 4, line: 'dagger', prereq: ['shadow', 'farsight', 'trickster'], req: { sword: 'A' }, move: 5, moveType: 'infantry', weapons: ['sword'], atk: ['slash', 'thrust'], traits: ['backstab', 'farsight', 'ambush'], bonus: { str: 4, skl: 5, spd: 7 }, growth: { spd: 10 }, desc: '闇にまぎれて敵将を崩す。', unlock: '密偵として名を上げる' },
  { id: 'overlord', name: '覇騎', tier: 4, line: 'cavalry', prereq: ['paladin', 'greatknight', 'wyvernlord', 'bowknight'], req: { riding: 'A' }, move: 5, moveType: 'cavalry', weapons: ['sword', 'lance', 'axe'], atk: ['slash', 'thrust', 'crush'], traits: ['charge', 'greatknight', 'trample'], bonus: { hp: 6, str: 6, def: 5 }, growth: { str: 10 }, desc: '大軍を率いる騎兵の頂。', unlock: '大きな戦で軍を率いて勝つ' },
  // ======================= 隠れた兵種（たたき台：出来事で横道が開く） =======================
  { id: 'oneeye', name: '隻眼の射手', tier: 2, hidden: true, line: 'bow', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['bow'], atk: ['shot'], traits: ['longshot', 'oneeye'], bonus: { skl: 5 }, growth: { skl: 15 }, desc: '片目を奪われてなお、射る。', unlock: '宿敵に目を傷つけられる' },
  { id: 'avenger', name: '仇討ち', tier: 2, hidden: true, line: 'any', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['sword', 'lance', 'axe'], atk: ['slash', 'thrust', 'crush'], traits: ['avenger'], bonus: { str: 3, spd: 2 }, growth: { str: 10 }, desc: 'ただ一人の宿敵を討つために。', unlock: '宿敵に大切な人を奪われ、執念が燃えあがる' },
  { id: 'undying', name: '死に損ない', tier: 2, hidden: true, line: 'any', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['sword', 'axe'], atk: ['slash', 'crush'], traits: ['undying'], bonus: { hp: 6 }, growth: { hp: 15 }, desc: '二度、死の淵から戻った。', unlock: '大けがから2度生き延びる' },
  { id: 'nemhunter', name: '宿敵狩り', tier: 3, hidden: true, line: 'any', prereq: [], req: {}, move: 4, moveType: 'infantry', weapons: ['sword', 'lance', 'bow'], atk: ['slash', 'thrust', 'shot'], traits: ['hunter_n'], bonus: { str: 3, skl: 3 }, growth: { skl: 10 }, desc: '宿敵の盾を見抜く。', unlock: '宿敵を3人討つ' },
  { id: 'oathshield', name: '盾の誓い', tier: 2, hidden: true, line: 'any', prereq: [], req: {}, move: 2, moveType: 'armor', weapons: ['lance', 'axe'], atk: ['thrust', 'crush'], traits: ['guard', 'fortress'], bonus: { hp: 5, def: 6 }, growth: { def: 15 }, desc: '仲間をかばい続けた盾。', unlock: '仲間をかばって大けがを3度負う' },
  { id: 'bareblade', name: '無刃', tier: 2, hidden: true, line: 'any', prereq: [], req: {}, move: 4, moveType: 'infantry', weapons: [], atk: ['blunt'], traits: ['bare', 'barrage'], bonus: { str: 3, spd: 3 }, growth: { str: 10 }, desc: '武器を持たずに戦う。', unlock: '武器を持たずに勝つ' },
  { id: 'cursechild', name: '呪いの子', tier: 2, hidden: true, line: 'any', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['magic', 'sword'], atk: ['dark', 'slash'], traits: ['cursed', 'curse'], bonus: { mag: 4, str: 2 }, growth: { mag: 10 }, desc: '呪いで蘇った。', unlock: '呪いで蘇る' },
  { id: 'twinstar', name: '双星', tier: 2, hidden: true, line: 'any', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['sword', 'bow', 'magic'], atk: ['slash', 'shot', 'light'], traits: ['twinstar'], bonus: { skl: 3, spd: 2 }, growth: { skl: 10 }, desc: '想い合う二人の星。', unlock: '両想いの二人が、同じ宿敵戦で活躍する' },
  { id: 'storyteller', name: '語り部', tier: 4, hidden: true, line: 'any', prereq: [], req: {}, move: 3, moveType: 'infantry', weapons: ['staff', 'holy'], atk: ['light'], traits: ['storyteller'], bonus: { mag: 3, def: 2 }, growth: {}, desc: '後ろから、教え子の心を整える。', unlock: '卒業後、講師として学校に戻る' },
];

function cls(d: Def): ClassDefX {
  return { id: d.id, name: d.name, tier: d.tier, prereq: d.prereq, req: d.req, move: d.move, moveType: d.moveType, weapons: d.weapons, bonus: d.bonus, growth: d.growth, desc: d.desc, atk: d.atk, traits: d.traits, line: d.line, ...(d.hidden ? { hidden: true } : {}), ...(d.unlock ? { unlock: d.unlock } : {}) };
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
export function entryClassFor(skills: Partial<Record<SkillId, number>>): string {
  const sc = (k: SkillId) => skills[k] ?? 0;
  const cand: [string, number][] = [
    ['swordsman', sc('sword')], ['lancer', sc('lance')], ['fighter', sc('axe') + sc('heavy') * 0.3], ['archer', sc('bow') + sc('gun')],
    ['mage', sc('magic')], ['cleric', sc('faith')], ['thief', sc('sword') * 0.6 + sc('tactics') * 0.6], ['cavalier', sc('riding') + sc('flying') * 0.5 + sc('lance') * 0.3],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  return cand[0][1] > 0 ? cand[0][0] : 'swordsman';
}

/** 19夜目：古い兵種（68種・14種のたたき台）→ 新しい木 */
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
};
export function newClassId(old: string | null | undefined, skills?: Partial<Record<SkillId, number>>): string {
  if (!old) return skills ? entryClassFor(skills) : 'swordsman';
  if (old === 'novice') return skills ? entryClassFor(skills) : 'novice';
  if (OLD_MAP[old] && CLASSES[OLD_MAP[old]]) return OLD_MAP[old];
  if (CLASSES[old]) return old;
  return skills ? entryClassFor(skills) : 'swordsman';
}
export function traitsOf(classId: string): string[] { return CLASSES[classId]?.traits ?? []; }
export function hasTrait(classId: string, t: string): boolean { return traitsOf(classId).includes(t); }
