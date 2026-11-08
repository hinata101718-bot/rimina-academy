// 育ち方の確認：学年の終わり（3月の第4週の初め）に、在校生のレベル・技能ランク・能力を学年ごとにまとめる
// 使い方：npx tsx scripts/growth-diag.ts [年数=9] [回数=4]
import { newGame, enrolled, effectiveStats } from '../src/core/game';
import { autoWeek, autoPending } from '../src/core/autoplay';
import { rankOf } from '../src/core/util';
import { TALENTS } from '../src/data/people';
import { SKILLS, STATS } from '../src/data/balance';
import type { GameState, Student } from '../src/core/state';
import type { SkillId } from '../src/core/types';

const YEARS = Number(process.argv[2] ?? 9);
const RUNS = Number(process.argv[3] ?? 4);
const FROM = Number(process.argv[4] ?? 0); // この年より後だけ記録する（学校が育った後の様子）
interface Row { grade: number; level: number; battles: number; top: number; second: number; other: number; talent: number | null; hp: number; best: number; worst: number; train: number; maxTier: number }
const rows: Row[] = [];
const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const q = (xs: number[], p: number) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0; };

function record(s: GameState) {
  for (const st of enrolled(s)) {
    const pts = SKILLS.filter((k) => k !== 'gun').map((k) => st.skills[k]).sort((a, b) => b - a);
    const tk = st.talent ? TALENTS[st.talent].skill : undefined;
    const base = st.stats;
    const vals = STATS.filter((k) => k !== 'hp' && k !== 'cha' && k !== 'lck').map((k) => base[k]).sort((a, b) => b - a);
    const train = Object.values((st as Student & { trainGain?: Record<string, number> }).trainGain ?? {}).reduce((a, b) => a + b, 0);
    rows.push({ grade: st.grade, level: st.level, battles: st.battles, top: pts[0], second: pts[1], other: med(pts.slice(2)), talent: tk ? st.skills[tk as SkillId] : null, hp: base.hp, best: vals[0], worst: vals[vals.length - 1], train, maxTier: 0 });
  }
  void effectiveStats;
}

for (let r = 0; r < RUNS; r++) {
  const s = newGame({ name: 'しらべ', background: ['knight', 'mage', 'scholar', 'wanderer'][r % 4], seed: 500 + r * 31 });
  let guard = 0;
  const end = s.year + YEARS;
  let marked = -1;
  while (s.year < end && guard++ < YEARS * 70) {
    autoPending(s);
    if (s.month === 11 && s.week === 4 && marked !== s.year) { marked = s.year; if (s.year > FROM) record(s); }
    autoWeek(s);
  }
}
const pct = (p: number) => `${rankOf(p)}(${Math.round(p)})`;
let deaths = 0;
for (const g of [1, 2, 3]) {
  const rs = rows.filter((x) => x.grade === g);
  if (!rs.length) continue;
  const byB = [...rs].sort((a, b) => b.battles - a.battles);
  const often = byB.slice(0, Math.ceil(byB.length / 2));
  const lv = often.map((x) => x.level);
  console.log(`${g}年の終わり（${rs.length}人） 死亡 ${deaths}`);
  console.log(`  よく出撃した子のLv：中央${med(lv)}（25%${q(lv, 0.25)}〜75%${q(lv, 0.75)}） 全体の中央Lv${med(rs.map((x) => x.level))} 出撃回数の中央${med(often.map((x) => x.battles))}`);
  console.log(`  得意：${pct(med(rs.map((x) => x.top)))}（25%${pct(q(rs.map((x) => x.top), 0.25))}〜75%${pct(q(rs.map((x) => x.top), 0.75))}） 2番目：${pct(med(rs.map((x) => x.second)))} その他：${pct(med(rs.map((x) => x.other)))} 才能：${pct(med(rs.filter((x) => x.talent !== null).map((x) => x.talent!)))}`);
  console.log(`  HP：${med(rs.map((x) => x.hp))}（${q(rs.map((x) => x.hp), 0.25)}〜${q(rs.map((x) => x.hp), 0.75)}） 得意な能力：${med(rs.map((x) => x.best))}（${q(rs.map((x) => x.best), 0.25)}〜${q(rs.map((x) => x.best), 0.75)}） 苦手な能力：${med(rs.map((x) => x.worst))} 鍛錬ゲージの+合計：${med(rs.map((x) => x.train))}`);
}
