// 10夜目の画面撮影用のセーブ：npx tsx scripts/mkshots10.ts <出力先>
// board（3部隊の出撃前・同行しない）／battle（新しい戦いの画面）／result（同行しない部隊の結果と戦利品）／skills（技能タブの得意・苦手・芽）／bloom（開花の演出）
import { writeFileSync, mkdirSync } from 'node:fs';
import { serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { startSortie, finishBattle, battleCtx, chooseLesson, squadCount } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { skipAuto } from '../src/core/battle/auto';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots10';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const clone = (g: GameState): GameState => JSON.parse(serialize(g)).state;
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 77 });
autoYears(s, 4);
autoPending(s);
s.guideStep = 99; s.settings.guide = false; s.lastExport = Date.now();
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
toBoard(s);
for (let k = 0; k < 8 && squadCount(s) < 3; k++) { autoPending(s); toBoard(s); }
save('board', s);
const b = clone(s);
startSortie(b, recommendSquads(b));
save('battle', b);
// 結果：同行しない部隊があり、戦利品（銘入り）があるものを探す
let r: GameState | null = null;
const base = clone(s);
for (let m = 0; m < 12 && !r; m++) {
  const t = clone(base);
  startSortie(t, recommendSquads(t));
  let g = 0;
  while (t.battle && g++ < 5) { skipAuto(t, battleCtx(t)); finishBattle(t); }
  const res = t.pending.find((p) => p.type === 'sortieResult');
  if (res?.type === 'sortieResult' && res.reports.some((x) => x.away) && res.reports.some((x) => (x.loot ?? []).some((l) => l.named))) { t.pending = [res]; r = t; break; }
  autoPending(base); toBoard(base);
}
if (r) save('result', r); else console.log('結果の場面が見つからなかった');
// 技能タブ：得意・苦手と芽（撮影のため、在籍の子に芽を見せる）
const k = clone(s);
k.pending = [];
for (const st of enrolled(k)) if (st.apt?.bad.length && !st.bud) st.bud = { skill: st.apt.bad[0], reveal: 100 };
for (const st of enrolled(k)) if (st.bud && !st.bud.done) st.bud.reveal = 100;
save('skills', k);
// 開花の演出
const f = clone(k);
const st = enrolled(f).find((x) => x.bud?.skill)!;
st.bud!.done = true; st.bud!.ability = `bloom_${st.bud!.skill}`; st.bud!.year = f.year;
st.apt = { good: [...(st.apt?.good ?? []), st.bud!.skill!], bad: (st.apt?.bad ?? []).filter((x) => x !== st.bud!.skill) };
f.pending = [{ type: 'bloom', studentId: st.id, skill: st.bud!.skill }];
save('bloom', f);
console.log('ok', out);
