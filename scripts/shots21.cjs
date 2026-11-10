// 21夜目の画面の撮影（最後にまとめて1回）：node scripts/shots21.cjs（先に npm run build と vite preview --port 4173）
// 撮るもの：入れ替えの紫・道化王の札・2手先の狙い・宝箱と扉・燃える森と砦の木の門・宿敵との恋や友情の場面・引退を考える場面・期の呼び名・「？」の説明ボタン
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night21';
const URL = 'http://localhost:4173/rimina-academy/?debug';
fs.mkdirSync(OUT, { recursive: true });
const report = [];

async function page(b, w) {
  const p = await b.newPage({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2 });
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => !!window.__rimina, null, { timeout: 15000 });
  await p.waitForTimeout(700);
  return p;
}
async function check(p, name) {
  const r = await p.evaluate(() => {
    const over = document.documentElement.scrollWidth > window.innerWidth + 1;
    const small = [...document.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && x.height > 0 && (x.height < 43.5 || x.width < 43.5) && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.tb-board'); }).map((b) => (b.className + ':' + b.textContent).slice(0, 40));
    const tiny = [...document.querySelectorAll('body *')].filter((e) => { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; const f = parseFloat(getComputedStyle(e).fontSize); return f < 11.5 && e.getBoundingClientRect().width > 0; }).length;
    return { over, small: small.length, smallList: small.slice(0, 5), tiny };
  });
  report.push({ name, ...r, errors: p.errs.slice(0, 3) });
}
async function shot(p, name) { await p.screenshot({ path: `${OUT}/${name}.png` }); await check(p, name); }

/** 8年遊んだ学校を作る */
const SETUP = () => {
  const R = window.__rimina;
  const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 21, opening: false });
  R.auto.autoYears(g, 8);
  g.pending = [];
  g.tutorial = { tour: 99, seen: ['tactics'] };
  window.__g = g;
  return true;
};
/** 戦いを始める（field：戦場、cls：教え子に持たせる兵種（並び順）、after：盤をいじる） */
const BATTLE = ([field, cls]) => {
  const R = window.__rimina; const g = window.__g;
  const q = g.quests.find((x) => x.real && !x.nemesisId) || g.quests[0];
  q.objective = 'rout'; q.nemesisId = undefined;
  const deploy = R.sortie.recommendSquad(g, q).deploy.slice(0, 4);
  R.flow.startBattle(g, q.id, deploy);
  const b = g.battle;
  b.fx = [];
  // 戦場を差しかえる
  if (field) { const F = { woods: { forest: ['0-2', '1-2', '4-3', '5-3', '2-4', '3-5', '1-5', '4-1'], rock: ['3-2'] }, fort: { forest: [], rock: ['0-2', '1-2', '4-2', '5-2', '2-4', '3-4'] } }[field]; b.field = field; b.forest = [...F.forest]; b.rock = [...F.rock]; if (field === 'fort') b.gate = '2-2'; }
  const kids = b.units.filter((u) => u.side === 'me' && !u.teacher);
  cls.forEach((c, i) => { const u = kids[i]; if (!u || !c) return; R.tsetup.applyClass(u, c); u.classId = c; });
  // 動かせる場所に寄せる
  const free = (x, y) => !b.rock.includes(`${x}-${y}`) && b.gate !== `${x}-${y}` && !b.units.some((o) => o.alive && o.x === x && o.y === y);
  for (const u of b.units) if (u.side === 'me' && !free(u.x, u.y) && b.rock.includes(`${u.x}-${u.y}`)) { for (let y = 7; y >= 5; y--) for (let x = 0; x < 6; x++) if (free(x, y)) { u.x = x; u.y = y; y = -1; break; } }
  for (const u of b.units) if (u.side === 'foe' && b.rock.includes(`${u.x}-${u.y}`)) { for (let y = 0; y <= 3; y++) for (let x = 0; x < 6; x++) if (free(x, y)) { u.x = x; u.y = y; y = 99; break; } }
  R.tengine.intents(b);
  window.__kids = kids.map((u) => u.uid);
  return true;
};
async function show(p) { await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); }); await p.waitForTimeout(900); }
async function tapUnit(p, uid) {
  const xy = await p.evaluate((id) => { const b = window.__rimina.store.getGame().battle; const u = b.units.find((x) => x.uid === id); return u ? u.y * b.w + u.x : -1; }, uid);
  if (xy < 0) return;
  const cells = await p.$$('.tb-cell');
  await cells[xy].click();
  await p.waitForTimeout(500);
}

(async () => {
  const b = await chromium.launch();
  // ---- 1. 入れ替え（トリックスター）：紫に光る仲間 ----
  for (const w of [360, 390, 430]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await p.evaluate(BATTLE, [null, ['trickster']]);
    await p.evaluate(() => { const b = window.__g.battle; const t = b.units.find((u) => u.uid === window.__kids[0]); const a = b.units.find((u) => u.uid === window.__kids[1]); if (t && a) { t.x = 2; t.y = 6; a.x = 3; a.y = 5; } window.__rimina.tengine.intents(b); });
    await show(p);
    await tapUnit(p, await p.evaluate(() => window.__kids[0]));
    await shot(p, `01-swap-purple-${w}`);
    await p.close();
  }
  // ---- 2. 道化王：敵も紫に。敵をタップすると「入れ替え」「道化の手」の札 ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(BATTLE, [null, ['jesterking']]);
    await p.evaluate(() => { const b = window.__g.battle; const t = b.units.find((u) => u.uid === window.__kids[0]); if (t) { t.x = 2; t.y = 4; } const f = b.units.filter((u) => u.side === 'foe'); if (f[0]) { f[0].x = 2; f[0].y = 2; } if (f[1]) { f[1].x = 4; f[1].y = 2; } window.__rimina.tengine.intents(b); });
    await show(p);
    const jk = await p.evaluate(() => window.__kids[0]);
    await tapUnit(p, jk);
    await shot(p, '02-jester-purple-390');
    const foe = await p.evaluate(() => window.__rimina.store.getGame().battle.units.find((u) => u.side === 'foe' && u.alive && u.x === 2 && u.y === 2)?.uid);
    if (foe) { await tapUnit(p, foe); await shot(p, '03-jester-cards-390'); }
    await p.close();
  }
  // ---- 3. 2手先の狙い（千里眼）：薄い矢印と「次の次」の札 ----
  for (const w of [390]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await p.evaluate(BATTLE, [null, ['farsight']]);
    await show(p);
    await shot(p, `04-aim2-${w}`);
    await p.close();
  }
  // ---- 4. 宝箱と扉（盗賊）：光る宝箱・扉 ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(BATTLE, [null, ['rogue']]);
    await p.evaluate(() => { const b = window.__g.battle; const t = b.units.find((u) => u.uid === window.__kids[0]); if (t) { t.x = 1; t.y = 6; } b.chests = [{ x: 1, y: 4, kind: 'potion' }, { x: 4, y: 3, kind: 'weapon', weaponId: 'steel_sword' }]; b.doors = ['0-4']; for (const u of b.units) if (u.alive && ((u.x === 1 && u.y === 4) || (u.x === 4 && u.y === 3) || (u.x === 0 && u.y === 4))) u.y = Math.max(0, u.y - 2); window.__rimina.tengine.intents(b); });
    await show(p);
    await tapUnit(p, await p.evaluate(() => window.__kids[0]));
    await shot(p, '05-chest-door-390');
    await p.close();
  }
  // ---- 5. 燃える森（火矢兵）・砦の木の門 ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(BATTLE, ['woods', ['firearcher']]);
    await p.evaluate(() => { const R = window.__rimina; const b = window.__g.battle; const t = b.units.find((u) => u.uid === window.__kids[0]); if (t) { t.x = 2; t.y = 6; t.acted = false; } const ig = R.tengine.ignitables(b, t).find((o) => !o.gate); if (ig) R.tengine.ignite(b, t.uid, ig.x, ig.y); b.fx = []; b.undo = null; });
    await show(p);
    await tapUnit(p, await p.evaluate(() => window.__kids[1]));
    await shot(p, '06-forest-fire-390');
    await p.close();
  }
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(BATTLE, ['fort', ['firearcher']]);
    await p.evaluate(() => { const b = window.__g.battle; const t = b.units.find((u) => u.uid === window.__kids[0]); if (t) { t.x = 2; t.y = 5; } window.__rimina.tengine.intents(b); });
    await show(p);
    await tapUnit(p, await p.evaluate(() => window.__kids[0]));
    const fire = await p.$('.tb-acts .btn.accent');
    if (fire) { await fire.click(); await p.waitForTimeout(400); }
    await shot(p, '07-fort-gate-390');
    await p.close();
  }
  // ---- 6. 宿敵との恋・友情：芽生え・手紙・想いを打ち明け合う・因縁の帳 ----
  for (const w of [360, 390]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await p.evaluate(() => {
      const R = window.__rimina; const g = window.__g;
      const o = g.officers.find((x) => x.status === 'active' && x.kind !== 'monster' && !x.alumniId);
      o.heart = 'steady';
      const st = Object.values(g.students).find((x) => x.status === 'enrolled');
      const k = `${st.id}|${o.id}`; g.rivalries[k] = g.rivalries[k] || { sid: st.id, oid: o.id, battles: 3, stage: 2, vow: null, log: [], settled: null };
      g.heartYear = undefined;
      let seed = 1; for (; seed < 60; seed++) { const c = new R.rng.Rng({ rng: seed }); if (c.next() < 0.4) break; }
      R.hearts.sproutHeart(g, g.rivalries[k], 'meet', new R.rng.Rng({ rng: seed }));
      window.__hk = k; window.__oid = o.id;
      R.store.setGame(g);
    });
    await p.waitForTimeout(1000);
    await shot(p, `08-heart-sprout-${w}`);
    if (w === 390) {
      await p.evaluate(() => {
        const R = window.__rimina; const g = R.store.getGame(); g.pending = [];
        const rv = g.rivalries[window.__hk]; rv.heart.letters = 2;
        const r = new R.rng.Rng({ rng: 2 });
        for (let i = 0; i < 80 && !rv.heart.confessed; i++) { g.pending = []; R.hearts.heartsMonth(g, r); }
        R.store.emit();
      });
      await p.waitForTimeout(900);
      await shot(p, '09-heart-confess-390');
      await p.evaluate(() => { const R = window.__rimina; const g = R.store.getGame(); g.pending = []; R.store.emit(); R.store.navigate({ tab: 'school', page: 'ledger', id: window.__oid }); });
      await p.waitForTimeout(900);
      await shot(p, '10-heart-ledger-390');
      // 宿敵戦の口上と、とどめを迷う場面
      await p.evaluate(() => {
        const R = window.__rimina; const g = R.store.getGame();
        const rv = g.rivalries[window.__hk];
        const q = g.quests.find((x) => x.real) || g.quests[0];
        q.nemesisId = window.__oid; q.objective = 'boss';
        const deploy = R.sortie.recommendSquad(g, q).deploy.slice(0, 3).filter((d) => d.studentId !== rv.sid);
        R.flow.startBattle(g, q.id, [{ studentId: rv.sid }, ...deploy]);
        R.store.emit();
      });
      await p.waitForTimeout(450);
      await shot(p, '11-heart-intro-390');
    }
    await p.close();
  }
  // ---- 7. 引退を考える場面 ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(() => { const R = window.__rimina; const g = window.__g; g.instructor.age = 57; g.instructor.thought = undefined; R.instructor.retireThought(g); R.store.setGame(g); });
    await p.waitForTimeout(1000);
    await shot(p, '12-retire-think-390');
    await p.close();
  }
  // ---- 8. 期の呼び名（開校のときの上級生）・「？」の説明ボタン ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); R.store.navigate({ tab: 'yearbook', page: 'roster' }); });
    await p.waitForTimeout(1000);
    await p.evaluate(() => { const e = [...document.querySelectorAll('*')].find((x) => x.childElementCount === 0 && /開校のときの/.test(x.textContent || '')); if (e) e.scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(300);
    await shot(p, '13-cohort-name-390');
    await p.evaluate(() => { window.__rimina.store.navigate({ tab: 'school', page: 'instructor' }); });
    await p.waitForTimeout(900);
    await shot(p, '14-teacher-page-390');
    await p.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/check.json`, JSON.stringify(report, null, 1));
  console.log(report.map((r) => [r.name, r.over ? 'はみ出し' : '', r.small ? `小さいボタン${r.small} ${r.smallList.join('/')}` : '', r.tiny ? `小さい字${r.tiny}` : '', r.errors.length ? r.errors.join('|') : ''].filter(Boolean).join(' ')).join('\n'));
})();
