// 5夜目の画面撮影用のセーブ：npx tsx scripts/mkshots5.ts <出力先>
// board.json（月末の依頼掲示板）・choice.json（自動の戦闘の、ここぞの選択の手前）・nemesis.json（年鑑の因縁の敵将）
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { rollQuests } from '../src/core/quests';
import { autoDeploy, finishAuto } from '../src/core/autoplay';
import { startAutoQuest } from '../src/core/flow';
import { defaultPlan } from '../src/core/battle/auto';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots';
const base = () => deserialize(readFileSync(new URL('../tests/fixtures/v3-save.json', import.meta.url), 'utf8'));
const board = (s: GameState, seed: number) => { s.rng = seed; s.pending = [{ type: 'questBoard' }]; s.battle = null; s.quests = rollQuests(s); };
// 依頼掲示板（敵将のいる実戦がある回）
{ const s = base(); board(s, 3); writeFileSync(`${out}/board.json`, serialize(s)); }
// 因縁の敵将：何度か戦わせて記録を作る
{ const s = base(); s.nemeses = [];
  for (let seed = 1; seed < 40 && (s.nemeses?.length ?? 0) < 2; seed++) { s.month = 2; board(s, seed); const q = s.quests.find((x) => x.real && !!x.enemyCountry) ?? s.quests.find((x) => x.real); if (!q) continue; const d = autoDeploy(s); s.pending = []; startAutoQuest(s, q.id, d, defaultPlan(s, q, d)); finishAuto(s); }
  s.pending = []; writeFileSync(`${out}/nemesis.json`, serialize(s)); }
console.log('ok');
