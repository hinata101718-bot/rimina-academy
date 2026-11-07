// 戦闘で味方を1人動かせるかの確認（幅390×高さ844）
// 使い方：npx vite を起動してから node scripts/ui-move.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', (e) => console.log('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:5173/rimina-academy/');
  await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
  await p.reload(); await p.waitForTimeout(500);
  await p.click('text=はじめから'); await p.click('text=着任する'); await p.click('text=読み飛ばす'); await p.click('text=授業を始める');
  for (let w = 0; w < 4; w++) {
    await p.click('button.next-week'); await p.waitForTimeout(400);
    for (let k = 0; k < 12; k++) { const c = await p.$('.sheet button:has-text("スキップ"), .sheet button:has-text("閉じる"), .sheet button:has-text("次へ"), .sheet button:has-text("まとめに戻る")'); if (!c) break; await c.click(); await p.waitForTimeout(80); }
  }
  await p.click('.sheet .card >> nth=0'); await p.waitForTimeout(100);
  await p.click('text=出撃する'); await p.waitForTimeout(300);
  const units = await p.$$('.uwrap .unit.player:not(.done)');
  console.log('units', units.length);
  const box = await units[0].boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(100);
  const mv = await p.$$('.cell.mv');
  console.log('mv', mv.length);
  const before = await p.$$eval('.uwrap', (els) => els.map((e) => e.style.left + ',' + e.style.top).join(' '));
  await mv[0].click(); await p.waitForTimeout(600);
  const after = await p.$$eval('.uwrap', (els) => els.map((e) => e.style.left + ',' + e.style.top).join(' '));
  console.log(before === after ? 'NOT MOVED' : 'moved');
  console.log(await p.$eval('.panel', (e) => e.innerText.slice(0, 160)));
  await b.close();
})();
