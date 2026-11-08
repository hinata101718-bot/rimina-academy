// 9夜目の画面撮影：3部隊の出撃前・策の選択・戦いの記録（必殺・撃破・宿命の対決）・組織図と変化・結果の評価
// 使い方：npx vite を起動し、npx tsx scripts/mkshots9.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night9.cjs [出力先=docs/screenshots/night9]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night9';
const dir = process.env.SHOTS_DIR;
const W = Number(process.env.W || 390);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: Number(process.env.DPR || 2) });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { await p.waitForTimeout(450); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > W) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const open = async (file, keep) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForSelector('nav.tabs, .ab-view', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(700);
    if (!keep) await closeAll();
  };
  const closeAll = async () => { for (let i = 0; i < 16; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("OK"), .sheet button:has-text("丁重に断る")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const click = async (sel) => { await p.click(sel).catch((e) => errors.push('click ' + sel)); await p.waitForTimeout(350); };
  const tab = async (i) => { await click(`nav.tabs button >> nth=${i}`); };
  const want = (k) => !ONLY || ONLY.includes(k);
  if (want('board')) {
    await open('board.json', true);
    await closeAll();
    await shot('01-sortie-squads');
    await click('.sq-card >> nth=0 >> .tap');
    await shot('02-squad-editor');
    await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.includes('策')); h && h.scrollIntoView(); });
    await shot('03-strat-select');
    await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.includes('陣形')); h && h.scrollIntoView(); });
    await shot('04-formation');
  }
  if (want('battle')) {
    await open('battle.json', true); await p.waitForTimeout(800);
    for (let i = 0; i < 6; i++) await click('.bl-log');
    await shot('05-battle-log');
  }
  if (want('result')) {
    await open('result.json', true);
    await shot('10-sortie-result');
    await click('.sheet .btn.primary'); await p.waitForTimeout(300);
    for (let i = 0; i < 12; i++) { if (await p.$('.ev-card')) break; const c = await p.$('.sheet button:has-text("スキップ"), .sheet button:has-text("次へ"), .sheet button:has-text("閉じる")'); if (!c) break; await c.click(); await p.waitForTimeout(250); }
    await shot('11-evals');
  }
  if (want('strat')) { await open('strat.json', true); await p.waitForTimeout(900); await shot('12-new-strat'); }
  if (want('org')) {
    await open('org.json');
    await tab(2); await click('button:has-text("敵将の名簿")'); await shot('20-orgchart');
  }
  console.log('wide', wide.join(', ') || 'なし');
  console.log('errors', errors.join('\n') || 'なし');
  await b.close();
})();
