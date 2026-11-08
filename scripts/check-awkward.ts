// 14夜目：ぎこちない読点の点検。言葉の途中に「、」が入って、部品をつないだように聞こえる文を探す
// 例：「わかる、ようになった」「行き、たい」「見て、ました」。使い方：npx tsx scripts/check-awkward.ts [--list]
import { readFileSync, readdirSync } from 'node:fs';
const files = ['src/data/autobattle_text.ts', 'src/data/evaluation.ts', 'src/data/officers_text.ts', 'src/data/aftermath.ts', 'src/data/aftermath_war.ts', 'src/data/lessons.ts', 'src/data/discovery.ts', 'src/data/mentor.ts', ...readdirSync('src/data/talks').map((f) => `src/data/talks/${f}`)];
/** 「、」のすぐあとに来ると、言葉がちぎれて聞こえるもの（助動詞・補助の言葉・語尾） */
export const AWKWARD = /[るたてくいうれし]、(ようになっ|ように|ない(?=[。、？！'…]|$|の|よ|で|か|ん|け)|なかった|だけ|かも|のかも|ます|ました|ません|です(?!か)|でした|みたい)|[てで]、(くれ|み[るたてよ]|いる|いた|ほし|あげ|もら|しま)|(?:[一-龠ァ-ヶ}]|わたし|あなた|みんな|きみ)の、(?=[一-龠ァ-ヶ{])/;
/** 短い切れはしが4つ以上「、」でつながった文（「……{a}の、こと、まだ、へた」） */
export function fragmented(q: string): boolean {
  for (const sent of q.replace(/^'|'$/g, '').split(/[。？！]/)) {
    const parts = sent.split('、');
    if (parts.length >= 4 && sent.replace(/[…{}a-zA-Z]/g, '').length / parts.length < 4) return true;
  }
  return false;
}
let n = 0;
const list = process.argv.includes('--list');
for (const f of files) {
  let lines: string[];
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  lines.forEach((l, i) => {
    for (const q of l.match(/'[^'\n]*'/g) ?? []) if (AWKWARD.test(q) || (/\b(shy|timid)\s*:/.test(l) && fragmented(q))) { n++; if (list) console.log(`${f}:${i + 1} ${q.slice(0, 90)}`); }
  });
}
console.log(`ぎこちない読点：${n}か所`);
