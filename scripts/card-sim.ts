// 16夜目：札の戦いの手早い確かめ（N年×何回）。勝率・在学中の戦死・重傷・ターン数・卒業時Lv
import { newGame } from '../src/core/game';
import { autoYears, setAutoChoicePick, humanLikePick, opCount, setCareerPolicy, type CareerPolicy } from '../src/core/autoplay';
import { setCardMode } from '../src/core/battle/auto';
import { cardStats } from '../src/core/battle/cards';
const mode = process.argv[2] !== 'old';
setCardMode(mode);
const years = Number(process.argv[3] ?? 6), runs = Number(process.argv[4] ?? 3);
setCareerPolicy((process.argv[5] ?? 'auto') as CareerPolicy);
setAutoChoicePick(humanLikePick(3));
let deaths = 0, lv = 0, n = 0, won = 0, lost = 0;
for (let i = 0; i < runs; i++) {
  const s = newGame({ name: 'テ', background: 'knight', seed: 100 + i, start: 'normal' });
  autoYears(s, years);
  for (const st of Object.values(s.students)) {
    if (st.status === 'graduated') { lv += st.level; n++; }
    if (st.status === 'dead' && (st.deathNote ?? '').includes('戦死')) deaths++;
  }
  won += s.stats.battlesWon; lost += s.stats.battlesLost;
}
console.log(JSON.stringify({ mode: mode ? 'cards' : 'old', winRate: (won / (won + lost) * 100).toFixed(1), deathsPerRun: (deaths / runs).toFixed(1), gradLv: (lv / Math.max(1, n)).toFixed(1), sq: opCount.sq, turns: (cardStats.turns / Math.max(1, cardStats.battles)).toFixed(2), timeouts: cardStats.timeouts, timeoutWins: cardStats.timeoutWins, battles: cardStats.battles }));
