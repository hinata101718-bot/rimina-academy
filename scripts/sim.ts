// 長期シミュレーション：オートプレイで何十年も回して、結果を docs/sim-report.md に書く
// 使い方：npm run sim -- [年数=30] [回数=10]
import { writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { tensionStage, STAGE_NAMES, PAIRS, relStage, REL_NAMES } from '../src/core/world';
import type { GameState } from '../src/core/state';
import { BACKGROUNDS } from '../src/data/people';

const YEARS = Number(process.argv[2] ?? 30);
const RUNS = Number(process.argv[3] ?? 10);

interface YearRow { year: number; tension: number; stage: string; money: number; rep: number; students: number; grads: number; aliveGrads: number; deaths: number; power: string; rels: string; events: string[] }
interface RunResult { seed: number; bg: string; rows: YearRow[]; error: string | null; zeroMoneyYears: number; vassal: string | null; gunYear: number | null; bigEvents: Record<string, number>; wins: number; losses: number; alumniDeaths: number; ms: number }

function snapshot(s: GameState, events: string[]): YearRow {
  const grads = Object.values(s.students).filter((x) => x.status === 'graduated');
  return {
    year: s.year - 1, tension: Math.round(s.world.tension), stage: STAGE_NAMES[tensionStage(s.world.tension)], money: s.money,
    rep: Math.round(s.reputation), students: enrolled(s).length, grads: grads.length, aliveGrads: grads.filter((g) => g.career?.alive && !g.career.retired).length,
    deaths: s.stats.deaths, power: `王${Math.round(s.world.power.kingdom)}/帝${Math.round(s.world.power.empire)}/同${Math.round(s.world.power.alliance)}`,
    rels: PAIRS.map((p) => REL_NAMES[relStage(s.world.relations[p.key])]).join('・'), events,
  };
}

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
      // 整合性の確認
      for (const st of Object.values(g.students)) {
        if (!Number.isFinite(st.level) || !Number.isFinite(st.stats.hp)) throw new Error(`数値が壊れた生徒 ${st.id}`);
      }
      if (!Number.isFinite(g.money) || !Number.isFinite(g.world.tension)) throw new Error('お金か緊張度が壊れた');
    });
  } catch (e) { error = (e as Error).stack ?? String(e); }
  const alumniDeaths = Object.values(s.students).filter((x) => x.status === 'graduated' && x.career && !x.career.alive).length;
  results.push({ seed, bg, rows, error, zeroMoneyYears: zero, vassal: s.world.vassal, gunYear, bigEvents, wins: s.stats.battlesWon, losses: s.stats.battlesLost, alumniDeaths, ms: Date.now() - t0 });
  console.log(`run ${r + 1}/${RUNS} seed=${seed} ${bg} years=${rows.length} money=${s.money} rep=${Math.round(s.reputation)} grads=${s.stats.graduates} deaths(在学)=${s.stats.deaths} tension=${Math.round(s.world.tension)} ${error ? 'ERROR' : 'ok'} (${Date.now() - t0}ms)`);
  if (error) console.log(error);
}

// ---- レポート ----
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const lines: string[] = [];
lines.push('# 長期シミュレーションの結果', '');
lines.push(`オートプレイ（画面なし・自動で判断）で **${YEARS}年 × ${RUNS}回** 回した結果です。`, `作成：\`npm run sim\`（${new Date().toISOString().slice(0, 10)}）`, '');
lines.push('## まとめ', '');
const errs = results.filter((r) => r.error).length;
lines.push(`- エラー：**${errs ? `${errs}回で発生` : 'なし'}**`);
lines.push(`- 最後まで回った年数の平均：${avg(results.map((r) => r.rows.length)).toFixed(1)}年`);
lines.push(`- お金が0の年があった回：${results.filter((r) => r.zeroMoneyYears > 0).length}回（年数の合計 ${results.reduce((a, r) => a + r.zeroMoneyYears, 0)}）`);
lines.push(`- 傘下に入った回：${results.filter((r) => r.vassal).length}回`);
lines.push(`- 銃が登場した年：${results.map((r) => r.gunYear ?? '—').join(', ')}`);
lines.push('');
const at = (y: number, f: (row: YearRow) => number) => avg(results.map((r) => r.rows.find((x) => x.year === y)).filter(Boolean).map((x) => f(x!)));
lines.push('## 年ごとの平均', '');
lines.push('| 年 | 緊張度 | 所持金 | 評判 | 在籍 | 卒業生（累計） | 現役の卒業生 | 在学中の戦死（累計） |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const y of [1, 2, 3, 5, 8, 10, 15, 20, 25, 30].filter((y) => y <= YEARS)) {
  lines.push(`| ${y} | ${at(y, (r) => r.tension).toFixed(0)} | ${at(y, (r) => r.money).toFixed(0)} | ${at(y, (r) => r.rep).toFixed(0)} | ${at(y, (r) => r.students).toFixed(1)} | ${at(y, (r) => r.grads).toFixed(0)} | ${at(y, (r) => r.aliveGrads).toFixed(0)} | ${at(y, (r) => r.deaths).toFixed(1)} |`);
}
lines.push('');
lines.push('## 戦況の時期（全回の合計の年数）', '');
const stageCount: Record<string, number> = {};
for (const r of results) for (const row of r.rows) stageCount[row.stage] = (stageCount[row.stage] ?? 0) + 1;
lines.push(Object.entries(stageCount).map(([k, v]) => `- ${k}：${v}年（${((v / results.reduce((a, r) => a + r.rows.length, 0)) * 100).toFixed(0)}%）`).join('\n'));
lines.push('');
lines.push('## 大事件の回数（全回の合計）', '');
const ev: Record<string, number> = {};
for (const r of results) for (const [k, v] of Object.entries(r.bigEvents)) ev[k] = (ev[k] ?? 0) + v;
lines.push(Object.entries(ev).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}：${v}回`).join('\n') || '- なし');
lines.push('');
lines.push('## 回ごとの結果', '');
lines.push('| 回 | 経歴 | 年数 | 最終の所持金 | 最終の評判 | 卒業生 | 在学中の戦死 | 卒業後の戦死 | 戦闘の勝敗 | 最終の緊張度 | 傘下 | エラー |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
results.forEach((r, i) => {
  const last = r.rows[r.rows.length - 1];
  lines.push(`| ${i + 1} | ${BACKGROUNDS.find((b) => b.id === r.bg)?.name} | ${r.rows.length} | ${last?.money ?? '—'} | ${last?.rep ?? '—'} | ${last?.grads ?? 0} | ${last?.deaths ?? 0} | ${r.alumniDeaths} | ${r.wins}勝${r.losses}敗 | ${last?.tension ?? '—'}（${last?.stage ?? ''}） | ${r.vassal ?? 'なし'} | ${r.error ? 'あり' : 'なし'} |`);
});
lines.push('');
lines.push('## 1回目の年表（抜粋）', '');
const r0 = results[0];
for (const row of r0.rows) lines.push(`- ${row.year}年目：${row.stage}（緊張度${row.tension}）・国力 ${row.power}・関係 ${row.rels}・所持金${row.money}G・評判${row.rep}${row.events.length ? `・事件：${row.events.join('／')}` : ''}`);
if (errs) { lines.push('', '## エラーの内容', ''); for (const r of results.filter((x) => x.error)) lines.push('```', r.error!.slice(0, 1500), '```'); }
writeFileSync(new URL('../docs/sim-report.md', import.meta.url), lines.join('\n') + '\n');
console.log('docs/sim-report.md を書き出しました');
if (errs) process.exit(1);
