// シミュレーションの結果（--json で書き出したもの）を方針ごとの主な数字にまとめ、docs/sim-baseline.json（前の回）と並べる
// 使い方：npx tsx scripts/sim-sum.ts a.json,b.json [--save]（--save で docs/sim-baseline.json を今の数字に書きかえる）
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const files = (argv.find((a) => !a.startsWith('--')) ?? '').split(',').filter(Boolean);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const all: any[] = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const base = JSON.parse(readFileSync(new URL('../docs/sim-baseline.json', import.meta.url), 'utf8'));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const policies = [...new Set(all.map((r) => r.policy))];
const out: Record<string, Record<string, unknown>> = {};
const lines: string[] = [];
lines.push('| 方針 | 回 | 在学中の戦死 | 勝率 | 最初のエンディング | 所持金（中央値） | 宿敵以上 | 卒業時Lv | 卒業時の能力の合計（HP以外） | レベルアップで上がる数 | 2ピン保証が働いた割合 | 開花（1学年あたり） | 芽を持つ子 | 卒業後の道 | 同行しない部隊の勝率・よい判断 | 戦利品（銘入り・落とし物・報酬・国から） | 同じ会話 |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const p of policies) {
  const rs = all.filter((r) => r.policy === p);
  const last = rs.map((r) => r.rows[r.rows.length - 1]);
  const deaths = avg(last.map((x) => x?.deaths ?? 0));
  const win = avg(rs.map((r) => (r.wins / Math.max(1, r.wins + r.losses)) * 100));
  const first = rs.map((r) => r.endings[0]).filter(Boolean);
  const money = med(last.map((x) => x?.money ?? 0));
  const nem = avg(rs.map((r) => r.officers?.rival2 ?? 0));
  const g3 = rs.flatMap((r) => (r.growth ?? []).filter((x: { grade: number }) => x.grade === 3));
  const often = [...g3].sort((a, b) => b.battles - a.battles).slice(0, Math.ceil(g3.length / 2));
  const lv = med(often.map((x) => x.level));
  const gs = med(rs.flatMap((r) => r.n10?.gradStats ?? []));
  const ups = rs.reduce((a, r) => a + (r.n10?.lvUps ?? 0), 0), st = rs.reduce((a, r) => a + (r.n10?.lvStats ?? 0), 0), pin = rs.reduce((a, r) => a + (r.n10?.pinned ?? 0), 0);
  const blooms = avg(rs.map((r) => (r.n10?.blooms ?? 0) / Math.max(1, r.n10?.cohorts ?? 1)));
  const buds = avg(rs.map((r) => (r.n10?.buds ?? 0) / Math.max(1, r.n10?.cohorts ?? 1)));
  const paths: Record<string, number> = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.n10?.paths ?? {})) paths[k] = (paths[k] ?? 0) + (v as number);
  const pt = Object.values(paths).reduce((a, b) => a + b, 0) || 1;
  const PN: Record<string, string> = { warrior: '将', strategist: '参謀', champion: '勇士', civil: '文官', none: 'なし' };
  const aw = rs.reduce((a, r) => { const x = r.n10?.away ?? { w: 0, l: 0, good: 0, calls: 0 }; return { w: a.w + x.w, l: a.l + x.l, good: a.good + x.good, calls: a.calls + x.calls }; }, { w: 0, l: 0, good: 0, calls: 0 });
  const sqw = rs.reduce((a, r) => { const x = r.ops?.sq; return x ? { w: a.w + x.w[0], l: a.l + x.l[0] } : a; }, { w: 0, l: 0 });
  const loot = (k: string) => avg(rs.map((r) => r.n10?.loot?.[k] ?? 0)).toFixed(1);
  const rep = avg(rs.map((r) => r.n10?.talkRepeats ?? 0));
  const b = base.policies?.[p];
  const cmp = (v: number, k: string, d = 1) => (b && typeof b[k] === 'number' ? `${b[k]} → **${v.toFixed(d)}**` : `**${v.toFixed(d)}**`);
  lines.push(`| ${b?.name ?? p} | ${rs.length}${rs.some((r) => r.error) ? `（エラー${rs.filter((r) => r.error).length}）` : ''} | ${cmp(deaths, 'schoolDeaths')} | ${cmp(win, 'winRate')}% | ${first.length}/${rs.length}・${avg(first.map((e) => e.year)).toFixed(1)}年 | ${cmp(money, 'moneyMedian', 0)}G | ${cmp(nem, 'nemesis')} | ${cmp(lv, 'gradLevel', 0)} | ${gs} | ${(st / Math.max(1, ups)).toFixed(2)} | ${((pin / Math.max(1, ups)) * 100).toFixed(0)}% | ${blooms.toFixed(2)} | ${buds.toFixed(2)} | ${Object.entries(paths).map(([k, v]) => `${PN[k] ?? k}${Math.round((v / pt) * 100)}%`).join('・')} | ${((aw.w / Math.max(1, aw.w + aw.l)) * 100).toFixed(1)}%（第一部隊 ${((sqw.w / Math.max(1, sqw.w + sqw.l)) * 100).toFixed(1)}%）・${((aw.good / Math.max(1, aw.calls)) * 100).toFixed(0)}% | ${loot('named')}・${loot('drop')}・${loot('reward')}・${loot('gift')} | ${rep.toFixed(1)} |`);
  out[p] = { name: b?.name ?? p, schoolDeaths: +deaths.toFixed(2), winRate: +win.toFixed(1), firstEnding: { count: first.length, avgYear: +avg(first.map((e) => e.year)).toFixed(1) }, moneyMedian: money, nemesis: +nem.toFixed(1), gradLevel: lv, gradStatSum: gs, statsPerLevelUp: +(st / Math.max(1, ups)).toFixed(2), bloomsPerCohort: +blooms.toFixed(2), budsPerCohort: +buds.toFixed(2), paths, awayWinRate: +((aw.w / Math.max(1, aw.w + aw.l)) * 100).toFixed(1), firstSquadWinRate: +((sqw.w / Math.max(1, sqw.w + sqw.l)) * 100).toFixed(1), awayGoodCalls: +((aw.good / Math.max(1, aw.calls)) * 100).toFixed(0), talkRepeats: rep, years: Math.max(...rs.map((r) => r.rows.length)), runs: rs.length };
}
console.log(lines.join('\n'));
if (argv.includes('--save')) {
  const night = Number(argv.find((a) => a.startsWith('--night='))?.split('=')[1] ?? 10);
  writeFileSync(new URL('../docs/sim-baseline.json', import.meta.url), JSON.stringify({ note: base.note, night, years: Math.max(...all.map((r) => r.rows.length)), runs: Math.max(...policies.map((p) => all.filter((r) => r.policy === p).length)), source: `${night}夜目の長いシミュレーション（scripts/sim-sum.ts --save）`, policies: out, previous: { night: base.night, policies: base.policies } }, null, 2) + '\n');
  console.log('docs/sim-baseline.json を書きかえました');
}
