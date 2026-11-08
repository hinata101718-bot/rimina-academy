// 宿敵の仕組みの様子を見る：オートプレイで何年か回して、敵将・宿敵・二つ名の数を数える
import { newGame } from '../src/core/game';
import { autoYears, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { officerName, rankName } from '../src/core/officers';
setAutoChoicePick(humanLikePick(3));
const YEARS = Number(process.argv[2] ?? 10);
const seed = Number(process.argv[3] ?? 5);
const s = newGame({ name: 'テスト', background: 'knight', seed, start: 'normal' });
const t0 = Date.now();
autoYears(s, YEARS, (g) => {
  const of = g.officers ?? [];
  const rv = Object.values(g.rivalries ?? {});
  console.log(`${g.year - 1}年目 敵将(現役)${of.filter((o) => o.status === 'active').length} 二つ名${of.filter((o) => o.epithet && o.kind === 'army').length} 傷${of.filter((o) => o.scars).length} 卒業生の敵将${of.filter((o) => o.alumniId).length} 因縁${rv.filter((r) => r.stage === 1).length} 宿敵${rv.filter((r) => r.stage >= 2).length} 誓い${rv.filter((r) => r.vow).length} 決着${rv.filter((r) => r.settled).length} 戦死${g.stats.deaths} 勝${g.stats.battlesWon}敗${g.stats.battlesLost}`);
});
console.log('ms', Date.now() - t0);
for (const o of (s.officers ?? []).filter((x) => x.meets.length >= 2).slice(0, 12)) console.log(officerName(o), rankName(o), o.status, 'meets', o.meets.length, 'scars', o.scars, 'victims', o.victims.length, 'known', o.knownTraits.join(','));
console.log(s.chronicle.filter((c) => /敵将|宿敵|仇|二つ名|呼ばれる|昇進|将軍|頭目/.test(c.text)).slice(-25).map((c) => `${c.year}-${c.month} ${c.text}`).join('\n'));
// 負けた戦いの敵将
const all = s.officers ?? [];
const tally: Record<string, [number, number]> = {};
for (const o of all) for (const m of o.meets) { const k = `${o.alumniId ? '卒業生' : rankName(o)}`; tally[k] ??= [0, 0]; tally[k][0]++; if (m.result === 'lose') tally[k][1]++; }
console.log('敵将の種類ごと [戦った数, 負けた数]', JSON.stringify(tally));
