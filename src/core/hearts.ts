// 21夜目②：宿敵との友情と恋（問12 D）。DOMに依存しない
// 芽生える：止めを刺さなかった恩・好敵手の約束・戦場の外の再会（捕虜の引き渡し・和平の席）
// 芽生えると：手紙（思い出話）・気持ちを確かめ合う場面・宿敵戦の口上・とどめを迷う・味方になる見込み・どちらかが討たれたときの重い場面
import { B } from '../data/balance';
import { HEART_SPROUT, HEART_LETTER, HEART_REPLY, HEART_CONFESS, HEART_INTRO, HEART_HESITATE, HEART_MOURN, HEART_ALLY, type HeartKind, type HeartWhy } from '../data/hearts';
import type { GameState, EnemyOfficer, Rivalry, Student } from './state';
import { Rng } from './rng';
import { officerById, officerName, officers, voice } from './officers';
import { pushReunion, moveMind } from './nemesis';
import { chronicle, mail } from './game';

const A = () => B.bonds;

function fillH(t: string, st: Student, o: EnemyOfficer): string {
  return t.replace(/\{a\}/g, st.given).replace(/\{og\}/g, o.given).replace(/\{o\}/g, officerName(o));
}
/** 場面の行に（q で始まる行は宿敵のせりふ） */
function render(lines: string[], st: Student, o: EnemyOfficer): string[] {
  return lines.map((l) => (l.startsWith('q') ? `${o.given}「${voice(fillH(l.slice(1), st, o), o)}」` : fillH(l, st, o)));
}
function studentAlive(st: Student | undefined): boolean { return !!st && st.status !== 'dead' && st.career?.alive !== false; }

/** 縁のある組（まだ続いている） */
export function hearts(s: GameState): Rivalry[] { return Object.values(s.rivalries ?? {}).filter((rv) => !!rv.heart); }
/** その宿敵と縁のある組 */
export function heartsOf(s: GameState, oid: string): Rivalry[] { return hearts(s).filter((rv) => rv.oid === oid && !rv.heart!.mourned); }
export function heartOf(s: GameState, sid: string, oid: string): Rivalry['heart'] | null { return s.rivalries?.[`${sid}|${oid}`]?.heart ?? null; }

/** 縁が芽生える（新しい縁は、前の縁から何年かあける） */
export function sproutHeart(s: GameState, rv: Rivalry, why: HeartWhy, r: Rng): string | null {
  const st = s.students[rv.sid];
  const o = officerById(s, rv.oid);
  if (!st || !o || rv.heart || !studentAlive(st) || o.status !== 'active' || o.heart === 'mad' || o.kind === 'monster') return null;
  if (s.heartYear !== undefined && s.year - s.heartYear < A().heartGap) return null;
  // 宿敵ひとりに縁は一つまで
  if (heartsOf(s, o.id).length) return null;
  const kind: HeartKind = r.chance(A().heartLove) ? 'love' : 'friend';
  rv.heart = { kind, year: s.year, why, letters: 0 };
  s.heartYear = s.year;
  rv.log.push({ year: s.year, month: s.month, text: kind === 'love' ? '想いが芽生えた' : '友情が芽生えた' });
  const lines = render(HEART_SPROUT[why][kind], st, o);
  pushReunion(s, o, [st.id], 'heart', lines);
  const t = `${st.given}と${officerName(o)}のあいだに、${kind === 'love' ? '想い' : '友情'}が芽生えた`;
  chronicle(s, t, 'student');
  st.history.push({ year: s.year, text: `敵の将、${o.given}とのあいだに${kind === 'love' ? '想い' : '友情'}が芽生えた` });
  return t;
}

/** 月末：戦場の外の再会・手紙・気持ちを確かめ合う・どちらかが討たれたとき */
export function heartsMonth(s: GameState, r: Rng): void {
  // どちらかが討たれた（重い場面）
  for (const rv of hearts(s)) {
    const h = rv.heart!;
    if (h.mourned) continue;
    const st = s.students[rv.sid];
    const o = officerById(s, rv.oid);
    if (!st || !o) { h.mourned = true; continue; }
    const oDead = o.status === 'dead' && !o.presumed;
    if (!oDead && studentAlive(st)) continue;
    h.mourned = true;
    const byHand = oDead && rv.settled === 'kill' && rv.log.some((l) => l.text === `${st.given}が討ち取った`);
    const lines = render(oDead ? (byHand ? HEART_MOURN.byHand : HEART_MOURN.officer)[h.kind] : HEART_MOURN.student[h.kind], st, o);
    pushReunion(s, o, [st.id], 'heart', lines);
    if (oDead && studentAlive(st)) {
      moveMind(st, 'calm', -15); moveMind(st, 'fight', -10);
      st.history.push({ year: s.year, text: `${h.kind === 'love' ? '想いを寄せた' : '友と呼んだ'}敵の将、${o.given}を${byHand ? 'この手で討った' : '失った'}` });
      chronicle(s, `${st.given}は、${h.kind === 'love' ? '想いを寄せた' : '友と呼んだ'}${officerName(o)}を${byHand ? '自らの手で討った' : '失った'}`, 'student');
    }
    rv.log.push({ year: s.year, month: s.month, text: oDead ? `${o.given}が倒れた` : `${st.given}が倒れた` });
  }
  // 手紙（思い出話）と、気持ちを確かめ合う場面
  for (const rv of hearts(s)) {
    const h = rv.heart!;
    const st = s.students[rv.sid];
    const o = officerById(s, rv.oid);
    if (h.mourned || !st || !o || !studentAlive(st) || o.status === 'dead') continue;
    if (!h.confessed && h.letters >= A().confessAfter && r.chance(A().heartConfess)) {
      h.confessed = true;
      rv.log.push({ year: s.year, month: s.month, text: h.kind === 'love' ? '想いを打ち明け合った' : '友と呼び合った' });
      pushReunion(s, o, [st.id], 'heart', render(HEART_CONFESS[h.kind], st, o));
      const t = h.kind === 'love' ? `${st.given}と${officerName(o)}は、敵どうしのまま想いを打ち明け合った` : `${st.given}と${officerName(o)}は、たがいを友と呼び合った`;
      chronicle(s, t, 'student');
      st.history.push({ year: s.year, text: h.kind === 'love' ? `${o.given}と想いを打ち明け合った` : `${o.given}と友と呼び合った` });
      continue;
    }
    if (r.chance(A().heartLetter)) {
      h.letters += 1;
      const body = voice(fillH(HEART_LETTER[h.kind][(h.letters - 1) % HEART_LETTER[h.kind].length], st, o), o);
      mail(s, officerName(o), h.kind === 'love' ? `${st.given}への手紙` : `${st.given}への便り`, body, st.id, false);
      pushReunion(s, o, [st.id], 'heart', [`${officerName(o)}から、${st.given}に手紙が届いた。`, body, fillH(r.pick(HEART_REPLY[h.kind]), st, o)]);
    }
  }
  // 戦場の外の再会（捕虜の引き渡し・和平の席）
  if (r.chance(A().heartMeet)) {
    const cands = Object.values(s.rivalries ?? {}).filter((rv) => !rv.heart && !rv.settled && rv.battles >= 1 && studentAlive(s.students[rv.sid]) && officerById(s, rv.oid)?.status === 'active');
    if (cands.length) sproutHeart(s, r.pick(cands), 'meet', r);
  }
}

/** 宿敵戦の台詞：縁のある子がいれば、口上が変わり、とどめを迷う（engine が lines の heart: を見る） */
export function heartBattleLines(s: GameState, o: EnemyOfficer, ids: string[], out: Record<string, string>, r: Rng): void {
  for (const rv of heartsOf(s, o.id)) {
    if (!ids.includes(rv.sid)) continue;
    const st = s.students[rv.sid];
    if (!st) continue;
    const k = rv.heart!.kind;
    out['boss:intro'] = voice(fillH(r.pick(HEART_INTRO[k]), st, o), o);
    out[`heart:s_${st.id}`] = k;
    out[`heart:hesitate:s_${st.id}`] = fillH(HEART_HESITATE[k], st, o);
  }
}

/** 年度末：縁のある宿敵が、味方になる見込み（恩があれば倍。縁だけでも少し） */
export function heartAllyChance(s: GameState, o: EnemyOfficer, hasDebt: boolean): number {
  const hs = heartsOf(s, o.id);
  if (!hs.length) return hasDebt ? A().allyDebt : 0;
  const conf = hs.some((rv) => rv.heart!.confessed) ? 2 : 1;
  return hasDebt ? Math.min(0.9, A().allyDebt * A().heartAllyMul * conf) : A().heartAlly * conf;
}
/** 縁のために味方になったときの場面 */
export function heartAllyLines(s: GameState, o: EnemyOfficer): { lines: string[]; sid: string } | null {
  const rv = heartsOf(s, o.id)[0];
  const st = rv ? s.students[rv.sid] : null;
  if (!rv || !st) return null;
  return { lines: render(HEART_ALLY[rv.heart!.kind], st, o), sid: st.id };
}

/** シミュレーション用：縁の数（友情・恋・確かめ合った・討たれた） */
export function heartCounts(s: GameState): { friend: number; love: number; confessed: number; mourned: number } {
  const L = hearts(s);
  return { friend: L.filter((x) => x.heart!.kind === 'friend').length, love: L.filter((x) => x.heart!.kind === 'love').length, confessed: L.filter((x) => x.heart!.confessed).length, mourned: L.filter((x) => x.heart!.mourned).length };
}
void officers;
