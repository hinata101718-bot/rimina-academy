// 4夜目版（セーブ形式3）の確認用セーブを作る：ふつうスタート・2年目の途中／手動の戦闘の途中
import { writeFileSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, autoWeek, autoDeploy, autoPending } from '../src/core/autoplay';
import { startBattle, battleCtx } from '../src/core/flow';
import { autoPlayerPhase, endPlayerPhase } from '../src/core/battle/engine';
import { serialize } from '../src/core/save';

const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 20261108, start: 'normal' });
autoYears(s, 1);
for (let i = 0; i < 6; i++) autoWeek(s);
writeFileSync(new URL('../tests/fixtures/v4-save.json', import.meta.url), serialize(s));
// 月末まで進めて、依頼掲示板で手動の戦闘を始め、2ターン進めたところ
let g = 0;
while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 20) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) { const { nextWeek } = await import('../src/core/flow'); nextWeek(s); } }
s.pending = s.pending.filter((p) => p.type === 'questBoard');
const q = s.quests.find((x) => x.real) ?? s.quests[0];
startBattle(s, q.id, autoDeploy(s));
const ctx = battleCtx(s);
for (let t = 0; t < 2 && s.battle && s.battle.phase !== 'done'; t++) { autoPlayerPhase(s.battle, ctx); if ((s.battle.phase as string) !== 'done') endPlayerPhase(s.battle, ctx); }
writeFileSync(new URL('../tests/fixtures/v4-battle.json', import.meta.url), serialize(s));
console.log('ok', s.year, s.month, s.week, s.battle?.turn, s.battle?.phase, q.title);
