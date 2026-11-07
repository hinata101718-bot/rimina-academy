// 2夜目の画面確認：戦闘の演出（歩く・HPゲージ・敵ターン）、成長の記録（幅390×高さ844）
// 使い方：npx vite を起動してから node scripts/ui-night2.cjs
const { chromium } = require('playwright');
const shot = (p, n) => p.screenshot({ path: `test-screens/n2-${n}.png` });
async function closeSheets(p, n = 12) {
  for (let k = 0; k < n; k++) {
    const c = await p.$('.sheet button:has-text("スキップ"), .sheet button:has-text("閉じる"), .sheet button:has-text("次へ"), .sheet button:has-text("まとめに戻る")');
    if (!c) break;
    await c.click(); await p.waitForTimeout(80);
  }
}
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
  await shot(p, '01-home');
  for (let w = 0; w < 4; w++) {
    await p.click('button.next-week'); await p.waitForTimeout(400);
    if (w === 0) await shot(p, '02-week');
    await closeSheets(p);
  }
  await p.click('.sheet .card >> nth=0'); await p.waitForTimeout(100);
  await shot(p, '03-deploy');
  await p.click('text=出撃する'); await p.waitForTimeout(300);
  await shot(p, '04-battle');
  let attacked = false;
  for (let turn = 0; turn < 10 && !(await p.$('text=結果を見る')); turn++) {
    for (let i = 0; i < 10; i++) {
      const units = await p.$$('.uwrap .unit.player:not(.done)');
      if (!units.length) break;
      // ユニットの層は押せないので、同じ位置のマスを押す
      const box = await units[0].boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(40);
      const mv = await p.$$('.cell.mv');
      if (!mv.length) break;
      await mv[Math.floor(mv.length / 2)].click(); await p.waitForTimeout(500);
      const atk = await p.$('.panel button:has-text("攻撃")');
      if (atk) {
        await atk.click(); await p.waitForTimeout(40);
        const cells = await p.$$('.cell.atk');
        let done = false;
        for (const c of cells) {
          await c.click(); await p.waitForTimeout(40);
          if (await p.$('.panel button:has-text("決定")')) {
            if (!attacked) await shot(p, '05-forecast');
            await p.click('.panel button:has-text("決定")');
            await p.waitForTimeout(700);
            if (!attacked) await shot(p, '06-combat');
            attacked = true;
            await p.waitForTimeout(2500);
            done = true; break;
          }
        }
        if (done) continue;
        const back = await p.$('.panel button:has-text("戻る")'); if (back) await back.click();
      }
      const waitBtn = await p.$('.panel button:has-text("待機")');
      if (waitBtn) await waitBtn.click();
      await p.waitForTimeout(40);
    }
    if (await p.$('text=結果を見る')) break;
    await p.click('button:has-text("ターン終了")');
    await p.waitForTimeout(1500);
    if (turn === 0) await shot(p, '07-enemy');
    await p.waitForTimeout(1200);
    if (turn === 0) await shot(p, '08-enemy2');
    if (turn > 0) { const sk = await p.$('button:has-text("スキップ")'); if (sk) await sk.click(); }
    for (let k = 0; k < 40 && await p.$('button:has-text("スキップ")'); k++) await p.waitForTimeout(500);
  }
  if (!(await p.$('text=結果を見る'))) { await p.click('summary:has-text("あきらめる")'); await p.click('button:has-text("撤退する")'); await p.waitForTimeout(200); }
  const res = await p.$('text=結果を見る');
  if (res) { await res.click(); await p.waitForTimeout(600); }
  await shot(p, '09-growth');
  await p.waitForTimeout(2500);
  await shot(p, '10-growth2');
  console.log('attacked', attacked, 'errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
