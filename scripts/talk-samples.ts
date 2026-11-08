// 会話の読み合わせ用の書き出し（7夜目）：全話題×性格のまとまり（15の組み合わせ）×主な分岐で会話を組み立て、docs/talk-samples/ に書く
// 使い方：npx tsx scripts/talk-samples.ts [出力先=docs/talk-samples]
import { mkdirSync, writeFileSync } from 'node:fs';
import { newGame, enrolled } from '../src/core/game';
import { TALKS } from '../src/data/talks';
import { INTERVIEWS } from '../src/data/talks/interviews';
import { WHOLE_TALKS, WHOLE_INTERVIEWS } from '../src/data/talks/whole_index';
import { TONES, TONE_NAMES, TONE_OF, type Tone } from '../src/data/talks/whole';
import { renderLines, renderWhole, getSupport, condOk, TOPIC_TITLE } from '../src/core/support';
import { buildInterviewDef, buildWholeInterview } from '../src/core/interview';
import { PERSONALITIES, PERSONALITY_IDS } from '../src/data/people';
import { Rng } from '../src/core/rng';
import type { Student, GameState } from '../src/core/state';
import type { PersonalityId, TalkDef } from '../src/core/types';

const out = process.argv[2] ?? 'docs/talk-samples';
mkdirSync(out, { recursive: true });
const s: GameState = newGame({ name: 'ヒナタ', background: 'knight', seed: 7 });
const [A, Bs] = enrolled(s);
const PAIRS: [Tone, Tone][] = [];
for (let i = 0; i < TONES.length; i++) for (let j = i; j < TONES.length; j++) PAIRS.push([TONES[i], TONES[j]]);
const pers = (t: Tone, k: number): PersonalityId => PERSONALITY_IDS.filter((p) => TONE_OF[p] === t)[k % 2];
/** 主な分岐：夢あり・なし／家柄／同じ国・違う国／関係 */
const VARIANTS: { name: string; set: (a: Student, b: Student) => void }[] = [
  { name: '夢あり同士・平民・違う国', set: (a, b) => { a.dream = 'kingdom_knight'; b.dream = 'scholar'; a.house = 'commoner'; b.house = 'commoner'; a.origin = 'kingdom'; b.origin = 'alliance'; } },
  { name: '夢なしの相手・孤児と貴族・同じ国', set: (a, b) => { a.dream = 'feed_family'; b.dream = 'none'; a.house = 'orphan'; b.house = 'noble'; a.origin = 'empire'; b.origin = 'empire'; } },
  { name: '夢なし・貴族と平民', set: (a, b) => { a.dream = 'none'; b.dream = 'healer'; a.house = 'noble'; b.house = 'commoner'; a.origin = 'frontier'; b.origin = 'kingdom'; } },
];
function prep(a: Student, b: Student, kind: 'friend' | 'rival' | 'love' | 'none') {
  a.knownTraits = a.traits.slice(0, 1); b.knownTraits = b.traits.slice(0, 1);
  a.recent = []; b.recent = [];
  for (const t of ['ev_cover', 'ev_samekill', 'ev_exam', 'ev_loss', 'ev_homewar', 'ev_festival', 'ev_spar', 'ev_injury']) { a.recent.push({ type: t, week: s.absWeek, detail: '国境の小競り合い', with: b.id }); }
  const sp = getSupport(s, a.id, b.id); sp.kind = kind; sp.value = 130;
}
const md = (title: string, lines: { by: string; text: string }[]) => [`#### ${title}`, '', ...lines.map((l) => `- ${l.by === 'narr' ? '（地の文）' : l.by === 'teacher' ? '先生' : l.by === A.id ? A.given : Bs.given}：${l.text}`), ''].join('\n');
let total = 0;
const byTopic: Record<string, string[]> = {};
const r = new Rng({ rng: 11 });
// 部品を組み合わせた会話（6夜目までの仕組み）
for (const t of TALKS as TalkDef[]) {
  const kind = t.topic.startsWith('rel_') ? t.topic.slice(4) as 'friend' | 'rival' | 'love' : 'friend';
  PAIRS.forEach(([ga, gb], i) => {
    for (const v of VARIANTS) {
      A.personality = pers(ga, i); Bs.personality = pers(gb, i + 1); A.gender = i % 2 ? 'f' : 'm'; Bs.gender = i % 3 ? 'm' : 'f';
      v.set(A, Bs); prep(A, Bs, kind);
      if (!condOk(t.when, A, Bs, getSupport(s, A.id, Bs.id), s)) continue;
      const lines = renderLines(s, r, t.lines, A, Bs, getSupport(s, A.id, Bs.id), '国境の小競り合い');
      (byTopic[t.topic] ??= []).push(md(`[部品] ${t.id}（${t.rank}）${TONE_NAMES[ga]}×${TONE_NAMES[gb]}：${A.given}（${PERSONALITIES[A.personality].name}）と${Bs.given}（${PERSONALITIES[Bs.personality].name}）／${v.name}`, lines));
      total++;
      break;
    }
  });
}
// まるごと書いた会話（7夜目）
for (const t of WHOLE_TALKS) {
  for (let k = 0; k < 2; k++) {
    A.personality = pers(t.ga, k); Bs.personality = pers(t.gb, k + 1); A.gender = k ? 'f' : 'm'; Bs.gender = k ? 'm' : 'f';
    let ok = false;
    for (const v of VARIANTS) { v.set(A, Bs); prep(A, Bs, t.topic.startsWith('rel_') ? t.topic.slice(4) as 'friend' : 'friend'); if (condOk(t.when, A, Bs, getSupport(s, A.id, Bs.id), s)) { ok = true; break; } }
    if (!ok && t.when) { const w = t.when; if (w.a?.hasDream !== undefined) A.dream = w.a.hasDream ? 'scholar' : 'none'; if (w.b?.hasDream !== undefined) Bs.dream = w.b.hasDream ? 'sky' : 'none'; if (w.a?.house) A.house = w.a.house; if (w.b?.house) Bs.house = w.b.house; if (w.sameCountry !== undefined) Bs.origin = w.sameCountry ? A.origin : (A.origin === 'kingdom' ? 'empire' : 'kingdom'); }
    const lines = renderWhole(s, t.lines, A, Bs, '国境の小競り合い');
    (byTopic[t.topic] ??= []).push(md(`[まるごと] ${t.id}（${t.rank}）：${A.given}（${PERSONALITIES[A.personality].name}）と${Bs.given}（${PERSONALITIES[Bs.personality].name}）`, lines));
    total++;
  }
}
for (const [topic, list] of Object.entries(byTopic)) writeFileSync(`${out}/support-${topic}.md`, [`# 支援会話の読み合わせ：${TOPIC_TITLE[topic] ?? topic}`, '', `${list.length}本。[部品]＝6夜目までの組み立て方、[まるごと]＝7夜目に通しで書いたもの。`, '', ...list].join('\n'));
// 面談
const iv: string[] = [];
for (const d of INTERVIEWS) TONES.forEach((g, i) => { A.personality = pers(g, i); A.dream = 'scholar'; const t = buildInterviewDef(s, r, A, d, ['reason_motivation', 's_study']); iv.push(md(`[部品] ${d.id}「${d.title}」：${A.given}（${PERSONALITIES[A.personality].name}）`, t.lines)); total++; });
for (const d of WHOLE_INTERVIEWS) for (let k = 0; k < 2; k++) { A.personality = pers(d.g, k); A.dream = 'scholar'; const t = buildWholeInterview(s, A, d); iv.push(md(`[まるごと] ${d.id}「${d.title}」：${A.given}（${PERSONALITIES[A.personality].name}）`, t.lines)); total++; }
writeFileSync(`${out}/interviews.md`, ['# 面談の読み合わせ', '', `${iv.length}本。先生は元王国騎士の口調。`, '', ...iv].join('\n'));
writeFileSync(`${out}/README.md`, ['# 会話の読み合わせ（7夜目）', '', `\`npx tsx scripts/talk-samples.ts\` で書き出した、支援会話と面談の見本 ${total}本。`, '', '- 話題ごとのファイル（support-*.md）に、性格のまとまり（明るい・落ち着いた・強気・控えめ・ひねくれ）の15の組み合わせで組み立てた会話が並んでいます。', '- [部品]＝6夜目までの「意味ID×性格の言い回し」を組み合わせる仕組み、[まるごと]＝7夜目に組み合わせごとに通しで書いた会話です。', '- 読んで噛み合わないものを書き直した記録は、報告書（docs/reports/night7.md）にあります。', ''].join('\n'));
console.log('書き出した会話', total);
