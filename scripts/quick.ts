import { newGame, enrolled } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
const s = newGame({ name: 'テスト', background: 'knight', seed: 42 });
console.log('students', enrolled(s).map((x) => `${x.given}・${x.family} ${x.age}`).join(', '));
autoYears(s, 5, (g) => console.log(`year ${g.year} money ${g.money} rep ${g.reputation} students ${enrolled(g).length} grads ${g.stats.graduates} deaths ${g.stats.deaths} tension ${Math.round(g.world.tension)} gun ${g.world.gunUnlocked} W/L ${g.stats.battlesWon}/${g.stats.battlesLost}`));
