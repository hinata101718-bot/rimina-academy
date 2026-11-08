// 13夜目の画面撮影：勢力図・地域の吹き出し・拡大・地域の変化の場面・組織図の変化の場面・ホームの作戦地図
// 使い方：npx vite を起動し、npx tsx scripts/mkshots13.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night13.cjs [出力先=docs/screenshots/night13] [幅=390]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night13';
const W = Number(process.argv[3] || 390);
const dir = process.env.SHOTS_DIR;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const shot = async (n, full) => {
    await p.waitForTimeout(500);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    if (sw > W + 1) errors.push(`${n}: 横にはみ出し ${sw}px`);
    await p.screenshot({ path: `${out}/${n}.png`, fullPage: !!full }); console.log('shot', n);
  };
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForTimeout(1400);
    for (let i = 0; i < 16; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("OK")'); if (!c) break; await c.click(); await p.waitForTimeout(150); }
  };
  const click = async (sel) => { await p.click(sel).catch(() => errors.push('click ' + sel)); await p.waitForTimeout(400); };
  // ホームの作戦地図
  await open('world.json');
  await p.evaluate(() => document.querySelector('.deskmap')?.scrollIntoView({ block: 'center' }));
  await shot('01-home-map');
  // 勢力図
  await click('.deskmap');
  await p.evaluate(() => document.querySelector('.wm-card')?.scrollIntoView());
  await shot('02-worldmap');
  await click('.wm-label.school'); await p.waitForTimeout(700); await shot('03-region-school');
  await click('.sheet button:has-text("閉じる")');
  await click('.wm-label.cap >> nth=0'); await p.waitForTimeout(700); await shot('04-region-capital');
  await click('.sheet button:has-text("閉じる")');
  await click('.wm-card button:has-text("拡大する")'); await shot('05-worldmap-zoom');
  await click('.wm-card button:has-text("元の大きさ")');
  // 地域の変化の場面
  if (await p.$('.wm-changes')) {
    await click('.wm-changes'); await p.waitForTimeout(900); await shot('06-map-change-1');
    await click('.wm-player .btn.primary'); await p.waitForTimeout(900);
    if (await p.$('.wm-player')) await shot('07-map-change-2');
  } else errors.push('地域の変化の札がない');
  // 組織図の変化の場面
  await open('world.json');
  await click('nav.tabs button >> nth=2'); await click('button:has-text("敵将の名簿")');
  const tabs = await p.$$('.ofc-tabs button');
  const seen = new Set();
  let first = true;
  for (let ti = 0; ti < tabs.length && seen.size < 6; ti++) {
    const bt = (await p.$$('.ofc-tabs button'))[ti];
    if (!bt || !(await bt.$('.org-dot'))) continue;
    await bt.click(); await p.waitForTimeout(400);
    if (first) { first = false; await shot('08-orgchart', true); }
    if (!(await p.$('.org-bigplay'))) continue;
    await click('.org-bigplay'); await p.waitForTimeout(1200);
    for (let i = 0; i < 16 && (await p.$('.oc-player')); i++) {
      const k = await p.evaluate(() => (document.querySelector('.oc-stage')?.classList[1] || ''));
      if (!seen.has(k) && seen.size < 6) { seen.add(k); await shot(`09-org-${seen.size}-${k}`); }
      await click('.oc-player'); await p.waitForTimeout(900);
    }
  }
  if (!seen.size) errors.push('組織図の変化の場面がない');
  // 依頼の札の「場所」
  await p.goto('http://localhost:5173/rimina-academy/');
  await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
  await p.reload(); await p.waitForTimeout(500);
  await p.setInputFiles('input[type=file]', path.join(dir, 'board.json'));
  await p.waitForTimeout(1600);
  for (let i = 0; i < 6 && !(await p.$('.pcard')); i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("OK")'); if (!c) break; await c.click(); await p.waitForTimeout(300); }
  const hasQ = await p.evaluate(() => { const e = [...document.querySelectorAll('.pcard')].find((x) => /場所：|(領|港|荒野|王都|帝都|商都|分校)/.test(x.textContent)); if (e) e.scrollIntoView({ block: 'center' }); return !!e; });
  if (hasQ) await shot('10-quest-place'); else console.log('依頼の札が見つからない');
  console.log('errors', errors.join('\n') || 'なし');
  await b.close();
})();
