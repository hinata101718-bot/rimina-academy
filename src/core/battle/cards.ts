// 札の戦い（16夜目）：教えたことが手札になる。DOMに依存しない・シード付きの乱数。
// 山札は出撃した子の戦技・魔法・スキル札と先生の策。毎ターン手札を引き、行動力の分だけ出す。
// 敵は次の行動を予告し、それを読んで札を選ぶ。見えている数と中身は同じ（裏のマス目の戦いはない）。
import { B } from '../../data/balance';
import { ARTS, type CardFx, type ArtDef, type PerkId, type SkillCond } from '../../data/arts';
import { MAP_TAGS } from '../../data/stratagems';
import { WEAPONS } from '../../data/weapons';
import { CLASSES } from '../../data/classes';
import { STRATS, type StratId } from '../../data/stratagems';
import { LEGEND_BY_ID } from '../../data/rarity';
import { PROSE_LIGHT, PROSE_DENSE, PROSE_BRUTAL, PROSE_GRUNT_KILL, PROSE_DEEP, PROSE_FLEE, PROSE_ALUMNI_RETREAT, fallLines, proseKey, type ProseLevel } from '../../data/warprose';
import type { WeaponDef, SkillId } from '../types';
import type { GameState, Quest, Student } from '../state';
import type { BattleState, Unit } from './types';
import { finish, type BattleCtx } from './engine';
import { Rng } from '../rng';
import { loadoutOf, artPlus } from '../arts';
import { armoryItem } from '../loot';
import { abilitiesOf, healAmount, staffsOf, weaponOf } from './calc';
import { stratOdds, fireStrat } from '../stratagems';
import { officerById, survives } from '../officers';
import { clamp } from '../util';
import type { CardGuide } from './cardGuide';

/** シミュレーション用の数え（戦い・ターン・勝ち・時間切れ） */
export const cardStats = { battles: 0, turns: 0, wins: 0, timeouts: 0, timeoutWins: 0 };
// ---------- 型 ----------
export type CardKind = 'art' | 'spell' | 'skill' | 'basic' | 'strat' | 'item' | 'bloom' | 'legend';
export interface Card {
  id: string; kind: CardKind; name: string; fx: CardFx;
  /** 使う子の uid（策は 'teacher'） */
  owner: string;
  /** もとの技・魔法・策の id */
  src: string;
  plus?: boolean;
  /** 先週の授業で覚えた（出撃前の山札の ✦新） */
  fresh?: boolean;
  /** 技能（札の色分け） */
  skill?: SkillId | 'staff';
  /** 18夜目：連携技の相手（uid）と、相手の札のもとの id */
  partner?: string; src2?: string;
}
/** 敵の次の行動（予告） */
export interface Intent {
  uid: string;
  act: 'atk' | 'big' | 'art' | 'rage' | 'heal' | 'wait';
  name: string;
  target?: string; dmg: number; hits: number;
  /** 前列の誰か（まだ決まっていない） */
  front?: boolean;
  art?: string;
}
/** 結果の文の1行（文の窓）。cls＝色：ally・foe・dmg・heal・guard・strat・narr・prose・down・big */
export interface CLine {
  text: string; cls: string;
  /** 見せ場の大きな演出 */
  fx?: 'crit' | 'bloom' | 'legend' | 'kill' | 'fall' | 'strat';
  a?: string; d?: string;
  /** 会心の一撃の数・札の名前（演出用） */
  n?: number; card?: string;
}
export interface TurnRec { turn: number; lines: CLine[]; played: string[] }
export interface CardState {
  cards: Record<string, Card>;
  deck: string[]; hand: string[]; discard: string[];
  ap: number; apBase: number; handSize: number;
  turn: number; maxTurns: number;
  /** 前に出ている敵・控えの敵 */
  front: string[]; reserve: string[];
  intents: Intent[];
  /** このターンの守り・強め */
  t: { cover: { by: string; to: string }[]; wall: number; self: Record<string, number>; counter: Record<string, number>; team: { dmg: number; hit: number; crit: number }; first: string[]; plays?: Record<string, number>; killAp?: boolean };
  /** 次のターンの行動力+・手札+ */
  next: { ap: number; draw: number };
  stun: string[];
  deb: Record<string, { avo: number; atk: number; def: number }>;
  rage: Record<string, number>;
  /** 仲間が倒れた（条件で効くスキル） */
  allyDown: boolean;
  /** 18夜目：その子がつけている、条件や特別な効き目のあるスキル（uid → id） */
  sk?: Record<string, string[]>;
  /** 18夜目：1戦に1回のスキルを使った（「uid:スキルid」） */
  once?: string[];
  turns: TurnRec[];
  played: { turn: number; card: string; owner: string; name: string; kind: CardKind; kill?: boolean; crit?: boolean; dmg?: number; cover?: string; heal?: number; disobey?: boolean; tgt?: string }[];
  /** 'play'＝札を選ぶ、'result'＝結果を見る、'done'＝決着 */
  phase: 'play' | 'result' | 'done';
  /** 狙う敵（手で決めたとき） */
  target?: string;
  /** 17夜目：札の戦いの案内（最初の1戦の1ターン目だけ） */
  guide?: CardGuide;
  /** 17夜目：「戦い方が新しくなりました」を出す（今のセーブで遊んでいる人に1回だけ） */
  guideOffer?: boolean;
}

const rngOf = (b: BattleState) => new Rng(b as unknown as { rng: number });
const C = () => B.cards;
const alive = (u: Unit | undefined | null): u is Unit => !!u && !u.dead && u.hp > 0;

// ---------- 山札 ----------
const BASIC: Record<string, string> = { sword: '斬りつける', lance: '突く', axe: '叩きつける', bow: '射る', gun: '撃つ', magic: '魔法を放つ', holy: '光を放つ', none: '殴りかかる' };
function skillOfWeapon(w: WeaponDef | null): SkillId | 'staff' | undefined {
  if (!w) return undefined;
  return w.type === 'holy' ? 'faith' : w.type === 'staff' ? 'staff' : (w.type as SkillId);
}
/** その子の札（つけている戦技・魔法・札になるスキル・伝説の武器・道具、足りなければふつうの攻撃） */
export function studentCards(s: GameState, st: Student, u: Unit, fresh: Set<string> = new Set()): Omit<Card, 'id'>[] {
  const out: Omit<Card, 'id'>[] = [];
  const w = weaponOf(u);
  const wt = w?.type;
  for (const id of loadoutOf(st)) {
    const a = ARTS[id];
    if (a) {
      if (!a.card) continue;
      if (a.card.type === 'atk' && a.weapons && (!wt || !a.weapons.includes(wt))) continue;
      if (a.card.type === 'atk' && !w && !u.weapons.some((x) => WEAPONS[x] && WEAPONS[x].type !== 'staff')) continue;
      const plus = artPlus(st, a);
      out.push({ kind: a.bloom ? 'bloom' : a.kind === 'mind' ? 'skill' : 'art', name: a.name + (plus ? '＋' : ''), fx: plusFx(a.card, plus), owner: u.uid, src: a.id, plus, fresh: fresh.has(a.id), skill: a.skill });
      continue;
    }
    const sp = WEAPONS[id];
    if (!sp?.spell || !u.weapons.includes(id)) continue;
    if (sp.type === 'staff') out.push({ kind: 'spell', name: sp.name, fx: { type: 'heal', heal: healAmount(u, sp), all: false }, owner: u.uid, src: id, fresh: fresh.has(id), skill: 'staff' });
    else out.push({ kind: 'spell', name: sp.name, fx: { type: 'atk' }, owner: u.uid, src: id, fresh: fresh.has(id), skill: skillOfWeapon(sp) });
  }
  // 伝説の武器の札（14夜目の専用のスキル）
  const item = armoryItem(s, u.armoryUid ?? null);
  const lg = item?.legend ? LEGEND_BY_ID[item.legend] : null;
  if (lg && w) out.unshift({ kind: 'legend', name: lg.art, fx: { type: 'atk', mul: 1.8, crit: 20 }, owner: u.uid, src: `legend:${lg.id}`, skill: skillOfWeapon(w) });
  if (u.item) out.push({ kind: 'item', name: u.item === 'elixir' ? '特効薬' : '傷薬', fx: { type: 'heal', heal: u.item === 'elixir' ? 99 : B.battle.vulnerary * 2, self: 1 } as CardFx, owner: u.uid, src: `item:${u.item}`, skill: 'staff' });
  // 足りない分は、ふつうの攻撃（攻撃できない子は、いちばん強い回復）
  const atkW = w ?? u.weapons.map((x) => WEAPONS[x]).find((x) => x && x.type !== 'staff') ?? null;
  const staff = staffsOf(u).sort((a, b) => b.might - a.might)[0];
  while (out.length < C().perMin) {
    if (atkW) out.push({ kind: 'basic', name: atkW.spell ? atkW.name : BASIC[atkW.type] ?? BASIC.none, fx: { type: 'atk' }, owner: u.uid, src: atkW.spell ? atkW.id : 'basic', skill: skillOfWeapon(atkW) });
    else if (staff) out.push({ kind: 'spell', name: staff.name, fx: { type: 'heal', heal: healAmount(u, staff) }, owner: u.uid, src: staff.id, skill: 'staff' });
    else out.push({ kind: 'basic', name: BASIC.none, fx: { type: 'atk' }, owner: u.uid, src: 'basic' });
  }
  return out.slice(0, C().perMax);
}
function plusFx(f: CardFx, plus: boolean): CardFx {
  if (!plus) return f;
  const m = B.cards ? 1.25 : 1;
  const g: CardFx = { ...f };
  if (g.type === 'atk') g.mul = Math.round((g.mul ?? 1) * m * 100) / 100;
  if (g.heal) g.heal = Math.round(g.heal * m);
  if (g.wall) g.wall += 1;
  if (g.self) g.self += 1;
  if (g.team) g.team = { dmg: g.team.dmg ? g.team.dmg + 1 : g.team.dmg, hit: g.team.hit, crit: g.team.crit };
  return g;
}
/** 先生の策の札 */
export function stratCards(ids: StratId[]): Omit<Card, 'id'>[] {
  return ids.filter((id) => STRATS[id]).map((id) => ({ kind: 'strat' as const, name: STRATS[id].name, fx: { type: 'buff' } as CardFx, owner: 'teacher', src: `strat:${id}` }));
}
/** 出撃前の山札（画面の「出撃前 ― 山札を見る」と同じもの） */
export function previewDeck(s: GameState, b: BattleState): { owner: string; cards: Omit<Card, 'id'>[] }[] {
  const fresh = freshIds(s);
  const out: { owner: string; cards: Omit<Card, 'id'>[] }[] = [];
  for (const u of b.units) {
    if (u.side !== 'player' || !u.studentId) continue;
    const st = s.students[u.studentId];
    if (st) out.push({ owner: u.uid, cards: studentCards(s, st, u, fresh) });
  }
  out.push({ owner: 'teacher', cards: stratCards(b.auto?.planStrats ?? []) });
  return out;
}
/** 先週（この1か月）に覚えた技・魔法 */
function freshIds(s: GameState): Set<string> {
  const out = new Set<string>();
  for (const st of Object.values(s.students)) {
    if (st.status !== 'enrolled') continue;
    for (const p of st.recentLearn ?? []) if (s.absWeek - p.week <= 4) out.add(p.id);
  }
  return out;
}

// ---------- はじめ ----------
export function frontSize(n: number): number { const f = C().front; return n >= 9 ? f[2] : n >= 7 ? f[1] : f[0]; }
/** 札の戦いを用意する（buildBattle のあと）。山札を作って混ぜ、前に出る敵を決め、最初の手札と予告まで */
export function initCards(s: GameState, b: BattleState, strats: StratId[]): void {
  const r = rngOf(b);
  const members = b.units.filter((u) => u.side === 'player' && u.studentId);
  const fresh = freshIds(s);
  const cards: Record<string, Card> = {};
  let n = 0;
  for (const u of members) {
    const st = s.students[u.studentId!];
    if (!st) continue;
    for (const c of studentCards(s, st, u, fresh)) { const id = `c${n++}`; cards[id] = { ...c, id }; }
  }
  for (const c of stratCards(strats)) { const id = `c${n++}`; cards[id] = { ...c, id }; }
  let deck = r.shuffle(Object.keys(cards));
  // 策を立てる子の軍略で、策の札が手札に来やすい
  const planner = b.auto?.plan?.planner ? s.students[b.auto.plan.planner] : null;
  const pTop = C().stratTop + (planner?.strat ?? 0) / C().stratPerStrat;
  for (const id of deck.filter((x) => cards[x].kind === 'strat')) if (r.chance(pTop)) { deck = deck.filter((x) => x !== id); deck.splice(r.int(0, 3), 0, id); }
  const nMem = members.length;
  const ap = clamp(C().ap + Math.floor(Math.max(0, nMem - 4) / C().apPerMembers), C().ap, C().apMax);
  const L = b.auto?.leader;
  const foes = b.units.filter((u) => u.side === 'enemy' && !u.dead);
  // 前に出る敵：卒業生・敵将（勝利条件が敵将のとき）・ほかは並び順
  const order = [...foes].sort((x, y) => rank(y) - rank(x));
  // 敵将：勝利条件が敵将なら、はじめから前に。ほかの戦いでは、兵が倒れてから前に出てくる（16夜目の調整2）
  function rank(u: Unit) { return (u.uid === L?.uid ? (b.objective === 'boss' || b.objective === 'seize' ? 3 : -1) : 0) + (u.persuadable ? 2 : 0) + (u.boss && u.uid !== L?.uid ? 1 : 0); }
  // 敵将は手ごわく（一撃で決着しないように）
  const lu = L ? b.units.find((u) => u.uid === L.uid) : null;
  if (lu && !lu.persuadable) { lu.maxHp = Math.round(lu.maxHp * C().leaderHp); lu.hp = lu.maxHp; }
  const fs = frontSize(nMem);
  const front = order.slice(0, fs).map((u) => u.uid);
  const reserve = order.slice(fs).map((u) => u.uid);
  b.rng = r.h.rng;
  const cs: CardState = {
    cards, deck, hand: [], discard: [], ap, apBase: ap, handSize: C().hand + (ap - C().ap),
    turn: 1, maxTurns: C().turns[b.objective] ?? 5,
    front, reserve, intents: [],
    t: freshTurn(), next: { ap: 0, draw: 0 }, stun: [], deb: {}, rage: {}, allyDown: false,
    turns: [], played: [], phase: 'play',
  };
  b.auto!.cards = cs;
  b.turn = 1;
  // 18夜目：戦いのはじめに効くスキル（最大HP・1ターン目の行動力・札を多く引く）
  let ap1 = 0;
  for (const u of members) {
    const hp = perkN(s, b, u, 'hp');
    if (hp) { u.maxHp += hp; u.hp += hp; }
    ap1 = Math.max(ap1, perkN(s, b, u, 'apOnce'));
  }
  cs.ap += Math.min(C().perkApMax, ap1);
  draw(b, cs.handSize + drawBonus(s, b));
  makeIntents(s, b);
}
/** 18夜目：ターンのはじめに札を多く引くスキル（出撃している子の合計。上限あり） */
function drawBonus(s: GameState, b: BattleState): number {
  let n = 0;
  for (const u of b.units) if (u.side === 'player' && alive(u) && !b.retreated.includes(u.uid)) n += perkN(s, b, u, 'drawPlus');
  return Math.min(C().perkDrawMax, n);
}
function freshTurn(): CardState['t'] { return { cover: [], wall: 0, self: {}, counter: {}, team: { dmg: 0, hit: 0, crit: 0 }, first: [] }; }

/** 手札を引く（山札がなくなったら捨て札を混ぜ直す）。倒れた子の札は来ない */
export function draw(b: BattleState, n: number): void {
  const cs = b.auto!.cards!;
  const r = rngOf(b);
  let guard = 0;
  while (cs.hand.length < n && guard++ < 200) {
    if (!cs.deck.length) {
      if (!cs.discard.length) break;
      cs.deck = r.shuffle(cs.discard.filter((id) => usable(b, cs.cards[id])));
      cs.discard = cs.discard.filter((id) => !usable(b, cs.cards[id]));
      if (!cs.deck.length) break;
    }
    const id = cs.deck.shift()!;
    if (!usable(b, cs.cards[id])) { cs.discard.push(id); continue; }
    cs.hand.push(id);
  }
  b.rng = r.h.rng;
}
/** その札を使える（使う子が倒れていない） */
export function usable(b: BattleState, c: Card | undefined): boolean {
  if (!c) return false;
  if (c.owner === 'teacher') return true;
  const u = b.units.find((x) => x.uid === c.owner);
  return alive(u) && !b.retreated.includes(u.uid) && (c.kind !== 'item' || !!u.item);
}

// ---------- 数の計算 ----------
function sumAb(u: Unit, key: 'hit' | 'avo' | 'crit' | 'dmg' | 'prot' | 'pierce' | 'adjAllyDef' | 'adjAllyProt'): number {
  const wt = u.weaponId ? WEAPONS[u.weaponId]?.type : undefined;
  return abilitiesOf(u).reduce((s, a) => s + (a.wtype && (!wt || !a.wtype.includes(wt)) ? 0 : ((a[key] as number | undefined) ?? 0)), 0);
}
/** 18夜目：その子がつけているスキルのうち、条件や特別な効き目のあるもの（戦いのはじめに一度だけ調べる） */
function skOf(s: GameState | null, b: BattleState, u: Unit): ArtDef[] {
  if (!u.studentId || !s) return [];
  const cs = b.auto?.cards;
  if (cs?.sk?.[u.uid]) return cs.sk[u.uid].map((id) => ARTS[id]).filter(Boolean);
  const st = s.students[u.studentId];
  const list = st ? loadoutOf(st).map((id) => ARTS[id]).filter((a): a is ArtDef => !!a && a.kind === 'mind' && (!!a.cond || !!a.perk)) : [];
  if (cs) (cs.sk ??= {})[u.uid] = list.map((a) => a.id);
  return list;
}
/** 戦場の地形の印（森・砦など） */
function tagsOf(s: GameState | null, b: BattleState): string[] {
  const q = s?.quests.find((x) => x.id === b.questId);
  return q ? MAP_TAGS[q.template] ?? [] : [];
}
/** 条件に合うか（16夜目の5つ＋18夜目の9つ） */
function condOk(s: GameState | null, b: BattleState, u: Unit, foe: Unit | null, first: boolean, c: SkillCond | undefined): boolean {
  if (!c) return true;
  const cs = b.auto?.cards;
  const L = b.auto?.leader;
  switch (c) {
    case 'lowHp': return u.hp <= u.maxHp / 2;
    case 'fullHp': return u.hp >= u.maxHp;
    case 'allyDown': return !!cs?.allyDown;
    case 'first': return first;
    case 'vsLeader': return !!foe && foe.uid === L?.uid;
    case 'tri': return !!foe && triangleOf(weaponOf(u), weaponOf(foe)) > 0;
    case 'front': return u.row !== 'back';
    case 'back': return u.row === 'back';
    case 'field': return b.weather === 'fog' || tagsOf(s, b).includes('forest');
    case 'clear': return b.weather === 'clear';
    case 'lastTurn': return !!cs && cs.turn >= cs.maxTurns;
    case 'turn1': return !!cs && cs.turn === 1;
    case 'vsStrong': return !!foe && foe.level > u.level;
    case 'vsStun': return !!foe && !!cs && (cs.stun.includes(foe.uid) || !!cs.deb[foe.uid] && (cs.deb[foe.uid].avo + cs.deb[foe.uid].atk + cs.deb[foe.uid].def) > 0);
  }
  return false;
}
/** 18夜目：その子の特別な効き目の強さ（条件に合うものの合計） */
export function perkN(s: GameState | null, b: BattleState, u: Unit, id: PerkId, foe: Unit | null = null, first = false): number {
  let n = 0;
  for (const a of skOf(s, b, u)) if (a.perk?.id === id && condOk(s, b, u, foe, first, a.cond)) n += a.perk.n;
  return n;
}
/** 条件で効くスキル（16夜目）：その子がつけているもののうち、今の条件に合うもの */
function condBonus(s: GameState | null, b: BattleState, u: Unit, foe: Unit | null, first: boolean): { dmg: number; hit: number; crit: number; avo: number; prot: number } {
  const out = { dmg: 0, hit: 0, crit: 0, avo: 0, prot: 0 };
  for (const a of skOf(s, b, u)) {
    if (!a.cond || !a.ability || !condOk(s, b, u, foe, first, a.cond)) continue;
    const ab = a.ability;
    if (ab.wtype && !ab.wtype.includes(WEAPONS[u.weaponId ?? '']?.type as never)) continue;
    out.dmg += ab.dmg ?? 0; out.hit += ab.hit ?? 0; out.crit += ab.crit ?? 0; out.avo += ab.avo ?? 0; out.prot += ab.prot ?? 0;
  }
  return out;
}
/** 18夜目：前列の仲間の受ける傷を減らすスキル（城壁）。いちばん大きいもの */
function teamProtOf(s: GameState | null, b: BattleState, d: Unit): number {
  if (d.side === 'enemy' || d.row === 'back') return 0;
  let n = 0;
  for (const m of b.units) if (m.side === d.side && alive(m) && m.row !== 'back') n = Math.max(n, perkN(s, b, m, 'teamProt'));
  return n;
}
/** 18夜目：1戦に1回のスキル（使ったら印をつける） */
function useOnce(b: BattleState, u: Unit, id: string): boolean {
  const cs = b.auto!.cards!;
  const k = `${u.uid}:${id}`;
  if ((cs.once ??= []).includes(k)) return false;
  cs.once.push(k);
  return true;
}
const BEATS: Record<string, string> = { sword: 'axe', axe: 'lance', lance: 'sword' };
export function triangleOf(a: WeaponDef | null, d: WeaponDef | null): number {
  if (!a || !d) return 0;
  if (BEATS[a.type] === d.type) return 1;
  if (BEATS[d.type] === a.type) return -1;
  return 0;
}
/** 支援の効き目：一緒に出撃している仲間との支援（いちばん高い2人まで） */
function supportOf(b: BattleState, ctx: BattleCtx | null, u: Unit): { hit: number; avo: number; crit: number; dmg: number } {
  const out = { hit: 0, avo: 0, crit: 0, dmg: 0 };
  if (!ctx || !u.studentId || u.abilities.includes('lone_wolf')) return out;
  const vs = b.units.filter((o) => o !== u && alive(o) && o.studentId && o.side === u.side).map((o) => ctx.support(u.studentId!, o.studentId!)).filter((v) => v >= B.support.C).sort((x, y) => y - x).slice(0, B.support.maxPartners);
  for (const v of vs) { const r = v >= B.support.A ? B.support.battle.A : v >= B.support.B ? B.support.battle.B : B.support.battle.C; out.hit += r.hit; out.avo += r.avo; out.crit += r.crit; out.dmg += r.dmg; }
  return out;
}
export interface Hit { dmg: number; hit: number; crit: number; hits: number; tri: number; eff: boolean; w: WeaponDef | null }
/**
 * 攻撃の見こみ（札の数字と、実際の計算は同じ）。fx＝札の効き目、foe＝敵の行動のとき
 */
export function strikeCalc(s: GameState | null, b: BattleState, ctx: BattleCtx | null, a: Unit, d: Unit, fx: CardFx, wOverride?: WeaponDef | null, first = false): Hit {
  const cs = b.auto?.cards;
  const w = wOverride !== undefined ? wOverride : weaponOf(a) ?? a.weapons.map((x) => WEAPONS[x]).find((x) => x && x.type !== 'staff') ?? null;
  const dw = weaponOf(d);
  const tri = w && w.type !== 'gun' ? triangleOf(w, dw && dw.type !== 'gun' ? dw : null) : 0;
  const dType = (CLASSES[d.classId] ?? CLASSES.novice).moveType;
  const eff = !!w && ((w.effective ?? []).includes(dType) || abilitiesOf(a).some((ab) => (ab.effective ?? []).includes(dType)));
  const magical = w?.type === 'magic' || w?.type === 'holy';
  const sa = supportOf(b, ctx, a), sd = supportOf(b, ctx, d);
  const ca = condBonus(s, b, a, d, first), cd = condBonus(s, b, d, a, false);
  let might = (w?.might ?? 0) + tri * B.battle.triangleMight;
  if (eff) might *= B.battle.effectiveMul;
  let fHit = 0, fDmg = 0;
  for (const fm of d.foeMods ?? []) if ((!fm.types || (w && fm.types.includes(w.type))) && (!fm.moveTypes || fm.moveTypes.includes((CLASSES[a.classId] ?? CLASSES.novice).moveType))) { fHit += fm.hit ?? 0; fDmg += fm.dmg ?? 0; }
  const ally = a.side !== 'enemy';
  const team = ally && cs ? cs.t.team : { dmg: 0, hit: 0, crit: 0 };
  const vs = fx.vsMove?.includes(dType) ? 6 : 0;
  // 18夜目：前の敵すべて・何回も打つ札を強めるスキル
  const pk = ally ? (fx.aoe ? perkN(s, b, a, 'aoePlus', d) : 0) + ((fx.hits ?? 1) > 1 ? perkN(s, b, a, 'multiPlus', d) : 0) : 0;
  let atk = (magical ? a.stats.mag : a.stats.str) + might + sa.dmg + sumAb(a, 'dmg') + (a.mod?.dmg ?? 0) + fDmg + ca.dmg + team.dmg + (fx.flat ?? 0) + vs + pk;
  if (!ally && cs) atk += (cs.rage[a.uid] ?? 0) - (cs.deb[a.uid]?.atk ?? 0);
  let defStat = magical ? d.stats.res : d.stats.def;
  defStat += (d.mod?.def ?? 0) - (cs?.deb[d.uid]?.def ?? 0) - (fx.pierce ?? 0) - sumAb(a, 'pierce');
  if (magical && d.ward) defStat += d.ward;
  if (w?.type === 'gun') defStat = Math.floor(defStat * B.battle.gunDefPierce);
  const prot = sumAb(d, 'prot') + cd.prot + (ally ? 0 : teamProtOf(s, b, d));
  const mul = (fx.mul ?? 1) * (ally ? C().dmgMul : C().foeMul);
  const dmg = Math.max(1, Math.round((atk - Math.max(0, defStat)) * mul) - prot);
  let hit = (w?.hit ?? 80) + a.stats.skl * 2 + a.stats.lck / 2 + tri * B.battle.triangleHit + sa.hit + sumAb(a, 'hit') + (a.mod?.hit ?? 0) + fHit + ca.hit + team.hit + (fx.hit ?? 0) + (ally ? C().hitPlus : C().foeHitPlus);
  const avo = d.stats.spd * 2 + d.stats.lck + sd.avo + sumAb(d, 'avo') + (d.mod?.avo ?? 0) + cd.avo - (cs?.deb[d.uid]?.avo ?? 0);
  hit = clamp(Math.round(hit - avo), ally ? 35 : 25, 100);
  // 敵の攻撃は、予告どおりの数（会心はない。読めば守れるように）
  const tc = ally && a.studentId && s ? perkN(s, b, a, 'trustCrit') : 0;
  const trustC = tc ? Math.floor((s!.students[a.studentId!]?.trust ?? 0) / tc) : 0;
  const crit = !ally ? 0 : clamp(Math.round((w?.crit ?? 0) + a.stats.skl / 2 + sa.crit + sumAb(a, 'crit') + (a.mod?.crit ?? 0) + ca.crit + team.crit + (fx.crit ?? 0) + trustC - d.stats.lck), 0, 100);
  return { dmg, hit, crit, hits: fx.hits ?? 1, tri, eff, w };
}
/** 札の武器：魔法の札はその魔法、戦技はその子の武器 */
function cardWeapon(u: Unit, c: Card): WeaponDef | null {
  if (c.kind === 'spell' || (c.kind === 'basic' && WEAPONS[c.src]?.spell)) return WEAPONS[c.src] ?? null;
  return weaponOf(u) ?? u.weapons.map((x) => WEAPONS[x]).find((x) => x && x.type !== 'staff') ?? null;
}
/** 札の狙い（手で決めた敵か、倒しやすい敵・敵将） */
export function defaultTarget(b: BattleState): Unit | null {
  const cs = b.auto!.cards!;
  const fr = cs.front.map((id) => b.units.find((u) => u.uid === id)).filter(alive);
  if (cs.target) { const t = fr.find((u) => u.uid === cs.target); if (t) return t; }
  if (b.focus) { const t = fr.find((u) => u.uid === b.focus); if (t) return t; }
  return [...fr].sort((x, y) => x.hp - y.hp)[0] ?? null;
}
/** 札の見こみの数（画面の札に出す） */
export function cardPreview(s: GameState, b: BattleState, ctx: BattleCtx | null, id: string): { text: string; dmg?: number; hits?: number; hit?: number; tri?: number; heal?: number; odds?: number } {
  const cs = b.auto!.cards!;
  const c = cs.cards[id];
  if (!c) return { text: '' };
  const u = b.units.find((x) => x.uid === c.owner);
  if (c.kind === 'strat') {
    const sid = c.src.slice(6) as StratId;
    const q = s.quests.find((x) => x.id === b.questId) ?? ({ template: 'training', weather: b.weather, objective: b.objective } as Quest);
    const plan = b.auto?.plan ?? {};
    const o = officerById(s, b.auto?.leader?.officerId);
    const members = b.units.filter((x) => x.side === 'player' && x.studentId && alive(x)).map((x) => s.students[x.studentId!]).filter(Boolean);
    const od = stratOdds(sid, { q, planner: plan.planner ? s.students[plan.planner] : null, captain: plan.captain ? s.students[plan.captain] : null, members, traits: o?.traits ?? [], known: o?.knownTraits ?? [], early: true });
    return { text: `${STRATS[sid].tip}`, odds: od.dud ? 0 : od.rate };
  }
  if (!u) return { text: '' };
  const f = c.fx;
  if (f.type === 'atk') {
    const t = defaultTarget(b);
    if (!t) return { text: '' };
    const h = strikeCalc(s, b, ctx, u, t, f, cardWeapon(u, c), cs.t.first.length === 0);
    const n = h.hits;
    return { text: `${f.aoe ? '前の敵すべてに' : ''}${n > 1 ? `${n}回 ${h.dmg}×${n}` : `${h.dmg}`}${f.stun ? '・止める' : ''}${f.debuff ? `・${{ avo: '回避', atk: '攻撃', def: '守り' }[f.debuff]}−${f.amt}` : ''}`, dmg: h.dmg, hits: n, hit: h.hit, tri: h.tri };
  }
  if (f.type === 'heal') { const amt = healOf(u, c, s, b); return { text: f.all ? `みんなHP+${amt}` : c.kind === 'item' ? `自分のHP+${amt}` : `HP+${amt}`, heal: amt }; }
  if (f.type === 'guard') return { text: [f.cover ? `${coverTarget(b, u)?.name ?? '仲間'}をかばう` : '', f.wall ? `みんな受ける傷−${f.wall}` : '', f.self ? `自分の受ける傷−${f.self}` : '', f.counter ? '反撃' : ''].filter(Boolean).join('・') };
  return { text: [f.team?.dmg ? `みんな威力+${f.team.dmg}` : '', f.team?.hit ? `命中+${f.team.hit}` : '', f.team?.crit ? `必殺+${f.team.crit}` : '', f.ap ? `次のターン行動力+${f.ap}` : '', f.draw ? `次のターン札+${f.draw}` : ''].filter(Boolean).join('・') };
}
function healOf(u: Unit, c: Card, s: GameState | null = null, b: BattleState | null = null): number {
  const f = c.fx;
  if (c.kind === 'item') return Math.min(f.heal ?? 10, u.maxHp);
  const base = (f.heal ?? 8) + (s && b ? perkN(s, b, u, 'backHeal') : 0);
  return c.kind === 'spell' ? base : base + Math.floor(u.stats.mag / 3);
}
/** かばう相手：敵の予告でいちばん傷を受けそうな仲間（自分のほか） */
export function coverTarget(b: BattleState, u: Unit): Unit | null {
  const cs = b.auto!.cards!;
  const inc = incoming(b);
  const mates = b.units.filter((x) => (x.side === 'player' || x.side === 'npc') && alive(x) && x !== u && !b.retreated.includes(x.uid));
  if (!mates.length) return null;
  const covered = new Set(cs.t.cover.map((c) => c.to));
  return [...mates].sort((x, y) => Number(covered.has(x.uid)) - Number(covered.has(y.uid)) || (inc[y.uid] ?? 0) / Math.max(1, y.hp) - (inc[x.uid] ?? 0) / Math.max(1, x.hp))[0];
}
/** 予告から、それぞれの味方が受けそうな傷 */
export function incoming(b: BattleState): Record<string, number> {
  const cs = b.auto!.cards!;
  const out: Record<string, number> = {};
  const fronts = b.units.filter((u) => u.side === 'player' && alive(u) && u.row !== 'back');
  for (const it of cs.intents) {
    if (cs.stun.includes(it.uid)) continue;
    const tot = it.dmg * it.hits;
    if (it.target) out[it.target] = (out[it.target] ?? 0) + tot;
    else if (it.front && fronts.length) for (const f of fronts) out[f.uid] = (out[f.uid] ?? 0) + tot / fronts.length;
  }
  return out;
}

// ---------- 敵の予告 ----------
function isRanged(u: Unit): boolean { const w = weaponOf(u); return !!w && (w.type === 'bow' || w.type === 'magic' || w.type === 'holy' || w.type === 'gun'); }
/** 敵の次の行動を決める（予告）。狙う相手も、ここで決まる（前列の誰か、のときは打つときに決める） */
export function makeIntents(s: GameState | null, b: BattleState): void {
  const cs = b.auto!.cards!;
  const r = rngOf(b);
  const L = b.auto?.leader;
  const mates = b.units.filter((u) => (u.side === 'player' || u.side === 'ally') && alive(u) && !b.retreated.includes(u.uid));
  const npc = b.units.find((u) => u.side === 'npc' && alive(u) && (u.escort || u.captive === false));
  cs.intents = [];
  // 18夜目：前列で敵の狙いを引きつける子（引きつけ）
  const tauntOf = (m: Unit) => m.row !== 'back' && m.hp > m.maxHp * 0.35 && perkN(s, b, m, 'taunt') > 0;
  for (const uid of cs.front) {
    const e = b.units.find((u) => u.uid === uid);
    if (!alive(e) || !mates.length) continue;
    // 回復役の敵：傷ついた仲間がいれば癒やす
    const hurt = cs.front.map((x) => b.units.find((u) => u.uid === x)).filter(alive).filter((x) => x.hp < x.maxHp * 0.6);
    if (staffsOf(e).length && hurt.length && !weaponOf(e)) { const t = hurt.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; cs.intents.push({ uid, act: 'heal', name: '癒やし', target: t.uid, dmg: healAmount(e), hits: 1 }); continue; }
    if (!weaponOf(e)) { cs.intents.push({ uid, act: 'wait', name: '様子をうかがう', dmg: 0, hits: 0 }); continue; }
    const isL = uid === L?.uid;
    // 狙い：執着している子・銃や弓や魔法は誰でも（弱った子・後列）・ほかは前列
    let target: Unit | null = null; let front = false;
    const grudge = e.grudge ? mates.find((m) => m.uid === e.grudge) : null;
    if (grudge) target = grudge;
    else if (npc && (b.objective === 'defend' || b.objective === 'escort') && r.chance(0.3)) target = npc;
    else if (isRanged(e)) target = r.weighted(mates, (m) => (1 + (m.row === 'back' ? 1 : 0) + (1 - m.hp / m.maxHp) * 2) * (tauntOf(m) ? 2 : 1));
    else {
      const fr = mates.filter((m) => m.row !== 'back');
      target = r.weighted(fr.length ? fr : mates, (m) => (1 + (1 - m.hp / m.maxHp) * 1.5 + (m.side === 'ally' ? 0.5 : 0)) * (tauntOf(m) ? 4 : 1));
      front = false;
    }
    let act: Intent['act'] = 'atk'; let fx: CardFx = { type: 'atk' }; let name = attackName(e); let art: string | undefined;
    const arts = (e.arts ?? []).map((id) => ARTS[id]).filter((a) => a?.card?.type === 'atk' && !a.card.aoe && !a.card.stun && !a.card.debuff && ((a.card.mul ?? 1) * (a.card.hits ?? 1) >= 1 || !!a.card.crit));
    const roll = r.next();
    if (isL && roll < C().leaderRage && !cs.rage[uid]) { cs.intents.push({ uid, act: 'rage', name: '怒りの構え（次の攻撃が上がる）', dmg: 0, hits: 0 }); continue; }
    if (arts.length && roll < (isL ? C().leaderArt + C().leaderRage : 0.2)) { const a = r.pick(arts); act = 'art'; fx = a.card!; name = a.name; art = a.id; }
    else if (isL && roll < C().leaderArt + C().leaderRage + C().leaderBig) { act = 'big'; fx = { type: 'atk', mul: C().bigMul }; name = '大振り'; }
    const h = strikeCalc(s, b, null, e, target ?? mates[0], fx);
    cs.intents.push({ uid, act, name, target: target?.uid, front, dmg: h.dmg, hits: h.hits, art });
  }
  b.rng = r.h.rng;
}
function attackName(e: Unit): string {
  const w = weaponOf(e);
  const names: Record<string, string> = { sword: '斬る', lance: '突く', axe: '斧', bow: '射る', gun: '撃つ', magic: '魔法', holy: '光' };
  return names[w?.type ?? ''] ?? '殴る';
}
/** 予告の短い文（「次：大振り 14（前列の1人）」） */
export function intentText(b: BattleState, it: Intent): string {
  if (it.act === 'rage' || it.act === 'wait') return it.name;
  const t = it.target ? b.units.find((u) => u.uid === it.target) : null;
  if (it.act === 'heal') return `${t?.name ?? '仲間'}を癒やす`;
  const n = it.hits > 1 ? `${it.dmg}×${it.hits}` : `${it.dmg}`;
  return `${it.name} ${n}${t ? `（${t.name}）` : '（前列の1人）'}`;
}

/** 18夜目：札の行動力。「先駆けの詠唱」の子の魔法の札は、1ターンに1枚だけ1少なく（cut に使った子を入れる） */
export function costOf(s: GameState | null, b: BattleState, c: Card, cut: Set<string>): number {
  const base = c.fx.cost ?? 1;
  const spell = c.kind === 'spell' || (c.kind === 'basic' && !!WEAPONS[c.src]?.spell);
  if (!spell || base <= 0 || cut.has(c.owner)) return base;
  const u = b.units.find((x) => x.uid === c.owner);
  if (!u || !perkN(s, b, u, 'spellCost')) return base;
  cut.add(c.owner);
  return base - 1;
}
/** 札を並んだ順に出すときの、それぞれの行動力（画面の「行動力」と同じ数え方） */
export function cardCosts(s: GameState | null, b: BattleState, ids: string[]): number[] {
  const cs = b.auto!.cards!;
  const cut = new Set<string>();
  return ids.map((id) => (cs.cards[id] ? costOf(s, b, cs.cards[id], cut) : 0));
}

// ---------- 1ターン ----------
export interface TurnOpts { level: ProseLevel; deathMul: number }
/** 札を出してターンを進める（味方の札 → 敵の行動）。決着がついたら b.phase='done' */
export function resolveTurn(s: GameState, b: BattleState, ctx: BattleCtx, ids: string[], opt: TurnOpts): TurnRec {
  const cs = b.auto!.cards!;
  const r = rngOf(b);
  const lines: CLine[] = [];
  const rec: TurnRec = { turn: cs.turn, lines, played: [] };
  cs.t = freshTurn();
  b.blog?.push({ k: 'turn', turn: cs.turn, side: 'player' });
  // 行動力の分だけ（手札にあるもの）
  let ap = cs.ap;
  const play: Card[] = [];
  const cut = new Set<string>();
  for (const id of ids) { const c = cs.cards[id]; if (!c || !cs.hand.includes(id) || !usable(b, c)) continue; const cost = costOf(s, b, c, cut); if (cost > ap) continue; ap -= cost; play.push(c); }
  // 強め・守りの札を先に（あとの攻撃に効く）
  const order = [...play.filter((c) => c.fx.type === 'buff' && c.kind !== 'strat'), ...play.filter((c) => c.kind === 'strat'), ...play.filter((c) => c.fx.type === 'guard'), ...play.filter((c) => c.fx.type === 'atk' || c.fx.type === 'heal')];
  const owners = new Set<string>();
  for (const c of order) {
    if (b.phase === 'done') break;
    rec.played.push(c.id);
    if (c.owner !== 'teacher') owners.add(c.owner);
    b.rng = r.h.rng;
    playOne(s, b, ctx, c, lines, opt);
    r.h.rng = b.rng;
    stepForward(b, lines);
    checkCardsEnd(s, b);
  }
  // 一緒に札を出した子は、支援が少し深まる（隣で戦った組と同じ）
  const ownerSt = [...owners].map((uid) => b.units.find((u) => u.uid === uid)?.studentId).filter((x): x is string => !!x);
  for (let i = 0; i < ownerSt.length; i++) for (let j = i + 1; j < ownerSt.length; j++) { const k = [ownerSt[i], ownerSt[j]].sort().join('|'); b.adjacencyPairs[k] = (b.adjacencyPairs[k] ?? 0) + 1; }
  // 出した札は捨て札へ、残りの手札も捨て札へ（次のターンは引き直す）
  cs.discard.push(...cs.hand); cs.hand = [];
  // 敵の番
  if (b.phase !== 'done') { b.rng = r.h.rng; enemyPhase(s, b, ctx, lines, opt); r.h.rng = b.rng; }
  // 援軍の卒業生（自分で動く）
  if (b.phase !== 'done') { b.rng = r.h.rng; allyPhase(s, b, ctx, lines, opt); r.h.rng = b.rng; }
  checkCardsEnd(s, b);
  // 時間切れ
  if (b.phase !== 'done' && cs.turn >= cs.maxTurns) timeout(s, b, lines);
  cs.turns.push(rec);
  if (b.phase === 'done') { cardStats.battles++; cardStats.turns += cs.turn; if (b.result === 'win') cardStats.wins++; }
  cs.stun = cs.stun.filter((uid) => !cs.intents.some((it) => it.uid === uid));
  b.rng = r.h.rng;
  if (b.phase !== 'done') nextTurn(s, b);
  else cs.phase = 'done';
  return rec;
}
/** 次のターン：手札を引き、敵の予告を作る */
export function nextTurn(s: GameState, b: BattleState): void {
  const cs = b.auto!.cards!;
  cs.turn += 1; b.turn = cs.turn;
  cs.ap = cs.apBase + cs.next.ap;
  const n = cs.handSize + cs.next.draw;
  cs.next = { ap: 0, draw: 0 };
  // ターンのはじめ：まわりの仲間の傷がふさがる（スキル「慈愛」など）
  for (const u of b.units) if ((u.side === 'player' || u.side === 'ally') && alive(u)) {
    const aura = abilitiesOf(u).reduce((a, x) => a + (x.auraHeal ?? 0), 0);
    if (aura) for (const m of b.units) if (m.side === u.side && alive(m)) m.hp = Math.min(m.maxHp, m.hp + aura);
    // 18夜目：自分の傷がふさがる（祈りの基本）
    const rg = perkN(s, b, u, 'regen');
    if (rg) u.hp = Math.min(u.maxHp, u.hp + rg);
  }
  draw(b, n + drawBonus(s, b));
  makeIntents(s, b);
  cs.phase = 'result';
}

/** 前の敵が倒れたら、控えの敵が前に出る */
function stepForward(b: BattleState, lines: CLine[]): void {
  const cs = b.auto!.cards!;
  cs.front = cs.front.filter((id) => { const u = b.units.find((x) => x.uid === id); return alive(u) && !b.retreated.includes(id); });
  const fs = frontSize(b.units.filter((u) => u.side === 'player' && u.studentId).length);
  while (cs.front.length < fs && cs.reserve.length) {
    const id = cs.reserve.shift()!;
    const u = b.units.find((x) => x.uid === id);
    if (!alive(u) || b.retreated.includes(id)) continue;
    cs.front.push(id);
    lines.push({ cls: 'foe', text: `後ろから${u.name}が前に出てきた！` });
  }
}

/** 1枚の札 */
function playOne(s: GameState, b: BattleState, ctx: BattleCtx, c0: Card, lines: CLine[], opt: TurnOpts): void {
  const cs = b.auto!.cards!;
  const r = rngOf(b);
  let c = c0;
  const rec: CardState['played'][number] = { turn: cs.turn, card: c.id, owner: c.owner, name: c.name, kind: c.kind };
  cs.played.push(rec);
  if (c.kind === 'strat') { b.rng = r.h.rng; playStrat(s, b, c, lines); return; }
  const u = b.units.find((x) => x.uid === c.owner)!;
  const st = u.studentId ? s.students[u.studentId] : null;
  // 信頼が低い子は、ときどき自分の判断で動く（たいていは悪くない動き）
  // 17夜目：案内の1ターン目は、言われたとおりに動く
  if (st && C().obeyAt > st.trust && c.kind !== 'item' && !cs.guide) {
    const p = Math.min(C().disobeyMax, (C().obeyAt - st.trust) * C().disobeyPer);
    if (r.next() * 100 < p) {
      const own = Object.values(cs.cards).filter((x) => x.owner === u.uid && x.id !== c.id && x.fx.type === 'atk' && (x.fx.cost ?? 1) <= (c.fx.cost ?? 1));
      const alt: Card = own.length ? r.pick(own) : { id: 'own', kind: 'basic', name: BASIC[weaponOf(u)?.type ?? 'none'] ?? BASIC.none, fx: { type: 'atk' }, owner: u.uid, src: 'basic' };
      lines.push({ cls: 'narr', text: `${u.name}は${c.name}ではなく、自分の判断で${alt.name}を放った` });
      rec.disobey = true; rec.name = alt.name;
      c = alt;
    }
  }
  b.rng = r.h.rng;
  const f = c.fx;
  const big = c.kind === 'bloom' ? 'bloom' : c.kind === 'legend' ? 'legend' : undefined;
  const nth = ((cs.t.plays ??= {})[u.uid] = (cs.t.plays[u.uid] ?? 0) + 1);
  if (f.type === 'atk') {
    const first = !cs.t.first.includes(u.uid);
    cs.t.first.push(u.uid);
    const targets = f.aoe ? cs.front.map((id) => b.units.find((x) => x.uid === id)).filter(alive) : [defaultTarget(b)].filter(alive);
    if (!targets.length) return;
    rec.tgt = targets[0].uid;
    const w = cardWeapon(u, c);
    lines.push({ cls: `ally${c.kind === 'basic' ? '' : ' art'}`, text: c.kind === 'spell' || (c.kind === 'basic' && WEAPONS[c.src]?.spell) ? `${u.name}は${c.name}を唱えた！` : c.kind === 'basic' ? `${u.name}の攻撃！` : `${u.name}の${c.name}！`, fx: big, a: u.uid, card: c.name });
    for (const d of targets) {
      for (let i = 0; i < (f.hits ?? 1) && alive(d); i++) {
        const h = strikeCalc(s, b, ctx, u, d, f, w, first && i === 0);
        const out = hitOnce(s, b, ctx, u, d, h, lines, opt, i > 0 || targets.length > 1);
        if (out.crit) rec.crit = true;
        if (out.kill) rec.kill = true;
        rec.dmg = (rec.dmg ?? 0) + out.dmg;
      }
      if (alive(d)) {
        if (f.stun && !cs.stun.includes(d.uid)) { cs.stun.push(d.uid); lines.push({ cls: 'narr', text: `${d.name}は足を止められた！（次の行動ができない）` }); }
        if (f.debuff) { const x = (cs.deb[d.uid] ??= { avo: 0, atk: 0, def: 0 }); x[f.debuff] += f.amt ?? 0; lines.push({ cls: 'narr', text: `${d.name}の${{ avo: '回避', atk: '攻撃', def: '守り' }[f.debuff]}が下がった` }); }
      }
    }
    // 18夜目：同じターンに自分の札を2枚出すと、2枚目の攻撃のあとに追い打ち（連ね太刀・早込め）
    const sc = nth >= 2 ? perkN(s, b, u, 'selfCombo') : 0;
    const t0 = targets.find(alive);
    if (sc && t0 && b.phase !== 'done') {
      lines.push({ cls: 'ally art', text: `${u.name}の追い打ち！`, a: u.uid });
      const h = strikeCalc(s, b, ctx, u, t0, { type: 'atk', mul: sc / 100 }, w);
      const out = hitOnce(s, b, ctx, u, t0, h, lines, opt, true);
      if (out.kill) rec.kill = true;
      rec.dmg = (rec.dmg ?? 0) + out.dmg;
    }
    if (w) u.usedWeapon[w.id] = (u.usedWeapon[w.id] ?? 0) + C().usePerCard;
    if (f.self) { cs.t.self[u.uid] = (cs.t.self[u.uid] ?? 0) + f.self; }
    return;
  }
  if (f.type === 'heal') {
    const amt = healOf(u, c, s, b);
    const self = c.kind === 'item';
    const list = f.all ? b.units.filter((x) => (x.side === 'player' || x.side === 'ally' || x.side === 'npc') && alive(x)) : [self ? u : [...b.units.filter((x) => (x.side === 'player' || x.side === 'npc') && alive(x))].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]].filter(alive);
    lines.push({ cls: 'ally', text: self ? `${u.name}は${c.name}を使った！` : `${u.name}は${c.name}を唱えた！`, fx: big, a: u.uid });
    let tot = 0;
    for (const t of list) {
      const hp0 = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt); const got = t.hp - hp0; tot += got;
      if (!got) continue;
      lines.push({ cls: 'heal', text: `${t.name}のHPが ${got}回復した！` });
      b.feed?.push({ t: 'heal', a: u.uid, d: t.uid, turn: cs.turn });
      b.blog?.push({ k: 'heal', x: 0, a: u.uid, d: t.uid, w: c.src, amt: got, hp0, hp1: t.hp, max: t.maxHp });
    }
    rec.heal = tot;
    if (!tot) lines.push({ cls: 'narr', text: '傷ついた仲間は、まだいなかった' });
    if (self) u.item = null;
    else { const sp = WEAPONS[c.src]; if (sp) u.usedWeapon[sp.id] = (u.usedWeapon[sp.id] ?? 0) + C().usePerCard; }
    u.expGain += B.battle.exp.heal;
    return;
  }
  if (f.type === 'guard') {
    const parts: string[] = [];
    if (f.cover) { const t = coverTarget(b, u); if (t) { cs.t.cover.push({ by: u.uid, to: t.uid }); parts.push(`${t.name}の前に立ちはだかった`); rec.cover = t.uid; } }
    const gp = perkN(s, b, u, 'guardPlus');
    if (f.wall) { cs.t.wall += f.wall + gp; parts.push(`みんなの受ける傷が${f.wall + gp}減る`); }
    if (f.self) { cs.t.self[u.uid] = (cs.t.self[u.uid] ?? 0) + f.self + (f.wall ? 0 : gp); parts.push('身を固めた'); }
    if (f.counter) { cs.t.counter[u.uid] = f.counter; parts.push('反撃の構え'); }
    lines.push({ cls: 'guard', text: `${u.name}の${c.name}！　${parts.join('。') || '身構えた'}`, a: u.uid });
    u.expGain += B.battle.exp.hit / 2;
    if (u.studentId) b.auto!.spot[u.studentId] = (b.auto!.spot[u.studentId] ?? 0) + 0.5;
    return;
  }
  // 強め
  const parts: string[] = [];
  const bp = f.team ? perkN(s, b, u, 'buffPlus') : 0;
  if (f.team) { cs.t.team.dmg += (f.team.dmg ?? 0) + bp; cs.t.team.hit += (f.team.hit ?? 0) + bp * 5; cs.t.team.crit += f.team.crit ?? 0; parts.push(`このターン、みんなの${[f.team.dmg ? '威力' : '', f.team.hit ? '命中' : '', f.team.crit ? '必殺' : ''].filter(Boolean).join('・')}が上がる`); }
  if (f.ap) { cs.next.ap += f.ap; parts.push(`次のターン、行動力+${f.ap}`); }
  if (f.draw) { cs.next.draw += f.draw; parts.push(`次のターン、札を${f.draw}枚多く引く`); }
  lines.push({ cls: 'guard', text: `${u.name}の${c.name}！　${parts.join('。')}`, a: u.uid });
  u.expGain += B.battle.exp.hit / 2;
}

/** 策の札（9夜目の策をそのまま切る。成功の見込みは地形・天候・策を立てる子しだい） */
function playStrat(s: GameState, b: BattleState, c: Card, lines: CLine[]): void {
  const id = c.src.slice(6) as StratId;
  const q = s.quests.find((x) => x.id === b.questId) ?? ({ template: 'training', weather: b.weather, objective: b.objective } as Quest);
  const rec = fireStrat(s, b, q, id, officerById(s, b.auto?.leader?.officerId), true);
  if (!rec) return;
  lines.push({ cls: rec.ok ? 'strat' : 'stratng', text: `策「${STRATS[id].name}」：${rec.text}`, fx: rec.ok ? 'strat' : undefined });
}

/** 1回の攻撃（味方→敵、敵→味方どちらも） */
function hitOnce(s: GameState, b: BattleState, ctx: BattleCtx, a: Unit, d: Unit, h: Hit, lines: CLine[], opt: TurnOpts, quiet: boolean, mul = 1): { dmg: number; crit: boolean; kill: boolean } {
  const cs = b.auto!.cards!;
  const r = rngOf(b);
  const ally = a.side !== 'enemy';
  const hp0 = d.hp;
  const roll = ((r.next() + r.next()) / 2) * 100;
  if (roll >= h.hit) {
    lines.push({ cls: 'narr', text: `${d.name}は ひらりとかわした！` });
    b.feed?.push({ t: 'miss', a: a.uid, d: d.uid, turn: cs.turn });
    b.blog?.push({ k: 'atk', x: cs.turn, a: a.uid, d: d.uid, w: h.w?.id ?? null, dmg: 0, hit: false, crit: false, tri: h.tri, eff: h.eff, role: ally ? 'atk' : 'counter', hp0, hp1: hp0, max: d.maxHp, kill: false });
    b.rng = r.h.rng;
    return { dmg: 0, crit: false, kill: false };
  }
  const crit = r.next() * 100 < h.crit;
  let dmg = Math.max(1, Math.round(h.dmg * mul * (crit ? C().critMul : 1)));
  // 守り：かばう・みんなの守り・自分の守り（敵の攻撃だけ）
  if (!ally) {
    dmg = Math.max(0, dmg - cs.t.wall - (cs.t.self[d.uid] ?? 0));
  }
  dmg = Math.min(d.hp, dmg);
  // 18夜目：1戦に1回、倒れるはずの攻撃をHP1で踏みとどまる（踏みとどまり・不沈）
  let endured = false;
  if (!ally && dmg >= d.hp && d.hp > 1 && perkN(s, b, d, 'endure') && useOnce(b, d, 'endure')) { dmg = d.hp - 1; endured = true; }
  d.hp -= dmg;
  b.rng = r.h.rng;
  a.dmgDealt += dmg; d.dmgTaken += dmg;
  if (ally) { a.hits += 1; a.expGain += B.battle.exp.hit; if (!(b.hitBy[d.uid] ??= []).includes(a.uid)) b.hitBy[d.uid].push(a.uid); if (a.studentId) b.auto!.spot[a.studentId] = (b.auto!.spot[a.studentId] ?? 0) + 0.3; }
  else if (d.studentId) { const l = ((b.struck ??= {})[a.uid] ??= []); if (!l.includes(d.studentId)) l.push(d.studentId); }
  b.feed?.push({ t: crit ? 'crit' : 'hit', a: a.uid, d: d.uid, turn: cs.turn, dmg });
  const kill = d.hp <= 0;
  b.blog?.push({ k: 'atk', x: cs.turn, a: a.uid, d: d.uid, w: h.w?.id ?? null, dmg, hit: true, crit, tri: h.tri, eff: h.eff, role: ally ? 'atk' : 'counter', hp0, hp1: Math.max(0, d.hp), max: d.maxHp, kill });
  if (crit) lines.push({ cls: 'big', text: ally ? '会心の一撃！' : `${a.name}の会心の一撃！`, fx: ally ? 'crit' : undefined, a: a.uid, d: d.uid, n: dmg });
  lines.push({ cls: 'dmg', text: `${d.name}に ${dmg}のダメージ！${h.tri > 0 ? '（有利）' : ''}${h.eff ? '（特効）' : ''}`, a: a.uid, d: d.uid });
  if (endured) lines.push({ cls: 'guard', text: `${d.name}は歯を食いしばり、踏みとどまった！（HP1）`, d: d.uid });
  if (kill) down(s, b, ctx, d, a, h.w, lines, opt);
  else {
    // 結果の4段（16夜目）：ふつう・深手。命にかかわる言葉は使わない
    const tier = d.hp <= d.maxHp * 0.3 ? 'heavy' : 'hit';
    const salt = cs.turn * 7 + hp0 * 3 + dmg;
    if (!quiet && opt.level !== 'normal' && (tier === 'heavy' || salt % 2 === 0)) {
      const key = proseKey(h.w);
      const list = crit ? PROSE_LIGHT[key]?.crit : PROSE_LIGHT[key]?.[tier] ?? PROSE_LIGHT.none[tier];
      const t = list?.length ? list[salt % list.length] : '';
      if (t && !crit) lines.push({ cls: 'prose', text: t.replace(/\{a\}/g, a.name).replace(/\{d\}/g, d.name) });
    }
    if (tier === 'heavy' && d.side !== 'enemy') lines.push({ cls: 'narr', text: PROSE_DEEP.replace(/\{d\}/g, d.name) });
  }
  return { dmg, crit, kill };
}

/** 倒れた：生徒は重傷か戦死、敵将は討ち取るか逃げのびるか、雑兵は倒れる（結果の4段の「重傷」「死」） */
function down(s: GameState, b: BattleState, ctx: BattleCtx, d: Unit, by: Unit, w: WeaponDef | null, lines: CLine[], opt: TurnOpts): void {
  const cs = b.auto!.cards!;
  const r = rngOf(b);
  const key = proseKey(w);
  const salt = cs.turn * 13 + d.maxHp;
  const pick = (l: string[] | undefined) => (l?.length ? l[salt % l.length] : '');
  const fillT = (t: string, a: string) => t.replace(/\{a\}/g, a).replace(/\{d\}/g, a).replace(/\{l\}/g, a);
  d.hp = 0; d.dead = true;
  by.kills += 1;
  if (by.side !== 'enemy') {
    // 18夜目：敵を倒すと次のターンの行動力+1（狂戦の血・追い拍車。1ターンに1回）、HPが戻る（空の狩り）
    if (!cs.t.killAp && perkN(s, b, by, 'killAp')) { cs.t.killAp = true; cs.next.ap += 1; lines.push({ cls: 'guard', text: `${by.name}の勢いが増した。次のターン、行動力+1` }); }
    const kh = perkN(s, b, by, 'killHeal');
    if (kh && alive(by)) by.hp = Math.min(by.maxHp, by.hp + kh);
    const diff = d.level - by.level;
    by.expGain += Math.max(B.battle.exp.minKill, Math.min(B.battle.exp.levelDiffMax + B.battle.exp.kill, B.battle.exp.kill + diff * B.battle.exp.levelDiffPer));
    if (by.studentId) b.auto!.spot[by.studentId] = (b.auto!.spot[by.studentId] ?? 0) + 1;
  }
  b.feed?.push({ t: 'kill', a: by.uid, d: d.uid, turn: cs.turn });
  const L = b.auto?.leader;
  // 生徒・卒業生（味方）
  if (d.studentId && (d.side === 'player' || d.side === 'ally')) {
    let outcome: 'dead' | 'injured' | 'out' = 'out';
    if (b.real) {
      let inj = B.battle.injuryBase + d.stats.lck * B.battle.injuryPerLck + ctx.luckInjury(d.studentId);
      for (const o of b.units) {
        if (o === d || !alive(o) || !o.studentId || o.side !== d.side) continue;
        const v = ctx.support(d.studentId, o.studentId);
        if (v >= B.support.A) inj += B.battle.injurySupportA; else if (v >= B.support.B) inj += B.battle.injurySupportB;
      }
      inj = Math.min(B.battle.injuryMax, inj);
      const deathP = (100 - inj) * ctx.deathMul * opt.deathMul;
      outcome = r.next() * 100 < deathP ? 'dead' : 'injured';
    }
    b.fallen.push({ studentId: d.studentId, outcome, by: by.uid });
    b.feed?.push({ t: 'fallen', a: d.uid, d: by.uid, turn: cs.turn });
    cs.allyDown = true;
    // 18夜目：仲間が倒れると、次のターンの行動力+1（冷静・仲間の仇。1戦に1回）
    const avenger = b.units.find((m) => m.side === d.side && alive(m) && m !== d && perkN(s, b, m, 'apOnce') && skOf(s, b, m).some((x) => x.perk?.id === 'apOnce' && x.cond === 'allyDown'));
    if (avenger && useOnce(b, avenger, 'apDown')) { cs.next.ap += 1; lines.push({ cls: 'guard', text: `${avenger.name}が声を張った。次のターン、行動力+1` }); }
    if (outcome === 'dead') { lines.push({ cls: 'down', text: fillT(pick(fallLines(key, 'dead', opt.level)), d.name), fx: 'fall', d: d.uid }); }
    else if (outcome === 'injured') { lines.push({ cls: 'down', text: fillT(pick(fallLines(key, 'injured', opt.level)), d.name), fx: 'fall', d: d.uid }); }
    else lines.push({ cls: 'down', text: `${d.name}は戦いから外れた`, d: d.uid });
    b.rng = r.h.rng;
    return;
  }
  if (d.side === 'npc') { lines.push({ cls: 'down', text: `${d.name}が倒れた……`, d: d.uid }); b.rng = r.h.rng; return; }
  // 敵の卒業生：命までは取らない（重傷で退く）
  if (d.persuadable) { lines.push({ cls: 'narr', text: PROSE_ALUMNI_RETREAT.replace(/\{d\}/g, d.name) }); b.retreated.push(d.uid); b.rng = r.h.rng; return; }
  // 敵将：名簿の敵将は、その場で逃げのびるかが決まる（逃げのびたら「重傷」の段の文）
  if (L && d.uid === L.uid) {
    const o = officerById(s, L.officerId);
    if (o && b.real && !L.fled && !L.settled && !L.noFlee && survives(o, b.objective, r)) {
      L.fled = true; b.retreated.push(d.uid);
      lines.push({ cls: 'foe', text: PROSE_FLEE.replace(/\{d\}/g, L.name), d: d.uid });
      b.rng = r.h.rng;
      return;
    }
    const br = opt.level === 'brutal' ? pick(PROSE_BRUTAL[key]?.kill) : '';
    const t = opt.level === 'normal' ? '' : br || pick(PROSE_DENSE[key]?.kill ?? PROSE_DENSE.none.kill);
    lines.push({ cls: 'prose strong', text: t ? t.replace(/\{a\}/g, by.name).replace(/\{d\}/g, d.name) : `${L.name}を討ち取った！`, fx: 'kill', a: by.uid, d: d.uid });
    if (t) lines.push({ cls: 'narr', text: `${L.name}を討ち取った！` });
    b.rng = r.h.rng;
    return;
  }
  // 名を得た兵・雑兵
  const named = !!b.auto?.raised?.some((x) => x.uid === d.uid);
  if (named && opt.level !== 'normal') lines.push({ cls: 'prose strong', text: pick(PROSE_DENSE[key]?.kill ?? PROSE_DENSE.none.kill).replace(/\{a\}/g, by.name).replace(/\{d\}/g, d.name) });
  else lines.push({ cls: 'narr', text: (salt % 3 === 0 ? pick(PROSE_GRUNT_KILL) : '{d}を倒した！').replace(/\{d\}/g, d.name) });
  b.rng = r.h.rng;
}

/** 敵の番：予告どおりに動く（止められた敵は動けない） */
function enemyPhase(s: GameState, b: BattleState, ctx: BattleCtx, lines: CLine[], opt: TurnOpts): void {
  const cs = b.auto!.cards!;
  const r = rngOf(b);
  const mates = () => b.units.filter((u) => (u.side === 'player' || u.side === 'ally' || u.side === 'npc') && alive(u) && !b.retreated.includes(u.uid) && !u.captive);
  for (const it of cs.intents) {
    if (b.phase === 'done') break;
    const e = b.units.find((u) => u.uid === it.uid);
    if (!alive(e) || b.retreated.includes(e.uid)) continue;
    if (cs.stun.includes(e.uid)) { lines.push({ cls: 'foe', text: `${e.name}は動けない！` }); continue; }
    if (it.act === 'wait') continue;
    if (it.act === 'rage') { cs.rage[e.uid] = (cs.rage[e.uid] ?? 0) + C().rage; lines.push({ cls: 'foe', text: `${e.name}は怒りの構えをとった。次の攻撃が重くなる` }); continue; }
    if (it.act === 'heal') {
      const t = b.units.find((u) => u.uid === it.target);
      if (alive(t)) { const hp0 = t.hp; t.hp = Math.min(t.maxHp, t.hp + it.dmg); lines.push({ cls: 'foe', text: `${e.name}は${t.name}の傷を癒やした（HP+${t.hp - hp0}）` }); }
      continue;
    }
    // 狙い（予告の相手が倒れていたら、前列の別の子）
    let t = it.target ? b.units.find((u) => u.uid === it.target) : null;
    const ms = mates();
    if (!ms.length) break;
    if (!alive(t) || b.retreated.includes(t.uid)) { const fr = ms.filter((m) => m.row !== 'back' && m.side !== 'npc'); t = r.pick(fr.length ? fr : ms); }
    // かばう
    const cov = cs.t.cover.find((c) => c.to === t!.uid && alive(b.units.find((u) => u.uid === c.by)));
    let mul = 1;
    const name = it.act === 'big' ? '大振り' : it.art ? ARTS[it.art]?.name ?? it.name : '';
    lines.push({ cls: 'foe', text: name ? `${e.name}の${name}！` : `${e.name}の攻撃！`, a: e.uid });
    let coverBy: Unit | null = null;
    if (cov) {
      const g = b.units.find((u) => u.uid === cov.by)!;
      lines.push({ cls: 'guard', text: `${g.name}がかばう！　${t!.name}の前に立ちはだかった` });
      t = g; mul = C().coverMul * (1 - Math.min(80, perkN(s, b, g, 'coverPlus')) / 100); coverBy = g;
    }
    const fx: CardFx = it.art && ARTS[it.art]?.card ? ARTS[it.art].card! : it.act === 'big' ? { type: 'atk', mul: C().bigMul } : { type: 'atk' };
    b.rng = r.h.rng;
    for (let i = 0; i < (fx.hits ?? 1) && alive(t); i++) {
      const h = strikeCalc(s, b, ctx, e, t!, fx);
      hitOnce(s, b, ctx, e, t!, h, lines, opt, i > 0, mul);
    }
    r.h.rng = b.rng;
    if (cs.rage[e.uid]) cs.rage[e.uid] = 0;
    // 反撃の構え（18夜目：かばったあとの反撃〔返し槍〕・前列で攻撃されたときの反撃〔間合い取り〕も）
    let ct = cs.t.counter[t!.uid];
    if (!ct && coverBy && perkN(s, b, coverBy, 'coverCounter')) ct = perkN(s, b, coverBy, 'coverCounter') / 100;
    if (!ct && t!.row !== 'back' && t!.side === 'player') { const p = perkN(s, b, t!, 'counter'); if (p && r.next() * 100 < p) ct = C().counterMul; }
    if (ct && alive(t) && alive(e)) {
      lines.push({ cls: 'ally', text: `${t!.name}の反撃！` });
      b.rng = r.h.rng;
      const h = strikeCalc(s, b, ctx, t!, e, { type: 'atk', mul: ct });
      hitOnce(s, b, ctx, t!, e, h, lines, opt, true);
      r.h.rng = b.rng;
      const w = weaponOf(t!); if (w) t!.usedWeapon[w.id] = (t!.usedWeapon[w.id] ?? 0) + 1;
    }
    b.rng = r.h.rng;
    stepForward(b, lines);
    checkCardsEnd(s, b);
  }
  b.rng = r.h.rng;
}
/** 援軍の卒業生：自分で、いちばん弱った敵を打つ */
function allyPhase(s: GameState, b: BattleState, ctx: BattleCtx, lines: CLine[], opt: TurnOpts): void {
  const cs = b.auto!.cards!;
  for (const u of b.units.filter((x) => x.side === 'ally' && alive(x) && !x.persuadable)) {
    const t = cs.front.map((id) => b.units.find((x) => x.uid === id)).filter(alive).sort((x, y) => x.hp - y.hp)[0];
    if (!t || b.phase === 'done') break;
    lines.push({ cls: 'ally', text: `援軍の${u.name}の攻撃！` });
    const h = strikeCalc(s, b, ctx, u, t, { type: 'atk' });
    hitOnce(s, b, ctx, u, t, h, lines, opt, true);
    stepForward(b, lines);
    checkCardsEnd(s, b);
  }
}

/** 決着：勝利条件ごと */
export function checkCardsEnd(s: GameState, b: BattleState): void {
  if (b.phase === 'done') return;
  const foes = b.units.filter((u) => u.side === 'enemy' && alive(u) && !b.retreated.includes(u.uid));
  const mine = b.units.filter((u) => u.side === 'player' && alive(u) && !b.retreated.includes(u.uid));
  const L = b.auto?.leader;
  const lu = L ? b.units.find((u) => u.uid === L.uid) : null;
  const npc = b.units.find((u) => u.side === 'npc' && (u.escort));
  if (!mine.length) { end(b, 'lose'); return; }
  if (npc && !alive(npc) && (b.objective === 'defend' || b.objective === 'escort')) { end(b, 'lose'); return; }
  if (!foes.length) { if (b.objective === 'rescue') b.rescued = true; if (b.objective === 'escape') b.escaped = mine.length; end(b, 'win'); return; }
  if ((b.objective === 'boss' || b.objective === 'seize') && lu && (!alive(lu) || b.retreated.includes(lu.uid))) { end(b, 'win'); return; }
}
function end(b: BattleState, result: 'win' | 'lose'): void { finish(b, result); }
/** 時間切れ：守る・逃げる戦いは持ちこたえれば勝ち。ほかは、残った敵が少なければ敵が退く */
function timeout(s: GameState, b: BattleState, lines: CLine[]): void {
  cardStats.timeouts++;
  const foes = b.units.filter((u) => u.side === 'enemy');
  const left = foes.filter((u) => alive(u) && !b.retreated.includes(u.uid)).reduce((a, u) => a + u.hp, 0);
  const all = foes.reduce((a, u) => a + u.maxHp, 0) || 1;
  const mine = b.units.filter((u) => u.side === 'player' && alive(u) && !b.retreated.includes(u.uid));
  if (b.objective === 'defend' || b.objective === 'escort' || b.objective === 'escape') {
    if (b.objective === 'escape') b.escaped = mine.length;
    lines.push({ cls: 'strat', text: b.objective === 'escape' ? '敵の囲みを抜けた！' : '最後まで持ちこたえた！　敵は引き上げていく' });
    end(b, 'win');
    return;
  }
  // 最初の依頼（案内つき）は負けない：敵が退く
  const tut = !!s.quests.find((q) => q.id === b.questId)?.tutorial;
  if (left / all <= C().timeoutWin || tut) {
    if (b.objective === 'rescue') b.rescued = true;
    for (const u of foes) if (alive(u) && !b.retreated.includes(u.uid)) b.retreated.push(u.uid);
    const L = b.auto?.leader;
    if (L && b.retreated.includes(L.uid) && !b.units.find((u) => u.uid === L.uid)?.dead) L.fled = true;
    lines.push({ cls: 'strat', text: '残った敵は、かなわぬと見て退いていった' });
    cardStats.timeoutWins++;
    end(b, 'win');
  } else {
    lines.push({ cls: 'stratng', text: '日が傾いた。これ以上は戦えない。部隊は退くしかなかった' });
    b.auto!.retreatedAll = true;
    end(b, 'lose');
  }
}

/** ここぞの判断のあと：倒れた・退いた敵を前から外し、決着を見て、予告を作り直す */
export function afterChoice(s: GameState, b: BattleState): void {
  const cs = b.auto!.cards!;
  const lines: CLine[] = [];
  stepForward(b, lines);
  checkCardsEnd(s, b);
  if (b.phase === 'done') { cs.phase = 'done'; return; }
  makeIntents(s, b);
}

// ---------- おまかせ（オートプレイ） ----------
export type CardPolicy = 'balanced' | 'safe' | 'bold';
/**
 * おまかせで出す札を選ぶ。危ない子（予告の傷で倒れそうな子）がいれば守り・回復を先に、
 * そのあと倒しきれる敵から攻撃。方針：safe＝守りを厚く、bold＝攻めを厚く
 */
export function autoPick(s: GameState, b: BattleState, ctx: BattleCtx | null, policy: CardPolicy = 'balanced'): { ids: string[]; target?: string } {
  const cs = b.auto!.cards!;
  const hand = cs.hand.filter((id) => usable(b, cs.cards[id]));
  const inc = incoming(b);
  const units = (uid: string) => b.units.find((u) => u.uid === uid);
  const margin = policy === 'safe' ? 0.75 : policy === 'bold' ? 1.0 : 0.85;
  const danger = b.units.filter((u) => (u.side === 'player' || u.side === 'npc') && alive(u) && (inc[u.uid] ?? 0) >= u.hp * margin)
    .sort((x, y) => (inc[y.uid] ?? 0) - y.hp - ((inc[x.uid] ?? 0) - x.hp));
  let ap = cs.ap;
  const picked: string[] = [];
  let target: string | undefined = cs.target;
  const take = (id: string) => { const c = cs.cards[id]; if (picked.includes(id)) return false; const cut = new Set<string>(); for (const x of picked) costOf(s, b, cs.cards[x], cut); const cost = costOf(s, b, c, cut); if (cost > ap) return false; ap -= cost; picked.push(id); return true; };
  const cards = hand.map((id) => cs.cards[id]);
  const free = (c: Card) => !picked.includes(c.id);
  // 0：行動力のいらない札は出す
  for (const c of cards) if ((c.fx.cost ?? 1) === 0) take(c.id);
  // 1：危ない子を守る（かばう → 守り → 回復 → 狙ってくる敵を止める・倒す）
  let wall = 0;
  for (const d of danger) {
    if (!ap) break;
    const need = (inc[d.uid] ?? 0) - d.hp + 1;
    const hitsOn = cs.intents.filter((it) => it.target === d.uid).reduce((x, it) => x + it.hits, 0) || 1;
    if (need - wall * hitsOn <= 0) continue;
    const cover = cards.find((c) => free(c) && c.fx.type === 'guard' && c.fx.cover && c.owner !== d.uid && (() => { const o = units(c.owner); return !!o && o.hp > (inc[o.uid] ?? 0) + (inc[d.uid] ?? 0) * C().coverMul; })());
    if (cover && take(cover.id)) continue;
    const wl = cards.filter((c) => free(c) && c.fx.type === 'guard' && ((c.fx.wall ?? 0) + (c.owner === d.uid ? c.fx.self ?? 0 : 0)) * hitsOn >= need - wall * hitsOn).sort((x, y) => (x.fx.cost ?? 1) - (y.fx.cost ?? 1))[0];
    if (wl && take(wl.id)) { wall += wl.fx.wall ?? 0; continue; }
    const hl = cards.find((c) => free(c) && c.fx.type === 'heal' && (c.kind !== 'item' || c.owner === d.uid) && Math.min(d.maxHp, d.hp + healOf(units(c.owner)!, c, s, b)) > (inc[d.uid] ?? 0));
    if (hl && take(hl.id)) continue;
    // 狙ってくるいちばん強い敵を止めるか、倒す
    const it = cs.intents.filter((x) => x.target === d.uid && !cs.stun.includes(x.uid)).sort((x, y) => y.dmg * y.hits - x.dmg * x.hits)[0];
    const e = it ? units(it.uid) : null;
    if (e && alive(e)) {
      target = e.uid;
      const stun = cards.find((c) => free(c) && c.fx.type === 'atk' && c.fx.stun && !c.fx.aoe);
      if (stun && take(stun.id)) continue;
      let hp = e.hp;
      for (const c of cards.filter((x) => free(x) && x.fx.type === 'atk').sort((x, y) => atkValue(y, e) - atkValue(x, e))) {
        if (hp <= 0 || !ap) break;
        if (take(c.id)) hp -= atkValue(c, e);
      }
    }
  }
  // 2：大きな見こみの攻撃から（倒しきれるもの・敵将）。守り重視なら、残りの守り札も
  const tu = target ? units(target) : defaultTarget(b);
  function atkValue(c: Card, t: Unit): number {
    const o = units(c.owner);
    if (!o) return 0;
    const h = strikeCalc(s, b, ctx, o, t, c.fx, cardWeapon(o, c));
    return h.dmg * h.hits * (h.hit / 100);
  }
  const hurt = b.units.filter((u) => (u.side === 'player' || u.side === 'npc') && alive(u));
  const missing = hurt.reduce((x, u) => x + (u.maxHp - u.hp), 0);
  const score = (c: Card): number => {
    if (c.kind === 'strat') return 40;
    const o = units(c.owner);
    if (!o) return -1;
    if (c.fx.type === 'atk' && tu) {
      const n = c.fx.aoe ? cs.front.length : 1;
      let v = atkValue(c, tu) * n / Math.max(1, c.fx.cost ?? 1);
      const h = strikeCalc(s, b, ctx, o, tu, c.fx, cardWeapon(o, c));
      if (h.dmg * h.hits >= tu.hp) v += 15;
      if (c.fx.stun && cs.intents.some((it) => it.uid === tu.uid && it.dmg * it.hits > 8)) v += 10;
      return v;
    }
    if (c.fx.type === 'buff') return c.fx.team ? (c.fx.team.dmg ?? 0) * 4 + (c.fx.team.hit ?? 0) / 2 : 5;
    if (c.fx.type === 'heal') {
      if (c.fx.all) return Math.min(missing, healOf(o, c, s, b) * hurt.length) / 3;
      const lo = [...hurt].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      return lo && lo.hp < lo.maxHp * 0.6 ? 18 : 0;
    }
    if (c.fx.type === 'guard') return policy === 'safe' ? (Object.keys(inc).length ? 12 : 0) : 3;
    return 0;
  };
  const rest = cards.filter(free).sort((x, y) => score(y) - score(x));
  for (const c of rest) { if (!ap) break; if (score(c) <= 0) continue; take(c.id); }
  return { ids: picked, target: tu?.uid };
}
