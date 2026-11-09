// 16夜目⑦：1か月の操作の数を数えるためのセーブを作る（月のはじめ。1部隊の月と3部隊の月）
// npx tsx scripts/mktap16.ts <出力先>
import { writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoDay, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { squadCount } from '../src/core/flow';
import { serialize } from '../src/core/save';
const out = process.argv[2];
setAutoChoicePick(humanLikePick(9));
const toMonthStart = (s: ReturnType<typeof newGame>, month: number) => {
  let g = 0;
  while (!(s.month === month && s.week === 1 && (s.day ?? 1) === 1 && !s.pending.length) && g++ < 400) { autoPending(s); if (s.month === month && s.week === 1 && (s.day ?? 1) === 1) { autoPending(s); break; } autoDay(s); }
  autoPending(s);
};
const a = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261109, start: 'normal' });
toMonthStart(a, 1);
console.log('one', a.year, a.month, a.week, a.day, enrolled(a).length, squadCount(a));
a.lastExport = 4102444800000;
writeFileSync(`${out}/tap-one.json`, serialize(a));
const b = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261110, start: 'normal' });
autoYears(b, 4); autoPending(b);
toMonthStart(b, 6);
console.log('three', b.year, b.month, b.week, b.day, enrolled(b).length, squadCount(b));
b.lastExport = 4102444800000;
writeFileSync(`${out}/tap-three.json`, serialize(b));
