// 14夜目の画面撮影用のセーブ：npx tsx scripts/mkshots14.ts <出力先>
// tour（案内つきで始めた日）／lesson（1日目の授業の結果と案内）／talk（最初の面談）／board（最初の出撃）／
// main（5年目：ホーム・勢力図の変化・技・武器庫）／review（1年の振り返り）／legend（伝説の武器が手に入った）／battle（戦いの画面）
import { writeFileSync, mkdirSync } from 'node:fs';
import { serialize } from '../src/core/save';
import { newGame, enrolled } from '../src/core/game';
import { autoYears, autoPending, setAutoChoicePick, humanLikePick, recommendSquads } from '../src/core/autoplay';
import { chooseLesson, startSortie } from '../src/core/flow';
import { todayCards, recommendCard } from '../src/core/lessons';
import { markMapSeen, mapChanges, ownerOf } from '../src/core/regions';
import { REGIONS } from '../src/data/regions';
import { legendLoot } from '../src/core/rarity';
import { takeLoot } from '../src/core/loot';
import type { GameState } from '../src/core/state';
const out = process.argv[2] ?? 'shots14';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const clone = (g: GameState): GameState => JSON.parse(serialize(g)).state;
const save = (name: string, g: GameState) => writeFileSync(`${out}/${name}.json`, serialize(g));
// ---- 案内つきで始めた日 ----
const t = newGame({ name: 'ヒナタ', background: 'knight', seed: 14, tutorial: true });
t.lastExport = Date.now();
save('tour', t);
const l = clone(t); l.tutorial!.tour = 99;
save('today', l);
chooseLesson(l, 0);
save('lesson', l);
const k = clone(l); k.pending = []; todayCards(k); chooseLesson(k, recommendCard(k));
k.pending = k.pending.filter((p) => p.type === 'talk' || p.type === 'guide');
save('talk', k);
const bd = clone(k); bd.pending = [];
for (let g = 0; g < 40 && !bd.pending.some((p) => p.type === 'questBoard'); g++) { bd.pending = []; todayCards(bd); chooseLesson(bd, recommendCard(bd)); }
bd.pending = bd.pending.filter((p) => p.type === 'questBoard' || (p.type === 'guide' && p.key === 'quest'));
save('board', bd);
// ---- 5年目 ----
const s = newGame({ name: 'ヒナタ', background: 'knight', seed: 77 });
autoYears(s, 3);
autoPending(s);
markMapSeen(s);
autoYears(s, 2);
autoPending(s);
s.pending = []; s.guideStep = 99; s.settings.guide = false; s.lastExport = Date.now();
if (mapChanges(s).length < 1 && s.mapSeen) { const r = REGIONS.find((x) => x.home === 'empire' && ownerOf(s, x.id) === 'empire' && x.kind !== 'capital'); if (r) s.mapSeen.o[r.id] = 'kingdom'; }
// 撮影のため、武器庫にレア・ユニーク・伝説を並べる
s.armory.push({ uid: 'wshot1', weaponId: 'silver_lance', affix: ['keen'], got: { kind: 'drop', year: s.year, text: '帝国兵が落とした' } });
s.armory.push({ uid: 'wshot2', weaponId: 'killing_edge', got: { kind: 'drop', year: s.year, text: '盗賊が落とした' } });
s.legends!.asteria = { holder: 'none', log: [] };
save('main', s);
const lg = clone(s);
takeLoot(lg, [legendLoot('asteria', '古戦場を掘り返した農夫が見つけ、学校に届けた')]);
lg.pending = lg.pending.filter((p) => p.type === 'legend');
save('legend', lg);
const rv = clone(s); rv.pending = [{ type: 'yearReview', year: rv.year - 1 }];
save('review', rv);
const ba = clone(s);
for (let g = 0; g < 40 && !ba.pending.some((p) => p.type === 'questBoard'); g++) { ba.pending = []; todayCards(ba); chooseLesson(ba, recommendCard(ba)); }
ba.pending = ba.pending.filter((p) => p.type === 'questBoard');
startSortie(ba, recommendSquads(ba));
save('battle', ba);
console.log('ok', enrolled(s).length, 'map', mapChanges(s).length, 'reviews', s.reviews?.length);
