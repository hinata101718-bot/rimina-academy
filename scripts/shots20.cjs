// 20夜目の画面の撮影（最後にまとめて1回）：node scripts/shots20.cjs（先に npm run build と vite preview --port 4173）
// 撮るもの：兵種の図鑑・最上級になった卒業生（新聞・年鑑）・先生の兵種・宿敵が味方になる場面・好敵手・密偵の報告・地図の札
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night20';
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

/** 8年遊んだ学校（卒業生・先生の兵種・宿敵）を作る */
const SETUP = () => {
  const R = window.__rimina;
  const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 20, opening: false });
  R.auto.autoYears(g, 8);
  g.pending = [];
  window.__g = g;
  return true;
};

(async () => {
  const b = await chromium.launch();
  // ---- 1. 兵種の図鑑（年鑑の図鑑）：木・最上級の条件・特技 ----
  for (const w of [360, 390, 430]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); R.store.navigate({ tab: 'yearbook', page: 'book', sub: 'class' }); });
    await p.waitForTimeout(900);
    const first = await p.$('.cb-grid .cb-leaf');
    if (first) { await first.click(); await p.waitForTimeout(400); }
    const close = await p.$('.sheet .btn.ghost'); if (close) { await close.click(); await p.waitForTimeout(200); }
    await p.evaluate(() => { const t = document.querySelector('.ct-tree'); if (t) t.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300);
    await shot(p, `01-classbook-tree-${w}`);
    if (w === 390) {
      const tops = await p.$$('.ct-pair .ct-c:last-child .cb-leaf');
      if (tops[0]) { await tops[0].click(); await p.waitForTimeout(400); await shot(p, `02-classbook-top-${w}`); }
    }
    await p.close();
  }
  // ---- 2. 最上級になった卒業生（新聞・個人ページ・年鑑）・先生の兵種 ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(() => {
      const R = window.__rimina; const g = window.__g;
      const st = Object.values(g.students).find((x) => x.status === 'graduated' && x.career && x.career.alive && !x.career.instructor);
      if (st) { st.classId = 'swordmaster'; st.level = Math.max(st.level, 50); st.deeds = { unhurt: 10 }; window.__sid = st.id; }
      R.auto.autoYears(g, 1);
      g.pending = [];
      g.instructor.nemWins = Math.max(g.instructor.nemWins || 0, 4); g.instructor.since = Math.min(g.instructor.since || 1, g.year - 10);
      R.store.setGame(g);
      R.store.navigate({ tab: 'school', page: 'news' });
    });
    await p.waitForTimeout(1000);
    await shot(p, '03-news-top-390');
    await p.evaluate(() => { const g = window.__rimina.store.getGame(); const st = g.students[window.__sid]; if (st) { st.seenTitle = undefined; st.seenClass = st.classId; } window.__rimina.store.navigate({ tab: 'students', page: 'detail', id: window.__sid, sub: 'record' }); });
    await p.waitForTimeout(900);
    await shot(p, '04-alumni-top-390');
    await p.evaluate(() => { window.__rimina.store.navigate({ tab: 'yearbook', page: 'chronicle' }); });
    await p.waitForTimeout(900);
    await p.evaluate(() => { const e = [...document.querySelectorAll('*')].find((x) => x.childElementCount === 0 && /最上級の/.test(x.textContent || '')); if (e) e.scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(300);
    await shot(p, '05-yearbook-390');
    await p.evaluate(() => { window.__rimina.store.navigate({ tab: 'school', page: 'instructor' }); });
    await p.waitForTimeout(900);
    await shot(p, '06-teacher-rank-390');
    await p.close();
  }
  // ---- 3. 宿敵が味方になる場面・好敵手 ----
  for (const w of [360, 390]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await p.evaluate(() => {
      const R = window.__rimina; const g = window.__g;
      const o = R.nemesis.bondedOfficers(g).find((x) => x.status === 'active' && !x.alumniId) || g.officers.find((x) => x.status === 'active' && x.kind !== 'monster' && !x.alumniId);
      const st = Object.values(g.students).find((x) => x.status === 'enrolled');
      R.nemesis.memoryOf(o).debts.push({ id: st.id, text: '止めを刺さなかった', year: g.year });
      const k = `${st.id}|${o.id}`; g.rivalries[k] = g.rivalries[k] || { sid: st.id, oid: o.id, battles: 3, stage: 2, vow: null, log: [], settled: null };
      R.bonds.makeAlly(g, o, 'debt');
      R.store.setGame(g);
    });
    await p.waitForTimeout(1000);
    await shot(p, `07-ally-${w}`);
    if (w === 390) {
      await p.evaluate(() => {
        const R = window.__rimina; const g = R.store.getGame(); g.pending = [];
        const o = R.nemesis.bondedOfficers(g).find((x) => x.status === 'active' && !x.alumniId && x.heart !== 'mad') || g.officers.find((x) => x.status === 'active' && x.kind !== 'monster' && !x.alumniId && x.heart !== 'mad');
        const st = Object.values(g.students).filter((x) => x.status === 'enrolled')[1];
        if (o && st) { const k = `${st.id}|${o.id}`; g.rivalries[k] = g.rivalries[k] || { sid: st.id, oid: o.id, battles: 3, stage: 2, vow: null, log: [], settled: null }; g.rivalries[k].battles = 3; for (let i = 1; i < 80 && !g.rivalries[k].oath; i++) R.bonds.maybeOath(g, o, st.id, new R.rng.Rng({ rng: i })); }
        R.store.emit();
      });
      await p.waitForTimeout(900);
      await shot(p, '08-rival-390');
    }
    await p.close();
  }
  // ---- 4. 密偵を送る（因縁の帳）・密偵の報告 ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(() => { const R = window.__rimina; const g = window.__g; const o = R.bonds.spyTargets(g)[0]; window.__oid = o && o.id; R.store.setGame(g); R.store.navigate({ tab: 'school', page: 'ledger', id: o && o.id }); });
    await p.waitForTimeout(900);
    const go = await p.$('.spy-box .btn.block');
    if (go) { await go.click(); await p.waitForTimeout(300); }
    await p.evaluate(() => { const e = document.querySelector('.spy-box'); if (e) e.scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(300);
    await shot(p, '09-spy-choose-390');
    await p.evaluate(() => {
      const R = window.__rimina; const g = R.store.getGame();
      const o = g.officers.find((x) => x.id === window.__oid);
      const st = R.bonds.spyCandidates(g)[0];
      for (let i = 1; i < 60; i++) { const c = JSON.parse(JSON.stringify(g)); const r = R.bonds.sendSpy(c, st.id, o.id, new R.rng.Rng({ rng: i })); if (r.ok) { R.bonds.sendSpy(g, st.id, o.id, new R.rng.Rng({ rng: i })); break; } }
      R.store.emit();
    });
    await p.waitForTimeout(1000);
    await shot(p, '10-spy-report-390');
    await p.close();
  }
  // ---- 5. 地図の札（タップできる広さ44px） ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); R.store.navigate({ tab: 'war' }); });
    await p.waitForTimeout(1200);
    await shot(p, '11-map-390');
    await p.close();
  }
  // ---- 6. タイトル ----
  {
    const p = await page(b, 390);
    await p.waitForTimeout(600);
    await shot(p, '12-title-390');
    await p.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/check.json`, JSON.stringify(report, null, 1));
  console.log(report.map((r) => [r.name, r.over ? 'はみ出し' : '', r.small ? `小さいボタン${r.small} ${r.smallList.join('/')}` : '', r.tiny ? `小さい字${r.tiny}` : '', r.errors.length ? r.errors.join('|') : ''].filter(Boolean).join(' ')).join('\n'));
})();
