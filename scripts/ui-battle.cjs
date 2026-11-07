// 戦闘の操作確認：移動→攻撃の予測→決定
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:5173/rimina-academy/');
  await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
  await p.reload(); await p.waitForTimeout(400);
  await p.click('text=はじめから'); await p.click('text=着任する'); await p.click('text=読み飛ばす'); await p.click('text=授業を始める');
  for (let w = 0; w < 4; w++) {
    await p.click('button.next-week'); await p.waitForTimeout(60);
    for (let k = 0; k < 6; k++) { const c = await p.$('.sheet button:has-text("閉じる")'); if (!c) break; await c.click(); await p.waitForTimeout(40); }
  }
  await p.click('.sheet .card >> nth=0'); await p.click('text=出撃する'); await p.waitForTimeout(200);
  let attacks = 0;
  for (let turn = 0; turn < 8; turn++) {
    for (let i = 0; i < 8; i++) {
      const units = await p.$$('.unit.player:not(.done)');
      if (!units.length) break;
      await units[0].click(); await p.waitForTimeout(30);
      const mv = await p.$$('.cell.mv');
      await mv[0].click(); await p.waitForTimeout(30);
      const atk = await p.$('.panel button:has-text("攻撃")');
      if (atk) {
        await atk.click(); await p.waitForTimeout(30);
        const enemyCell = await p.$('.cell.atk:has(.unit.enemy)');
        if (enemyCell) {
          await enemyCell.click(); await p.waitForTimeout(30);
          if (!attacks) await p.screenshot({ path: 'test-screens/b-forecast.png' });
          await p.click('.panel button:has-text("決定")'); attacks++;
          await p.waitForTimeout(1100);
          continue;
        }
        await p.click('.panel button:has-text("戻る")');
      }
      const waitBtn = await p.$('.panel button:has-text("待機")');
      if (waitBtn) await waitBtn.click();
      await p.waitForTimeout(30);
    }
    if (await p.$('text=結果を見る')) break;
    await p.click('button:has-text("ターン終了")'); await p.waitForTimeout(300);
    const skip = await p.$('button:has-text("スキップ")'); if (skip) await skip.click();
    await p.waitForTimeout(100);
  }
  await p.screenshot({ path: 'test-screens/b-after.png', fullPage: true });
  console.log('attacks', attacks, 'errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
