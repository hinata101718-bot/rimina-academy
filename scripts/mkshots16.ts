// 16夜目の撮影用セーブ：札の戦いの開戦・札を出す・結果・判断、出撃前の山札、15夜目版のセーブ
// 使い方：npx tsx scripts/mkshots16.ts <出力先>
import { writeFileSync, readFileSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, autoDay, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie, battleCtx } from '../src/core/flow';
import { setCardMode, playCardTurn } from '../src/core/battle/auto';
import { autoPick } from '../src/core/battle/cards';
import { serialize } from '../src/core/save';
const out = process.argv[2];
setCardMode(true);
setAutoChoicePick(humanLikePick(3));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261109, start: 'normal' });
autoYears(s, 2);
let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 80) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); }
s.pending = s.pending.filter((p) => p.type === 'questBoard');
writeFileSync(`${out}/board.json`, serialize(s));
const sq = recommendSquads(s).slice(0, 1);
startSortie(s, sq);
writeFileSync(`${out}/open.json`, serialize(s));
s.battle!.auto!.shown = 1;
writeFileSync(`${out}/play.json`, serialize(s));
const ctx = battleCtx(s);
const p = autoPick(s, s.battle!, ctx);
playCardTurn(s, p.ids, p.target, ctx);
writeFileSync(`${out}/result.json`, serialize(s));
// 判断が出るまで
let k = 0;
while (s.battle && s.battle.phase !== 'done' && !s.battle.auto!.choice && k++ < 8) { s.battle.auto!.cards!.phase = 'play'; const q = autoPick(s, s.battle, ctx); playCardTurn(s, q.ids, q.target, ctx); }
console.log('choice', !!s.battle?.auto?.choice, s.battle?.auto?.cards?.turn);
writeFileSync(`${out}/later.json`, serialize(s));
writeFileSync(`${out}/v15.json`, readFileSync('tests/fixtures/v15-day.json'));
