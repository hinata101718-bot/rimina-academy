// 戦闘だけを何度も回して勝率・戦死率を見る（オートプレイ）
import { newGame, enrolled } from '../src/core/game';
import { startBattle } from '../src/core/flow';
import { autoDeploy, autoBattle } from '../src/core/autoplay';
import { rollQuests } from '../src/core/quests';
import type { GameState } from '../src/core/state';
const N = Number(process.argv[2] ?? 60);
const stat: Record<string, { n: number; win: number; dead: number; inj: number }> = {};
for (let i = 0; i < N; i++) {
  const s = newGame({ name: 't', background: 'knight', seed: 50 + i });
  s.quests = rollQuests(s);
  for (const q of s.quests) {
    const g: GameState = JSON.parse(JSON.stringify(s));
    startBattle(g, q.id, autoDeploy(g));
    autoBattle(g);
    const res = g.pending.find((p) => p.type === 'battleResult');
    const key = `${q.real ? '実戦' : '演習'}★${q.danger} ${q.objective}`;
    const r = (stat[key] ??= { n: 0, win: 0, dead: 0, inj: 0 });
    r.n++; if (res && res.type === 'battleResult' && res.win) r.win++;
    r.dead += Object.values(g.students).filter((x) => x.status === 'dead').length;
    r.inj += enrolled(g).filter((x) => x.injuredWeeks > 0).length;
  }
}
for (const [k, v] of Object.entries(stat).sort()) console.log(k.padEnd(20), `n=${v.n} 勝率${Math.round((v.win / v.n) * 100)}% 戦死/戦=${(v.dead / v.n).toFixed(2)} 重傷/戦=${(v.inj / v.n).toFixed(2)}`);
