// 手動（4夜目までのオートプレイ）と自動の戦闘で、勝率・戦死・重傷を比べる
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { rollQuests } from '../src/core/quests';
import { autoDeploy, autoBattle, finishAuto } from '../src/core/autoplay';
import { startBattle, startAutoQuest } from '../src/core/flow';
import { defaultPlan } from '../src/core/battle/auto';
const txt = readFileSync(new URL(`../tests/fixtures/${process.argv[2] ?? 'v3-save.json'}`, import.meta.url), 'utf8');
const N = Number(process.argv[3] ?? 60);
const stat: Record<string, Record<string, { n: number; win: number; dead: number; inj: number }>> = { manual: {}, auto: {} };
for (const mode of ['manual', 'auto'] as const) for (let i = 0; i < N; i++) {
  const s = deserialize(txt); s.rng = i * 7919 + 13; s.pending = []; s.quests = rollQuests(s);
  for (const q of s.quests.filter((x) => x.real)) {
    const g = deserialize(txt); g.rng = s.rng + q.danger; g.pending = []; g.quests = s.quests.map((x) => ({ ...x }));
    const d = autoDeploy(g);
    if (mode === 'manual') { startBattle(g, q.id, d); const b = g.battle!; autoBattle(g); void b; }
    else { startAutoQuest(g, q.id, d, defaultPlan(g, q, d)); }
    const fallen = mode === 'manual' ? null : g.battle!.fallen;
    let win: boolean, dead = 0, inj = 0;
    if (mode === 'auto') { finishAuto(g); }
    const p = g.pending.find((x) => x.type === 'battleResult') as any;
    win = p.win;
    dead = Object.values(g.students).filter((x) => x.status === 'dead' && x.diedYear === g.year && x.deathNote?.includes(q.title)).length;
    inj = p.lines.filter((l: string) => l.includes('重傷（')).length;
    void fallen;
    const k = q.objective;
    const e = (stat[mode][k] ??= { n: 0, win: 0, dead: 0, inj: 0 });
    e.n++; if (win) e.win++; e.dead += dead; e.inj += inj;
  }
}
for (const mode of ['manual', 'auto']) {
  console.log(mode);
  let T = { n: 0, win: 0, dead: 0, inj: 0 };
  for (const [k, e] of Object.entries(stat[mode])) { console.log(`  ${k.padEnd(7)} n=${e.n} 勝率${Math.round(e.win / e.n * 100)}% 戦死/戦=${(e.dead / e.n).toFixed(3)} 重傷/戦=${(e.inj / e.n).toFixed(2)}`); T = { n: T.n + e.n, win: T.win + e.win, dead: T.dead + e.dead, inj: T.inj + e.inj }; }
  console.log(`  合計 n=${T.n} 勝率${Math.round(T.win / T.n * 100)}% 戦死/戦=${(T.dead / T.n).toFixed(3)} 重傷/戦=${(T.inj / T.n).toFixed(2)}`);
}
