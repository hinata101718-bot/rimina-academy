// 20夜目④：宿敵とのもう一つの縁（宿敵が味方になる・好敵手）と、密偵を送る（問12・問17）。DOMに依存しない
import { B } from '../data/balance';
import { ATK_NAME, type AtkType } from '../data/tactics';
import { CLASSES } from '../data/classes';
import { OFFICER_TRAITS, FACTION_NAMES } from '../data/officers';
import type { GameState, EnemyOfficer, Student } from './state';
import { Rng } from './rng';
import { officers, officerName, officerById, voice, rivalriesOf } from './officers';
import { memoryOf, pushReunion, addIntel, intelOf } from './nemesis';
import { chronicle, mail, notify, available } from './game';
import { absMonth } from './util';

const A = () => B.bonds;

/** 学校と因縁のある宿敵（味方・死んだ者を除く） */
function bondedActive(s: GameState): EnemyOfficer[] {
  const ids = new Set(Object.values(s.rivalries ?? {}).filter((rv) => !rv.settled && (rv.stage >= 1 || rv.vow || rv.battles >= 1)).map((rv) => rv.oid));
  return officers(s).filter((o) => ids.has(o.id) && o.status === 'active' && o.kind !== 'monster' && !o.alumniId && !o.allied);
}

// ---------- 宿敵が味方になる ----------

/** 宿敵戦に勝ち、宿敵が生きて退いたとき：止めを刺さなかった恩が残ることがある */
export function maybeDebt(s: GameState, o: EnemyOfficer, top: string | null, r: Rng): string | null {
  if (!top || o.heart === 'mad' || !s.students[top] || !r.chance(A().debtChance)) return null;
  const m = memoryOf(o);
  if (m.debts.some((d) => d.id === top)) return null;
  m.debts.push({ id: top, text: '崩れたところに、止めを刺さなかった', year: s.year });
  return `${s.students[top].given}は、崩れた${o.given}に止めを刺さなかった。${o.given}は何も言わずに去った`;
}

/** 味方にする（恩返し／国に裏切られた） */
export function makeAlly(s: GameState, o: EnemyOfficer, why: 'debt' | 'betrayed', report?: string[]): void {
  const m = memoryOf(o);
  const from = FACTION_NAMES[o.faction];
  o.allied = { year: s.year, why };
  o.status = 'retired'; o.endYear = s.year; o.endNote = '学校の味方になった';
  const ids: string[] = [];
  for (const rv of Object.values(s.rivalries ?? {})) if (rv.oid === o.id) { rv.settled = 'ally'; rv.settledYear = s.year; rv.log.push({ year: s.year, month: s.month, text: '学校の味方になった' }); if (s.students[rv.sid]) ids.push(rv.sid); }
  const debtor = m.debts[0] ? s.students[m.debts[0].id] : null;
  const lines = why === 'debt'
    ? [`${officerName(o)}が、ひとりで学校の門の前に立っていた。`, voice(`${debtor ? `${debtor.given}。` : ''}あの日、お前は止めを刺さなかった。借りは返す。……今日から、この剣は学校のために振るう`, o), `${officerName(o)}が学校の味方になった。これからは、ときどき戦場に駆けつけてくれる。`]
    : [`${from}は、負け続けた責めを${officerName(o)}ひとりに負わせ、すべてを取り上げた。`, voice(`国は、わたしを捨てた。……笑うがいい。だが、お前たちだけは、最後まで正面からわたしと戦った`, o), `${officerName(o)}が学校の味方になった。これからは、ときどき戦場に駆けつけてくれる。`];
  const t = `宿敵だった${officerName(o)}が、${why === 'debt' ? '恩を返すため' : `${from}に裏切られ`}、学校の味方になった`;
  chronicle(s, t, 'school'); report?.push(t);
  notify(s, t);
  pushReunion(s, o, debtor ? [debtor.id, ...ids.filter((x) => x !== debtor.id)].slice(0, 3) : ids.slice(0, 3), 'ally', lines);
}

/** 年度末：恩のある宿敵・国に裏切られた宿敵が、味方になる */
export function yearlyAllies(s: GameState, r: Rng, report: string[]): void {
  for (const o of bondedActive(s)) {
    const m = memoryOf(o);
    if (m.debts.length && o.heart !== 'mad' && r.chance(A().allyDebt)) { makeAlly(s, o, 'debt', report); continue; }
    if (o.faction !== 'bandit' && m.shame.length >= A().betrayShame && r.chance(A().allyBetrayed)) { makeAlly(s, o, 'betrayed', report); continue; }
  }
}

/** 味方になった宿敵（戦場に駆けつけてくれる。年をとると来なくなる） */
export function allies(s: GameState): EnemyOfficer[] { return officers(s).filter((o) => o.allied && o.endNote === '学校の味方になった' && o.age < A().allyMaxAge); }

// ---------- 好敵手 ----------

/** 宿敵戦のあと：たがいに名を呼び合った二人（宿敵が生きのび、教え子が宿敵を傷つけた）は、決着を約束する */
export function maybeOath(s: GameState, o: EnemyOfficer, sid: string | null, r: Rng): string | null {
  if (!sid || o.heart === 'mad' || o.status !== 'active') return null;
  const rv = s.rivalries?.[`${sid}|${o.id}`];
  const st = s.students[sid];
  if (!rv || !st || rv.oath || rv.settled || rv.vow || rv.battles < A().oathBattles || !r.chance(A().oathChance)) return null;
  // 好敵手は、ひとりの宿敵に1人だけ
  if (Object.values(s.rivalries ?? {}).some((x) => x.oid === o.id && x.oath)) return null;
  rv.oath = { year: s.year, month: s.month };
  rv.log.push({ year: s.year, month: s.month, text: '好敵手として、決着を約束した' });
  o.grudge = sid;
  const lines = [
    voice(`${st.given}……${st.given}か。覚えた。次に会うときまで、だれにも負けるな`, o),
    `「${o.given}。次は、わたしが勝つ」——${st.given}は、去っていく背中に名前を呼んだ。`,
    `二人は、たがいの名を呼び合い、決着を約束した。${o.given}は「好敵手」になった。`,
  ];
  pushReunion(s, o, [sid], 'rival', lines);
  const t = `${st.given}と${officerName(o)}が、好敵手として決着を約束した`;
  chronicle(s, t, 'student');
  return t;
}
/** 好敵手の約束をした子（戦いで、その宿敵への傷が少し増える） */
export function oathOf(s: GameState, sid: string, oid: string): boolean { return !!s.rivalries?.[`${sid}|${oid}`]?.oath; }

// ---------- 密偵を送る ----------

export interface SpyResult { ok: boolean; caught: boolean; lines: string[] }

/** この月に、まだ密偵を送っていないか */
export function spyReady(s: GameState): boolean { return (s.spyMonth ?? -1) !== absMonth(s.year, s.month); }
/** 密偵を送れる宿敵 */
export function spyTargets(s: GameState): EnemyOfficer[] { return bondedActive(s); }
/** 密偵に向いている教え子（密偵の系統ほど、速さと技が高いほど） */
export function spyCandidates(s: GameState): Student[] {
  return Object.values(s.students).filter((x) => available(x)).sort((a, b) => spyScore(b) - spyScore(a));
}
export function spyScore(st: Student): number {
  const line = (CLASSES[st.classId] as { line?: string } | undefined)?.line;
  return (line === 'dagger' ? 40 : 0) + st.stats.spd * 2 + st.stats.skl + Math.floor((st.skills.tactics ?? 0) / 20);
}
/** 見つからずに戻る見込み（％） */
export function spyChance(s: GameState, st: Student, o: EnemyOfficer): number {
  const S = A();
  const line = (CLASSES[st.classId] as { line?: string } | undefined)?.line;
  const v = S.spyBase + (line === 'dagger' ? S.spyDagger : 0) + Math.min(S.spyStatMax, (st.stats.spd + st.stats.skl) * S.spyPerStat) - (o.traits.includes('wary') ? 10 : 0) - (o.rank === 0 ? 10 : 0);
  void s;
  return Math.max(10, Math.min(95, Math.round(v)));
}

/** 密偵を送る（月に1回、宿敵ひとりに）。弱点・性格・次の動きが分かる。見つかると捕らわれる */
export function sendSpy(s: GameState, sid: string, oid: string, r: Rng): SpyResult {
  const st = s.students[sid];
  const o = officerById(s, oid);
  if (!st || !o || !spyReady(s) || !available(st)) return { ok: false, caught: false, lines: ['いまは密偵を送れません'] };
  s.spyMonth = absMonth(s.year, s.month);
  s.stats.spies = (s.stats.spies ?? 0) + 1;
  const ok = r.next() * 100 < spyChance(s, st, o);
  const lines: string[] = [];
  const nm = officerName(o);
  if (ok) {
    const rec: NonNullable<EnemyOfficer['spied']>[number] = { year: s.year, month: s.month };
    // 弱点
    const hidden = (o.weak ?? []).find((w) => !(o.knownWeak ?? []).includes(w));
    if (hidden) { (o.knownWeak ??= []).push(hidden); rec.weak = hidden; lines.push(`弱点：${nm}は「${ATK_NAME[hidden as AtkType]}」の攻めに弱いらしい。`); }
    else lines.push(`弱点：分かっている弱点のほかには、見つからなかった。${(o.resist ?? []).length ? `「${(o.resist ?? []).map((x) => ATK_NAME[x as AtkType]).join('・')}」は、もう効かない。` : ''}`);
    // 性格
    const tid = o.traits.find((t) => !o.knownTraits.includes(t) && !!OFFICER_TRAITS[t]);
    if (tid) { o.knownTraits.push(tid); rec.trait = tid; lines.push(`性格：「${OFFICER_TRAITS[tid].name}」——${OFFICER_TRAITS[tid].desc}`); }
    else lines.push(`性格：${o.heart === 'mad' ? '怒りで我を忘れかけている。' : o.heart === 'careful' ? '前より慎重になっている。' : '落ち着いている。'}`);
    // 次の動き
    const g = o.grudge && s.students[o.grudge] ? s.students[o.grudge] : null;
    const plan = g && g.status === 'enrolled' ? `${g.given}を狙って、近いうちに動くつもりだ` : o.rank <= 1 ? '兵を集め、国境へ向かう支度をしている' : '傷を癒やし、次の機会を待っている';
    rec.plan = plan;
    lines.push(`次の動き：${plan}。`);
    addIntel(o);
    (o.spied ??= []).push(rec);
    if (o.spied.length > 6) o.spied.splice(0, o.spied.length - 6);
    // 密偵として敵の将を失脚させる（影の王の条件）：同じ宿敵に3度入りこめた密偵の系統の子は、偽の知らせで失脚させることがある
    const line = (CLASSES[st.classId] as { line?: string } | undefined)?.line;
    const mine = o.spied.filter((x) => x.year >= s.year - 3).length;
    if (line === 'dagger' && mine >= A().toppleAfter && r.chance(A().toppleChance)) {
      o.status = 'retired'; o.endYear = s.year; o.endNote = '偽の知らせで失脚した';
      (st.deeds ??= {}).topple = (st.deeds.topple ?? 0) + 1;
      for (const rv of Object.values(s.rivalries ?? {})) if (rv.oid === o.id && !rv.settled) { rv.settled = 'persuade'; rv.settledYear = s.year; rv.log.push({ year: s.year, month: s.month, text: `${st.given}の密偵の働きで失脚した` }); }
      const t = `${st.given}が密偵として流した偽の知らせで、${nm}は${FACTION_NAMES[o.faction]}を追われた（失脚）`;
      lines.push(t); chronicle(s, t, 'student');
    }
    st.history.push({ year: s.year, text: `密偵として${nm}の陣にもぐりこみ、無事に戻った` });
    pushReunion(s, o, [st.id], 'spy', [`${st.given}が、${nm}の陣から戻ってきた。密偵の報告：`, ...lines]);
    return { ok: true, caught: false, lines };
  }
  // 見つかった：半分は逃げ帰る。半分は捕らわれる（来月、救い出す戦いになる）
  if (r.chance(A().spyCaught)) {
    st.injuredWeeks = Math.max(st.injuredWeeks, A().captiveWeeks);
    s.spyCaptive = { sid: st.id, oid: o.id };
    s.nextNemesis = o.id;
    st.history.push({ year: s.year, text: `密偵として${nm}の陣にもぐりこみ、捕らわれた` });
    lines.push(`${st.given}が戻らない。${nm}の陣で見つかり、捕らわれたらしい。`, '来月、救い出しに向かうことになる。');
    mail(s, '急報', `${st.given}が捕らわれた`, lines.join(''), st.id, true);
    pushReunion(s, o, [st.id], 'spy', lines);
    return { ok: false, caught: true, lines };
  }
  st.injuredWeeks = Math.max(st.injuredWeeks, 1);
  lines.push(`${st.given}は${nm}の陣で見つかりかけ、何も持ち帰れずに逃げ帰った。`);
  pushReunion(s, o, [st.id], 'spy', lines);
  return { ok: false, caught: false, lines };
}

/** おまかせ：月に1回、因縁のいちばん深い宿敵に、いちばん向いている子を送る（密偵の系統の子がいるときだけ） */
export function autoSpy(s: GameState, r: Rng): void {
  if (!spyReady(s)) return;
  const ts = spyTargets(s);
  const c = spyCandidates(s).find((x) => (CLASSES[x.classId] as { line?: string } | undefined)?.line === 'dagger');
  if (!ts.length || !c || !r.chance(A().autoSpy)) return;
  const o = ts.sort((a, b) => intelOf(a) - intelOf(b))[0];
  if (spyChance(s, c, o) < 55) return;
  sendSpy(s, c.id, o.id, r);
}

void rivalriesOf;
