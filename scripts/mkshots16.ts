// 16夜目の撮影用セーブ：札の戦いの開戦・札を出す・結果・判断、出撃前の山札、個人ページ、15夜目版のセーブ
// 使い方：npx tsx scripts/mkshots16.ts <出力先>
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie, battleCtx, chooseLesson } from '../src/core/flow';
import { playCardTurn } from '../src/core/battle/auto';
import { autoPick } from '../src/core/battle/cards';
import { todayCards, recommendCard } from '../src/core/lessons';
import { serialize } from '../src/core/save';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots16';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(3));
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
const toBoard = (g: GameState) => { for (let i = 0; i < 40 && !g.pending.some((p) => p.type === 'questBoard'); i++) { g.pending = []; todayCards(g); chooseLesson(g, recommendCard(g)); } g.pending = g.pending.filter((p) => p.type === 'questBoard'); };
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261109, start: 'normal' });
autoYears(s, 2);
autoPending(s);
s.pending = []; s.lastExport = Date.now();
save('main', s);
toBoard(s);
save('board', s);
const sq = recommendSquads(s).slice(0, 1);
startSortie(s, sq);
save('open', s);
s.battle!.auto!.shown = 1;
save('play', s);
const ctx = battleCtx(s);
const p = autoPick(s, s.battle!, ctx);
playCardTurn(s, p.ids, p.target, ctx);
save('result', s);
// 判断が出るまで（出なければ、別の月で）
let k = 0;
while (s.battle && s.battle.phase !== 'done' && !s.battle.auto!.choice && k++ < 8) { s.battle.auto!.cards!.phase = 'play'; const q = autoPick(s, s.battle, ctx); playCardTurn(s, q.ids, q.target, ctx); }
// 判断が出なかったら、宿敵のいる戦いを探して作る（同じ学校の別の月）
let g2: GameState | null = s.battle?.auto?.choice ? s : null;
for (let m = 0; m < 12 && !g2; m++) {
  const t = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261109 + m * 7, start: 'normal' });
  autoYears(t, 3); autoPending(t); t.pending = []; t.lastExport = Date.now(); toBoard(t);
  startSortie(t, recommendSquads(t).slice(0, 1));
  const c2 = battleCtx(t); let j = 0;
  while (t.battle && t.battle.phase !== 'done' && !t.battle.auto!.choice && j++ < 8) { t.battle.auto!.cards!.phase = 'play'; t.battle.auto!.shown = t.battle.auto!.scenes.length; const q = autoPick(t, t.battle, c2); playCardTurn(t, q.ids, q.target, c2); }
  if (t.battle?.auto?.choice) g2 = t;
}
console.log('choice', !!g2?.battle?.auto?.choice, g2?.battle?.auto?.choice?.kind, enrolled(s).length);
if (g2?.battle?.auto) { g2.battle.auto.cards!.phase = 'play'; g2.battle.auto.shown = g2.battle.auto.scenes.length; save('later', g2); }
writeFileSync(`${out}/v15.json`, readFileSync('tests/fixtures/v15-day.json'));
