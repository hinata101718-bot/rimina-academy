// 13夜目の画面撮影用のセーブ：npx tsx scripts/mkshots13.ts <出力先>
// world（勢力図と、前に見たときからの地域の変化・組織図の変化があるもの）
import { writeFileSync, mkdirSync } from 'node:fs';
import { serialize } from '../src/core/save';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { markOrgSeen, orgChanges } from '../src/core/officers';
import { markMapSeen, mapChanges, ownerOf } from '../src/core/regions';
import { REGIONS } from '../src/data/regions';
const out = process.argv[2] ?? 'shots13';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 77 });
autoYears(s, 4);
autoPending(s);
markOrgSeen(s); markMapSeen(s);
autoYears(s, 2);
autoPending(s);
s.pending = [];
s.guideStep = 99; s.settings.guide = false; s.lastExport = Date.now();
// 地域の変化が少ないときは、撮影のため前に見た持ち主を書きかえる
if (mapChanges(s).length < 2 && s.mapSeen) {
  const cs = REGIONS.filter((r) => r.home !== 'school' && r.home !== 'wild' && ownerOf(s, r.id) !== 'wild').slice(0, 3);
  for (const r of cs) s.mapSeen.o[r.id] = r.home === 'kingdom' ? 'empire' : 'kingdom';
}
console.log('map changes', mapChanges(s).length, 'org', ['kingdom', 'empire', 'alliance', 'bandit'].map((f) => orgChanges(s, f as never).length).join(','));
writeFileSync(`${out}/world.json`, serialize(s));
