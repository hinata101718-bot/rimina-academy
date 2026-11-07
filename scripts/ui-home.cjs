const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p.goto('http://localhost:5173/rimina-academy/');
  await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
  await p.reload(); await p.waitForTimeout(500);
  await p.click('text=はじめから'); await p.click('text=着任する'); await p.click('text=読み飛ばす'); await p.click('text=授業を始める');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'test-screens/h-01-home.png' });
  await p.screenshot({ path: 'test-screens/h-02-home-full.png', fullPage: true });
  await p.click('button.next-week'); await p.waitForTimeout(250);
  await p.screenshot({ path: 'test-screens/h-03-flip.png' });
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
