// 9夜目の画面撮影用のセーブ：npx tsx scripts/mkshots9.ts <出力先>
// board.json（3部隊の出撃前）／battle.json（第1部隊の戦い）／result.json（3部隊の結果）／org.json（組織図の変化）／strat.json（新しい策）
import { writeFileSync, mkdirSync } from 'node:fs';
import { serialize } from '../src/core/save';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, autoDay, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { startSortie, finishBattle, battleCtx, chooseLesson, squadCount } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { skipAuto, officerForQuest } from '../src/core/battle/auto';
import { markOrgSeen } from '../src/core/officers';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots9';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const clone = (g: GameState): GameState => JSON.parse(serialize(g)).state;
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 77 });
autoYears(s, 4);
autoPending(s);
s.guideStep = 99; s.settings.guide = false; s.lastExport = Date.now();
// 組織図：今のようすを「前に見たとき」にして、数か月進める
const toBoard = (g: GameState) => {
  let guard = 0;
  while (guard++ < 80) {
    g.pending = g.pending.filter((p) => p.type === 'questBoard');
    if (g.pending.length) { if (g.quests.length >= 3) break; autoPending(g); continue; }
    autoPending(g);
    todayCards(g); chooseLesson(g, recommendCard(g));
  }
  g.pending = g.pending.filter((p) => p.type === 'questBoard');
};
markOrgSeen(s);
for (let m = 0; m < 4; m++) { toBoard(s); autoPending(s); }
autoPending(s); s.pending = [];
save('org', s);
const b = clone(s);
toBoard(b);
// 3部隊を出せる月まで進める
for (let k = 0; k < 8 && squadCount(b) < 3; k++) { autoPending(b); toBoard(b); }
save('board', b);
const sq = recommendSquads(b);
startSortie(b, sq);
save('battle', b);
// 一騎打ちが来る戦い（敵将は「一騎打ちを断れない」）
{
  const d = clone(s);
  toBoard(d);
  const list = recommendSquads(d);
  for (const x of list) { const q = d.quests.find((y) => y.id === x.questId)!; const o = officerForQuest(d, q); if (o && !o.traits.includes('duel_bound')) o.traits[0] = 'duel_bound'; }
  startSortie(d, list);
  save('duel', d);
}
const r = clone(b);
let g = 0;
while (r.battle && g++ < 5) { skipAuto(r, battleCtx(r)); finishBattle(r); }
r.pending = r.pending.filter((p) => p.type === 'sortieResult' || p.type === 'battleResult');
save('result', r);
const t = clone(s);
t.strats = ['rally', 'ambush', 'feint'];
for (const st of Object.values(t.students)) if (st.status === 'enrolled') { st.strat = 30; break; }
t.pending = [{ type: 'newStrat', id: 'withdraw', by: Object.values(t.students).find((x) => x.status === 'enrolled')!.id, why: 'テスト' }];
save('strat', t);
console.log('ok', s.year, s.month, Object.values(s.students).filter((x) => x.status === 'enrolled').length, sq.length);
