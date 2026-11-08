// 9夜目版（セーブ形式9）の確認用セーブを作る：ふつう（日の途中）／自動の戦闘の途中／3部隊の途中の部隊／結果の途中（まとめた結果）
// 9夜目の版のコードで動かす：npx tsx scripts/mkfixture-v9.ts <出力先>
import { writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoDay, autoPending, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { startSortie, battleCtx, finishBattle, squadCount } from '../src/core/flow';
import { skipAuto } from '../src/core/battle/auto';
import { serialize } from '../src/core/save';
const out = process.argv[2];
setAutoChoicePick(humanLikePick(9));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261108, start: 'normal' });
autoYears(s, 4);
autoPending(s);
autoDay(s); autoPending(s); autoDay(s); autoPending(s);
console.log('day', s.year, s.month, s.day, enrolled(s).length);
writeFileSync(`${out}/v9-day.json`, serialize(s));
const toBoard = () => { let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 60) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); } s.pending = s.pending.filter((p) => p.type === 'questBoard'); };
toBoard();
console.log('squads', squadCount(s));
const sq = recommendSquads(s);
startSortie(s, sq);
writeFileSync(`${out}/v9-auto.json`, serialize(s));
skipAuto(s, battleCtx(s)); finishBattle(s);
console.log('sortie idx', s.sortie?.idx, s.battle?.questId);
writeFileSync(`${out}/v9-squad.json`, serialize(s));
for (let i = 0; i < 5 && s.battle; i++) { skipAuto(s, battleCtx(s)); finishBattle(s); }
console.log('result', s.pending.map((p) => p.type).join(','));
writeFileSync(`${out}/v9-result.json`, serialize(s));
