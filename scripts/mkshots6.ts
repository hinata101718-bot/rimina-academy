// 6夜目の画面撮影用のセーブ：npx tsx scripts/mkshots6.ts <出力先>
// board.json（依頼掲示板：傷を負った因縁の敵将・宿敵・仇討ちの誓いあり）／settle.json（宿敵の決着の手前）／roster.json（何年か遊んだ名簿）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { rollQuests } from '../src/core/quests';
import { autoDeploy, autoYears, setAutoChoicePick, humanLikePick } from '../src/core/autoplay';
import { startAutoQuest, battleCtx } from '../src/core/flow';
import { defaultPlan, officerForQuest, chooseAuto, advanceAuto } from '../src/core/battle/auto';
import { ensureRivalry } from '../src/core/officers';
import { enrolled } from '../src/core/game';
import type { GameState, Quest } from '../src/core/state';
import { revealTalent } from '../src/core/week';
import { upgradeFacility } from '../src/core/teachers';
import { addRep } from '../src/core/game';
import { SIDES } from '../src/data/discovery';
const out = process.argv[2] ?? 'shots6';
mkdirSync(out, { recursive: true });
setAutoChoicePick(humanLikePick(11));
const base = () => deserialize(readFileSync(new URL('../tests/fixtures/v5-save.json', import.meta.url), 'utf8'));
const board = (s: GameState, seed: number) => { s.rng = seed; s.pending = [{ type: 'questBoard' }]; s.battle = null; s.quests = rollQuests(s); };
/** 敵将に歴史をつける（傷・分かった特徴・執着・宿敵・誓い） */
function history(s: GameState, q: Quest) {
  const o = officerForQuest(s, q)!;
  const st = enrolled(s).sort((a, b) => b.level - a.level);
  o.scars = 3; o.knownTraits = [o.traits[0]];
  o.meets.push({ year: s.year - 1, month: 4, title: '国境の小競り合い', result: 'fled', foes: [st[0].id] }, { year: s.year - 1, month: 9, title: '砦の攻略', result: 'fled', foes: [st[0].id, st[1].id] });
  o.victims.push({ id: st[3].id, name: st[3].given, year: s.year - 1, dead: false });
  o.epithet = `${st[3].given}斬りの`;
  o.grudge = st[1].id;
  const rv = ensureRivalry(s, st[0].id, o.id); rv.battles = 3; rv.stage = 2; rv.log.push({ year: s.year - 1, month: 9, text: '宿敵になった' });
  const rv2 = ensureRivalry(s, st[2].id, o.id); rv2.vow = st[3].id; rv2.stage = 1; rv2.battles = 1;
  return { o, st };
}
let qid = '';
{ const s = base(); for (let seed = 1; seed < 50; seed++) { board(s, seed); const q = s.quests.find((x) => x.real && !!x.enemyCountry); if (q && officerForQuest(s, q)) { history(s, q); qid = q.id; break; } }
  writeFileSync(`${out}/board.json`, serialize(s)); }
// 宿敵の決着の手前
{ let done = false;
  for (let seed = 1; seed < 80 && !done; seed++) {
    const s = base(); board(s, seed);
    const q = s.quests.find((x) => x.real && !!x.enemyCountry); if (!q || !officerForQuest(s, q)) continue;
    history(s, q); s.pending = [];
    const d = autoDeploy(s);
    startAutoQuest(s, q.id, d, defaultPlan(s, q, d));
    for (let i = 0; i < 6 && s.battle?.auto && s.battle.auto.seg < 3; i++) {
      const c = s.battle.auto.choice;
      if (c?.kind === 'settle') { s.battle.auto.shown = s.battle.auto.scenes.length - 1; writeFileSync(`${out}/settle.json`, serialize(s)); done = true; break; }
      if (c) chooseAuto(s, c.recommended, battleCtx(s)); else advanceAuto(s, battleCtx(s));
    }
  }
  console.log('settle', done); }
// 何年か遊んだ名簿（個人ページの宿敵欄も：因縁のある生徒をつくる）
{ const s = base(); autoYears(s, 3); s.pending = [];
  const q = (() => { for (let seed = 1; seed < 50; seed++) { board(s, seed); const x = s.quests.find((y) => y.real && !!y.enemyCountry); if (x && officerForQuest(s, x)) return x; } return null; })();
  if (q) history(s, q);
  s.pending = []; writeFileSync(`${out}/roster.json`, serialize(s)); }
// 才能の判明・ヒント・意外な一面・ランクアップの演出
{ const s = base(); s.pending = []; s.battle = null;
  const st = enrolled(s).find((x) => x.talent)!;
  st.talentReveal = 0;
  revealTalent(s, st, 35); revealTalent(s, st, 30); revealTalent(s, st, 100);
  const other = enrolled(s).find((x) => x.id !== st.id)!;
  const side = SIDES.find((d) => d.id === 'song')!;
  (other.sides ??= []).push('song');
  s.pending.push({ type: 'discovery', studentId: other.id, stage: 4, title: '意外な一面', text: side.lines.map((l) => l.split('{a}').join(other.given)).join('\n'), name: side.label });
  s.facilities.training = 1; s.money = 99999; upgradeFacility(s, 'training');
  s.reputation = 58; addRep(s, 4);
  writeFileSync(`${out}/discovery.json`, serialize(s)); }
console.log('ok', qid);
