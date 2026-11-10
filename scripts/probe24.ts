// 24夜目：評判の動き・在籍の子の兵種の系統の割合・入学の希望者の質を年ごとに見る
// 使い方：npx tsx scripts/probe24.ts 年数 回数 方針 [--start=0] [--json=出力先]
import { writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, setCareerPolicy, setAutoEnding, setPendingHook, type CareerPolicy } from '../src/core/autoplay';
import { continueSchool } from '../src/core/ending';
import { CLASSES } from '../src/data/classes';
import { repTrace } from '../src/core/game';
import type { GameState } from '../src/core/state';

const argv = process.argv.slice(2);
const flag = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const pos = argv.filter((a) => !a.startsWith('--'));
const YEARS = Number(pos[0] ?? 12), RUNS = Number(pos[1] ?? 2), POL = (pos[2] ?? 'auto') as CareerPolicy, START = Number(flag('start') ?? 0);
setAutoEnding((s) => continueSchool(s));
setPendingHook(() => undefined);
const out: unknown[] = [];
for (let i = START; i < START + RUNS; i++) {
  setCareerPolicy(POL);
  const s = newGame({ name: 'シム', background: ['knight', 'merc', 'mage', 'wanderer'][i % 4], seed: 1000 + i });
  const s0year = s.year;
  const reps: number[] = [];
  const src: Record<string, number> = {};
  repTrace.fn = (d) => { const st = (new Error().stack ?? '').split('\n')[3] ?? ''; const m = st.match(/(\w+)\.ts:(\d+)/); const k = m ? `${m[1]}:${m[2]}` : '?'; src[k] = +((src[k] ?? 0) + d).toFixed(1); };
  const lines: Record<string, number> = {};
  const cls: Record<string, number> = {};
  let total = 0;
  const first: Record<string, string> = {};
  const moves: Record<string, number> = {};
  const entry: Record<string, number> = {};
  const last: Record<string, number> = {};
  const byDecade: Record<string, Record<string, number>> = {};
  const appl: { y: number; far: number; talent: number; avenger: number; n: number }[] = [];
  autoYears(s, YEARS, (g: GameState) => {
    reps.push(Math.round(g.reputation));
    const dk = String(Math.floor((g.year - s0year) / 10));
    byDecade[dk] ??= {};
    if (g.year === s0year + YEARS) for (const st of enrolled(g)) { const l = CLASSES[st.classId]?.line ?? '?'; last[l] = (last[l] ?? 0) + 1; }
    for (const st of enrolled(g)) { const l0 = CLASSES[st.classId]?.line ?? '?'; if (!first[st.id]) { first[st.id] = l0; entry[l0] = (entry[l0] ?? 0) + 1; } else if (first[st.id] !== l0 && st.grade === 3) { const k = `${first[st.id]}>${l0}`; moves[k] = (moves[k] ?? 0) + 1; first[st.id] = l0; } }
    for (const st of enrolled(g)) { byDecade[dk][CLASSES[st.classId]?.line ?? '?'] = (byDecade[dk][CLASSES[st.classId]?.line ?? '?'] ?? 0) + 1; const c = CLASSES[st.classId]; lines[c?.line ?? '?'] = (lines[c?.line ?? '?'] ?? 0) + 1; cls[c?.name ?? '?'] = (cls[c?.name ?? '?'] ?? 0) + 1; total += 1; }
    const a = Object.values(g.students).filter((x) => x.enrollYear === g.year);
    appl.push({ y: g.year, n: a.length, far: a.filter((x) => x.origin && x.origin !== 'frontier').length, talent: Math.round(a.reduce((t, x) => t + Object.values(x.growth).reduce((p, q) => p + q, 0), 0) / Math.max(1, a.length)), avenger: a.filter((x) => (x as { avengerOf?: string }).avengerOf).length });
  });
  const share = Object.fromEntries(Object.entries(lines).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total * 100).toFixed(1)]));
  const yr = YEARS;
  const r = { seed: i, src: Object.fromEntries(Object.entries(src).map(([k, v]) => [k, +(v / yr).toFixed(2)])), policy: POL, reps, share, cls: Object.fromEntries(Object.entries(cls).sort((a, b) => b[1] - a[1]).slice(0, 12)), last, entry, moves: Object.fromEntries(Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 14)), decades: Object.fromEntries(Object.entries(byDecade).map(([k, v]) => { const n = Object.values(v).reduce((a, b) => a + b, 0); return [k, Object.fromEntries(Object.entries(v).sort((a, b) => b[1] - a[1]).map(([kk, vv]) => [kk, Math.round(vv / n * 100)]))]; })), appl: appl.map((x) => `${x.n}/${x.far}/${x.talent}/${x.avenger}`).join(' ') };
  out.push(r);
  console.log(JSON.stringify(r));
}
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(out, null, 1));
