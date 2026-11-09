// 15夜目の画面撮影用のセーブ：npx tsx scripts/mkshots15.ts <出力先>
// main（5年目：ホーム・手帳・書状・武器庫・図鑑・戦況・個人ページ・兵種試験）／board1（1部隊の月末）／board3（3部隊の月末）
import { writeFileSync, mkdirSync } from 'node:fs';
import { serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { chooseLesson } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { nextClasses } from '../src/core/exam';
import { SKILLS, RANK_POINTS } from '../src/data/balance';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots15';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const clone = (g: GameState): GameState => JSON.parse(serialize(g)).state;
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
const toBoard = (g: GameState) => { for (let i = 0; i < 40 && !g.pending.some((p) => p.type === 'questBoard'); i++) { g.pending = []; todayCards(g); chooseLesson(g, recommendCard(g)); } g.pending = g.pending.filter((p) => p.type === 'questBoard'); };
// ---- 1年目の5月：1部隊 ----
const a = newGame({ name: 'ヒナタ', background: 'knight', seed: 15 });
autoYears(a, 0.1 as unknown as number);
a.pending = []; a.lastExport = Date.now();
toBoard(a);
save('board1', a);
// ---- 5年目 ----
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 77 });
autoYears(s, 4);
autoPending(s);
s.pending = []; s.lastExport = Date.now();
// 兵種試験を受けられる子を1人
const st = enrolled(s).find((x) => nextClasses(s, x).length > 0 && x.grade >= 2)!;
st.level = Math.max(st.level, 21); for (const k of SKILLS) st.skills[k] = Math.max(st.skills[k] ?? 0, RANK_POINTS.B); st.examMonth = -1; st.injuredWeeks = 0;
console.log('exam', st.given);
save('main', s);
const b3 = clone(s); toBoard(b3);
save('board3', b3);
console.log('ok', enrolled(s).length, 'mail', s.mail.filter((m) => !m.read).length, s.mail.filter((m) => m.parts).length);
