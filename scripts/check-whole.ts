// まるごと書いた会話の点検：全部の会話を、まとまりに入る全性格の組み合わせで組み立て、差し込み忘れ（{…}）や空の行がないか確かめる
// 使い方：npx tsx scripts/check-whole.ts [ファイル名の一部（例 whole_a）]
import { newGame, enrolled } from '../src/core/game';
import { WHOLE_TALKS, WHOLE_INTERVIEWS } from '../src/data/talks/whole_index';
import { TONE_OF, TONES } from '../src/data/talks/whole';
import { renderWhole, getSupport } from '../src/core/support';
import { buildWholeInterview } from '../src/core/interview';
import { PERSONALITY_IDS } from '../src/data/people';
const s = newGame({ name: 'テスト', background: 'knight', seed: 3 });
const [a, b] = enrolled(s);
let bad = 0, n = 0;
const ids = new Set<string>();
for (const t of WHOLE_TALKS) {
  if (ids.has(t.id)) { console.log('同じid', t.id); bad++; }
  ids.add(t.id);
  if (!TONES.includes(t.ga) || !TONES.includes(t.gb)) { console.log('まとまりの名前がおかしい', t.id); bad++; }
  for (const pa of PERSONALITY_IDS.filter((p) => TONE_OF[p] === t.ga)) for (const pb of PERSONALITY_IDS.filter((p) => TONE_OF[p] === t.gb)) for (const g of ['m', 'f'] as const) {
    a.personality = pa; b.personality = pb; a.gender = g; b.gender = g === 'm' ? 'f' : 'm';
    getSupport(s, a.id, b.id).kind = t.topic === 'rel_love' ? 'love' : t.topic === 'rel_rival' ? 'rival' : 'friend';
    const lines = renderWhole(s, t.lines, a, b, '国境の小競り合い');
    n++;
    for (const l of lines) if (!l.text.trim() || /[{}]/.test(l.text) || l.text.includes('undefined')) { console.log('×', t.id, pa, pb, l.text); bad++; }
  }
}
for (const t of WHOLE_INTERVIEWS) {
  if (ids.has(t.id)) { console.log('同じid', t.id); bad++; }
  ids.add(t.id);
  for (const bg of ['knight', 'merc', 'mage', 'wanderer']) for (const p of PERSONALITY_IDS.filter((x) => TONE_OF[x] === t.g)) {
    s.instructor.background = bg; a.personality = p;
    const lines = buildWholeInterview(s, a, t).lines;
    n++;
    for (const l of lines) if (!l.text.trim() || /[{}]/.test(l.text) || l.text.includes('undefined')) { console.log('×', t.id, bg, p, l.text); bad++; }
  }
}
const pairs: Record<string, number> = {};
for (const t of WHOLE_TALKS) { const k = `${t.topic}:${[t.ga, t.gb].sort().join('-')}`; pairs[k] = (pairs[k] ?? 0) + 1; }
console.log(`会話${WHOLE_TALKS.length}本・面談${WHOLE_INTERVIEWS.length}本を${n}通りで組み立てた。問題 ${bad}件`);
const topics = [...new Set(WHOLE_TALKS.map((t) => t.topic))];
for (const tp of topics) console.log(`  ${tp}：${WHOLE_TALKS.filter((t) => t.topic === tp).length}本（組み合わせ${Object.keys(pairs).filter((k) => k.startsWith(tp + ':')).length}／15）`);
if (bad) process.exit(1);
