// 古いセーブの読み込み・レベルアップの演出の画面確認（幅390×高さ844）
// 使い方：npx vite を起動してから node scripts/ui-saves.cjs [レベルアップ用のセーブ.json]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(400);
    await p.setInputFiles('input[type=file]', file);
    await p.waitForTimeout(600);
  };
  await open(path.join(__dirname, '../tests/fixtures/v1-save.json'));
  await p.screenshot({ path: 'test-screens/s-01-v1-loaded.png' });
  if (process.argv[2]) {
    await open(process.argv[2]);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: 'test-screens/s-02-levelup.png' });
    await p.waitForTimeout(2200);
    await p.screenshot({ path: 'test-screens/s-03-levelup2.png' });
  }
  await open(path.join(__dirname, '../tests/fixtures/v1-battle.json'));
  await p.screenshot({ path: 'test-screens/s-04-v1-battle.png' });
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
