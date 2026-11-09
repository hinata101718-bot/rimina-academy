// 18夜目の点検：スキルの効果の重なり・技の名前の重なり・覚える表の重なり
// npx tsx scripts/check-arts.ts
import { ART_LIST, skillKey } from '../src/data/arts';
import { ABILITIES } from '../src/data/abilities';
const skills = ART_LIST.filter((a) => a.kind === 'mind');
const byKey = new Map<string, string[]>();
for (const a of skills) byKey.set(skillKey(a), [...(byKey.get(skillKey(a)) ?? []), `${a.name}（${a.skill}${a.rank}）`]);
const over = [...byKey].filter(([, v]) => v.length > 2);
console.log(`スキル ${skills.length}個、効果 ${byKey.size}種、3つ以上重なる効果 ${over.length}件`);
for (const [k, v] of over) console.log('  ', k, v.join(' / '));
const cards = ART_LIST.filter((a) => a.kind === 'mind' && a.card);
console.log(`札になるスキル ${cards.length}件`);
const names = new Map<string, string[]>();
const add = (n: string, w: string) => names.set(n, [...(names.get(n) ?? []), w]);
for (const a of ART_LIST) add(a.name, a.id);
for (const ab of Object.values(ABILITIES)) if (!ART_LIST.some((a) => a.id === ab.id)) add(ab.name, `ability:${ab.id}`);
const dupN = [...names].filter(([, v]) => v.length > 1);
console.log(`技・スキルの名前 ${names.size}個、重なり ${dupN.length}件`);
for (const [n, v] of dupN) console.log('  ', n, v.join(' / '));

// ---- 覚える表：全員で、同じ効果のスキルが2つ以上入っていないか ----
import { readFileSync } from 'node:fs';
import { newGame } from '../src/core/game';
import { autoYears, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { deserialize } from '../src/core/save';
import { ensureArtPlan, artsOf, loadoutOf } from '../src/core/arts';
import { ARTS, ART_SLOTS } from '../src/data/arts';
import type { GameState } from '../src/core/state';
function planCheck(s: GameState, label: string): void {
  let plans = 0, dupPlan = 0, dupLearn = 0, over = 0;
  for (const st of [...Object.values(s.students), ...(s.applicants ?? [])]) {
    plans++;
    const p = ensureArtPlan(st);
    const ks = Object.values(p).map((id) => ARTS[id]).filter((a) => a?.kind === 'mind').map(skillKey);
    if (new Set(ks).size !== ks.length) dupPlan++;
    const ls = artsOf(st).map((id) => ARTS[id]).filter((a) => a?.kind === 'mind').map(skillKey);
    if (new Set(ls).size !== ls.length) dupLearn++;
    if (loadoutOf(st).filter((id) => ARTS[id]?.kind === 'mind').length > ART_SLOTS.mind) over++;
  }
  console.log(`${label}：覚える表 ${plans}人、同じ効果が2つ以上の表 ${dupPlan}件、覚えたスキルの重なり ${dupLearn}件、つけたスキルが${ART_SLOTS.mind}を超える子 ${over}人`);
}
setAutoChoicePick(humanLikePick(9));
const g = newGame({ name: 'ヒナタ', background: 'knight', seed: 18001, start: 'normal' });
autoYears(g, 3);
planCheck(g, '新しいゲーム（3年）');
for (const f of ['v16-day', 'v17-day', 'v17-cards', 'v17-result']) planCheck(deserialize(readFileSync(`tests/fixtures/${f}.json`, 'utf8')), `${f}（読みこみ後）`);

// ---- 技の進化：すべての進化した名前が、ほかの技・スキル・進化した名前と重ならないか ----
import { evoOptions, evoName } from '../src/core/evolve';
import { WEAPONS } from '../src/data/weapons';
const evoNames = new Map<string, string[]>();
let evoCount = 0;
const bases = [...ART_LIST.filter((a) => a.card).map((a) => ({ id: a.id, name: a.name })), ...Object.values(WEAPONS).filter((w) => w.spell).map((w) => ({ id: w.id, name: w.name }))];
for (const x of bases) for (const b1 of evoOptions(x.id, []) ?? []) {
  const n1 = evoName(x.id, x.name, [b1]); evoNames.set(n1, [...(evoNames.get(n1) ?? []), x.id]); evoCount++;
  for (const b2 of evoOptions(x.id, [b1]) ?? []) { const n2 = evoName(x.id, x.name, [b1, b2]); evoNames.set(n2, [...(evoNames.get(n2) ?? []), x.id]); evoCount++; }
}
const evoDup = [...evoNames].filter(([n, v]) => v.length > 1 || names.has(n));
console.log(`進化できる技 ${bases.length}個、進化した形 ${evoCount}通り、名前の重なり ${evoDup.length}件`);
for (const [n, v] of evoDup.slice(0, 10)) console.log('  ', n, v.join(' / '));
// ---- 連携技：長く遊んだゲームで、名前が重ならないか ----
const lg = newGame({ name: 'ヒナタ', background: 'knight', seed: 18002, start: 'normal' });
autoYears(lg, 12);
const cn = Object.values(lg.combos ?? {}).map((c) => c.name);
const kinds: Record<string, number> = {};
for (const c of Object.values(lg.combos ?? {})) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
console.log(`連携技（12年遊んだゲーム）${cn.length}組、名前の重なり ${cn.length - new Set(cn).size}件、技の名前との重なり ${cn.filter((n) => names.has(n)).length}件、関係の種類 ${JSON.stringify(kinds)}`);
console.log('  例：', cn.slice(0, 12).join('・'));
