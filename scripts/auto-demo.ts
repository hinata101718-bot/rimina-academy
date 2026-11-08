// 自動の戦闘のお試し：場面と選択を文字で出す
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { rollQuests } from '../src/core/quests';
import { autoDeploy } from '../src/core/autoplay';
import { startAutoQuest, battleCtx, finishBattle } from '../src/core/flow';
import { defaultPlan, skipAuto } from '../src/core/battle/auto';

const seed = Number(process.argv[2] ?? 1);
const s = deserialize(readFileSync(new URL('../tests/fixtures/v3-save.json', import.meta.url), 'utf8'));
s.rng = seed; s.pending = []; s.quests = rollQuests(s);
const q = s.quests.find((x) => x.real) ?? s.quests[0];
const d = autoDeploy(s);
startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
const name = (by: string) => by === 'narr' ? '' : by === 'leader' ? `【${s.battle!.auto!.leader?.name}】` : `【${s.students[by]?.given}】`;
skipAuto(s, battleCtx(s), (c) => { console.log(`  ◆選択：${c.prompt} → ${c.options.map((o) => o.label).join(' / ')}`); return c.recommended; });
console.log(q.title, q.objective, q.template, q.weather);
for (const sc of s.battle!.auto!.scenes) { console.log(`== ${sc.title}（勢い${Math.round(sc.momentum * 100)}）`); for (const l of sc.lines) console.log('  ' + name(l.by) + l.text); }
console.log('result', s.battle!.result, 'turn', s.battle!.turn, 'fallen', JSON.stringify(s.battle!.fallen));
finishBattle(s);
const p = s.pending.find((x) => x.type === 'battleResult') as any;
console.log(p.lines.join('\n'), '\n講評', p.review);
