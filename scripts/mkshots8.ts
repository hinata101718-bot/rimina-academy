// 8夜目の画面撮影用のセーブ：npx tsx scripts/mkshots8.ts <出力先>
// home.json（2年目の5月：手紙・新聞・気にかける生徒あり）／result.json（授業の結果）／battle.json（戦いの記録）／board.json（依頼掲示板）
// exam.json（兵種試験）／entrance.json（入学試験）／grad.json（卒業式）／mentor.json（ポイントがたまった教官）
import { writeFileSync, mkdirSync } from 'node:fs';
import { serialize } from '../src/core/save';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, autoDay, setAutoChoicePick, humanLikePick, autoDeploy } from '../src/core/autoplay';
import { chooseLesson, startAutoQuest, endMonth } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { defaultPlan } from '../src/core/battle/auto';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots8';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const clone = (g: GameState): GameState => JSON.parse(serialize(g)).state;
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 77 });
autoYears(s, 1);
autoPending(s);
for (let i = 0; i < 6; i++) autoDay(s);
autoPending(s);
s.guideStep = 99; s.settings.guide = false;
s.lastExport = Date.now();
const ids = Object.values(s.students).filter((x) => x.status === 'enrolled').map((x) => x.id);
s.pinned = ids.slice(0, 2);
s.mail.unshift({ id: 'm-x', year: s.year, month: s.month, from: '北の国境の砦', title: '急報', body: '北の国境より伝令。帝国軍、三部隊が北上中との報せ。', read: false });
s.mail.unshift({ id: 'm-y', year: s.year, month: s.month, from: '王国の使者', title: '依頼状', body: '王国より、街道の警護の依頼が一通。', read: false });
todayCards(s);
save('home', s);
const r = clone(s); chooseLesson(r, recommendCard(r)); save('result', r);
const m = clone(s); m.instructor.xp = 1800; m.instructor.xpTotal = 2600; m.instructor.abilities = ['lecture', 'scout']; save('mentor', m);
{
  const g = clone(s);
  g.pending = [];
  let guard = 0;
  while (!g.pending.some((p) => p.type === 'questBoard') && guard++ < 40) { autoPending(g); if (g.pending.some((p) => p.type === 'questBoard')) break; autoDay(g); }
  g.pending = g.pending.filter((p) => p.type === 'questBoard');
  save('board', g);
  const q = g.quests.find((x) => x.real && x.enemyCountry) ?? g.quests.find((x) => x.real) ?? g.quests[0];
  const d = autoDeploy(g);
  startAutoQuest(g, q.id, d, defaultPlan(g, q, d));
  save('battle', g);
}
// 新聞：9月の終わりまで進めて前期号
{
  const g = clone(s);
  g.pending = [];
  let guard = 0;
  while (!(g.news[0]?.kind === 'first') && guard++ < 400) { autoPending(g); autoDay(g); }
  g.pending = g.pending.filter((p) => p.type === 'newspaper');
  save('news', g);
}
// 年度末（進路の相談＝卒業式の手前）
{
  const g = clone(s);
  g.pending = [];
  let guard = 0;
  while (!(g.month === 11 && g.week === 4) && guard++ < 900) autoDay(g);
  g.pending = []; g.battle = null;
  endMonth(g);
  save('grad', g);
}
console.log('ok', out);
