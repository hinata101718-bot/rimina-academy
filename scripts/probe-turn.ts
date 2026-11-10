// 23夜目⑧⑪：敵の番の長さ（画面の演出の時間の見積もり）と、1つの戦場のターン数
const BASE = 1762650000000; let now = BASE; Date.now = () => (now += 1);
import { newGame } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
import { buildBattle } from '../src/core/flow';
import { recommendSquad } from '../src/core/sortie';
import { autoTurn } from '../src/core/tactics/ai';
import { walkPath } from '../src/core/tactics/engine';
import type { TBattle, TFx } from '../src/core/tactics/types';
// 画面の演出の時間（ふつうの速さ・Tactics.tsx と同じ数字）
function foeTurnMs(view: TBattle, fx: TFx[]): number {
  const U = (id: string) => view.units.find((u) => u.uid === id);
  const leader = (id: string) => { const u = U(id); return !!u && u.side === 'foe' && (!!u.boss || !!u.nemesis); };
  let ms = 650; let longest = 0; let lastLeader = '';
  for (const f of fx) {
    if (f.k === 'move') { const u = U(f.uid); if (!u) continue; const n = walkPath(view, u, f.x, f.y).length; if (leader(f.uid)) { if (lastLeader !== f.uid) ms += 480 + 220; lastLeader = f.uid; ms += n * 120 + 80; } else longest = Math.max(longest, n); u.x = f.x; u.y = f.y; }
    else if (f.k === 'hit') { ms += leader(f.a) ? 520 : 380; if (f.brk) ms += 1000; }
    else if (f.k === 'heal' || f.k === 'flee') ms += 500;
    else if (f.k === 'reveal') ms += 700;
    else if (f.k === 'cutin') ms += 950; else if (f.k === 'say') ms += 1500;
  }
  return ms + (longest ? longest * 120 + 120 : 0);
}
const s = newGame({ name: 'シム', background: 'knight', seed: 1005 });
const turns: number[] = []; const foeMs: number[] = []; let over20 = 0;
for (let y = 0; y < 4; y++) {
  autoYears(s, 1);
  for (const q of s.quests.filter((x) => x.real)) {
    const b = buildBattle(s, q, recommendSquad(s, q).deploy);
    let g = 0;
    while (b.phase !== 'done' && g++ < 40) {
      const view: TBattle = JSON.parse(JSON.stringify(b));
      autoTurn(b);
      const i = b.fx.findIndex((f) => f.k === 'phase' && f.side === 'foe');
      if (i < 0) continue;
      const j = b.fx.findIndex((f, k) => k > i && f.k === 'phase' && f.side === 'me');
      // 味方の動きを先に盤に入れてから、敵の番を見積もる
      for (const f of b.fx.slice(0, i)) if (f.k === 'move') { const u = view.units.find((x) => x.uid === f.uid); if (u) { u.x = f.x; u.y = f.y; } } else if (f.k === 'hit' && f.kill) { const u = view.units.find((x) => x.uid === f.d); if (u) u.alive = false; }
      const ms = foeTurnMs(view, b.fx.slice(i + 1, j < 0 ? undefined : j));
      foeMs.push(ms); if (ms > 20000) over20++;
    }
    turns.push(b.turn);
  }
}
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length);
foeMs.sort((a, b) => a - b);
console.log(`戦場 ${turns.length}  ターン数 平均${avg(turns).toFixed(1)}  敵の番 平均${(avg(foeMs) / 1000).toFixed(1)}秒 いちばん長い${(foeMs[foeMs.length - 1] / 1000).toFixed(1)}秒 9割${(foeMs[Math.floor(foeMs.length * 0.9)] / 1000).toFixed(1)}秒 20秒こえ${over20}/${foeMs.length}`);
