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
