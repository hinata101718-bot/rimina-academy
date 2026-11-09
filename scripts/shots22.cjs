// 22夜目の画面の撮影（最後にまとめて1回）：node scripts/shots22.cjs（先に npm run build と vite preview --port 4173）
// 撮るもの：個人ページ（7つの能力と人望）・兵種試験の候補（枝分かれの先でないものも並ぶ例）・兵種の図鑑
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night22';
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


/** 3年遊んだ学校を作り、在学生のひとりを「剣士・剣C・斧C・魔道D」にする（ほかの枝の兵種も受けられる例） */
const SETUP = () => {
  const R = window.__rimina;
  const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 22, opening: false });
  R.auto.autoYears(g, 3);
  g.pending = [];
  const st = Object.values(g.students).find((x) => x.status === 'enrolled' && x.grade === 2) || Object.values(g.students).find((x) => x.status === 'enrolled');
  st.classId = 'swordsman'; st.level = Math.max(st.level, 12); st.battles = Math.max(st.battles, 10); st.injuredWeeks = 0; st.sickWeeks = 0; st.sickDays = 0;
  st.skills.sword = Math.max(st.skills.sword, 150); st.skills.axe = Math.max(st.skills.axe, 145); st.skills.magic = Math.max(st.skills.magic, 60);
  st.mind = { fight: 60, calm: 72, grudge: 20 }; st.trust = Math.max(st.trust, 70);
  window.__sid = st.id;
  window.__g = g;
  return true;
};

(async () => {
  const b = await chromium.launch();
  // ---- 1. 個人ページ：7つの能力と人望 ----
  for (const w of [360, 390, 430]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); R.store.navigate({ tab: 'students', page: 'detail', id: window.__sid }); });
    await p.waitForTimeout(900);
    await shot(p, `01-detail-stats-${w}`);
    await p.evaluate(() => { const r = document.querySelector('.renown'); if (r) r.scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(300);
    await shot(p, `02-detail-renown-${w}`);
    // ---- 2. 兵種試験の候補 ----
    const btn = await p.$('button:has-text("兵種試験を受ける")');
    if (btn) {
      await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(600); await shot(p, `03-exam-${w}`);
      // 枝分かれの先でない兵種（ほかの枝へ）の札
      await p.evaluate(() => { const t = [...document.querySelectorAll('.sheet .tag')].find((x) => x.textContent.includes('ほかの枝')); if (t) t.closest('.pcard').scrollIntoView({ block: 'start' }); });
      await p.waitForTimeout(300); await shot(p, `03b-exam-other-${w}`);
    }
    await p.close();
  }
  // ---- 3. 兵種の図鑑（おすすめの道）----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); R.store.navigate({ tab: 'yearbook', page: 'book', sub: 'class' }); });
    await p.waitForTimeout(900);
    const first = await p.$('.cb-grid .cb-leaf');
    if (first) { await first.click(); await p.waitForTimeout(400); }
    const close = await p.$('.sheet .btn.ghost'); if (close) { await close.click(); await p.waitForTimeout(200); }
    await shot(p, '04-classbook-390');
    await p.evaluate(() => { const t = document.querySelector('.ct-tree'); if (t) t.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300);
    await shot(p, '05-classbook-tree-390');
    const leaf = await p.$('.ct-row .ct-c .cb-leaf');
    if (leaf) { await leaf.click(); await p.waitForTimeout(400); await shot(p, '06-classbook-sheet-390'); }
    await p.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/check.json`, JSON.stringify(report, null, 1));
  console.log(report.map((r) => [r.name, r.over ? 'はみ出し' : '', r.small ? `小さいボタン${r.small} ${r.smallList.join('/')}` : '', r.tiny ? `小さい字${r.tiny}` : '', r.errors.length ? r.errors.join('|') : ''].filter(Boolean).join(' ')).join('\n'));
})();
