// 5夜目の画面確認：自動の戦闘（出撃前・場面・選択・結果）を幅390×高さ844で撮る。横にはみ出した画面も報告する
// 使い方：npx vite を起動し、npx tsx scripts/mkshots5.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night5.cjs [出力先=docs/screenshots/night5]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night5';
const dir = process.env.SHOTS_DIR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { await p.waitForTimeout(300); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 390) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', file);
    await p.waitForSelector('nav.tabs, .ab-view', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(600);
  };
  await open(path.join(dir, 'board.json'));
  await shot('01-board');
  await p.click('.sheet .pcard.tap:has(.flag.red) >> nth=0');
  await p.waitForTimeout(800);
  await shot('02-prep');
  for (let k = 1; k <= 3; k++) { await p.evaluate((k) => { const sh = document.querySelector('.sheet'); if (sh) sh.scrollTop = k * 700; }, k); await shot(`02-prep-${k}`); }
  // 方針と役割を少し変えてみる
  await p.click('.ab-tac >> nth=1'); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('.ab-odds')?.scrollIntoView({ block: 'center' }));
  await shot('03-prep-tactic-role');
  await p.click('.ab-tac >> nth=0'); await p.waitForTimeout(200);
  await p.click('button:has-text("出撃する")');
  await p.waitForTimeout(800);
  await shot('04-scene-open');
  // タップで送る（選択が出るまで）
  let choice = false;
  for (let i = 0; i < 40 && !choice; i++) {
    if (await p.$('.ab-choice')) { choice = true; break; }
    if (await p.$('button:has-text("結果を見る")')) break;
    await p.click('.ab-scene', { position: { x: 180, y: 120 } }); await p.waitForTimeout(160);
    if (i === 6) await shot('05-scene-clash');
  }
  if (choice) { await shot('06-choice'); await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(500); await shot('07-after-choice'); }
  for (let i = 0; i < 60; i++) {
    if (await p.$('button:has-text("結果を見る")')) break;
    if (await p.$('.ab-choice')) { await shot('08-choice2'); await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(400); continue; }
    await p.click('.ab-scene', { position: { x: 180, y: 120 } }); await p.waitForTimeout(120);
  }
  await shot('09-scene-end');
  await p.click('button:has-text("結果を見る")'); await p.waitForTimeout(600);
  await shot('10-result-growth');
  for (let i = 0; i < 6; i++) { const sk = await p.$('.sheet button:has-text("スキップ")'); if (!sk) break; await sk.click(); await p.waitForTimeout(250); }
  await shot('11-result');
  await p.evaluate(() => { const sh = document.querySelector('.sheet'); if (sh) sh.scrollTop = 99999; }); await shot('11-result-2');
  // 設定
  for (let i = 0; i < 12; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ")'); if (!c) break; await c.click(); await p.waitForTimeout(150); }
  await p.click('nav.tabs button:has-text("設定")'); await p.waitForTimeout(300);
  await shot('12-settings');
  // 年鑑の因縁の敵将
  await open(path.join(dir, 'nemesis.json'));
  for (let i = 0; i < 12; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ")'); if (!c) break; await c.click(); await p.waitForTimeout(150); }
  await p.click('nav.tabs button:has-text("年鑑")'); await p.waitForTimeout(300);
  await p.click('.seg button:has-text("記録")'); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('h3')].find((h) => h.textContent.includes('因縁'))?.scrollIntoView());
  await shot('13-nemesis');
  console.log('wide:', wide.length ? wide.join(', ') : 'なし');
  console.log('errors:', errors.length ? errors.join('\n') : 'なし');
  await b.close();
})();
