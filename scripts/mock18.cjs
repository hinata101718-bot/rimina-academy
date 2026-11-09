// 18夜目の見本（docs/mockups/night18-mock.html）を1枚ずつ撮る：node scripts/mock18.cjs
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.resolve('docs/mockups/night18-mock.html'));
  await p.waitForTimeout(300);
  const names = ['night18-arts', 'night18-evolve', 'night18-combo-hand', 'night18-combo-fx', 'night18-book'];
  const cols = await p.$$('body > .col');
  for (let i = 0; i < cols.length; i++) await cols[i].screenshot({ path: 'docs/mockups/' + names[i] + '.png' });
  await b.close();
  console.log('ok', cols.length);
})();
