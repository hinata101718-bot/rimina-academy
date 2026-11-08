// 画面撮影用のセーブを作る：npx tsx scripts/mkshots.ts <出力先>
// entrance（入学試験）・retire（教官の引退）・ending（学校の中立宣言）・talk（支援A会話と面談）・hall.json（殿堂）
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { enrolled } from '../src/core/game';
import { rng, prepareEntrance } from '../src/core/flow';
import { checkEndings, buildHallEntry } from '../src/core/ending';
import { getSupport, buildTalk } from '../src/core/support';
import { buildInterviewDef } from '../src/core/interview';
import { INTERVIEWS } from '../src/data/talks/interviews';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots';
const base = () => deserialize(readFileSync(new URL('../tests/fixtures/v3-save.json', import.meta.url), 'utf8'));
const grads = (s: GameState, n: number) => {
  const g = Object.values(s.students).filter((x) => x.status === 'graduated');
  for (let i = g.length; i < n; i++) { const o = g[i % g.length]; s.students[`sg${i}`] = { ...o, id: `sg${i}`, given: o.given, career: o.career ? { ...o.career } : null }; }
};
// 入学試験（新年度の最初の週に出る志願者を、もう一度用意する）
{ const s = base(); prepareEntrance(s); s.pending = s.pending.filter((p) => p.type === 'entrance'); writeFileSync(`${out}/entrance.json`, serialize(s)); }
// 引退
{ const s = base(); s.instructor.age = 60; s.pending = [{ type: 'retire', forced: false }]; writeFileSync(`${out}/retire.json`, serialize(s)); }
// 学校の中立宣言
{ const s = base(); s.endings = []; s.reputation = 95; s.world.friendship = { kingdom: 80, empire: 72, alliance: 88 }; s.world.vassal = null; s.world.defenseWonYear = s.year; s.world.peaceRoundYear = null; grads(s, 100);
  s.pending = []; checkEndings(s, rng(s), 'month'); writeFileSync(`${out}/ending.json`, serialize(s)); }
// 支援A会話と面談（処理待ちの会話として）
{ const s = base(); const [a, b] = enrolled(s); const sp = getSupport(s, a.id, b.id); sp.kind = 'friend'; sp.value = 0; sp.seen = []; sp.lastRank = 'B';
  const t = buildTalk(s, rng(s), sp, 'A'); const iv = buildInterviewDef(s, rng(s), a, INTERVIEWS.find((d) => d.id === 'recent_study')!, []);
  s.pending = [{ type: 'weekSummary', lines: ['面談：先生と話した', '支援会話：A'], talks: [t!, iv!] }]; writeFileSync(`${out}/talk.json`, serialize(s)); }
// 殿堂（4夜目の形式1校＋3夜目の形式1校）
{ const s = base(); s.endings = [{ kind: 'neutral', year: 6 }]; grads(s, 30);
  const h = buildHallEntry(s); const old = JSON.parse(readFileSync(new URL('../tests/fixtures/v3-hall.json', import.meta.url), 'utf8'));
  writeFileSync(`${out}/hall.json`, JSON.stringify([...old, h])); }
console.log('ok');
