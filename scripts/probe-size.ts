// 23夜目⑩：おまかせが選んだ依頼の戦場の数（年あたり）
const BASE = 1762650000000; let now = BASE; Date.now = () => (now += 1);
import { newGame } from '../src/core/game';
import { autoYears, setPendingHook } from '../src/core/autoplay';
import { recommendQuest } from '../src/core/sortie';
import { ensureStages, questStages } from '../src/core/march';
const cnt: Record<number, number> = {}; let years = 0; let nemBig = 0, nemAll = 0;
for (const seed of [1, 2, 3]) {
  const s = newGame({ name: 'シム', background: 'knight', seed: 2000 + seed });
  setPendingHook((g, p) => { if (p.type !== 'questBoard' && p.type !== 'sortieChoice') return; ensureStages(g); const q = recommendQuest(g); if (!q) return; const n = questStages(q); cnt[n] = (cnt[n] ?? 0) + 1; if (q.nemesisId) { nemAll++; if (n >= 3) nemBig++; } });
  autoYears(s, 8); years += 8;
}
console.log('年あたり', Object.entries(cnt).map(([n, c]) => `戦場${n}:${(c / years).toFixed(2)}`).join(' '), `宿敵の依頼のうち大きめ ${nemBig}/${nemAll}`);
