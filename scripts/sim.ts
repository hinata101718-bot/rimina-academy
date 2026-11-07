// 長期シミュレーション：オートプレイで何十年も回して、結果を docs/sim-report.md に書く
// 使い方：
//   npm run sim -- [年数=30] [回数=10] [方針=auto,peace,unify]
//   並べて回すとき：npx tsx scripts/sim.ts 30 10 peace --json=/tmp/peace.json  → 最後に --merge=a.json,b.json,c.json
import { writeFileSync, readFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, setCareerPolicy, type CareerPolicy } from '../src/core/autoplay';
import { tensionStage, STAGE_NAMES, PAIRS, relStage, REL_NAMES } from '../src/core/world';
import type { GameState } from '../src/core/state';
import { BACKGROUNDS } from '../src/data/people';

const argv = process.argv.slice(2);
const flag = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const pos = argv.filter((a) => !a.startsWith('--'));
const YEARS = Number(pos[0] ?? 30);
const RUNS = Number(pos[1] ?? 10);
const POLICIES = (pos[2] ?? 'auto,peace,unify').split(',') as CareerPolicy[];
const POLICY_NAMES: Record<CareerPolicy, string> = { auto: 'おまかせ', peace: '和平狙い（文官を三国へ）', unify: '統一狙い（一番強い国へ武官を集める）' };

interface YearRow { year: number; tension: number; stage: string; money: number; rep: number; students: number; grads: number; aliveGrads: number; deaths: number; alumniDead: number; power: string; rels: string; events: string[] }
interface RunResult { policy: CareerPolicy; seed: number; bg: string; rows: YearRow[]; error: string | null; zeroMoneyYears: number; vassal: string | null; everVassal: boolean; gunYear: number | null; bigEvents: Record<string, number>; wins: number; losses: number; alumniDeaths: number; graduates: number; peaceTalks: number; roundYear: number | null; ms: number }

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
    const rows: YearRow[] = [];
    let error: string | null = null;
    let zero = 0;
    let gunYear: number | null = null;
    const bigEvents: Record<string, number> = {};
    let seenChron = 0;
    try {
      autoYears(s, YEARS, (g) => {
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
    results.push({ policy, seed, bg, rows, error, zeroMoneyYears: zero, vassal: s.world.vassal, everVassal: s.chronicle.some((c) => c.text.includes('傘下に入る')), gunYear, bigEvents, wins: s.stats.battlesWon, losses: s.stats.battlesLost, alumniDeaths, graduates: grads.length, peaceTalks: s.world.peaceTalksHeld, roundYear: s.world.peaceRoundYear ?? null, ms: Date.now() - t0 });
    console.log(`[${policy}] run ${r + 1}/${RUNS} seed=${seed} ${bg} money=${s.money} rep=${Math.round(s.reputation)} grads=${grads.length} 卒業後の戦死=${alumniDeaths}（${Math.round((alumniDeaths / Math.max(1, grads.length)) * 100)}%） 和平会議=${s.world.peaceTalksHeld} 円卓=${s.world.peaceRoundYear ?? '—'} ${error ? 'ERROR' : 'ok'} (${Date.now() - t0}ms)`);
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
  lines.push(`オートプレイ（画面なし・自動で判断）で **${years}年 × ${all.length / policies.length}回** を、進路の方針ごとに回した結果です。`, `作成：\`npm run sim\`（${new Date().toISOString().slice(0, 10)}）`, '');
  lines.push('進路の方針：', ...policies.map((p) => `- **${POLICY_NAMES[p]}**`), '');
  lines.push('## 方針ごとのまとめ', '');
  lines.push('| 方針 | エラー | 和平会議（平均回数） | 和平の円卓に届いた回 | 円卓の年 | 30年目の所持金（平均） | 卒業後の戦死の割合（最大の回） | 在学中の戦死（平均） |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const p of policies) {
    const rs = all.filter((r) => r.policy === p);
    const last = rs.map((r) => r.rows[r.rows.length - 1]);
    const ratios = rs.map((r) => r.alumniDeaths / Math.max(1, r.graduates));
    const rounds = rs.filter((r) => r.roundYear !== null);
    lines.push(`| ${POLICY_NAMES[p]} | ${rs.filter((r) => r.error).length} | ${avg(rs.map((r) => r.peaceTalks)).toFixed(1)} | ${rounds.length}／${rs.length} | ${rounds.map((r) => r.roundYear).join(', ') || '—'} | ${Math.round(avg(last.map((x) => x?.money ?? 0)))}G | ${pct(avg(ratios) * 100, 100)}（${pct(Math.max(...ratios) * 100, 100)}） | ${avg(last.map((x) => x?.deaths ?? 0)).toFixed(1)} |`);
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
    for (const y of [1, 2, 3, 5, 8, 10, 15, 20, 25, 30].filter((y) => y <= years)) {
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
    lines.push('| 回 | 経歴 | 最終の所持金 | 最終の評判 | 卒業生 | 卒業後の戦死 | 戦死の割合 | 和平会議 | 円卓 | 戦闘の勝敗 | 最終の緊張度 | 傘下 |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    results.forEach((r, i) => {
      const last = r.rows[r.rows.length - 1];
      lines.push(`| ${i + 1} | ${BACKGROUNDS.find((b) => b.id === r.bg)?.name} | ${last?.money ?? '—'} | ${last?.rep ?? '—'} | ${r.graduates} | ${r.alumniDeaths} | ${pct(r.alumniDeaths, r.graduates)} | ${r.peaceTalks} | ${r.roundYear ?? '—'} | ${r.wins}勝${r.losses}敗 | ${last?.tension ?? '—'}（${last?.stage ?? ''}） | ${r.vassal ?? 'なし'} |`);
    });
    lines.push('');
  }
  const r0 = all.find((r) => r.policy === 'peace') ?? all[0];
  lines.push(`## 年表の例（${POLICY_NAMES[r0.policy]}・1回目）`, '');
  for (const row of r0.rows) lines.push(`- ${row.year}年目：${row.stage}（緊張度${row.tension}）・国力 ${row.power}・関係 ${row.rels}・所持金${row.money}G・評判${row.rep}${row.events.length ? `・事件：${row.events.join('／')}` : ''}`);
  const errs = all.filter((x) => x.error);
  if (errs.length) { lines.push('', '## エラーの内容', ''); for (const r of errs) lines.push('```', r.error!.slice(0, 1500), '```'); }
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
