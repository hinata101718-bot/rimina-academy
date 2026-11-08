// 中立宣言の条件の調べもの：方針ごとに、年度末の評判・卒業生・友好度・防衛戦の勝利を数える
import { newGame } from '../src/core/game';
import { autoYears, setCareerPolicy, setAutoEnding, type CareerPolicy } from '../src/core/autoplay';
import { continueSchool } from '../src/core/ending';
import { BACKGROUNDS, COUNTRIES } from '../src/data/people';
import { activeAlumni } from '../src/core/world';
setAutoEnding((s) => continueSchool(s));
const argv = process.argv.slice(2);
const pols = (argv[0] ?? 'neutral,peace,unify,none').split(',') as CareerPolicy[];
const RUNS = Number(argv[1] ?? 10);
const YEARS = Number(argv[2] ?? 40);
for (const p of pols) {
  setCareerPolicy(p);
  let hits = 0; const yrs: number[] = []; let defWins = 0; let condYears = 0;
  for (let r = 0; r < RUNS; r++) {
    const s = newGame({ name: 'x', background: BACKGROUNDS[r % BACKGROUNDS.length].id, seed: 1000 + r * 7919 });
    const trace: string[] = [];
    let lastDef = 0;
    autoYears(s, YEARS, (g) => {
      const w = g.world; const grads = Object.values(g.students).filter((x) => x.status === 'graduated').length;
      const won = w.defenseWonYear === g.year - 1; if (w.defenseWonYear && w.defenseWonYear !== lastDef) { defWins++; lastDef = w.defenseWonYear; }
      const fmin = Math.min(w.friendship.kingdom, w.friendship.empire, w.friendship.alliance);
      if (g.reputation >= 90 && grads >= 100 && fmin >= 60 && !w.vassal) condYears++;
      trace.push(`${g.year - 1}:${Math.round(g.reputation)}/${grads}/${Math.round(w.friendship.kingdom)},${Math.round(w.friendship.empire)},${Math.round(w.friendship.alliance)}/a${COUNTRIES.map((c) => activeAlumni(g, c).length).join(',')}${won ? '/D' : ''}${w.era === 'peace' ? 'P' : ''}`);
    });
    const e = (s.endings ?? []).find((x) => x.kind === 'neutral');
    if (e) { hits++; yrs.push(e.year); }
    if (argv.includes('-v')) console.log(p, r, (s.endings ?? []).map((x) => `${x.kind}${x.year}`).join(','), trace.join(' '));
  }
  console.log(`[${p}] 中立 ${hits}/${RUNS} 年=${yrs.join(',')} 防衛戦勝利(延べ)=${defWins} 条件(防衛戦以外)を満たした年=${condYears}`);
}
