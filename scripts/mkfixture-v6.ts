// 6夜目版（セーブ形式5）の確認用セーブを作る：週の途中（個人指導・週末の予定・重点科目あり）／月の途中／自動の戦闘の途中／手動の戦闘の途中
import { writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoWeek, autoDeploy, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startBattle, startAutoQuest, battleCtx, nextWeek } from '../src/core/flow';
import { autoPlayerPhase, endPlayerPhase } from '../src/core/battle/engine';
import { defaultPlan } from '../src/core/battle/auto';
import { serialize } from '../src/core/save';
const out = process.argv[2];
setAutoChoicePick(humanLikePick(7));
const s = newGame({ name: 'ヒナタ', background: 'mage', seed: 20261110, start: 'normal' });
autoYears(s, 2);
autoPending(s);
autoWeek(s); autoPending(s);
// 週の途中：個人指導・週末の予定・重点科目を決めたところ（第2週）
const list = enrolled(s);
s.focus[1] = ['magic', 'bow']; s.focus[2] = ['lance', 'faith'];
s.plan.tutoring = [{ studentId: list[0].id, kind: 'skill', skill: list[0].targets[0] }, { studentId: list[1].id, kind: 'talk' }];
s.plan.weekend = [{ kind: 'tea', ids: [list[2].id, list[3].id] }, { kind: 'rest' }];
console.log('week', s.month, s.week, s.pending.length);
writeFileSync(`${out}/v6-week.json`, serialize(s));
// 月の途中（第3週、予定なし）
nextWeek(s); s.pending = [];
writeFileSync(`${out}/v6-month.json`, serialize(s));
const toBoard = () => { let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 30) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) nextWeek(s); } s.pending = s.pending.filter((p) => p.type === 'questBoard'); };
toBoard();
const base = JSON.parse(serialize(s));
let q = s.quests.find((x) => x.real) ?? s.quests[0];
let d = autoDeploy(s);
startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
console.log('auto choice', !!s.battle?.auto?.choice, s.battle?.auto?.scenes.length);
writeFileSync(`${out}/v6-auto.json`, serialize(s));
const s2 = base.state;
q = s2.quests.find((x: { real: boolean }) => x.real) ?? s2.quests[0];
d = autoDeploy(s2);
startBattle(s2, q.id, d);
const ctx = battleCtx(s2);
for (let t = 0; t < 2 && s2.battle && s2.battle.phase !== 'done'; t++) { autoPlayerPhase(s2.battle, ctx); if ((s2.battle.phase as string) !== 'done') endPlayerPhase(s2.battle, ctx); }
writeFileSync(`${out}/v6-manual.json`, serialize(s2));
console.log('ok', s2.year, s2.month, s2.battle?.turn);
