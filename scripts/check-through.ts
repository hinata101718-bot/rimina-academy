// 14夜目⑨：新しく始めて（案内つき）、入学から最初のエンディング、そのあと「この学校を続ける」まで、
// 授業→処理待ち→出撃を1日ずつ自動で動かし、止まるところ・エラー・文の差し込み忘れがないことを確かめる
// 使い方：npx tsx scripts/check-through.ts [種=1] [エンディングのあとに続ける年数=5]
import { newGame } from '../src/core/game';
import { autoDay, autoPending, setAutoChoicePick, humanLikePick, setAutoEnding } from '../src/core/autoplay';
import { continueSchool } from '../src/core/ending';
import { serialize, deserialize } from '../src/core/save';
import { todayCards, recommendCard } from '../src/core/lessons';
import { chooseLesson } from '../src/core/flow';
import type { GameState } from '../src/core/state';

const seed = Number(process.argv[2] ?? 1), after = Number(process.argv[3] ?? 5);
setAutoChoicePick(humanLikePick(seed));
setAutoEnding((s) => continueSchool(s));
let s: GameState = newGame({ name: 'ヒナタ', background: 'knight', seed, tutorial: true });
const seenTypes = new Set<string>();
const problems: string[] = [];
let endYear = 0;
const t0 = Date.now();
const textOf = (x: unknown): string => JSON.stringify(x);
for (let step = 0; step < 200000; step++) {
  if (s.gameOver) { problems.push(`ゲームオーバー（${s.year}年目）`); break; }
  for (const p of s.pending) seenTypes.add(p.type === 'guide' ? `guide:${p.key}` : p.type);
  // 画面に出る文に、差し込み忘れや「undefined」がないか
  for (const p of s.pending) { const t = textOf(p); if (/undefined|NaN|\{[a-zA-Z]+\}/.test(t)) problems.push(`${s.year}年目 ${p.type}: ${t.match(/.{0,40}(undefined|NaN|\{[a-zA-Z]+\}).{0,40}/)?.[0]}`); }
  const before = `${s.year}|${s.month}|${s.week}|${s.day}|${s.pending.length}`;
  try {
    if (s.pending.length || s.battle) autoPending(s);
    else if (s.week === 1 && (s.day ?? 1) === 1) autoDay(s); // 月の初めは、目標技能・兵種試験などの手入れも
    else { todayCards(s); chooseLesson(s, recommendCard(s)); } // ふだんの日は、出た画面が見えるように1日ずつ
  }
  catch (e) { problems.push(`エラー（${s.year}年目${s.month + 4}月）：${(e as Error).message}`); break; }
  if (!endYear && (s.endings ?? []).length) endYear = s.year;
  if (endYear && s.year >= endYear + after) break;
  if (s.year > 80) { problems.push('80年たってもエンディングに届かない'); break; }
  // ときどき書き出して読みなおす（セーブを壊さない）
  if (step % 5000 === 0) s = deserialize(serialize(s));
  if (before === `${s.year}|${s.month}|${s.week}|${s.day}|${s.pending.length}` && !s.pending.length && !s.battle) { problems.push(`止まった：${before}`); break; }
}
console.log(`種${seed}：${s.year}年目まで（最初のエンディング ${endYear || 'なし'}年目、${s.endings?.map((e) => e.kind).join('・')}）。${Math.round((Date.now() - t0) / 1000)}秒`);
console.log(`出た画面：${[...seenTypes].sort().join(' ')}`);
console.log(problems.length ? `問題 ${problems.length}件\n${[...new Set(problems)].slice(0, 30).join('\n')}` : '問題なし');
process.exit(problems.length ? 1 : 0);
