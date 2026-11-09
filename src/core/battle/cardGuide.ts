// 札の戦いの案内（17夜目）。DOM非依存
// 最初の札の戦いの1ターン目だけ、管理人オズヴァルトが横について3つ教える：
//   ①敵の予告を見る ②守る札（かばう）を出す ③攻める札を出す
// 案内のあいだは、敵の動きを案内に合わせる（1人が大振りでひとりの子を狙い、ほかは様子をうかがう）。
// 案内が終わったら（札を出したら・飛ばしたら）ふつうに戻る。
import { B } from '../../data/balance';
import { ARTS, type CardFx } from '../../data/arts';
import type { GameState } from '../state';
import type { BattleState, Unit } from './types';
import { strikeCalc, usable, type Card, type CardState, type Intent } from './cards';
import { weaponOf } from './calc';

export interface CardGuide {
  /** intent＝予告を見る、pick＝札を選ぶ（かばう → 攻める → 出す）、after＝札を出したあとのひとこと */
  step: 'intent' | 'pick' | 'after';
  /** 大振りをしてくる敵・狙われる子・かばう子・攻める子（uid） */
  foe: string; ward: string; coverBy: string; attacker: string;
  /** 光らせる札（id） */
  cover: string; atk: string;
  /** 案内のために足した札（終わったら山札に戻さない） */
  temp: string[];
  /** 飛ばしたときに戻すもの */
  saved: { intents: Intent[]; hand: string[]; deck: string[]; target?: string; foeHp?: [number, number] };
}

const alive = (u: Unit | undefined | null): u is Unit => !!u && !u.dead && u.hp > 0;
const COVER_ART = 'he_m1b';

/** 案内を始められるか（1ターン目の、札を選ぶところ） */
export function canStartGuide(b: BattleState | null | undefined): boolean {
  const cs = b?.auto?.cards;
  if (!b || !cs || cs.phase !== 'play' || cs.turn !== 1 || cs.guide || b.auto?.choice) return false;
  return pickRoles(b) !== null;
}

/** かばう子・狙われる子・攻める子・大振りの敵を選ぶ */
function pickRoles(b: BattleState): { coverBy: Unit; ward: Unit; foe: Unit; coverCard: Card | null } | null {
  const cs = b.auto!.cards!;
  const mates = b.units.filter((u) => u.side === 'player' && u.studentId && alive(u) && !b.retreated.includes(u.uid));
  if (mates.length < 2) return null;
  const front = mates.filter((u) => u.row !== 'back');
  const pool = front.length >= 2 ? front : mates;
  const foes = cs.front.map((id) => b.units.find((u) => u.uid === id)).filter(alive).filter((u) => !!weaponOf(u) && !u.persuadable);
  if (!foes.length) return null;
  // かばう札を持っている子がいれば、その子に（手札 → 山札の順）
  const all = [...cs.hand, ...cs.deck].map((id) => cs.cards[id]).filter((c) => c && usable(b, c));
  const coverCard = all.find((c) => c.fx.type === 'guard' && c.fx.cover && mates.some((m) => m.uid === c.owner) && (c.fx.cost ?? 1) < cs.ap) ?? null;
  const sturdy = (u: Unit) => u.hp + u.stats.def * 2;
  const coverBy = coverCard ? mates.find((m) => m.uid === coverCard.owner)! : [...pool].sort((x, y) => sturdy(y) - sturdy(x) || x.uid.localeCompare(y.uid))[0];
  const wards = pool.filter((u) => u !== coverBy);
  const ward = (wards.length ? wards : mates.filter((u) => u !== coverBy)).sort((x, y) => sturdy(x) - sturdy(y) || x.uid.localeCompare(y.uid))[0];
  if (!ward) return null;
  // 大振りの敵：敵将が前にいれば敵将、いなければ、いちばんHPの多い敵（攻撃の札1枚では倒れにくい）
  const L = b.auto?.leader;
  const foe = foes.find((u) => u.uid === L?.uid) ?? [...foes].sort((x, y) => y.hp - x.hp || x.uid.localeCompare(y.uid))[0];
  return { coverBy, ward, foe, coverCard };
}

/** 手札に札を入れる（山札から、または新しく足す）。手札の数は変えない：かわりに外した札は山札のいちばん上へ */
function bringToHand(cs: CardState, id: string, keep: string[]): void {
  if (cs.hand.includes(id)) return;
  cs.deck = cs.deck.filter((x) => x !== id);
  const out = [...cs.hand].reverse().find((x) => !keep.includes(x));
  if (out && cs.hand.length >= cs.handSize) { cs.hand = cs.hand.filter((x) => x !== out); cs.deck.unshift(out); }
  cs.hand.push(id);
}

/** 案内を始める：敵の動きを案内に合わせ、光らせる2枚を手札にそろえる */
export function startCardGuide(s: GameState, b: BattleState): boolean {
  if (!canStartGuide(b)) return false;
  const cs = b.auto!.cards!;
  const roles = pickRoles(b)!;
  const { coverBy, ward, foe } = roles;
  const saved: CardGuide['saved'] = { intents: cs.intents.map((x) => ({ ...x })), hand: [...cs.hand], deck: [...cs.deck], target: cs.target };
  const temp: string[] = [];
  let nId = Object.keys(cs.cards).length;
  const newId = () => { let id = `g${nId++}`; while (cs.cards[id]) id = `g${nId++}`; return id; };
  // ② かばう札
  let cover = roles.coverCard?.id;
  if (!cover) {
    const a = ARTS[COVER_ART];
    const id = newId();
    cs.cards[id] = { id, kind: 'art', name: a?.name ?? 'かばう', fx: { ...(a?.card ?? { type: 'guard', cover: true }) } as CardFx, owner: coverBy.uid, src: COVER_ART, skill: a?.skill ?? 'heavy' };
    temp.push(id); cover = id;
  }
  const coverCost = cs.cards[cover].fx.cost ?? 1;
  // ③ 攻める札：かばう子のほかの子の攻撃の札（戦技・魔法を先に）。行動力の残りで出せるもの
  const room = cs.ap - coverCost;
  const rankKind = (c: Card) => (c.kind === 'basic' ? 1 : 0);
  // 止める札（stun）は使わない：大振りが来なくなり、かばうところが見られない
  const atkOk = (c: Card | undefined): c is Card => !!c && usable(b, c) && c.fx.type === 'atk' && !c.fx.aoe && !c.fx.stun && c.owner !== coverBy.uid && c.owner !== 'teacher' && (c.fx.cost ?? 1) <= room
    && b.units.some((u) => u.uid === c.owner && u.side === 'player' && u.studentId);
  // 狙われる子のほかの子 → 手札にある札 → 戦技・魔法 の順に選ぶ
  const inHand = (c: Card) => (cs.hand.includes(c.id) ? 0 : 1);
  const isWard = (c: Card) => (c.owner === ward.uid ? 1 : 0);
  let atkCard: Card | undefined = [...cs.hand, ...cs.deck, ...cs.discard].map((id) => cs.cards[id]).filter(atkOk)
    .sort((x, y) => isWard(x) - isWard(y) || inHand(x) - inHand(y) || rankKind(x) - rankKind(y))[0];
  if (!atkCard) {
    const who = b.units.find((u) => u.side === 'player' && u.studentId && alive(u) && u !== coverBy && !!weaponOf(u));
    if (!who) return false;
    const id = newId();
    cs.cards[id] = { id, kind: 'basic', name: '斬りつける', fx: { type: 'atk' }, owner: who.uid, src: 'basic' };
    temp.push(id); atkCard = cs.cards[id];
  }
  cs.discard = cs.discard.filter((x) => x !== atkCard!.id);
  bringToHand(cs, cover, [atkCard.id]);
  bringToHand(cs, atkCard.id, [cover]);
  const attacker = b.units.find((u) => u.uid === atkCard!.owner)!;
  // ① 敵の予告：1人が大振りで、狙われる子を。ほかの敵は様子をうかがう
  const h = strikeCalc(s, b, null, foe, ward, { type: 'atk', mul: B.cards.bigMul });
  cs.intents = cs.front.filter((id) => alive(b.units.find((u) => u.uid === id))).map((uid): Intent => uid === foe.uid
    ? { uid, act: 'big', name: '大振り', target: ward.uid, dmg: h.dmg, hits: 1 }
    : { uid, act: 'wait', name: '様子をうかがう', dmg: 0, hits: 0 });
  cs.stun = cs.stun.filter((x) => x !== foe.uid);
  // 攻める札1枚では倒れないように（大振りの前に倒れると、かばうところが見られない）
  const ah = strikeCalc(s, b, null, attacker, foe, atkCard.fx);
  // （会心の一撃が出ても倒れないだけのHPにする。案内の1戦だけの手当て）
  const need = Math.ceil(ah.dmg * ah.hits * B.cards.critMul) + 3;
  if (foe.hp < need) { saved.foeHp = [foe.hp, foe.maxHp]; foe.maxHp = Math.max(foe.maxHp, need); foe.hp = need; }
  cs.target = foe.uid;
  cs.guide = { step: 'intent', foe: foe.uid, ward: ward.uid, coverBy: coverBy.uid, attacker: attacker.uid, cover, atk: atkCard.id, temp, saved };
  s.cardGuide = 'done'; s.cardGuideSeen = true;
  return true;
}

/** ①の次へ（予告を見た） */
export function guideNext(b: BattleState): void {
  const g = b.auto?.cards?.guide;
  if (g && g.step === 'intent') g.step = 'pick';
}

/** 案内を飛ばす：敵の動き・手札をもとに戻す */
export function skipCardGuide(b: BattleState): void {
  const cs = b.auto?.cards;
  const g = cs?.guide;
  if (!cs || !g) return;
  if (g.step !== 'after') {
    cs.intents = g.saved.intents;
    cs.hand = g.saved.hand;
    cs.deck = g.saved.deck;
    cs.target = g.saved.target;
    const f = b.units.find((u) => u.uid === g.foe);
    if (f && g.saved.foeHp) { f.hp = g.saved.foeHp[0]; f.maxHp = g.saved.foeHp[1]; }
    for (const id of g.temp) delete cs.cards[id];
  }
  delete cs.guide;
}

/** 札を出したあと：案内のために足した札は山札に戻さない。結果のあとにひとこと */
export function guideAfterPlay(b: BattleState): void {
  const cs = b.auto?.cards;
  const g = cs?.guide;
  if (!cs || !g || g.step === 'after') return;
  cs.discard = cs.discard.filter((x) => !g.temp.includes(x));
  cs.deck = cs.deck.filter((x) => !g.temp.includes(x));
  cs.hand = cs.hand.filter((x) => !g.temp.includes(x));
  g.step = 'after';
}

/** 案内を終える（結果を見たあと） */
export function endCardGuide(b: BattleState): void {
  const cs = b.auto?.cards;
  if (cs?.guide) delete cs.guide;
}

/** いまの案内の段：intent・cover・atk・play・after（なければ null）。sel＝いま選んでいる札 */
export function guideStage(b: BattleState, sel: string[]): 'intent' | 'cover' | 'atk' | 'play' | 'after' | null {
  const g = b.auto?.cards?.guide;
  if (!g) return null;
  if (g.step === 'intent' || g.step === 'after') return g.step;
  if (!sel.includes(g.cover)) return 'cover';
  if (!sel.includes(g.atk)) return 'atk';
  return 'play';
}

/**
 * 開戦の場面のあと、札を見るとき：最初の依頼（案内つき）なら案内を始める。
 * 今のセーブで遊んでいる人（cardGuide が 'pending'）には、「戦い方が新しくなりました」を1回だけ
 */
export function onCardsOpen(s: GameState): void {
  const b = s.battle;
  const cs = b?.auto?.cards;
  if (!b || !cs || cs.turn !== 1 || cs.phase !== 'play' || cs.guide || s.cardGuide !== 'pending') return;
  const q = s.quests.find((x) => x.id === b.questId);
  if (q?.tutorial && startCardGuide(s, b)) return;
  // 18夜目：案内つきの1戦にできないとき（顔ぶれが少ないなど）も、お知らせは必ず出す（「案内を見る」で手引きを開く）
  cs.guideOffer = true;
}
/** 「戦い方が新しくなりました」への答え */
export function answerGuideOffer(s: GameState, see: boolean): boolean {
  const b = s.battle;
  const cs = b?.auto?.cards;
  if (!b || !cs) return false;
  cs.guideOffer = undefined;
  s.cardGuide = 'done';
  s.cardGuideSeen = true;
  // 案内つきにできないときは false（画面は遊び方の手引きを開く）
  return see ? startCardGuide(s, b) : true;
}
