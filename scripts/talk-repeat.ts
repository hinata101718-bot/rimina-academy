// 同じ子（同じ組）に同じ会話が出た回数を数える（10夜目：10年×3回で0が目標）
import { newGame } from '../src/core/game';
import { autoYears, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { setArchiveHook } from '../src/core/support';
import { INTERVIEWS } from '../src/data/talks/interviews';
import { WHOLE_INTERVIEWS } from '../src/data/talks/whole_index';
const RETAIN = new Set([...INTERVIEWS, ...WHOLE_INTERVIEWS].filter((d) => d.topic === 'retain').map((d) => d.title));
setAutoChoicePick(humanLikePick(3));
const years = Number(process.argv[2] ?? 10), runs = Number(process.argv[3] ?? 3);
let total = 0, rep = 0, follow = 0;
const ex: string[] = [];
for (let r = 0; r < runs; r++) {
  const seen = new Set<string>();
  setArchiveHook((t) => {
    if (t.again || (t.kind !== 'support' && RETAIN.has(t.title))) return;
    total++;
    if (t.title.includes('（その後）') || t.title === '前の話の続き') follow++;
    const k = `${t.a}|${t.b}|${t.kind === 'support' ? t.def ?? t.title : t.title}`;
    if (seen.has(k)) { rep++; if (ex.length < 8) ex.push(k); } else seen.add(k);
  });
  const s = newGame({ name: 't', background: ['knight', 'merc', 'mage'][r % 3], seed: 500 + r * 77 });
  autoYears(s, years);
}
console.log(JSON.stringify({ years, runs, talks: total, repeats: rep, followUps: follow, examples: ex }));
