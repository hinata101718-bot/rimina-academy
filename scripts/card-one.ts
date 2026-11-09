// 16夜目：札の戦いを1回ずつ、ターンごとの手と敵の数・HPを見る
import { newGame } from '../src/core/game';
import { autoYears, autoPending, autoDay, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie, battleCtx, finishBattle } from '../src/core/flow';
import { setCardMode, playCardTurn, chooseAuto } from '../src/core/battle/auto';
import { autoPick, intentText, cardPreview } from '../src/core/battle/cards';
setCardMode(true);
setAutoChoicePick(humanLikePick(3));
const s = newGame({ name: 'テ', background: 'knight', seed: Number(process.argv[2] ?? 7), start: 'normal' });
autoYears(s, Number(process.argv[3] ?? 0));
let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 80) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); }
s.pending = s.pending.filter((p) => p.type === 'questBoard');
const sq = recommendSquads(s).slice(0, 1);
startSortie(s, sq);
const b = s.battle!; const cs = b.auto!.cards!; const ctx = battleCtx(s);
const hpOf = (side: string) => b.units.filter((u) => u.side === side).map((u) => `${u.name}${u.hp}/${u.maxHp}`).join(' ');
console.log(b.title, b.objective, 'ap', cs.ap, 'turns', cs.maxTurns);
while (b.phase !== 'done' && cs.turn < 10) {
  if (b.auto!.choice) { console.log('choice', b.auto!.choice.kind); chooseAuto(s, b.auto!.choice.recommended, ctx); continue; }
  console.log(`== T${cs.turn} 味方 ${hpOf('player')}`);
  console.log(`   敵 ${hpOf('enemy')} front=${cs.front.length} res=${cs.reserve.length}`);
  console.log('   予告', cs.intents.map((it) => `${b.units.find((u) => u.uid === it.uid)?.name}:${intentText(b, it)}`).join(' | '));
  console.log('   手札', cs.hand.map((id) => `${cs.cards[id].name}[${cardPreview(s, b, ctx, id).text}]`).join(' '));
  const p = autoPick(s, b, ctx);
  console.log('   出す', p.ids.map((id) => cs.cards[id].name).join(','));
  playCardTurn(s, p.ids, p.target, ctx);
  for (const l of cs.turns[cs.turns.length - 1].lines) console.log('     ', l.text);
}
console.log('result', b.result, JSON.stringify(b.fallen));
