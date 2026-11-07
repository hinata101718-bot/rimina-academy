// 支援会話データの検証：npx tsx scripts/check-talks.ts
// - TALKS が参照する意味ID（if/then/else 含む）がすべて PHRASES にあるか
// - PHRASES の各エントリが10性格すべての文面を持つか（空文字・空配列も不可）
// - 会話IDの重複、未知の差し込みタグ、話題と会話の数
import { PHRASES, TALKS } from '../src/data/talks';
import type { PersonalityId, TalkTopic } from '../src/core/types';

const PERSONALITIES: PersonalityId[] = [
  'hot', 'calm', 'timid', 'cynic', 'gentle', 'serious', 'cheerful', 'shy', 'competitive', 'whimsical',
];
const TOPICS: TalkTopic[] = [
  'dream', 'origin', 'house', 'trait',
  'ev_cover', 'ev_samekill', 'ev_exam', 'ev_loss', 'ev_homewar', 'ev_festival', 'ev_spar', 'ev_injury',
  'rel_friend', 'rel_rival', 'rel_love', 'daily',
];
const PLACEHOLDERS = new Set([
  'me', 'you', 'myDream', 'yourDream', 'myCountry', 'yourCountry', 'myTrait', 'yourTrait', 'event', 'teacher', 'school',
]);

const errors: string[] = [];
const referenced = new Set<string>();
const ids = new Set<string>();

for (const t of TALKS) {
  if (ids.has(t.id)) errors.push(`会話IDが重複: ${t.id}`);
  ids.add(t.id);
  if (t.lines.length < 3 || t.lines.length > 6) errors.push(`${t.id}: 行数 ${t.lines.length}（3〜6）`);
  for (const [i, line] of t.lines.entries()) {
    const keys = typeof line.say === 'string' ? [line.say] : [line.say.then, line.say.else];
    for (const k of keys) {
      referenced.add(k);
      if (!PHRASES[k]) errors.push(`${t.id} 行${i + 1}: 意味ID "${k}" が PHRASES にない`);
    }
  }
}

for (const [key, entry] of Object.entries(PHRASES)) {
  for (const p of PERSONALITIES) {
    const v = entry[p];
    const list = v === undefined ? [] : Array.isArray(v) ? v : [v];
    if (list.length === 0 || list.some((s) => !s.trim())) errors.push(`PHRASES.${key}: ${p} の文面がない`);
    for (const s of list) {
      for (const m of s.matchAll(/\{(\w+)\}/g)) {
        if (!PLACEHOLDERS.has(m[1])) errors.push(`PHRASES.${key}.${p}: 未知の差し込み {${m[1]}}`);
      }
    }
  }
}

const unused = Object.keys(PHRASES).filter((k) => !referenced.has(k));
const byTopic = new Map<string, string[]>();
for (const t of TALKS) byTopic.set(t.topic, [...(byTopic.get(t.topic) ?? []), t.rank]);
const missingTopics = TOPICS.filter((t) => !byTopic.has(t));

console.log(`会話: ${TALKS.length} 件 / 話題: ${byTopic.size} 種 / 意味ID: ${Object.keys(PHRASES).length} 件（参照 ${referenced.size}）`);
for (const [topic, ranks] of byTopic) console.log(`  ${topic.padEnd(12)} ${ranks.join(' ')}`);
if (missingTopics.length) console.log(`未使用の話題: ${missingTopics.join(', ')}`);
if (unused.length) console.log(`警告：どの会話からも参照されない意味ID: ${unused.join(', ')}`);

if (errors.length) {
  console.error(`\nエラー ${errors.length} 件:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log('OK');
