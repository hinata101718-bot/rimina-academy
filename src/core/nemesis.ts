// 19夜目：宿敵（ネメシス）の芯。覚えていること・再会までの変化・二つ名・情報・因縁の帳。DOMに依存しない
import { heartBattleLines } from './hearts';
import { NEM_SAY, WOUNDS, EPITHET_RULE, EPITHET_WORDS, STUDENT_EPITHET, HEART_TEXT, REUNION_TEXT } from '../data/nemesis';
import { ATK_NAME, ATK_TYPES, type AtkType } from '../data/tactics';
import { CLASSES } from '../data/classes';
import { FACTION_NAMES } from '../data/officers';
import type { LeaderPersonality } from '../data/autobattle';
import type { GameState, EnemyOfficer, OfficerCard, OfficerMemory, BattleFinding, Student, Quest } from './state';
import type { TBattle, TUnit } from './tactics/types';
import { Rng } from './rng';
import { officers, officerById, officerName, rankName, ensureRivalry, stageFor, stageName, voice, whenText, activeOf, headOf } from './officers';
import { maybeDebt, maybeOath } from './bonds';
import { chronicle, mail } from './game';
import { clamp } from './util';
import { B } from '../data/balance';
import { getSupport, supportValue } from './support';

export const NEM = {
  /** 学校と因縁を持つ宿敵の数の目安 */
  bondTarget: 10,
  /** 情報の段階（0〜4）：はじめは顔と名前だけ */
  intelMax: 4,
  /** 弱点を割られて覚える（次から効かない）、新しい弱点が生まれる見込み */
  learnNewWeak: 0.5,
  /** 傷が残る：ブレイクされた・体力が半分を切った */
  woundAt: 0.5,
  /** 傷の数による強さの変化はなし（強くなるのは会うたび） */
  levelPerMeet: 1, levelPerVictim: 1,
  /** 心が変わる見込み（負けて逃げたとき） */
  heartChange: 0.5,
  /** 討ち取ったのに生きている見込み（ふつうの戦い・宿敵戦）。あとで蘇ることがある */
  presumed: 0.1, presumedNem: 0.08,
};

function fill(t: string, v: Record<string, string>): string { return t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m); }
function pickLine(r: Rng, key: string, p: string, used: string[] = []): string {
  const L = NEM_SAY[key];
  const list = (L?.[p as LeaderPersonality] ?? []).concat(L?.default ?? []);
  // 19夜目⑨：同じ相手に同じ台詞を二度言わない（まだ言っていないものから）
  const fresh = list.filter((t) => !used.includes(`${key}:${t}`));
  return fresh.length ? r.pick(fresh) : list.length ? r.pick(list) : '';
}
export function memoryOf(o: EnemyOfficer): OfficerMemory { return (o.memory ??= { beatenBy: [], woundedBy: [], debts: [], shame: [], lost: [] }); }
export function shortName(o: Pick<EnemyOfficer, 'given'>): string { return o.given; }

/** 今の札（ある時点の見た目） */
export function cardOf(s: GameState, o: EnemyOfficer): OfficerCard {
  return { year: s.year, month: s.month, name: officerName(o), rank: rankName(o), level: o.level, wounds: (o.wounds ?? []).length, heart: o.heart, ep: o.epithet };
}

/** 学校との因縁の深さ（在籍・存命の卒業生の因縁＋会った回数） */
export function bondOf(s: GameState, o: EnemyOfficer): number {
  let n = 0;
  for (const rv of Object.values(s.rivalries ?? {})) {
    if (rv.oid !== o.id || rv.settled) continue;
    const st = s.students[rv.sid];
    if (!st || (st.status !== 'enrolled' && !(st.status === 'graduated' && st.career?.alive))) continue;
    if (rv.stage < 1 && !rv.vow && (st.status !== 'enrolled' || (!o.memory?.beatenBy.includes(rv.sid) && !o.memory?.woundedBy.some((w) => w.id === rv.sid) && !o.victims.some((v) => v.id === rv.sid)))) continue;
    n += 1 + rv.stage + (rv.vow ? 2 : 0);
  }
  if (o.memory?.beatenBy.length) n += 1;
  return n;
}
/** 学校と因縁のある宿敵（因縁の帳にのる人） */
export function bondedOfficers(s: GameState): EnemyOfficer[] {
  return officers(s).filter((o) => o.status === 'active' && o.meets.length > 0 && bondOf(s, o) > 0)
    .sort((a, b) => bondOf(s, b) - bondOf(s, a) || b.meets.length - a.meets.length);
}
/** 因縁の帳にのる、今は死んだ・去った宿敵（終わった因縁） */
export function pastNemeses(s: GameState): EnemyOfficer[] {
  return officers(s).filter((o) => o.status !== 'active' && !o.presumed && o.meets.length > 0 && Object.values(s.rivalries ?? {}).some((rv) => rv.oid === o.id && (rv.stage >= 1 || rv.vow || rv.settled)));
}

/** 宿敵と、その子の因縁の短い説明（教え子の関係タブ・帳） */
export function bondText(s: GameState, o: EnemyOfficer, sid: string): string {
  const rv = s.rivalries?.[`${sid}|${o.id}`];
  const st = s.students[sid];
  if (!rv || !st) return '';
  const m = memoryOf(o);
  const parts: string[] = [stageName(rv.stage)];
  if (rv.vow && s.students[rv.vow]) parts.push(`${s.students[rv.vow].given}の仇`);
  if (m.beatenBy.includes(sid)) parts.push(`${o.given}は${st.given}に負けたことを覚えている`);
  const w = m.woundedBy.find((x) => x.id === sid);
  if (w) parts.push(`${st.given}が「${w.text}」を負わせた`);
  if (o.victims.some((v) => v.id === sid)) parts.push(`${st.given}は${o.given}に倒されたことがある`);
  if (rv.settled) parts.push('決着がついた');
  return parts.join('・');
}

/** 情報の段階で見えること */
export function intelOf(o: EnemyOfficer): number { return clamp(o.intel ?? Math.min(2, o.meets.length), 0, NEM.intelMax); }
export function addIntel(o: EnemyOfficer, n = 1): void { o.intel = clamp(intelOf(o) + n, 0, NEM.intelMax); }
/** 密偵の報告：弱点を1つ知る（まだ知らなければ） */
export function scoutWeak(o: EnemyOfficer, r: Rng): AtkType | null {
  const hidden = (o.weak ?? []).filter((t) => !(o.knownWeak ?? []).includes(t));
  if (!hidden.length) return null;
  const t = r.pick(hidden);
  (o.knownWeak ??= []).push(t);
  addIntel(o);
  return t;
}

/** 戦いの中の台詞を決める（uid＝boss。戦いを作るときに一度だけ） */
export function battleLines(s: GameState, o: EnemyOfficer, ids: string[], r: Rng): Record<string, string> {
  const p = o.personality;
  const v = (t: string, extra: Record<string, string> = {}) => voice(fill(t, { name: officerName(o), ...extra }), o);
  const out: Record<string, string> = {};
  const last = o.meets[o.meets.length - 1];
  const m = memoryOf(o);
  const nm = (id?: string | null) => (id && s.students[id] ? s.students[id].given : '');
  // 口上：前に自分をやった子がいれば名前を呼ぶ。傷があれば傷を見せる
  const grudgeHere = o.grudge && ids.includes(o.grudge) ? o.grudge : m.beatenBy.find((x) => ids.includes(x)) ?? null;
  const wound = m.woundedBy.slice().reverse().find((w) => ids.includes(w.id));
  const log = (o.lineLog ??= []);
  // 相手ごとに、言ったことのある台詞を覚えておく（同じ相手に同じことは言わない）
  const said = (who: string | null) => log.filter((x) => x.startsWith(`${who ?? '*'}|`)).map((x) => x.slice(x.indexOf('|') + 1));
  const take = (key: string, who: string | null, vars: Record<string, string> = {}) => { const t = pickLine(r, key, p, said(who)); log.push(`${who ?? '*'}|${key}:${t}`); if (log.length > 40) log.splice(0, log.length - 40); return v(t, vars); };
  if (wound) out['boss:intro'] = take('wound', wound.id, { a: nm(wound.id), wound: wound.text });
  else if (grudgeHere) out['boss:intro'] = take('call', grudgeHere, { a: nm(grudgeHere) });
  else if (o.victims.length && r.chance(0.5)) out['boss:intro'] = take('victim', null, { v: o.victims[o.victims.length - 1].name });
  else if (last) out['boss:intro'] = take('again', null, { when: whenText(s, last.year, last.month) });
  else out['boss:intro'] = take('intro', null);
  for (const k of ['shield', 'break', 'cornered', 'kill', 'fall', 'win', 'flee', 'clung']) out[`boss:${k}`] = v(pickLine(r, k, p));
  out['boss:fled'] = v(pickLine(r, 'fled', p), { a: nm(grudgeHere) || nm(ids[0]) });
  const res = (o.resist ?? [])[0];
  if (res) out['boss:resist'] = v(pickLine(r, 'resist', p), { t: ATK_NAME[res] });
  // 忠義の厚い将は逃げない
  if (o.traits.includes('loyal')) out['boss:canFlee'] = 'no';
  // 命を拾った恩のある将は、教え子の名前を呼ぶ
  if (m.debts.some((d) => ids.includes(d.id))) out['boss:intro'] = v('{a}……あの日の借りがある。だが、戦場は戦場だ。', { a: nm(m.debts.find((d) => ids.includes(d.id))!.id) });
  // 21夜目②：友情・恋のある子がいれば、口上が変わる（とどめを迷う）
  heartBattleLines(s, o, ids, out, r);
  return out;
}

/** 再会のときの文（昔の札と今の札をくらべて） */
export function reunionLines(s: GameState, o: EnemyOfficer): string[] {
  const prev = o.lastCard;
  const out: string[] = [];
  const m = memoryOf(o);
  if (o.reviveNote && o.revived && o.lastCard && !o.presumed) out.push(fill(REUNION_TEXT.revived, { name: o.given, why: o.reviveNote }));
  const w = (o.wounds ?? [])[(o.wounds ?? []).length - 1];
  if (w && prev && (o.wounds ?? []).length > prev.wounds) out.push(fill(REUNION_TEXT.wound, { wound: w.text.replace(/(を失う傷)$/, 'を失っている') }));
  if (prev && prev.rank !== rankName(o)) out.push(fill(REUNION_TEXT.rank, { rank: rankName(o) }));
  if (prev && o.level >= prev.level + 2) out.push(REUNION_TEXT.stronger);
  if (o.rank === 0) out.push(REUNION_TEXT.men);
  if (o.heart && o.heart !== 'steady' && prev?.heart !== o.heart) out.push(fill(REUNION_TEXT.heart, { heart: HEART_TEXT[o.heart] }));
  if (m.lost.length) out.push(`${m.lost[m.lost.length - 1].name}を奪われたことを、恨んでいる。`);
  return out;
}

/** 二つ名を変える（言葉の組み合わせ） */
export function setEpithet(s: GameState, o: EnemyOfficer, word: string, why: string, kind = 'wound'): string | null {
  if (!word || o.epithet === word) return null;
  // 23夜目⑤'：一度ついた二つ名は3年変えない（より大きな出来事のときだけ例外）。一生で3つまで
  const lv = EPITHET_RULE.level[kind] ?? 1;
  if ((o.epithetCount ?? 0) >= EPITHET_RULE.max) return null;
  if (o.epithetYear !== undefined && s.year - o.epithetYear < EPITHET_RULE.wait && lv <= (o.epithetLevel ?? 0)) return null;
  const old = officerName(o);
  o.epithet = word;
  o.epithetWhy = why;
  o.epithetYear = s.year; o.epithetLevel = lv; o.epithetCount = (o.epithetCount ?? 0) + 1;
  (o.epithetLog ??= []).push({ year: s.year, level: lv, word });
  const t = `${FACTION_NAMES[o.faction]}の${old}は、「${officerName(o)}」と呼ばれるようになった（${why}）`;
  chronicle(s, t, 'world');
  return t;
}

function topHitter(s: GameState, u: TUnit): string | null {
  const e = Object.entries(u.hitBy ?? {}).filter(([id]) => !!s.students[id]).sort((a, b) => b[1] - a[1])[0];
  return e?.[0] ?? null;
}

/** 生徒の二つ名（大きな出来事のときだけ） */
export function studentEpithet(s: GameState, st: Student, kind: keyof typeof STUDENT_EPITHET, n: string, r: Rng): string | null {
  const w = fill(r.pick(STUDENT_EPITHET[kind]), { n });
  if (st.epithet === w) return null;
  // 23夜目⑤'：生徒の二つ名も、3年は変えない（宿敵を討つ・退ける大きな出来事は例外）。一生で3つまで
  if ((st.epithetCount ?? 0) >= EPITHET_RULE.max) return null;
  if (st.epithet && st.epithetYear !== undefined && s.year - st.epithetYear < EPITHET_RULE.wait && kind === 'breaker') return null;
  if (st.epithet && st.epithetYear === s.year) return null;
  st.epithet = w;
  st.epithetYear = s.year; st.epithetCount = (st.epithetCount ?? 0) + 1;
  const t = `${st.given}は「${w}${st.given}」と呼ばれるようになった`;
  chronicle(s, t, 'student');
  st.history.push({ year: s.year, text: t });
  return t;
}

/** 教訓を身につける（出来事つき） */
export function addLesson(s: GameState, st: Student, id: string, text: string, why: string, vs?: string): string | null {
  st.lessons ??= [];
  if (st.lessons.some((l) => l.id === id)) return null;
  st.lessons.push({ id, text, why, year: s.year, vs });
  if (st.lessons.length > 6) st.lessons.shift();
  return `${st.given}は教訓「${text}」を身につけた（${why}）`;
}

/** 心を動かす */
export function moveMind(st: Student, k: 'fight' | 'calm' | 'grudge', d: number): void {
  st.mind ??= { fight: 50, calm: 50, grudge: 20 };
  st.mind[k] = clamp(st.mind[k] + d, 0, 100);
}

/**
 * 戦いのあと：敵将の記憶（だれに負け・傷つけられたか、戦い方、屈辱、奪われた人）、再会までの変化、二つ名、生徒の因縁・教訓・心。
 * 結果の画面の「分かったこと」を返す
 */
export function afterTactics(s: GameState, b: TBattle, r: Rng, lines: string[]): BattleFinding[] {
  const out: BattleFinding[] = [];
  const bu = b.units.find((u) => u.boss && u.officerId);
  const o = officerById(s, bu?.officerId);
  if (!bu || !o) { studentsAfter(s, b, r, out, null); return out; }
  const m = memoryOf(o);
  const fn = officerName(o);
  const ids = b.units.filter((u) => u.side === 'me' && u.studentId && !u.teacher).map((u) => u.studentId!);
  // 再会のために、会う前の札を残す
  o.lastCard = cardOf(s, o);
  o.lastMet = { year: s.year, month: s.month };
  const fell = !bu.alive && bu.down === 'dead';
  const fled = bu.down === 'fled' || (b.result === 'win' && bu.alive);
  const foes = Object.keys(bu.hitBy ?? {}).filter((id) => !!s.students[id]);
  const top = topHitter(s, bu);
  const killer = fell ? b.units.find((u) => u.uid === bu.lastHitBy)?.studentId ?? top : null;
  o.meets.push({ year: s.year, month: s.month, title: b.title, result: fell ? 'fell' : b.result === 'win' ? 'fled' : 'lose', foes: foes.slice(0, 6) });
  if (o.meets.length > 16) o.meets.splice(0, o.meets.length - 16);
  addIntel(o);
  // 割られた弱点は、次から効かない（別の弱点が生まれることも）
  for (const t of bu.weakHitBy ?? []) {
    if (!(bu.brokenBy ?? []).length) break;
    if ((o.resist ?? []).includes(t)) continue;
    (o.resist ??= []).push(t);
    o.weak = (o.weak ?? []).filter((x) => x !== t);
    o.knownWeak = (o.knownWeak ?? []).filter((x) => x !== t);
    let nw: AtkType | null = null;
    if (r.chance(NEM.learnNewWeak) || !(o.weak ?? []).length) { const pool = ATK_TYPES.filter((x) => !(o.resist ?? []).includes(x) && !(o.weak ?? []).includes(x)); if (pool.length) { nw = r.pick(pool); o.weak!.push(nw); } }
    const tx = `${fn}は「${ATK_NAME[t]}」の攻めを覚えた。次は効かない${nw ? '（別の弱点が生まれたようだ）' : ''}`;
    lines.push(tx); out.push({ icon: 'lantern', text: tx });
  }
  // 教え子を倒した
  for (const u of b.units) {
    if (u.side !== 'me' || u.alive || !u.studentId || u.teacher || !s.students[u.studentId]) continue;
    if (u.lastHitBy !== bu.uid) continue;
    const st = s.students[u.studentId];
    o.victims.push({ id: st.id, name: st.given, year: s.year, dead: u.down === 'dead' });
    if (u.down === 'dead') { const ep = setEpithet(s, o, fill(r.pick(EPITHET_WORDS.victim), { v: st.given }), `${st.given}を討った`, 'victim'); if (ep) { lines.push(ep); out.push({ icon: 'skull', text: ep }); } }
    o.level += NEM.levelPerVictim;
  }
  if (fell) {
    // 討ち取った（一度蘇った者は、本当に死ぬ。ほかはまれに生きている＝死んだと思われている）
    o.status = 'dead'; o.endYear = s.year; o.endNote = `「${b.title}」で討ち取られた`;
    // とどめを刺しても、まれに生きている（死体が見つからなかった など）。一度蘇った者は、本当に死ぬ
    if (!o.revived && o.kind !== 'monster' && r.chance(b.nemesisId === o.id ? NEM.presumedNem : NEM.presumed)) o.presumed = 'dead';
    const t = `${FACTION_NAMES[o.faction]}の${fn}を討ち取った`;
    chronicle(s, t, 'school'); out.push({ icon: 'star', text: t });
    const ks = killer ? s.students[killer] : null;
    if (ks) ks.nemKills = (ks.nemKills ?? 0) + (b.nemesisId === o.id ? 1 : 0);
    if (ks && b.nemesisId === o.id) { const ep = studentEpithet(s, ks, 'slay', o.given, r); if (ep) { lines.push(ep); out.push({ id: ks.id, icon: 'star', text: ep }); } }
    for (const rv of Object.values(s.rivalries ?? {})) if (rv.oid === o.id && !rv.settled) { rv.settled = 'kill'; rv.settledYear = s.year; rv.log.push({ year: s.year, month: s.month, text: `${ks?.given ?? '仲間'}が討ち取った` }); }
    // 大切な人を奪われた：同じ陣営の縁者（二代目・師弟）が恨む
    for (const x of officers(s)) {
      if (x === o || x.status !== 'active') continue;
      if (x.heirOf === o.id || o.heirOf === x.id) { memoryOf(x).lost.push({ name: o.given, by: killer ?? '', year: s.year }); if (killer) x.grudge = killer; const tt = `${officerName(x)}は、${o.given}を討った${ks?.given ?? '学校'}を恨んでいる`; lines.push(tt); out.push({ icon: 'flame', text: tt }); }
    }
    // 仇を討った子の空しさ（交流の場面の種）
    if (ks) for (const rv of Object.values(s.rivalries ?? {})) if (rv.oid === o.id && rv.sid === ks.id && rv.vow) { (ks.recent ??= []).push({ type: 'ev_avenged', week: s.absWeek, detail: o.given }); moveMind(ks, 'grudge', -30); }
  } else {
    // 生きのびた：傷・屈辱・心の変化・覚えた相手
    const hurt = bu.max > 0 && bu.hp / bu.max <= NEM.woundAt || (bu.brokenBy ?? []).length > 0 || !!bu.escapedWounded;
    if (hurt && top) {
      const wtype = (bu.lastType ?? 'slash') as AtkType;
      const wd = r.pick(WOUNDS[wtype]);
      const wt = wd.text;
      (o.wounds ??= []).push({ text: wt, year: s.year, by: top });
      m.woundedBy.push({ id: top, text: wt, year: s.year });
      o.scars = Math.min(4, (o.scars ?? 0) + 1);
      const tt = `${fn}は${s.students[top]?.given}に「${wt}」を負わされた`;
      lines.push(tt); out.push({ id: top, icon: 'flame', text: tt });
      // 23夜目⑤'：二つ名が変わるのは、体に一生残る大きな傷だけ。言葉は傷の文に合わせる
      if (wd.big && wd.ep) { const ep = setEpithet(s, o, wd.ep, wt, 'wound'); if (ep) { lines.push(ep); out.push({ icon: 'skull', text: ep }); } }
    }
    if (b.result === 'win' && top) {
      if (!m.beatenBy.includes(top)) m.beatenBy.push(top);
      o.grudge = top;
      m.shame.push({ text: `「${b.title}」で学校の${s.students[top]?.given}に退けられた`, year: s.year });
      const ks = s.students[top];
      if (ks && b.nemesisId === o.id && fled) { const ep = studentEpithet(s, ks, 'repel', o.given, r); if (ep) { lines.push(ep); out.push({ id: ks.id, icon: 'star', text: ep }); } }
      // 20夜目④：止めを刺さなかった恩・好敵手の約束（宿敵戦で、宿敵が生きて退いたとき）
      if (b.nemesisId === o.id && fled) {
        const dt = (bu.brokenBy ?? []).length ? maybeDebt(s, o, top, r) : null;
        if (dt) { lines.push(dt); out.push({ id: top, icon: 'lantern', text: dt }); }
        const ot = maybeOath(s, o, top, r);
        if (ot) { lines.push(ot); out.push({ id: top, icon: 'flame', text: ot }); }
      }
      if (r.chance(NEM.heartChange)) { o.heart = r.pick(m.shame.length >= 2 ? ['mad', 'careful'] as const : ['careful', 'steady', 'mad'] as const); }
      if (o.meets.length >= 3 && r.chance(0.5)) { const ep = setEpithet(s, o, EPITHET_WORDS.again[Math.min(EPITHET_WORDS.again.length - 1, o.meets.length - 2)] ?? '不死身の', `${o.meets.length}度目の再会を生きのびた`, 'again'); if (ep) { lines.push(ep); } }
      o.level += NEM.levelPerMeet;
    } else if (b.result === 'lose') {
      o.level += NEM.levelPerMeet;
      // 勝った将は出世する
      if (o.rank > 0 && activeOf(s, o.faction).filter((x) => x.rank === o.rank - 1).length < 4 && (o.rank > 1 || !headOf(s, o.faction))) { o.rank -= 1; const tt = `${FACTION_NAMES[o.faction]}の${fn}が${rankName(o)}に昇進した`; chronicle(s, tt, 'world'); lines.push(tt); }
    }
  }
  // 教え子の側の因縁
  for (const id of foes) {
    const st = s.students[id];
    if (!st || (st.status !== 'enrolled' && st.status !== 'graduated')) continue;
    const rv = ensureRivalry(s, id, o.id);
    if (rv.settled) continue;
    rv.battles += 1;
    const st0 = rv.stage;
    rv.stage = Math.max(st0, stageFor(rv));
    if (rv.stage > st0) { const t = `${st.given}と${fn}は「${stageName(rv.stage)}」になった`; rv.log.push({ year: s.year, month: s.month, text: `${stageName(rv.stage)}になった` }); out.push({ id, icon: 'flame', text: t }); if (rv.stage >= 2) chronicle(s, t, 'student'); }
  }
  // 仲間を倒された子は、仇討ちを誓う
  for (const v of b.units.filter((u) => u.side === 'me' && !u.alive && u.down === 'dead' && u.lastHitBy === bu.uid && u.studentId)) {
    const close = Object.values(s.students).filter((y) => y.status === 'enrolled' && y.id !== v.studentId && (getSupport(s, y.id, v.studentId!).kind === 'love' || supportValue(s, y.id, v.studentId!) >= B.support.B)).slice(0, 2);
    for (const y of close) {
      if (o.status !== 'active') continue;
      const rv = ensureRivalry(s, y.id, o.id);
      if (rv.vow) continue;
      rv.vow = v.studentId!; rv.stage = Math.max(1, rv.stage);
      moveMind(y, 'grudge', 25);
      const t = `${y.given}は、${s.students[v.studentId!].given}の仇として${fn}を討つと誓った`;
      rv.log.push({ year: s.year, month: s.month, text: t }); chronicle(s, t, 'student'); out.push({ id: y.id, icon: 'flame', text: t });
    }
  }
  studentsAfter(s, b, r, out, o);
  return out;
}

/** 教え子の心と教訓（戦いのあと） */
function studentsAfter(s: GameState, b: TBattle, r: Rng, out: BattleFinding[], o: EnemyOfficer | null): void {
  const won = b.result === 'win';
  for (const u of b.units) {
    if (u.side !== 'me' || !u.studentId || u.teacher) continue;
    const st = s.students[u.studentId];
    if (!st || st.status !== 'enrolled') continue;
    moveMind(st, 'fight', won ? 2 : -3);
    if (b.nemesisId) moveMind(st, 'calm', u.alive ? 2 : -4);
    // 教訓：同じ敵将に二度負けた → その兵種に強くなる
    if (o && !won) {
      const lostTo = o.meets.filter((mt) => mt.result === 'lose' && (mt.foes ?? []).includes(st.id)).length;
      const cls = CLASSES[o.classId] ? o.classId : null;
      if (lostTo >= 2 && cls) { const t = addLesson(s, st, `vs_${cls}`, `${CLASSES[cls].name}に強い`, `${o.given}に二度負けた`, cls); if (t) out.push({ id: st.id, icon: 'lantern', text: t }); }
    }
    // 教訓：炎の中を生きのびた
    const burned = u.alive && u.taken >= u.max * 0.6 && b.units.some((f) => f.side === 'foe' && f.type === 'fire');
    if (burned && r.chance(0.4)) { const t = addLesson(s, st, 'fire', '炎を恐れない', `「${b.title}」の炎の中を生きのびた`, 'fire'); if (t) out.push({ id: st.id, icon: 'lantern', text: t }); }
    // 教訓：宿敵と戦った子は、その宿敵の癖をつかむ
    if (o && b.nemesisId === o.id && u.alive && (o.meets.filter((mt) => (mt.foes ?? []).includes(st.id)).length >= 2)) { const t = addLesson(s, st, `nem_${o.id}`, `${o.given}の癖を知る`, `${o.given}と何度も戦った`, o.id); if (t) out.push({ id: st.id, icon: 'lantern', text: t }); }
    // 二つ名：ブレイクを何度も
    if (u.breaks >= 3 && r.chance(0.3)) { const t = studentEpithet(s, st, 'breaker', '', r); if (t) out.push({ id: st.id, icon: 'star', text: t }); }
  }
}

/** 宿敵の手紙（果たし状・恨み言・礼状） */
export function nemesisLetter(s: GameState, o: EnemyOfficer, kind: 'challenge' | 'grudge' | 'thanks', text: string, sid?: string): void {
  mail(s, officerName(o), kind === 'challenge' ? '果たし状' : kind === 'grudge' ? '恨み言' : '礼状', text, sid, true);
}

/** 再会の札（昔と今）を出す */
export function pushReunion(s: GameState, o: EnemyOfficer, ids: string[], kind: 'reunion' | 'rumor' | 'first' | 'revived' | 'letter' | 'ally' | 'rival' | 'spy' | 'heart', text: string[]): void {
  s.pending.push({ type: 'nemesis', officerId: o.id, studentIds: ids, kind, text });
}

/** 宿敵戦のあと：逃げた宿敵の捨て台詞、討ち取った宿敵の最期を、年表と手紙に */
export function afterNemesisBattle(s: GameState, b: TBattle, report: { lines: string[] }): void {
  const bu = b.units.find((u) => u.boss && u.officerId);
  const o = officerById(s, bu?.officerId);
  if (!bu || !o || !b.nemesisId) return;
  const r = new Rng({ rng: (s.year * 997 + s.month * 31 + o.id.length) | 0 });
  if (bu.down === 'fled' || (bu.alive && b.result === 'win')) {
    const top = Object.entries(bu.hitBy ?? {}).sort((a, c) => c[1] - a[1])[0]?.[0];
    const st = top ? s.students[top] : null;
    const w = (o.wounds ?? [])[(o.wounds ?? []).length - 1];
    if (st && w && r.chance(0.5)) nemesisLetter(s, o, 'grudge', voice(`${st.given}。この${w.text}を見るたびに、お前の顔を思い出す。いつか必ず。—${officerName(o)}`, o), st.id);
  }
  void report;
}

// ---------- 宿敵戦のきっかけ（月末） ----------
export const NEM_MONTH = {
  /** 依頼の先に宿敵がいる見込み（因縁のある宿敵がいるとき） */
  quest: 0.24,
  /** 宿敵から挑んでくる（果たし状。断れない） */
  challenge: 0.07,
  /** 執念の燃えた教え子が、許しを待たずに向かう（執念がこれ以上で、仇討ちの誓いがある子） */
  rush: 0.25, rushGrudge: 85,
  /** うわさが届く */
  rumor: 0.25,
};
const FACTION_FIELD: Record<string, string[]> = { kingdom: ['fort', 'plain'], empire: ['fort', 'snow'], alliance: ['ship', 'ruins'], bandit: ['woods', 'ruins', 'pass'], monster: ['woods'] };
/** 宿敵ごとの戦場（はじめて宿敵戦になるときに決まる） */
export function nemesisField(o: EnemyOfficer, r: Rng): string { return (o.field ??= r.pick(FACTION_FIELD[o.faction] ?? ['plain'])); }

/** 月末の依頼に、宿敵を結びつける（依頼の先に宿敵／果たし状／勝手に向かった子）。再会の札を、依頼の前に出す */
export function nemesisMonth(s: GameState, r: Rng): void {
  if (s.quests.some((q) => q.tutorial || q.kind === 'exhibition' || q.kind === 'schoolDefense')) return;
  const bonded = bondedOfficers(s).filter((o) => o.status === 'active' && o.kind !== 'monster' && !o.alumniId);
  if (!bonded.length && !s.nextNemesis) return;
  const enrolledIds = new Set(Object.values(s.students).filter((x) => x.status === 'enrolled').map((x) => x.id));
  const mk = (o: EnemyOfficer, kind: 'quest' | 'challenge' | 'rush', rushBy?: string) => {
    nemesisField(o, r);
    let q = kind === 'quest' ? s.quests.filter((x) => x.real && !x.small && !x.nemesisId).sort((a, c) => c.danger - a.danger)[0] : undefined;
    if (!q) {
      q = { id: `q${s.nextId++}`, kind: 'border', title: '', client: kind === 'challenge' ? '果たし状' : '書き置き', clientCountry: null, enemyCountry: o.country, objective: 'boss', template: 'field', level: Math.max(1, o.level - 2), reward: 300 + o.level * 20, danger: 2, weather: 'clear', real: true };
      s.quests.unshift(q);
    }
    q.nemesisId = o.id; q.nemesisKind = kind; q.objective = 'boss';
    if (o.country) q.enemyCountry = o.country;
    q.title = kind === 'challenge' ? `果たし状：${officerName(o)}` : kind === 'rush' ? `${s.students[rushBy!]?.given}を追って` : `${q.title}（${o.given}の影）`;
    if (kind !== 'quest') q.mustGo = true;
    if (rushBy) q.rushBy = rushBy;
    const ids = Object.values(s.rivalries ?? {}).filter((rv) => rv.oid === o.id && enrolledIds.has(rv.sid)).map((rv) => rv.sid).slice(0, 3);
    const lines: string[] = [];
    if (kind === 'challenge') { const tgt = o.grudge && s.students[o.grudge] ? s.students[o.grudge].given : '学校の者'; lines.push(voice(`${tgt}へ。決着をつけたい。来なければ、学校ごと焼くまでだ。—${officerName(o)}`, o)); nemesisLetter(s, o, 'challenge', lines[0], o.grudge ?? undefined); }
    else if (kind === 'rush') lines.push(`${s.students[rushBy!]?.given}の姿がない。机の上に書き置きがあった。「${o.given}を討ちに行きます。止めないでください」`);
    else lines.push(`依頼の先に、${officerName(o)}がいる。`);
    lines.push(...reunionLines(s, o));
    if (o.lastMet) lines.push(`最後に会ったのは${whenText(s, o.lastMet.year, o.lastMet.month)}。`);
    pushReunion(s, o, rushBy ? [rushBy, ...ids.filter((x) => x !== rushBy)] : ids, o.revived && o.reviveNote && !o.presumed ? 'revived' : 'reunion', lines);
  };
  // 20夜目④：捕らわれた密偵を救い出す（断れない）
  if (s.spyCaptive) {
    const sc = s.spyCaptive; s.spyCaptive = undefined;
    const o = officerById(s, sc.oid), st = s.students[sc.sid];
    if (st && o && o.status === 'active' && st.status === 'enrolled') {
      if (s.nextNemesis === o.id) s.nextNemesis = undefined;
      nemesisField(o, r);
      const q: Quest = { id: `q${s.nextId++}`, kind: 'rescue', title: `${st.given}を救い出せ`, client: '学校', clientCountry: null, enemyCountry: o.country, objective: 'rescue', template: 'field', level: Math.max(1, o.level - 2), reward: 200, danger: 2, weather: 'clear', real: true, nemesisId: o.id, nemesisKind: 'quest', mustGo: true, spyRescue: st.id };
      s.quests.unshift(q);
      pushReunion(s, o, [st.id], 'reunion', [`${officerName(o)}の陣に、${st.given}が捕らわれている。`, voice(`ねずみが一匹、迷いこんできた。返してほしければ、取りに来い`, o), ...reunionLines(s, o)]);
      return;
    }
    if (st) st.injuredWeeks = Math.min(st.injuredWeeks, 1);
  }
  // 勝手に向かう子
  for (const rv of Object.values(s.rivalries ?? {})) {
    const st = s.students[rv.sid];
    const o = bonded.find((x) => x.id === rv.oid);
    if (!o || !st || st.status !== 'enrolled' || !rv.vow || rv.settled || (st.mind?.grudge ?? 0) < NEM_MONTH.rushGrudge || st.injuredWeeks > 0) continue;
    if (!r.chance(NEM_MONTH.rush)) continue;
    mk(o, 'rush', st.id);
    return;
  }
  // 蘇った者・敵として戻った先代は、すぐに現れる
  if (s.nextNemesis) { const o = officerById(s, s.nextNemesis); s.nextNemesis = undefined; if (o && o.status === 'active') { mk(o, 'quest'); return; } }
  if (!bonded.length) return; // 20夜目：次の宿敵（蘇り・密偵）がもういないとき、因縁のある宿敵がいなければここまで
  const grudging = bonded.filter((o) => o.grudge && enrolledIds.has(o.grudge));
  if (grudging.length && r.chance(NEM_MONTH.challenge)) { mk(r.pick(grudging), 'challenge'); return; }
  if (r.chance(NEM_MONTH.quest)) mk(r.weighted(bonded, (o) => 1 + bondOf(s, o)), 'quest');
  else if (r.chance(NEM_MONTH.rumor)) rumor(s, r, r.pick(bonded));
}

/** うわさ（手紙・新聞の種）。情報が少し増える */
export function rumor(s: GameState, r: Rng, o: EnemyOfficer): void {
  const t = r.pick([
    `${officerName(o)}の姿を、国境の町で見たという者がいる。`,
    `${officerName(o)}が${rankName(o)}として兵を集めているらしい。`,
    o.grudge && s.students[o.grudge] ? `${officerName(o)}が「${s.students[o.grudge].given}」という名を口にしていたらしい。` : `${officerName(o)}が、学校のことを調べているらしい。`,
  ]);
  mail(s, '旅の行商人', `うわさ：${o.given}`, t, undefined, false);
  if (r.chance(0.5)) addIntel(o);
}
