// 文の点検（11夜目）：武器・兵種・性別・学年・状態と合わない文、くり返しの多い決まり文句、「……」の使いすぎを数える
// 使い方：npx tsx scripts/check-text.ts [月の数=24]
import { readFileSync, readdirSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { startSortie, finishBattle, battleCtx, chooseLesson } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { skipAuto } from '../src/core/battle/auto';
import { setArchiveHook } from '../src/core/support';
import { WEAPONS } from '../src/data/weapons';
import { usableSpells } from '../src/core/spells';
import type { GameState, TalkLog } from '../src/core/state';
import { proseMismatches, deathWordLeaks } from '../src/core/prosecheck';

const MONTHS = Number(process.argv[2] ?? 24);
const issues: Record<string, string[]> = {};
const add = (k: string, t: string) => { (issues[k] ??= []).push(t); };

// ---------- 1. 文のデータの点検（静的） ----------
const files = ['src/data/autobattle_text.ts', 'src/data/stratagems.ts', 'src/data/evaluation.ts', 'src/data/officers_text.ts', 'src/data/battlefx.ts', ...readdirSync('src/data/talks').map((f) => `src/data/talks/${f}`)];
const WEAPON_WORD = /\{(a|b|c|my\w*|your\w*)\}(?:が|の|は)(剣|槍|斧|弓|杖|銃|魔道書)/;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (WEAPON_WORD.test(l) && !/heal|healer|sword_master/.test(l)) add('武器が決めうちの文（差し込みの子の武器と合わないことがある）', `${f}:${i + 1} ${l.trim().slice(0, 80)}`);
    const quoted = l.match(/'[^']*'/g) ?? [];
    for (const q of quoted) {
      if ((q.match(/……/g) ?? []).length >= 3) add('「……」が3つ以上の文', `${f}:${i + 1} ${q.slice(0, 60)}`);
      if (/彼女|彼は|彼が/.test(q) && /\{(a|b|you|my)/.test(q)) add('性別を決めうちの代名詞（差し込みと合わないことがある）', `${f}:${i + 1} ${q.slice(0, 60)}`);
    }
  });
}

// ---------- 1b. 15夜目：最期の文・重傷の文・必殺の文・戦技の名前が、とどめの攻撃（武器・魔法の属性）と合っているか ----------
{
  const r = proseMismatches();
  console.log(`戦いの文と、とどめの攻撃の点検：${r.checked}通りを調べて、合わないもの ${r.issues.length}件`);
  for (const x of r.issues) add('とどめの攻撃と合わない文（武器・属性）', `${x.where}：${x.text}（${x.found}の言葉）`);
}

// ---------- 1c. 16夜目：結果の4段（ふつう・深手・重傷に、死ぬ段の言葉がないか。重傷に助かった理由があるか） ----------
{
  const r = deathWordLeaks();
  console.log(`結果の4段の点検：${r.checked}通りを調べて、合わないもの ${r.issues.length}件`);
  for (const x of r.issues) add('死ぬ段の言葉が、生き残る文に入っている', `${x.where}：${x.text}（${x.why}）`);
}

// ---------- 2. 遊んで出た文の点検（実行） ----------
setAutoChoicePick(humanLikePick(7));
const s = newGame({ name: '点検', background: 'knight', seed: 4242 });
autoYears(s, 2);
const talkCloser: Record<string, number> = {};
setArchiveHook((t: TalkLog) => {
  const last = t.lines.filter((l) => l.by === 'teacher').pop();
  if (last) talkCloser[last.text] = (talkCloser[last.text] ?? 0) + 1;
  for (const l of t.lines) if ((l.text.match(/……/g) ?? []).length >= 3) add('会話で「……」が3つ以上', l.text.slice(0, 60));
});
const toBoard = (g: GameState) => { let guard = 0; while (guard++ < 80) { g.pending = g.pending.filter((p) => p.type === 'questBoard'); if (g.pending.length) { if (g.quests.length) break; autoPending(g); continue; } autoPending(g); todayCards(g); chooseLesson(g, recommendCard(g)); } };
const TYPE_WORD: Record<string, string[]> = { sword: ['剣'], lance: ['槍'], axe: ['斧'], bow: ['弓'], magic: ['魔道書', '魔法'], holy: ['杖', '光'], staff: ['杖'], gun: ['銃'] };
let battleLines = 0;
for (let m = 0; m < MONTHS; m++) {
  toBoard(s);
  if (!s.pending.some((p) => p.type === 'questBoard')) { autoPending(s); continue; }
  startSortie(s, recommendSquads(s));
  let g = 0;
  while (s.battle && g++ < 5) {
    const b = s.battle;
    skipAuto(s, battleCtx(s));
    for (const sc of b.auto?.scenes ?? []) for (const l of sc.lines) {
      battleLines++;
      const st = s.students[l.by];
      // 話した子・名前の出た子の武器と、文の武器が合うか
      const who = st ?? Object.values(s.students).find((x) => x.status === 'enrolled' && l.text.startsWith(x.given));
      if (!who) continue;
      const u = b.units.find((x) => x.studentId === who.id);
      const wt = u?.weaponId ? WEAPONS[u.weaponId]?.type : undefined;
      // 魔法（杖・魔道書）は覚えた魔法も武器のうち
      const have = new Set([wt, ...usableSpells(who).map((id) => WEAPONS[id]?.type)].filter(Boolean));
      for (const [t, words] of Object.entries(TYPE_WORD)) if (!have.has(t as never) && !(t === 'holy' && have.has('staff')) && !(t === 'staff' && have.has('holy')) && words.some((w) => l.text.includes(`${who.given}が${w}`) || l.text.includes(`${who.given}の${w}`))) add('戦いの文：武器が合わない', `${who.given}（${wt ?? '武器なし'}）「${l.text.slice(0, 50)}」`);
      if (l.text.includes('初陣') && who.battles > 0 && sc.title === '開戦') add('戦いの文：初陣でないのに初陣', `${who.given}（出撃${who.battles}回）「${l.text.slice(0, 40)}」`);
      if (who.gender === 'm' && /わたくし|あたし/.test(l.text) && st) add('性別と合わない一人称', `${who.given}「${l.text.slice(0, 40)}」`);
    }
    if (s.battle) finishBattle(s);
  }
  autoPending(s);
}
const closers = Object.entries(talkCloser).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]);
for (const [t, n] of closers.slice(0, 10)) add('先生の締めの言葉のくり返し（5回以上）', `${n}回「${t.slice(0, 40)}」`);

console.log(`点検：文のデータ ${files.length}ファイル、遊んで出た戦いの文 ${battleLines}行（${MONTHS}か月）`);
let total = 0;
for (const [k, v] of Object.entries(issues)) { total += v.length; console.log(`\n## ${k}：${v.length}件`); for (const x of v.slice(0, 8)) console.log(`- ${x}`); }
console.log(`\n合計 ${total}件`);
