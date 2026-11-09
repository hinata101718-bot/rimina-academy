// 19夜目：長期シミュレーション（新しい戦い・宿敵の仕組み）。
// 使い方：npx tsx scripts/sim.ts 年数 回数 方針(auto,peace,unify,none) [--json=出力先] [--start=はじめの種]
// 見るもの：最初のエンディングの年・宿敵との再会（年あたり）・因縁のある宿敵の数・先生の代替わり・敵に回る教え子・教え子の死・止まらないこと
import { writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, setCareerPolicy, setAutoEnding, opCount, setPendingHook, type CareerPolicy } from '../src/core/autoplay';
import { continueSchool } from '../src/core/ending';
import { bondedOfficers } from '../src/core/nemesis';
import { officers } from '../src/core/officers';
import type { GameState } from '../src/core/state';
import { CLASSES } from '../src/data/classes';
import { teacherRank } from '../src/core/instructor';

const argv = process.argv.slice(2);
const flag = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const pos = argv.filter((a) => !a.startsWith('--'));
const YEARS = Number(pos[0] ?? 20);
const RUNS = Number(pos[1] ?? 4);
const POLICIES = (pos[2] ?? 'auto,peace').split(',') as CareerPolicy[];
const START = Number(flag('start') ?? 0);

setAutoEnding((s) => continueSchool(s));

interface Run { tier4: number; succBeforeEnd: number; teacherRank: number; allies: number; rivals: number; spies: number; policy: string; seed: number; error: string | null; firstEnding: number | null; firstKind: string | null; endings: number; reunions: number; nemBattles: number; bondAvg: number; bondMin: number; bondMax: number; named: number; successions: number; turned: number; cohorts: number; deaths: number; studentDeaths: number; wins: number; losses: number; revived: number; ms: number; graduates: number }

function run(policy: CareerPolicy, seed: number): Run {
  const t0 = Date.now();
  setCareerPolicy(policy);
  const s = newGame({ name: 'シム', background: ['knight', 'merc', 'mage', 'wanderer'][seed % 4], seed: 1000 + seed });
  opCount.reunions = 0; opCount.nemesis = 0;
  const bonds: number[] = [];
  let error: string | null = null;
  let revived = 0;
  setPendingHook(() => undefined);
  try {
    autoYears(s, YEARS, (g: GameState) => { bonds.push(bondedOfficers(g).length); });
  } catch (e) { error = String((e as Error).stack ?? e).split('\n').slice(0, 4).join(' | '); }
  const turned = officers(s).filter((o) => o.alumniId).length;
  revived = s.chronicle.filter((c) => c.text.startsWith('死んだはずの')).length;
  const named = officers(s).filter((o) => o.status === 'active').length;
  return {
    policy, seed, error, firstEnding: s.endings?.[0]?.year ?? null, firstKind: s.endings?.[0]?.kind ?? null, endings: (s.endings ?? []).length,
    reunions: opCount.reunions, nemBattles: opCount.nemesis,
    bondAvg: bonds.length ? +(bonds.reduce((a, b) => a + b, 0) / bonds.length).toFixed(1) : 0, bondMin: Math.min(...bonds), bondMax: Math.max(...bonds), named,
    successions: (s.pastInstructors ?? []).length, turned, cohorts: s.cohortCount, deaths: s.stats.deaths,
    studentDeaths: Object.values(s.students).filter((x) => x.status === 'dead').length, wins: s.stats.battlesWon, losses: s.stats.battlesLost, revived,
    ms: Date.now() - t0, graduates: Object.values(s.students).filter((x) => x.status === 'graduated').length,
    // 20夜目：最上級になった卒業生・先生の代替わり（最初のエンディングまで）・先生の兵種・味方になった宿敵・密偵
    tier4: Object.values(s.students).filter((x) => (CLASSES[x.classId]?.tier ?? 0) === 4).length,
    succBeforeEnd: (s.pastInstructors ?? []).filter((p) => p.to <= (s.endings?.[0]?.year ?? 999)).length,
    teacherRank: teacherRank(s),
    allies: officers(s).filter((o) => o.allied).length, rivals: Object.values(s.rivalries ?? {}).filter((r) => r.oath).length,
    spies: s.stats.spies ?? 0,
  };
}

const out: Run[] = [];
for (const p of POLICIES) for (let i = START; i < START + RUNS; i++) { const r = run(p, i); out.push(r); console.log(JSON.stringify(r)); }
const j = flag('json');
if (j) writeFileSync(j, JSON.stringify(out, null, 1));
// まとめ
for (const p of POLICIES) {
  const L = out.filter((r) => r.policy === p);
  const avg = (f: (r: Run) => number) => +(L.reduce((a, r) => a + f(r), 0) / Math.max(1, L.length)).toFixed(2);
  console.log(`== ${p}：エラー${L.filter((r) => r.error).length}／${L.length}　最初のエンディング ${L.map((r) => `${r.firstEnding ?? '-'}${r.firstKind ? r.firstKind[0] : ''}`).join(',')}　再会/年 ${avg((r) => r.reunions / YEARS)}　宿敵戦/年 ${avg((r) => r.nemBattles / YEARS)}　因縁の宿敵 平均${avg((r) => r.bondAvg)}（${Math.min(...L.map((r) => r.bondMin))}〜${Math.max(...L.map((r) => r.bondMax))}）　名前のある将 ${avg((r) => r.named)}　代替わり ${avg((r) => r.successions)}　敵に回った教え子/学年 ${avg((r) => r.turned / Math.max(1, r.cohorts))}　戦死/年 ${avg((r) => r.deaths / YEARS)}　勝ち率 ${avg((r) => r.wins / Math.max(1, r.wins + r.losses))}　蘇り ${avg((r) => r.revived)}　最上級 ${avg((r) => r.tier4)}　代替わり(最初のエンディングまで) ${avg((r) => r.succBeforeEnd)}　先生の兵種 ${avg((r) => r.teacherRank)}　味方の宿敵 ${avg((r) => r.allies)}　好敵手 ${avg((r) => r.rivals)}　密偵 ${avg((r) => r.spies)}　時間 ${avg((r) => r.ms)}ms`);
}
void enrolled;
