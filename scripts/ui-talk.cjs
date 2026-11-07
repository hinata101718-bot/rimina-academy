// 会話のタップ送り・面談・会話の記録の画面確認（幅390×高さ844）
// 使い方：npx vite を起動してから node scripts/ui-talk.cjs
const { chromium } = require('playwright');
const shot = (p, n) => p.screenshot({ path: `test-screens/t-${n}.png` });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:5173/rimina-academy/');
  await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
  await p.reload(); await p.waitForTimeout(500);
  await p.click('text=はじめから'); await p.click('text=着任する'); await p.click('text=読み飛ばす'); await p.click('text=授業を始める');
  await p.waitForTimeout(200);
  // 面談を2つ入れる
  await p.click('text=個人指導 あと');
  await p.click('.seg >> text=面談');
  await p.click('.card button:has-text("面談") >> nth=0');
  await p.click('.card button:has-text("面談") >> nth=1');
  await p.click('text=← 戻る');
  await p.click('button.next-week'); await p.waitForTimeout(400);
  await shot(p, '01-growth');
  const skip = await p.$('.sheet button:has-text("スキップ")'); if (skip) await skip.click();
  await p.waitForTimeout(200);
  await shot(p, '02-summary');
  await p.click('.sheet button:has-text("会話を見る")');
  await p.waitForTimeout(300);
  await shot(p, '03-talk-typing');
  await p.click('.tplayer'); await p.waitForTimeout(100);
  await p.click('.tplayer'); await p.waitForTimeout(900);
  await shot(p, '04-talk-line2');
  // 最後まで送る
  for (let k = 0; k < 60; k++) {
    if (await p.$('.tchoice')) { await shot(p, '05-choice'); await p.click('.tchoice button >> nth=1'); }
    const t = await p.$('.tplayer');
    if (!t) break;
    await t.click(); await p.waitForTimeout(60);
  }
  await shot(p, '06-after');
  for (let k = 0; k < 6; k++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("次へ")'); if (!c) break; await c.click(); await p.waitForTimeout(80); }
  // 個人ページの会話の記録
  await p.click('.tabs >> text=生徒');
  await p.click('.stu >> nth=0');
  await p.waitForTimeout(200);
  const arc = await p.$('h3:has-text("会話の記録")');
  if (arc) await arc.scrollIntoViewIfNeeded();
  const row = await p.$('.card:has(h3:has-text("会話の記録")) .row.between');
  if (row) { await row.click(); await p.waitForTimeout(200); }
  await shot(p, '07-archive');
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
