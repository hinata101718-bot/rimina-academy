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
