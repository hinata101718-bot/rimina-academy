// 育ち方の比べ：3年×3回。年の初めの、2年生・3年生の平均レベル
const BASE = 1762650000000; let now = BASE; Date.now = () => (now += 1);
import { newGame } from '../src/core/game';
import { autoYears } from '../src/core/autoplay';
const out: Record<string, number[]> = {};
for (const seed of [1, 2, 3]) {
  const s = newGame({ name: 'シム', background: 'knight', seed: 1000 + seed });
  autoYears(s, 4, (g) => { for (const gr of [2, 3]) { const L = Object.values(g.students).filter((x) => x.status === 'enrolled' && x.grade === gr).map((x) => x.level); if (L.length) (out[`y${g.year}g${gr}`] ??= []).push(L.reduce((a, b) => a + b, 0) / L.length); } });
}
console.log(Object.entries(out).map(([k, v]) => `${k}:${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`).join(' '));
