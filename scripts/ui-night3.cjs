// 3夜目の画面確認：2夜目版のセーブを読み込んで主要な画面を撮る（幅390×高さ844）
// 使い方：npx vite を起動してから node scripts/ui-night3.cjs [出力先=docs/screenshots/night3] [撮る画面の名前...]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night3';
const only = process.argv.slice(3);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const shot = async (n, full = false) => { if (only.length && !only.some((o) => n.includes(o))) return; await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); };
  const closeSheets = async (n = 20) => {
    for (let k = 0; k < n; k++) {
      const c = await p.$('.sheet button:has-text("スキップ"), .sheet button:has-text("閉じる"), .sheet button:has-text("まとめに戻る")');
      if (!c) break;
      await c.click(); await p.waitForTimeout(100);
    }
  };
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', file);
    await p.waitForTimeout(900);
  };
  const tab = async (label) => { await p.click(`nav.tabs button:has-text("${label}")`); await p.waitForTimeout(200); };
  await open(path.join(__dirname, '../tests/fixtures/v2-save.json'));
  await shot('00-loaded');
  await closeSheets();
  await shot('01-home');
  await shot('01-home-full', true);
  await tab('生徒');
  await shot('02-roster');
  await shot('02-roster-full', true);
  await p.click('.seg button:has-text("簡易")'); await shot('03-roster-compact');
  await p.click('.seg button:has-text("カード")');
  await p.click('.stucard >> nth=0'); await shot('04-detail-full', true);
  await tab('生徒');
  await p.click('button:has-text("兵種試験")'); await shot('05-exam-full', true);
  await tab('学校');
  await p.click('button:has-text("施設・講師")'); await shot('06-facilities-full', true);
  await tab('学校');
  await p.click('button:has-text("武器庫")'); await shot('07-armory');
  await tab('戦況'); await shot('08-war-full', true);
  await tab('年鑑'); await shot('09-yearbook');
  await p.click('.seg button:has-text("写真")'); await shot('10-photos');
  await p.click('.seg button:has-text("新聞")'); await shot('11-news');
  await p.click('.seg button:has-text("年表")'); await shot('12-chronicle');
  await tab('学校');
  // 週を進めて、まとめと依頼掲示板
  for (let w = 0; w < 4; w++) {
    const nb = await p.$('button.next-week'); if (!nb) break;
    await nb.click(); await p.waitForTimeout(900);
    if (w === 0) { await shot('13-weeksummary'); }
    const sum = await p.$('.sheet h2:has-text("今週のまとめ")');
    if (await p.$('text=月末の依頼掲示板')) break;
    await closeSheets();
    if (await p.$('text=月末の依頼掲示板')) break;
  }
  await closeSheets(3);
  if (await p.$('text=月末の依頼掲示板')) {
    await shot('14-questboard');
    await p.click('.sheet .pcard >> nth=0'); await shot('15-deploy');
  }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
