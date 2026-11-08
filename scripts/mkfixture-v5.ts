// 5夜目版（セーブ形式4）の確認用セーブを作る：ふつう（因縁の敵将あり）／自動の戦闘の途中（判断の手前）／手動の戦闘の途中
import { writeFileSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, autoWeek, autoDeploy, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startBattle, startAutoQuest, battleCtx, nextWeek } from '../src/core/flow';
import { autoPlayerPhase, endPlayerPhase } from '../src/core/battle/engine';
import { defaultPlan } from '../src/core/battle/auto';
import { serialize } from '../src/core/save';

setAutoChoicePick(humanLikePick(7));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261109, start: 'normal' });
let y = 0;
while (y++ < 6 && (s.nemeses ?? []).filter((n) => n.status === 'active').length < 2) autoYears(s, 1);
for (let i = 0; i < 2; i++) autoWeek(s);
console.log('nemeses', (s.nemeses ?? []).length, s.year);
writeFileSync(new URL('../tests/fixtures/v5-save.json', import.meta.url), serialize(s));
const toBoard = () => { let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 30) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) nextWeek(s); } s.pending = s.pending.filter((p) => p.type === 'questBoard'); };
toBoard();
const base = JSON.parse(serialize(s));
// 自動の戦闘：判断の手前
let q = s.quests.find((x) => x.real) ?? s.quests[0];
let d = autoDeploy(s);
startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
console.log('auto choice', !!s.battle?.auto?.choice, s.battle?.auto?.scenes.length);
writeFileSync(new URL('../tests/fixtures/v5-auto.json', import.meta.url), serialize(s));
// 手動の戦闘：2ターン進めたところ
const s2 = base.state;
q = s2.quests.find((x: { real: boolean }) => x.real) ?? s2.quests[0];
d = autoDeploy(s2);
startBattle(s2, q.id, d);
const ctx = battleCtx(s2);
for (let t = 0; t < 2 && s2.battle && s2.battle.phase !== 'done'; t++) { autoPlayerPhase(s2.battle, ctx); if ((s2.battle.phase as string) !== 'done') endPlayerPhase(s2.battle, ctx); }
writeFileSync(new URL('../tests/fixtures/v5-manual.json', import.meta.url), serialize(s2));
console.log('ok', s2.year, s2.month, s2.battle?.turn);
