// 7夜目の画面確認：授業カード・授業の結果・鍛錬ゲージ・戦いの記録・判断・結果・レベルアップを幅390×高さ844で撮る
// 使い方：npx vite を起動し、npx tsx scripts/mkshots7.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night7.cjs [出力先=docs/screenshots/night7]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night7';
const dir = process.env.SHOTS_DIR;
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DPR || 2) });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { await p.waitForTimeout(400); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 390) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', file);
    await p.waitForSelector('nav.tabs, .ab-view', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(700);
  };
  const closeAll = async () => { for (let i = 0; i < 14; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("OK")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const want = (k) => !only || only.includes(k);
  if (want('home')) {
    await open(path.join(dir, 'home.json'));
    await closeAll();
    await shot('01-home-calendar');
    await p.evaluate(() => document.querySelector('.lessonboard')?.scrollIntoView());
    await shot('02-lesson-cards');
    await p.click('.lcard >> nth=0'); await p.waitForTimeout(300);
    await shot('03-lesson-selected');
  }
  if (want('result')) {
    await open(path.join(dir, 'result.json'));
    await shot('04-lesson-result');
    for (let i = 0; i < 12; i++) {
      if (await p.$('.levelup, .learn')) break;
      const nx = await p.$('.lresult .btn.primary'); if (nx) { await nx.click(); await p.waitForTimeout(500); continue; }
      const ev = await p.$('.pevent'); if (ev) { await shot('05-practice-event'); await ev.click(); await p.waitForTimeout(400); continue; }
      await p.waitForTimeout(600);
    }
    await p.waitForTimeout(1500);
    await shot('06-growth-moment');
  }
  if (want('battle')) {
    await open(path.join(dir, 'battle.json'));
    await p.waitForTimeout(6000);
    await shot('07-battlelog');
    await p.click('.bl-ctrl button:has-text("速く")').catch(() => undefined);
    for (let i = 0; i < 80; i++) { if (await p.$('.ab-choice')) break; await p.waitForTimeout(300); }
    await shot('08-battle-choice');
    await p.click('.ab-copt >> nth=0').catch(() => undefined); await p.waitForTimeout(500);
    await p.click('.bl-ctrl button:has-text("速く")').catch(() => undefined);
    for (let i = 0; i < 120; i++) { if (await p.$('button:has-text("結果を見る")')) break; if (await p.$('.ab-choice')) { await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(400); continue; } await p.waitForTimeout(300); }
    await shot('09-battle-end');
    await p.click('button:has-text("結果を見る")').catch(() => undefined); await p.waitForTimeout(1200);
    for (let i = 0; i < 30; i++) { if (await p.$('.levelup')) break; await p.mouse.click(195, 500); await p.waitForTimeout(250); }
    await p.waitForTimeout(1200);
    await shot('10-levelup');
    for (let i = 0; i < 6; i++) { const sk = await p.$('.sheet button:has-text("スキップ")'); if (!sk) break; await sk.click(); await p.waitForTimeout(250); }
    await shot('11-result');
  }
  console.log('errors', errors.length ? errors : 'none');
  console.log('wide', wide.length ? wide : 'none');
  await b.close();
})();
