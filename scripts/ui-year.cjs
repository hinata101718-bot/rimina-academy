// 3年生として始めて、卒業式・新聞・入学試験の画面を確認する
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  await p.goto(process.argv[2] || 'http://localhost:5173/rimina-academy/');
  await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
  await p.reload(); await p.waitForTimeout(500);
  await p.click('text=はじめから');
  await p.click('summary:has-text("テスト用")');
  await p.selectOption('select', '3');
  await p.click('text=着任する');
  await p.click('text=読み飛ばす');
  await p.click('text=授業を始める');
  await p.click('.tabs >> text=設定');
  await p.click('summary:has-text("テスト用")');
  for (let m = 0; m < 11; m++) { await p.click('button:has-text("1ヶ月進める")'); await p.waitForTimeout(50); }
  await p.click('.tabs >> text=学校');
  for (let w = 0; w < 4; w++) {
    await p.click('button.next-week'); await p.waitForTimeout(80);
    for (let k = 0; k < 6; k++) { const c = await p.$('.sheet button:has-text("閉じる")'); if (!c) break; await c.click(); await p.waitForTimeout(60); }
  }
  await p.click('.sheet .card >> nth=0'); await p.waitForTimeout(80);
  await p.click('text=出撃する'); await p.waitForTimeout(200);
  await p.click('summary:has-text("あきらめる")'); await p.click('button:has-text("撤退する")'); await p.waitForTimeout(100);
  await p.click('text=結果を見る'); await p.waitForTimeout(200);
  let shots = 0;
  for (let i = 0; i < 40; i++) {
    const title = await p.$eval('.sheet h2', (e) => e.textContent).catch(() => null);
    if (!title) break;
    if (/進路|卒業|新聞|入学/.test(title) && shots < 8) { await p.screenshot({ path: `test-screens/y${i}-${title.slice(0, 6)}.png`, fullPage: true }); shots++; }
    const btn = await p.$('.sheet button.primary:not([disabled])') || await p.$('.sheet button:has-text("閉じる")');
    if (!btn) break;
    await btn.click(); await p.waitForTimeout(80);
  }
  // 1ヶ月目の最後の週まで行かない場合に備えて
  await p.click('.tabs >> text=年鑑').catch(() => undefined);
  await p.waitForTimeout(100);
  await p.screenshot({ path: 'test-screens/y-yearbook.png', fullPage: true });
  await p.click('.seg >> text=写真').catch(() => undefined);
  await p.screenshot({ path: 'test-screens/y-photo.png', fullPage: true });
  await p.click('.seg >> text=新聞').catch(() => undefined);
  await p.screenshot({ path: 'test-screens/y-news.png', fullPage: true });
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
