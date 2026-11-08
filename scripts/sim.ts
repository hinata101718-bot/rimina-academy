// 長期シミュレーション：オートプレイで何十年も回して、結果を docs/sim-report.md に書く
// 使い方：
//   npm run sim -- [年数=30] [回数=10] [方針=auto,peace,unify]
//   並べて回すとき：npx tsx scripts/sim.ts 30 10 peace --json=/tmp/peace.json  → 最後に --merge=a.json,b.json,c.json
import { writeFileSync, readFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, setCareerPolicy, setAutoEnding, setAutoChoicePick, humanLikePick, setManualInSim, setGradeHook, opCount, type CareerPolicy } from '../src/core/autoplay';
import { SKILLS, STATS } from '../src/data/balance';
import { TALENTS } from '../src/data/people';
import { rankOf } from '../src/core/util';
import type { SkillId } from '../src/core/types';
import { continueSchool, endingTitle, ENDING_NAMES } from '../src/core/ending';
import type { EndingKind } from '../src/core/state';
// エンディングのあとは「この学校を続ける」を選ぶ（平和な時代）
setAutoEnding((s) => continueSchool(s));
// 戦闘は自動の戦闘（5夜目）。ここぞの選択は7割おすすめ・3割ほかのもの。--manual で4夜目までの戦い方
setAutoChoicePick(humanLikePick(20261108));
if (process.argv.includes('--manual')) setManualInSim(true);
import { tensionStage, STAGE_NAMES, PAIRS, relStage, REL_NAMES } from '../src/core/world';
import type { GameState } from '../src/core/state';
import { BACKGROUNDS } from '../src/data/people';

const argv = process.argv.slice(2);
const flag = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const pos = argv.filter((a) => !a.startsWith('--'));
const YEARS = Number(pos[0] ?? 40);
const RUNS = Number(pos[1] ?? 10);
const POLICIES = (pos[2] ?? 'peace,unify,none').split(',') as CareerPolicy[];
const POLICY_NAMES: Record<CareerPolicy, string> = { none: '何もしない（教え子を三国の軍へ送らない）', neutral: '中立狙い（三国へ均等に・施設と評判を優先）', auto: 'おまかせ', peace: '和平狙い（文官を三国へ）', unify: '統一狙い（一番強い国へ武官を集める）' };

interface YearRow { year: number; tension: number; stage: string; money: number; rep: number; students: number; grads: number; aliveGrads: number; deaths: number; alumniDead: number; power: string; rels: string; events: string[] }
interface GrowthRow { grade: number; level: number; battles: number; top: number; second: number; other: number; talent: number | null; hp: number; best: number; worst: number; train: number }
interface RunResult { mentor?: { year: number; gen: number; abilities: number; xp: number; skills: number }[]; news?: number[]; growth?: GrowthRow[]; ops?: { lesson: number; pending: number; battle: number }; warNos?: number; seedOutbreaks?: number; policy: CareerPolicy; seed: number; bg: string; rows: YearRow[]; error: string | null; zeroMoneyYears: number; vassal: string | null; everVassal: boolean; gunYear: number | null; bigEvents: Record<string, number>; wins: number; losses: number; alumniDeaths: number; graduates: number; peaceTalks: number; roundYear: number | null; ms: number; endings: { kind: EndingKind; year: number; country?: string; n?: number }[]; generations: number; instructorAges: number[]; officers?: OfficerStats }
/** 宿敵の仕組み（6夜目）の数 */
interface OfficerStats { met: number; epithets: number; promotions: number; heads: number; rival1: number; rival2: number; rival3: number; vows: number; settles: Record<string, number>; alumni: number; scarred: number; years: number }
function officerStats(s: GameState, years: number): OfficerStats {
  const ch = s.chronicle.map((c) => c.text);
  const rv = Object.values(s.rivalries ?? {});
  const settles: Record<string, number> = {};
  for (const r of rv) if (r.settled && (r.stage >= 1 || r.vow)) settles[r.settled] = (settles[r.settled] ?? 0) + 1;
  return {
    met: (s.officers ?? []).filter((o) => o.meets.length).length,
    epithets: ch.filter((t) => t.includes('と呼ばれるようになった')).length,
    promotions: ch.filter((t) => t.includes('昇進した')).length,
    heads: ch.filter((t) => t.includes('に就いた') || t.includes('権力争い')).length,
    rival1: rv.filter((r) => r.stage >= 1).length, rival2: rv.filter((r) => r.stage >= 2).length, rival3: rv.filter((r) => r.stage >= 3).length,
    vows: rv.filter((r) => r.vow).length, settles,
    alumni: (s.officers ?? []).filter((o) => o.alumniId).length,
    scarred: (s.officers ?? []).filter((o) => o.scars > 0).length, years,
  };
}

function snapshot(s: GameState, events: string[]): YearRow {
  const grads = Object.values(s.students).filter((x) => x.status === 'graduated');
  return {
    year: s.year - 1, tension: Math.round(s.world.tension), stage: STAGE_NAMES[tensionStage(s.world.tension)], money: s.money,
    rep: Math.round(s.reputation), students: enrolled(s).length, grads: grads.length, aliveGrads: grads.filter((g) => g.career?.alive && !g.career.retired).length,
    deaths: s.stats.deaths, alumniDead: grads.filter((g) => g.career && !g.career.alive).length,
    power: `王${Math.round(s.world.power.kingdom)}/帝${Math.round(s.world.power.empire)}/同${Math.round(s.world.power.alliance)}`,
    rels: PAIRS.map((p) => REL_NAMES[relStage(s.world.relations[p.key])]).join('・'), events,
  };
}

function runAll(policy: CareerPolicy): RunResult[] {
  setCareerPolicy(policy);
  const results: RunResult[] = [];
  for (let r = 0; r < RUNS; r++) {
    const seed = 1000 + r * 7919;
    const bg = BACKGROUNDS[r % BACKGROUNDS.length].id;
    const t0 = Date.now();
    const s = newGame({ name: `シム${r}`, background: bg, seed });
    const growth: GrowthRow[] = [];
    const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
    setGradeHook((g) => {
      for (const st of enrolled(g)) {
        const pts = SKILLS.filter((k) => k !== 'gun').map((k) => st.skills[k]).sort((a, b) => b - a);
        const tk = st.talent ? TALENTS[st.talent].skill : undefined;
        const vals = STATS.filter((k) => k !== 'hp' && k !== 'cha' && k !== 'lck').map((k) => st.stats[k]).sort((a, b) => b - a);
        growth.push({ grade: st.grade, level: st.level, battles: st.battles, top: pts[0], second: pts[1], other: med(pts.slice(2)), talent: tk ? st.skills[tk as SkillId] : null, hp: st.stats.hp, best: vals[0], worst: vals[vals.length - 1], train: Object.values(st.trainGain ?? {}).reduce((a, b) => a + (b ?? 0), 0) });
      }
    });
    opCount.lesson = 0; opCount.pending = 0; opCount.battle = 0; opCount.squads = 0; opCount.cards = 0;
    const rows: YearRow[] = [];
    let error: string | null = null;
    let zero = 0;
    let gunYear: number | null = null;
    const bigEvents: Record<string, number> = {};
    let seenChron = 0;
    const mentor: { year: number; gen: number; abilities: number; xp: number; skills: number }[] = [];
    try {
      autoYears(s, YEARS, (g) => {
        mentor.push({ year: g.year - 1, gen: g.instructor.generation, abilities: (g.instructor.abilities ?? []).length - (g.instructor.inherited ?? []).length, xp: g.instructor.xpTotal ?? 0, skills: Object.values(g.instructor.skills).reduce((a, b) => a + b, 0) });
        const ev = g.chronicle.slice(seenChron).filter((c) => c.kind === 'world').map((c) => c.text);
        seenChron = g.chronicle.length;
        for (const e of ev) { const k = e.replace(/：.*/, '').replace(/^(王国|帝国|同盟)と(王国|帝国|同盟)の/, ''); bigEvents[k] = (bigEvents[k] ?? 0) + 1; }
        if (g.world.gunUnlocked && gunYear === null) gunYear = g.year - 1;
        if (g.money <= 0) zero++;
        rows.push(snapshot(g, ev));
        for (const st of Object.values(g.students)) if (!Number.isFinite(st.level) || !Number.isFinite(st.stats.hp)) throw new Error(`数値が壊れた生徒 ${st.id}`);
        if (!Number.isFinite(g.money) || !Number.isFinite(g.world.tension)) throw new Error('お金か緊張度が壊れた');
      });
    } catch (e) { error = (e as Error).stack ?? String(e); }
    const grads = Object.values(s.students).filter((x) => x.status === 'graduated');
    const alumniDeaths = grads.filter((x) => x.career && !x.career.alive).length;
    results.push({ mentor, news: [...Array(rows.length)].map((_, i) => s.news.filter((n) => n.year === i + 1 && (n.kind === 'first' || n.kind === 'second')).length), growth, ops: { ...opCount }, warNos: s.world.warNo ?? 1, seedOutbreaks: s.chronicle.filter((c) => c.text.includes('大陸戦争が始まった')).length, policy, seed, bg, rows, error, zeroMoneyYears: zero, vassal: s.world.vassal, everVassal: s.chronicle.some((c) => c.text.includes('傘下に入る')), gunYear, bigEvents, wins: s.stats.battlesWon, losses: s.stats.battlesLost, alumniDeaths, graduates: grads.length, peaceTalks: s.world.peaceTalksHeld, roundYear: s.world.peaceRoundYear ?? null, ms: Date.now() - t0, endings: (s.endings ?? []).map((e) => ({ ...e })), generations: s.instructor.generation, instructorAges: (s.pastInstructors ?? []).map((p) => p.age), officers: officerStats(s, rows.length) });
    console.log(`[${policy}] run ${r + 1}/${RUNS} 戦争${s.world.warNo ?? 1}度目まで seed=${seed} ${bg} money=${s.money} rep=${Math.round(s.reputation)} grads=${grads.length} 卒業後の戦死=${alumniDeaths}（${Math.round((alumniDeaths / Math.max(1, grads.length)) * 100)}%） 和平会議=${s.world.peaceTalksHeld} エンディング=${(s.endings ?? []).map((e) => `${endingTitle(e.kind, e.country as never)}${e.year}年目`).join('・') || 'なし'} 教官${s.instructor.generation}代 ${error ? 'ERROR' : 'ok'} (${Date.now() - t0}ms)`);
    if (error) console.log(error);
  }
  return results;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;

function report(all: RunResult[]): string {
  const lines: string[] = [];
  const policies = [...new Set(all.map((r) => r.policy))];
  const years = Math.max(...all.map((r) => r.rows.length));
  lines.push('# 長期シミュレーションの結果', '');
  lines.push(`オートプレイ（画面なし・自動で判断）で **${years}年 × ${all.length / policies.length}回** を、進路の方針ごとに回した結果です。`, `作成：\`npm run sim\`（${new Date().toISOString().slice(0, 10)}）`, '', '8夜目：先生の経験ポイントと特殊能力（オートプレイは、覚えられる特殊能力をいちばん安いものから覚え、余ったポイントで得意科目の技能を上げる）・成長率の5%きざみ・レベルアップの2ピン保証・新聞の半年に一回を入れたあとの結果。', '', 'エンディングのあとは毎回「この学校を続ける」を選ぶ（平和な時代→火種がくすぶる→次の戦争→二度目のエンディング、が起きるかを確かめる）。', '', '戦闘は **自動の戦闘**。作戦の方針・役割は依頼ごとのおすすめ、ここぞの選択は7割がおすすめ・3割がほかのもの（人が遊ぶときに近づけるため）。', '');
  lines.push('進路の方針：', ...policies.map((p) => `- **${POLICY_NAMES[p]}**`), '');
  lines.push('## 方針ごとのまとめ', '');
  lines.push('| 方針 | エラー | 最初のエンディング（回数） | 最初のエンディングの年（平均・最小〜最大） | 教官の代替わり（平均） | 最終年の所持金（平均） | 卒業後の戦死の割合（平均・最大の回） | 在学中の戦死（平均） |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const p of policies) {
    const rs = all.filter((r) => r.policy === p);
    const last = rs.map((r) => r.rows[r.rows.length - 1]);
    const ratios = rs.map((r) => r.alumniDeaths / Math.max(1, r.graduates));
    const first = rs.map((r) => r.endings[0]).filter(Boolean);
    const kinds: Record<string, number> = {};
    for (const e of first) { const k = endingTitle(e.kind, e.country as never); kinds[k] = (kinds[k] ?? 0) + 1; }
    const ys = first.map((e) => e.year);
    lines.push(`| ${POLICY_NAMES[p]} | ${rs.filter((r) => r.error).length} | ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join('・') || 'なし'}（${first.length}／${rs.length}） | ${ys.length ? `${avg(ys).toFixed(1)}年（${Math.min(...ys)}〜${Math.max(...ys)}）` : '—'} | ${avg(rs.map((r) => r.generations - 1)).toFixed(1)}回 | ${Math.round(avg(last.map((x) => x?.money ?? 0)))}G | ${pct(avg(ratios) * 100, 100)}（${pct(Math.max(...ratios) * 100, 100)}） | ${avg(last.map((x) => x?.deaths ?? 0)).toFixed(1)} |`);
  }
  lines.push('');
  lines.push('エンディングの種類ごとの到達率（その回で一度でも届いたか）：', '');
  lines.push(`| 方針 | ${(Object.keys(ENDING_NAMES) as EndingKind[]).map((k) => ENDING_NAMES[k]).join(' | ')} |`);
  lines.push(`|---|${(Object.keys(ENDING_NAMES) as EndingKind[]).map(() => '---').join('|')}|`);
  for (const p of policies) {
    const rs = all.filter((r) => r.policy === p);
    lines.push(`| ${POLICY_NAMES[p]} | ${(Object.keys(ENDING_NAMES) as EndingKind[]).map((k) => pct(rs.filter((r) => r.endings.some((e) => e.kind === k)).length, rs.length)).join(' | ')} |`);
  }
  lines.push('');
  // 育ち方の目標（7夜目）
  lines.push('## 育ち方の目標（7夜目）', '', '学年の終わり（3月の第4週）の在校生。レベルは「よく出撃した子」（その学年で出撃回数が上位半分）の中央値。技能は全員の中央値（25%〜75%）。目標は感想メモ「育ち方の目標」。', '');
  lines.push('| 学年の終わり | よく出撃した子のLv（目標） | 得意の技能（目標） | 2番目（目標） | その他（目標） | 才能の技能 | HP | 得意な能力 | 苦手な能力 | 鍛錬ゲージの+合計 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  const allG = all.flatMap((r) => r.growth ?? []);
  const medN = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
  const qN = (xs: number[], p: number) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0; };
  const rk = (p: number) => `${rankOf(p)}（${Math.round(p)}）`;
  const goals: Record<number, string[]> = { 1: ['10〜15', 'D+〜C', 'D', 'E+'], 2: ['15〜25', 'C+〜B', 'C', 'D'], 3: ['25〜40', 'B〜A', 'C〜B+', 'D〜C'] };
  for (const g of [1, 2, 3]) {
    const rs = allG.filter((x) => x.grade === g);
    if (!rs.length) continue;
    const often = [...rs].sort((a, b) => b.battles - a.battles).slice(0, Math.ceil(rs.length / 2));
    const lv = often.map((x) => x.level);
    lines.push(`| ${g}年 | ${medN(lv)}（${qN(lv, 0.25)}〜${qN(lv, 0.75)}）／${goals[g][0]} | ${rk(medN(rs.map((x) => x.top)))}（${rankOf(qN(rs.map((x) => x.top), 0.25))}〜${rankOf(qN(rs.map((x) => x.top), 0.75))}）／${goals[g][1]} | ${rk(medN(rs.map((x) => x.second)))}／${goals[g][2]} | ${rk(medN(rs.map((x) => x.other)))}／${goals[g][3]} | ${rk(medN(rs.filter((x) => x.talent !== null).map((x) => x.talent!)))} | ${medN(rs.map((x) => x.hp))}${g === 3 ? '／35〜45' : ''} | ${medN(rs.map((x) => x.best))}${g === 3 ? '／15〜22' : ''} | ${medN(rs.map((x) => x.worst))}${g === 3 ? '／5〜10' : ''} | ${medN(rs.map((x) => x.train))} |`);
  }
  lines.push('');
  // 戦争のあと（7夜目）
  lines.push('## 戦争のあと、また戦争（7夜目）', '', '| 方針 | 二度目の戦争が起きた回 | 二度目のエンディングまで届いた回 | 一度目→二度目の戦争の始まり（平均の年数） | 1年あたりの操作の目安（授業・処理待ち・戦闘） |', '|---|---|---|---|---|');
  for (const p of policies) {
    const rs = all.filter((r) => r.policy === p);
    const second = rs.filter((r) => (r.seedOutbreaks ?? 0) > 0);
    const end2 = rs.filter((r) => r.endings.some((e) => (e.n ?? 1) >= 2));
    const gaps: number[] = [];
    for (const r of rs) { const e1 = r.endings.find((e) => (e.n ?? 1) === 1); const w2 = r.rows.find((row) => row.events.some((x) => x.includes('大陸戦争が始まった'))); if (e1 && w2) gaps.push(w2.year - e1.year); }
    const ops = rs.map((r) => r.ops).filter(Boolean) as { lesson: number; pending: number; battle: number }[];
    const yrs = Math.max(1, avg(rs.map((r) => r.rows.length)));
    lines.push(`| ${POLICY_NAMES[p]} | ${second.length}／${rs.length} | ${end2.length}／${rs.length} | ${gaps.length ? `${avg(gaps).toFixed(1)}年（${Math.min(...gaps)}〜${Math.max(...gaps)}）` : '—'} | ${ops.length ? `${Math.round(avg(ops.map((o) => o.lesson)) / yrs)}・${Math.round(avg(ops.map((o) => o.pending)) / yrs)}・${Math.round(avg(ops.map((o) => o.battle)) / yrs)}` : '—'} |`);
  }
  lines.push('');
  // 宿敵の仕組み（6夜目）
  lines.push('## 宿敵の仕組み（6夜目）', '', '1回あたりの平均（40年間）と、1年あたりの目安。「因縁」以上は生徒と敵将の組の数（仇討ちの誓いをふくむ）。', '');
  lines.push('| 方針 | 会った敵将 | 二つ名がついた | 敵将の昇進 | 頭の交代 | 因縁以上 | 宿敵以上 | 生涯の宿敵 | 仇討ちの誓い | 決着（説得・一騎打ち・討ち取る・見逃す） | 卒業生の敵将 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of policies) {
    const os = all.filter((r) => r.policy === p).map((r) => r.officers).filter((x): x is OfficerStats => !!x);
    if (!os.length) continue;
    const per = (f: (o: OfficerStats) => number) => { const v = avg(os.map(f)); const y = avg(os.map((o) => f(o) / Math.max(1, o.years))); return `${v.toFixed(1)}（${y.toFixed(2)}/年）`; };
    const st = (k: string) => avg(os.map((o) => o.settles[k] ?? 0)).toFixed(1);
    lines.push(`| ${POLICY_NAMES[p]} | ${avg(os.map((o) => o.met)).toFixed(0)} | ${per((o) => o.epithets)} | ${per((o) => o.promotions)} | ${per((o) => o.heads)} | ${per((o) => o.rival1)} | ${per((o) => o.rival2)} | ${avg(os.map((o) => o.rival3)).toFixed(1)} | ${per((o) => o.vows)} | ${st('persuade')}・${st('duel')}・${st('kill')}・${st('spare')} | ${avg(os.map((o) => o.alumni)).toFixed(1)} |`);
  }
  lines.push('');
  for (const p of policies) {
    const results = all.filter((r) => r.policy === p);
    lines.push(`## ${POLICY_NAMES[p]}`, '');
    const errs = results.filter((r) => r.error).length;
    lines.push(`- エラー：**${errs ? `${errs}回で発生` : 'なし'}**`);
    lines.push(`- お金が0の年があった回：${results.filter((r) => r.zeroMoneyYears > 0).length}回（年数の合計 ${results.reduce((a, r) => a + r.zeroMoneyYears, 0)}）`);
    lines.push(`- 3年目の期限で傘下に入った回：${results.filter((r) => r.everVassal).length}回（そのうち、のちに独立を取り戻した回：${results.filter((r) => r.everVassal && !r.vassal).length}回）`);
    lines.push(`- 銃が登場した年（目安）：${results.map((r) => r.gunYear ?? '—').join(', ')}`);
    lines.push('');
    const at = (y: number, f: (row: YearRow) => number) => avg(results.map((r) => r.rows.find((x) => x.year === y)).filter(Boolean).map((x) => f(x!)));
    lines.push('| 年 | 緊張度 | 所持金 | 評判 | 在籍 | 卒業生（累計） | 現役の卒業生 | 卒業後の戦死（累計） | 在学中の戦死（累計） |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const y of [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].filter((y) => y <= years)) {
      lines.push(`| ${y} | ${at(y, (r) => r.tension).toFixed(0)} | ${at(y, (r) => r.money).toFixed(0)} | ${at(y, (r) => r.rep).toFixed(0)} | ${at(y, (r) => r.students).toFixed(1)} | ${at(y, (r) => r.grads).toFixed(0)} | ${at(y, (r) => r.aliveGrads).toFixed(0)} | ${at(y, (r) => r.alumniDead).toFixed(0)} | ${at(y, (r) => r.deaths).toFixed(1)} |`);
    }
    lines.push('');
    const stageCount: Record<string, number> = {};
    for (const r of results) for (const row of r.rows) stageCount[row.stage] = (stageCount[row.stage] ?? 0) + 1;
    const total = results.reduce((a, r) => a + r.rows.length, 0);
    lines.push(`戦況の時期：${Object.entries(stageCount).map(([k, v]) => `${k} ${pct(v, total)}`).join('・')}`, '');
    const ev: Record<string, number> = {};
    for (const r of results) for (const [k, v] of Object.entries(r.bigEvents)) ev[k] = (ev[k] ?? 0) + v;
    lines.push(`大事件（全回の合計）：${Object.entries(ev).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}回`).join('・') || 'なし'}`, '');
    lines.push('| 回 | 経歴 | エンディング | 教官 | 最終の所持金 | 最終の評判 | 卒業生 | 卒業後の戦死 | 戦死の割合 | 和平会議 | 戦闘の勝敗 | 最終の緊張度 | 傘下 |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    results.forEach((r, i) => {
      const last = r.rows[r.rows.length - 1];
      lines.push(`| ${i + 1} | ${BACKGROUNDS.find((b) => b.id === r.bg)?.name} | ${r.endings.map((e) => `${endingTitle(e.kind, e.country as never, (e as { n?: number }).n)}（${e.year}年目）`).join('・') || 'なし'} | ${r.generations}代（引退${r.instructorAges.join('・') || '—'}歳） | ${last?.money ?? '—'} | ${last?.rep ?? '—'} | ${r.graduates} | ${r.alumniDeaths} | ${pct(r.alumniDeaths, r.graduates)} | ${r.peaceTalks} | ${r.wins}勝${r.losses}敗 | ${last?.tension ?? '—'}（${last?.stage ?? ''}） | ${r.vassal ?? 'なし'} |`);
    });
    lines.push('');
  }
  const r0 = all.find((r) => r.policy === 'peace') ?? all[0];
  lines.push(`## 年表の例（${POLICY_NAMES[r0.policy]}・1回目）`, '');
  for (const row of r0.rows) lines.push(`- ${row.year}年目：${row.stage}（緊張度${row.tension}）・国力 ${row.power}・関係 ${row.rels}・所持金${row.money}G・評判${row.rep}${row.events.length ? `・事件：${row.events.join('／')}` : ''}`);
  const errs = all.filter((x) => x.error);
  if (errs.length) { lines.push('', '## エラーの内容', ''); for (const r of errs) lines.push('```', r.error!.slice(0, 1500), '```'); }
  // 8夜目：先生の特殊能力
  lines.push('', '## 先生の経験ポイントと特殊能力（初代の教官）', '');
  lines.push('自分で覚えた特殊能力の数（受け継いだものは数えない）。目安は「1年で2〜3個、覚えるたびに少しずつ高くなる」。', '');
  lines.push('| 方針 | 1年目 | 2年目 | 3年目 | 5年目 | 10年目 | 15年目 | 1年あたりの経験ポイント（初代・平均） | 新聞（前期号＋後期号）／年 |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const p of policies) {
    const rs = all.filter((r) => r.policy === p);
    const at = (y: number) => { const v = rs.map((r) => r.mentor?.find((m) => m.year === y && m.gen === 1)?.abilities).filter((x): x is number => x !== undefined); return v.length ? `${avg(v).toFixed(1)}個（${v.length}回）` : '—'; };
    const xpy = rs.map((r) => { const m = (r.mentor ?? []).filter((x) => x.gen === 1); const l = m[m.length - 1]; return l ? l.xp / Math.max(1, l.year) : 0; });
    const np = rs.flatMap((r) => (r.news ?? []).slice(-11, -1)); // 新聞は新しい60号だけ残るので、最後の10年で数える
    lines.push(`| ${POLICY_NAMES[p]} | ${at(1)} | ${at(2)} | ${at(3)} | ${at(5)} | ${at(10)} | ${at(15)} | ${Math.round(avg(xpy))}pt | ${avg(np).toFixed(2)}号 |`);
  }
  return lines.join('\n') + '\n';
}

const merge = flag('merge');
if (merge) {
  const all = merge.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as RunResult[]);
  writeFileSync(new URL('../docs/sim-report.md', import.meta.url), report(all));
  console.log('docs/sim-report.md を書き出しました');
} else {
  const all = POLICIES.flatMap((p) => runAll(p));
  const json = flag('json');
  if (json) writeFileSync(json, JSON.stringify(all));
  else { writeFileSync(new URL('../docs/sim-report.md', import.meta.url), report(all)); console.log('docs/sim-report.md を書き出しました'); }
  if (all.some((r) => r.error)) process.exit(1);
}
