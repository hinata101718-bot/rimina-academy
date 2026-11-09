// 17夜目版（セーブ形式17）の確認用セーブを作る：ふつう（日の途中）／札の戦いの途中（2ターン目）／3部隊の途中の部隊／結果の途中
// 17夜目の版のコードで動かす：npx tsx scripts/mkfixture-v17.ts <出力先>
import { writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoDay, autoPending, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { startSortie, battleCtx, finishBattle, squadCount } from '../src/core/flow';
import { skipAuto, playCardTurn } from '../src/core/battle/auto';
import { autoPick } from '../src/core/battle/cards';
import { serialize } from '../src/core/save';
const out = process.argv[2];
setAutoChoicePick(humanLikePick(9));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261110, start: 'normal' });
autoYears(s, 4);
autoPending(s);
autoDay(s); autoPending(s); autoDay(s); autoPending(s);
console.log('day', s.year, s.month, s.day, enrolled(s).length);
writeFileSync(`${out}/v17-day.json`, serialize(s));
const toBoard = () => { let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 60) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); } s.pending = s.pending.filter((p) => p.type === 'questBoard'); };
toBoard();
console.log('squads', squadCount(s));
const sq = recommendSquads(s);
for (const x of sq.slice(1)) x.away = false;
startSortie(s, sq);
// 札の戦いの途中：1ターン進めて、2ターン目の札を選ぶところ
{ const b = s.battle!; const ctx = battleCtx(s); if (b.auto?.cards) { const p = autoPick(s, b, ctx); playCardTurn(s, p.ids, p.target, ctx); } console.log('cards turn', s.battle?.auto?.cards?.turn, s.battle?.auto?.cards?.phase); }
writeFileSync(`${out}/v17-cards.json`, serialize(s));
skipAuto(s, battleCtx(s)); finishBattle(s);
console.log('sortie idx', s.sortie?.idx, s.battle?.questId);
writeFileSync(`${out}/v17-squad.json`, serialize(s));
for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
console.log('result', s.pending.map((p) => p.type).join(','));
writeFileSync(`${out}/v17-result.json`, serialize(s));
