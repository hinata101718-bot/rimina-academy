// 25夜目②：弓の届く距離を変えたあと、弓の系統の子の出番と働きを見る（小さなものさし）
// 使い方：npx tsx scripts/probe25.ts 年数 回数 方針 [--start=0] [--json=出力先]
// 見るもの：戦いの勝ちの割合・系統ごとの出撃の割合（在籍の割合と比べる）・1回の出撃で与えた傷と倒した数
import { writeFileSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, setCareerPolicy, setAutoEnding, setPendingHook, type CareerPolicy } from '../src/core/autoplay';
import { continueSchool } from '../src/core/ending';
import { CLASSES } from '../src/data/classes';
import { afterProbe } from '../src/core/tactics/after';
import type { GameState } from '../src/core/state';

const argv = process.argv.slice(2);
const flag = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const pos = argv.filter((a) => !a.startsWith('--'));
const YEARS = Number(pos[0] ?? 20), RUNS = Number(pos[1] ?? 4), POL = (pos[2] ?? 'auto') as CareerPolicy, START = Number(flag('start') ?? 0);
setAutoEnding((s) => continueSchool(s));
setPendingHook(() => undefined);
const lineOf = (id: string) => (CLASSES[id] as { line?: string } | undefined)?.line ?? 'novice';
const tot = { battles: 0, wins: 0 };
const dep: Record<string, { n: number; dealt: number; kills: number }> = {};
const enr: Record<string, number> = {}; let enrN = 0;
const t0 = Date.now();
afterProbe.fn = (b, win) => {
  tot.battles++; if (win) tot.wins++;
  for (const u of b.units) {
    if (u.side !== 'me' || u.teacher || !u.studentId) continue;
    const l = lineOf(u.classId);
    const d = (dep[l] ??= { n: 0, dealt: 0, kills: 0 });
    d.n++; d.dealt += u.dealt; d.kills += u.kills;
  }
};
for (let i = START; i < START + RUNS; i++) {
  setCareerPolicy(POL);
  const s = newGame({ name: 'シム', background: ['knight', 'merc', 'mage', 'wanderer'][i % 4], seed: 1000 + i });
  autoYears(s, YEARS, (g: GameState) => {
    for (const st of Object.values(g.students)) if (st.status === 'enrolled') { const l = lineOf(st.classId); enr[l] = (enr[l] ?? 0) + 1; enrN++; }
  });
}
afterProbe.fn = null;
const depN = Object.values(dep).reduce((a, x) => a + x.n, 0);
const lines = Object.keys(dep).sort((a, b) => dep[b].n - dep[a].n).map((l) => ({
  line: l,
  depShare: +((dep[l].n / depN) * 100).toFixed(1),
  enrShare: +(((enr[l] ?? 0) / Math.max(1, enrN)) * 100).toFixed(1),
  dealtPer: +(dep[l].dealt / dep[l].n).toFixed(1),
  killsPer: +(dep[l].kills / dep[l].n).toFixed(2),
}));
const out = { policy: POL, years: YEARS, runs: RUNS, battles: tot.battles, winRate: +((tot.wins / Math.max(1, tot.battles)) * 100).toFixed(1), lines, sec: Math.round((Date.now() - t0) / 1000) };
console.log(JSON.stringify(out, null, 1));
const j = flag('json'); if (j) writeFileSync(j, JSON.stringify(out, null, 1));
