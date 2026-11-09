// 16夜目：札の戦いを試す（1回の戦いの文を出す・数年回す）
import { newGame } from '../src/core/game';
import { autoYears, autoPending, autoDay, recommendSquads, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startSortie, battleCtx, finishBattle } from '../src/core/flow';
import { setCardMode, skipAuto } from '../src/core/battle/auto';
setCardMode(true);
setAutoChoicePick(humanLikePick(3));
const s = newGame({ name: 'テ', background: 'knight', seed: Number(process.argv[2] ?? 7), start: 'normal' });
autoYears(s, Number(process.argv[3] ?? 0));
let g = 0; while (!s.pending.some((p) => p.type === 'questBoard') && g++ < 80) { autoPending(s); if (!s.pending.some((p) => p.type === 'questBoard')) autoDay(s); }
s.pending = s.pending.filter((p) => p.type === 'questBoard');
const sq = recommendSquads(s);
for (const x of sq.slice(1)) x.away = false;
startSortie(s, sq);
const b = s.battle!;
const cs = b.auto!.cards!;
console.log('deck', Object.values(cs.cards).map((c) => `${b.units.find((u) => u.uid === c.owner)?.name ?? '先生'}:${c.name}`).join(' '));
console.log('front', cs.front.map((id) => b.units.find((u) => u.uid === id)?.name), 'reserve', cs.reserve.length, 'ap', cs.ap, 'turns', cs.maxTurns);
skipAuto(s, battleCtx(s));
for (const t of cs.turns) { console.log(`--- ターン${t.turn}`); for (const l of t.lines) console.log(`[${l.cls}] ${l.text}`); }
console.log('result', b.result, b.fallen);
for (const sc of b.auto!.scenes) console.log('scene', sc.title, sc.lines.map((l) => l.text).join(' / '));
finishBattle(s);
