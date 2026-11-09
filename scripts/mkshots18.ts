// 18夜目の撮影・点検用セーブ：札を出す画面（手札5・7・9枚）、ふつうの月（個人ページ・図鑑・年鑑）
// 使い方：npx tsx scripts/mkshots18.ts <出力先>
import { writeFileSync, mkdirSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, autoDay, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie } from '../src/core/flow';
import { draw } from '../src/core/battle/cards';
import { serialize } from '../src/core/save';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots18';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(3));
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: Number(process.env.SEED ?? 20261118), start: 'normal' });
autoYears(s, 3); autoPending(s);
s.lastExport = Date.now(); s.cardGuide = 'done'; s.cardGuideSeen = true;
s.pending = [];
save('main', s);
// 次の月末の出撃（いちばん人数の多い部隊）
let g = 0;
while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 80) { if (s.pending.length) { s.pending = []; } autoDay(s); }
s.pending = [];
startSortie(s, recommendSquads(s).slice(0, 1));
const b = s.battle!; const cs = b.auto!.cards!;
b.auto!.shown = b.auto!.scenes.length; // 開戦の場面は見たことに
for (const n of [5, 7, 9]) {
  const keep = JSON.parse(JSON.stringify({ hand: cs.hand, deck: cs.deck }));
  cs.deck.unshift(...cs.hand); cs.hand = [];
  draw(b, n);
  save(`hand${n}`, s);
  cs.hand = keep.hand; cs.deck = keep.deck;
}
// お知らせ（戦い方が新しくなりました）
s.cardGuide = 'pending'; s.cardGuideSeen = false;
save('offer', s);
console.log('ok', b.title, cs.ap, b.units.filter((u) => u.side === 'player').length);
