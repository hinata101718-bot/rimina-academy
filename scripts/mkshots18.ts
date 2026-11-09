// 18夜目の撮影・点検用セーブ：
//   hand5/hand7/hand9＝札を出す画面（手札5・7・9枚）、offer＝「戦い方が新しくなりました」、
//   combo＝連携技の2枚が手札にそろった札の戦い、main＝個人ページ（熟練・進化・連携技・スキル3つ）と図鑑、
//   evolve＝進化の2択（処理待ち）、talk＝支援会話のあとの連携技の発見、v17＝17夜目版のセーブ（お知らせ）
// 使い方：npx tsx scripts/mkshots18.ts <出力先>
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, autoDay, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie } from '../src/core/flow';
import { draw } from '../src/core/battle/cards';
import { serialize } from '../src/core/save';
import { addSupport, getSupport } from '../src/core/support';
import { ensureCombo } from '../src/core/combo';
import { evoOptions, evoBase } from '../src/core/evolve';
import { loadoutOf } from '../src/core/arts';
import { B } from '../src/data/balance';
import { Rng } from '../src/core/rng';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots18';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(3));
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
const clone = (g: GameState): GameState => JSON.parse(serialize(g)).state;
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: Number(process.env.SEED ?? 20261118), start: 'normal' });
autoYears(s, 3); autoPending(s);
s.lastExport = Date.now(); s.cardGuide = 'done'; s.cardGuideSeen = true;
s.pending = [];
// 個人ページ用：はじめの子に、進化した技・熟練が満ちた技・連携技（戦死した子との技も）
const kids = enrolled(s);
for (const st of kids.slice(0, 6)) {
  const ids = loadoutOf(st).filter((id) => evoBase(id));
  if (ids[0]) { const o = evoOptions(ids[0], [])!; (st.evo ??= {})[ids[0]] = [o[0]]; (st.evoLog ??= []).push({ id: ids[0], branch: o[0], year: s.year - 1, month: 6 }); (st.mastery ??= {})[ids[0]] = 14; }
  if (ids[1]) (st.mastery ??= {})[ids[1]] = B.evo.need[0];
  if (ids[2]) (st.mastery ??= {})[ids[2]] = 3;
}
for (let i = 1; i < 4 && i < kids.length; i++) { const sp = getSupport(s, kids[0].id, kids[i].id); sp.value = Math.max(sp.value, B.support.B); if (sp.kind === 'none') sp.kind = (['rival', 'senpai', 'love'] as const)[i - 1]; ensureCombo(s, sp); }
const lostC = Object.values(s.combos ?? {}).find((c) => c.a !== kids[0].id && c.b !== kids[0].id);
if (lostC) lostC.lost = { year: s.year - 1, month: 9, by: lostC.a };
save('main', s);
// 進化の2択（処理待ち）
{ const g = clone(s); const st = g.students[kids[0].id]; const id = loadoutOf(st).filter((x) => evoBase(x))[1]; if (id) g.pending = [{ type: 'evolve', studentId: st.id, id }]; save('evolve', g); }
// 支援会話のあとの連携技の発見
{
  const g = clone(s);
  const ids = enrolled(g).map((x) => x.id);
  let made = false;
  for (let i = 4; i < ids.length && !made; i++) for (let j = i + 1; j < ids.length && !made; j++) {
    const sp = getSupport(g, ids[i], ids[j]);
    if (sp.value >= B.support.B || g.combos?.[`${sp.a}|${sp.b}`]) continue;
    sp.value = B.support.B - 1; sp.lastRank = 'C'; if (sp.kind === 'none') sp.kind = 'friend';
    const t = addSupport(g, new Rng({ rng: 7 + i * 31 + j }), ids[i], ids[j], 5);
    if (t?.combo) { g.pending = [{ type: 'talk', talk: t }]; made = true; }
  }
  save('talk', g);
}
// 次の月末の出撃（いちばん人数の多い部隊）
let k = 0;
while (!s.pending.some((p) => p.type === 'questBoard') && k++ < 80) { if (s.pending.length) { s.pending = []; } autoDay(s); }
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
// 連携技：出撃している2人に連携技をつくり、2人の攻撃の札を手札の先頭に
{
  const g = clone(s);
  const gb = g.battle!; const gc = gb.auto!.cards!;
  const mem = gb.units.filter((u) => u.side === 'player' && u.studentId);
  for (let i = 0; i < mem.length; i++) for (let j = i + 1; j < mem.length; j++) {
    if (Object.keys(g.combos ?? {}).length > 40) break;
    const c1 = Object.values(gc.cards).find((c) => c.owner === mem[i].uid && c.fx.type === 'atk' && (c.fx.cost ?? 1) === 1);
    const c2 = Object.values(gc.cards).find((c) => c.owner === mem[j].uid && c.fx.type === 'atk' && (c.fx.cost ?? 1) === 1);
    if (!c1 || !c2) continue;
    const sp = getSupport(g, mem[i].studentId!, mem[j].studentId!);
    sp.value = Math.max(sp.value, B.support.B); sp.kind = 'rival';
    ensureCombo(g, sp);
    gc.hand = [c1.id, c2.id, ...gc.hand.filter((x) => x !== c1.id && x !== c2.id)].slice(0, 5);
    gc.deck = gc.deck.filter((x) => x !== c1.id && x !== c2.id);
    i = mem.length; break;
  }
  save('combo', g);
}
// お知らせ（戦い方が新しくなりました）
s.cardGuide = 'pending'; s.cardGuideSeen = false;
save('offer', s);
// 17夜目版のセーブ（読みこむと「18夜目の新しいこと」）
writeFileSync(`${out}/v17.json`, readFileSync('tests/fixtures/v17-day.json'));
console.log('ok', b.title, cs.ap, b.units.filter((u) => u.side === 'player').length, Object.keys(s.combos ?? {}).length);
