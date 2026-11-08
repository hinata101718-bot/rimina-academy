// 8夜目版（セーブ形式8）の確認用セーブを作る：ふつう（日の途中）／自動の戦闘の途中／手動の戦闘の途中／戦闘の結果の途中
import { writeFileSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, autoDay, autoDeploy, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startBattle, startAutoQuest, battleCtx, finishBattle } from '../src/core/flow';
import { autoPlayerPhase, endPlayerPhase } from '../src/core/battle/engine';
import { defaultPlan, skipAuto } from '../src/core/battle/auto';
import { serialize } from '../src/core/save';
const out = process.argv[2];
setAutoChoicePick(humanLikePick(9));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261108, start: 'normal' });
autoYears(s, 3);
autoPending(s);
// ふつう：日の途中（火曜あたり）
autoDay(s); autoPending(s); autoDay(s); autoPending(s);
console.log('day', s.year, s.month, s.week, s.day, s.pending.length, Object.values(s.students).filter((x) => x.status === 'enrolled').length);
writeFileSync(`${out}/v8-day.json`, serialize(s));
const toBoard = () => { let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 40) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); } s.pending = s.pending.filter((p) => p.type === 'questBoard'); };
toBoard();
const base = JSON.parse(serialize(s));
let q = s.quests.find((x) => x.real) ?? s.quests[0];
let d = autoDeploy(s);
startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
console.log('auto choice', !!s.battle?.auto?.choice, s.battle?.auto?.scenes.length);
writeFileSync(`${out}/v8-auto.json`, serialize(s));
// 戦闘の結果の途中
skipAuto(s, battleCtx(s));
finishBattle(s);
console.log('result', s.pending.map((p) => p.type).join(','));
writeFileSync(`${out}/v8-result.json`, serialize(s));
const s2 = base.state;
q = s2.quests.find((x: { real: boolean }) => x.real) ?? s2.quests[0];
d = autoDeploy(s2);
startBattle(s2, q.id, d);
const ctx = battleCtx(s2);
for (let t = 0; t < 2 && s2.battle && s2.battle.phase !== 'done'; t++) { autoPlayerPhase(s2.battle, ctx); if ((s2.battle.phase as string) !== 'done') endPlayerPhase(s2.battle, ctx); }
writeFileSync(`${out}/v8-manual.json`, serialize(s2));
console.log('ok', s2.year, s2.month, s2.battle?.turn);
