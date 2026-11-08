// 7夜目の画面撮影用のセーブ：npx tsx scripts/mkshots7.ts <出力先>
// home.json（授業カードの日）／result.json（授業を選んだ直後の結果）／year.json（2年目の在校生がそろったころ）
import { writeFileSync, mkdirSync } from 'node:fs';
import { serialize } from '../src/core/save';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, autoDay, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { chooseLesson } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
const out = process.argv[2] ?? 'shots7';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 77 });
autoYears(s, 1);
autoPending(s);
for (let i = 0; i < 6; i++) autoDay(s);
autoPending(s);
s.guideStep = 99; s.settings.guide = false;
s.lastExport = Date.now();
todayCards(s);
writeFileSync(`${out}/home.json`, serialize(s));
chooseLesson(s, recommendCard(s));
writeFileSync(`${out}/result.json`, serialize(s));
// 月末の依頼掲示板 → 自動の戦闘の途中（判断の手前）
import { startAutoQuest } from '../src/core/flow';
import { defaultPlan } from '../src/core/battle/auto';
import { autoDeploy } from '../src/core/autoplay';
{
  const g = JSON.parse(serialize(s)).state;
  g.pending = [];
  let guard = 0;
  while (!g.pending.some((p: { type: string }) => p.type === 'questBoard') && guard++ < 40) { autoPending(g); if (g.pending.some((p: { type: string }) => p.type === 'questBoard')) break; autoDay(g); }
  g.pending = g.pending.filter((p: { type: string }) => p.type === 'questBoard');
  writeFileSync(`${out}/board.json`, serialize(g));
  const q = g.quests.find((x: { real: boolean; enemyCountry: string | null }) => x.real && x.enemyCountry) ?? g.quests.find((x: { real: boolean }) => x.real) ?? g.quests[0];
  const d = autoDeploy(g);
  startAutoQuest(g, q.id, d, defaultPlan(g, q, d));
  writeFileSync(`${out}/battle.json`, serialize(g));
}
// 平和な時代（火種がくすぶっている）
import { continueSchool } from '../src/core/ending';
{
  const g = JSON.parse(serialize(s)).state;
  g.pending = []; g.battle = null;
  g.endings = [{ kind: 'peace', year: g.year - 6, n: 1 }];
  continueSchool(g);
  g.world.seed.since = g.year - 6; g.world.seed.smolder = 58; g.world.seed.omens = 1;
  writeFileSync(`${out}/peace.json`, serialize(g));
}
