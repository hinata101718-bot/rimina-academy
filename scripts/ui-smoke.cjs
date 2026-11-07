// 画面の動作確認（幅390×高さ844）
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  const base = process.argv[2] || 'http://localhost:5173/rimina-academy/';
  await p.goto(base);
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'test-screens/01-title.png' });
  await p.click('text=はじめから');
  await p.fill('input[type=text]', 'アルノルト');
  await p.screenshot({ path: 'test-screens/02-new.png' });
  await p.click('text=着任する');
  for (let i = 0; i < 8; i++) { await p.click('.app'); await p.waitForTimeout(50); }
  await p.screenshot({ path: 'test-screens/03-meet.png' });
  await p.click('text=授業を始める');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'test-screens/04-home.png', fullPage: true });
  // 生徒
  await p.click('.tabs >> text=生徒');
  await p.screenshot({ path: 'test-screens/05-roster.png', fullPage: true });
  await p.click('.stu >> nth=0');
  await p.screenshot({ path: 'test-screens/06-detail.png', fullPage: true });
  await p.click('.tabs >> text=学校');
  // 個人指導を1つ
  await p.click('text=個人指導 あと');
  await p.click('.seg >> text=面談');
  await p.click('button:has-text("面談") >> nth=1');
  await p.screenshot({ path: 'test-screens/07-tutoring.png', fullPage: true });
  await p.click('text=← 戻る');
  // 週を4回
  for (let w = 0; w < 4; w++) {
    await p.click('button.next-week');
    await p.waitForTimeout(200);
    if (w === 0) await p.screenshot({ path: 'test-screens/08-summary.png' });
    // まとめを閉じる（会話があれば開いて閉じる）
    for (let k = 0; k < 6; k++) {
      const close = await p.$('.sheet button:has-text("閉じる")');
      if (!close) break;
      await close.click(); await p.waitForTimeout(100);
      if (await p.$('text=月末の依頼掲示板')) break;
    }
  }
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'test-screens/09-quest.png', fullPage: true });
  await p.click('.sheet .card >> nth=0');
  await p.waitForTimeout(100);
  await p.screenshot({ path: 'test-screens/10-deploy.png', fullPage: true });
  await p.click('text=出撃する');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'test-screens/11-battle.png', fullPage: true });
  // 味方をタップ
  const unit = await p.$('.unit.player');
  await unit.click();
  await p.waitForTimeout(100);
  await p.screenshot({ path: 'test-screens/12-select.png' });
  // 全マスのサイズ
  const sizes = await p.$$eval('.cell', (cs) => cs.map((c) => c.getBoundingClientRect().width));
  console.log('cells', sizes.length, 'min width', Math.min(...sizes).toFixed(1));
  // ターン終了を何度か押して戦闘を進める
  for (let t = 0; t < 30; t++) {
    if (await p.$('text=結果を見る')) break;
    const btn = await p.$('button:has-text("ターン終了")');
    if (btn) await btn.click();
    await p.waitForTimeout(200);
    const skip = await p.$('button:has-text("スキップ")');
    if (skip) await skip.click();
    await p.waitForTimeout(100);
  }
  await p.screenshot({ path: 'test-screens/13-battle-end.png', fullPage: true });
  const res = await p.$('text=結果を見る');
  if (res) { await res.click(); await p.waitForTimeout(300); await p.screenshot({ path: 'test-screens/14-result.png', fullPage: true }); }
  // リロードして状態が残るか
  await p.waitForTimeout(300); await p.reload(); await p.waitForTimeout(800);
  const cont = await p.$('text=続きから');
  console.log('continue button after reload:', !!cont);
  if (cont) { await cont.click(); await p.waitForTimeout(400); await p.screenshot({ path: 'test-screens/15-reloaded.png', fullPage: true }); }
  for (let k = 0; k < 5; k++) { const c = await p.$('.sheet button:has-text("閉じる")'); if (!c) break; await c.click(); await p.waitForTimeout(100); }
  for (const t of ['戦況', '年鑑', '設定']) { await p.click(`.tabs >> text=${t}`); await p.waitForTimeout(150); await p.screenshot({ path: `test-screens/16-${t}.png`, fullPage: true }); }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
