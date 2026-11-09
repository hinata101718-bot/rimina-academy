import { newGame, enrolled } from '../src/core/game';
import { autoYears, opCount } from '../src/core/autoplay';
const t0 = Date.now();
for (const seed of [1,2,3]) {
  const s = newGame({ name: 'テスト', background: 'knight', seed });
  autoYears(s, Number(process.argv[2] ?? 2), (g) => console.log(seed, 'year', g.year, 'enrolled', enrolled(g).length, 'won', g.stats.battlesWon, 'lost', g.stats.battlesLost, 'deaths', g.stats.deaths, 'lv', enrolled(g).map(x=>x.level).join(',')));
}
console.log(opCount, Date.now()-t0, 'ms');
