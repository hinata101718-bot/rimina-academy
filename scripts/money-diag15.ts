// 15夜目：和平狙いの所持金が下がった原因の切り分け（道具の自動補充・声をかけるのおまかせ・戦技と魔法の5つ）
// npx tsx scripts/money-diag15.ts <restock 0|1> <spot 0|1> <seed>
import { newGame } from '../src/core/game';
import { autoYears, setCareerPolicy, setAutoChoicePick, humanLikePick, setAutoEnding } from '../src/core/autoplay';
import { continueSchool } from '../src/core/ending';
import { B } from '../src/data/balance';
const [rs, sp, seed] = process.argv.slice(2).map(Number);
if (!rs) { (B.restock as { vulnerary: number; elixir: number }).vulnerary = 0; (B.restock as { vulnerary: number; elixir: number }).elixir = 0; }
setAutoEnding((s) => continueSchool(s));
setAutoChoicePick(humanLikePick(20261108));
setCareerPolicy('peace');
const s = newGame({ name: 'テスト', background: 'knight', seed, start: 'normal' });
if (!sp) (globalThis as { __noSpot?: boolean }).__noSpot = true;
const ms: number[] = [];
autoYears(s, 12, (g) => ms.push(g.money));
console.log(JSON.stringify({ rs, sp, seed, money: ms, endings: (s.endings ?? []).map((e) => e.year) }));
