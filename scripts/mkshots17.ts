// 17夜目の撮影用セーブ：案内つきの最初の札の戦い（新しく始めた4月の終わり）・ふつうの月（手引き・設定）
// 使い方：npx tsx scripts/mkshots17.ts <出力先>
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie, chooseLesson } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { serialize } from '../src/core/save';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots17';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(3));
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
// 案内つきで新しく始めて、4月の終わりの最初の戦いへ
const t = newGame({ name: 'ヒナタ', background: 'knight', seed: Number(process.env.SEED ?? 20261110), tutorial: true });
t.tutorial!.tour = 99; t.lastExport = Date.now();
for (let i = 0; i < 40 && !t.pending.some((p) => p.type === 'questBoard'); i++) { t.pending = []; todayCards(t); chooseLesson(t, recommendCard(t)); }
t.pending = [];
startSortie(t, recommendSquads(t));
save('tut', t);
// ふつうの月（設定の画面）
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261109, start: 'normal' });
autoYears(s, 1); autoPending(s); s.pending = []; s.lastExport = Date.now();
save('main', s);
// 16夜目版のセーブ（出撃した直後の開戦）
writeFileSync(`${out}/v16.json`, readFileSync('tests/fixtures/v16-auto.json'));
console.log('ok', t.battle?.title, t.battle?.auto?.cards?.hand.length);
