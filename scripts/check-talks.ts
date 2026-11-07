// 会話データの検証：npx tsx scripts/check-talks.ts
// - TALKS・INTERVIEWS が参照する意味ID（分岐の中も）がすべてあるか
// - PHRASES の各エントリが10性格すべての文面を持つか（地の文 n_ は default だけでよい）
// - 先生のセリフが4つの経歴すべてにあるか
// - 支援会話の行数（C=8〜10、B=10〜14、A=14〜20 セリフ。地の文は数えない）、分岐2か所以上、話題20〜30種
// - 面談の行数（8〜12 セリフ）
import { PHRASES, TALKS } from '../src/data/talks';
import { INTERVIEWS, IV_NARR, TEACHER_PHRASES } from '../src/data/talks/interviews';
import type { PersonalityId, TalkSay, TalkLine } from '../src/core/types';

const PERSONALITIES: PersonalityId[] = ['hot', 'calm', 'timid', 'cynic', 'gentle', 'serious', 'cheerful', 'shy', 'competitive', 'whimsical'];
const PLACEHOLDERS = new Set(['me', 'you', 'event', 'teacher', 'school', 'season', 'scene',
  ...['Dream', 'Country', 'Trait', 'Home', 'Food', 'Sight', 'Fest', 'Cold', 'House', 'Duty', 'Skill', 'Class', 'Friend', 'Hint', 'TalentSkill'].flatMap((k) => [`my${k}`, `your${k}`])]);
const RANGE: Record<string, [number, number]> = { C: [8, 10], B: [10, 14], A: [14, 20] };

const errors: string[] = [];
let emptyCount = 0;
const referenced = new Set<string>();
const keysOf = (say: TalkSay): string[] => (typeof say === 'string' ? [say] : [...keysOf(say.then), ...keysOf(say.else)]);
const branchesOf = (lines: TalkLine[]) => lines.filter((l) => typeof l.say !== 'string').length;
function checkText(where: string, text: string) {
  for (const m of text.matchAll(/\{(\w+)\}/g)) if (!PLACEHOLDERS.has(m[1])) errors.push(`${where}: 未知の差し込み {${m[1]}}`);
}

const ids = new Set<string>();
for (const t of TALKS) {
  if (ids.has(t.id)) errors.push(`会話IDが重複: ${t.id}`);
  ids.add(t.id);
  const spoken = t.lines.filter((l) => l.by !== 'n').length;
  const [mn, mx] = RANGE[t.rank];
  if (spoken < mn || spoken > mx) errors.push(`${t.id}: セリフ数 ${spoken}（${t.rank}は${mn}〜${mx}）`);
  if (branchesOf(t.lines) < 2) errors.push(`${t.id}: 分岐が${branchesOf(t.lines)}か所（2か所以上）`);
  for (const [i, line] of t.lines.entries()) for (const k of keysOf(line.say)) {
    if (!k) continue;
    referenced.add(k);
    if (!PHRASES[k]) errors.push(`${t.id} 行${i + 1}: 意味ID "${k}" が PHRASES にない`);
    else if (line.by === 'n' && !PHRASES[k].default) errors.push(`${t.id} 行${i + 1}: 地の文 "${k}" に default がない`);
  }
}
for (const d of INTERVIEWS) {
  const all = [...d.lines, ...(d.choice?.options[0].lines ?? [])];
  const spoken = all.filter((l) => l.by !== 'n').length;
  if (spoken < 8 || spoken > 12) errors.push(`面談 ${d.id}: セリフ数 ${spoken}（8〜12）`);
  const lines = [...d.lines, ...(d.choice?.options.flatMap((o) => o.lines) ?? [])];
  for (const l of lines) for (const k of keysOf(l.say)) {
    if (l.by === 'n') { if (!IV_NARR[k]) errors.push(`面談 ${d.id}: 地の文 "${k}" がない`); else checkText(`IV_NARR.${k}`, IV_NARR[k]); }
    else if (l.by === 't') { if (!TEACHER_PHRASES[k]) errors.push(`面談 ${d.id}: 先生のセリフ "${k}" がない`); }
    else { referenced.add(k); if (!PHRASES[k]) errors.push(`面談 ${d.id}: 意味ID "${k}" が PHRASES にない`); }
  }
}
for (const [k, e] of Object.entries(TEACHER_PHRASES)) for (const bg of ['knight', 'merc', 'mage', 'wanderer'] as const) {
  if (!e[bg]) errors.push(`TEACHER_PHRASES.${k}: ${bg} がない`); else checkText(`TEACHER_PHRASES.${k}.${bg}`, e[bg]);
}

for (const [key, entry] of Object.entries(PHRASES)) {
  if (key.startsWith('n_')) { const v = entry.default; if (!v || (Array.isArray(v) ? !v.length : !v.trim())) errors.push(`PHRASES.${key}: default がない`); for (const x of [v ?? ''].flat()) checkText(`PHRASES.${key}`, x); continue; }
  for (const p of PERSONALITIES) {
    const v = entry[p];
    const list = v === undefined ? [] : Array.isArray(v) ? v : [v];
    if (v === '') { emptyCount++; continue; } // 分岐で使わない性格（tests/talks.test.ts で全組み合わせを確かめる）
    if (list.length === 0 || list.some((x) => !x.trim())) errors.push(`PHRASES.${key}: ${p} の文面がない`);
    for (const x of list) checkText(`PHRASES.${key}.${p}`, x);
  }
}

const unused = Object.keys(PHRASES).filter((k) => !referenced.has(k));
const byTopic = new Map<string, string[]>();
for (const t of TALKS) byTopic.set(t.topic, [...(byTopic.get(t.topic) ?? []), t.rank]);
const lineCount = (r: string) => TALKS.filter((t) => t.rank === r).map((t) => t.lines.filter((l) => l.by !== 'n').length);
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
console.log(`支援会話: ${TALKS.length} 本 / 話題: ${byTopic.size} 種 / 意味ID: ${Object.keys(PHRASES).length} 件（参照 ${referenced.size}）`);
console.log(`  平均セリフ数 C ${avg(lineCount('C'))}・B ${avg(lineCount('B'))}・A ${avg(lineCount('A'))}`);
for (const [topic, ranks] of byTopic) console.log(`  ${topic.padEnd(12)} ${ranks.join(' ')}`);
console.log(`分岐で使わないため空にしてある文面: ${emptyCount} 件`);
console.log(`面談: ${INTERVIEWS.length} 種 / 先生のセリフ: ${Object.keys(TEACHER_PHRASES).length} 件`);
if (byTopic.size < 20 || byTopic.size > 30) errors.push(`話題が${byTopic.size}種（20〜30種）`);
if (unused.length) console.log(`警告：どこからも参照されない意味ID: ${unused.join(', ')}`);
if (errors.length) {
  console.error(`\nエラー ${errors.length} 件:`);
  for (const e of errors.slice(0, 80)) console.error('  ' + e);
  process.exit(1);
}
console.log('OK');
