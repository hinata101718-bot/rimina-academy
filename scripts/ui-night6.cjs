// 6夜目の画面確認：敵将の名簿・敵将の顔が出る出撃前と場面・宿敵の決着・個人ページの宿敵欄・才能判明の演出を幅390×高さ844で撮る
// 使い方：npx vite を起動し、npx tsx scripts/mkshots6.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night6.cjs [出力先=docs/screenshots/night6]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night6';
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
  const shot = async (n, full = false) => { await p.waitForTimeout(350); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 390) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', file);
    await p.waitForSelector('nav.tabs, .ab-view', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(700);
  };
  const closeAll = async () => { for (let i = 0; i < 14; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("次へ"), .sheet button:has-text("OK")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const want = (k) => !only || only.includes(k);
  if (want('prep')) {
    await open(path.join(dir, 'board.json'));
    await shot('01-board');
    await p.click('.sheet .pcard.tap:has(.flag.red) >> nth=0').catch(() => undefined);
    await p.waitForTimeout(900);
    await shot('02-prep-officer');
    await p.click('.ofc-scout button').catch(() => undefined); await p.waitForTimeout(600);
    await shot('03-prep-scouted');
    await p.click('button:has-text("出撃する")'); await p.waitForTimeout(900);
    for (let i = 0; i < 4; i++) { await p.click('.ab-scene', { position: { x: 180, y: 120 } }); await p.waitForTimeout(200); }
    await shot('04-scene-open');
  }
  if (want('settle')) {
    await open(path.join(dir, 'settle.json'));
    for (let i = 0; i < 30; i++) { if (await p.$('.ab-choice')) break; await p.click('.ab-scene', { position: { x: 180, y: 120 } }); await p.waitForTimeout(150); }
    await shot('05-settle-choice');
    await p.click('.ab-copt >> nth=1'); await p.waitForTimeout(500);
    for (let i = 0; i < 2; i++) { await p.click(".ab-scene", { position: { x: 180, y: 300 } }); await p.waitForTimeout(220); }
    await shot('06-settle-scene');
    for (let i = 0; i < 60; i++) { if (await p.$('button:has-text("結果を見る")')) break; if (await p.$('.ab-choice')) { await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(300); continue; } await p.click('.ab-scene', { position: { x: 180, y: 120 } }); await p.waitForTimeout(110); }
    await p.click('button:has-text("結果を見る")').catch(() => undefined); await p.waitForTimeout(600);
    for (let i = 0; i < 6; i++) { const sk = await p.$('.sheet button:has-text("スキップ")'); if (!sk) break; await sk.click(); await p.waitForTimeout(250); }
    await shot('07-result-officer');
    await p.evaluate(() => [...document.querySelectorAll('.sheet h3, .sheet b')].find((h) => h.textContent.includes('分かった'))?.scrollIntoView());
    await shot('07b-result-findings');
  }
  if (want('roster')) {
    await open(path.join(dir, 'roster.json'));
    await closeAll();
    await p.click('nav.tabs button:has-text("戦況")'); await p.waitForTimeout(300);
    await p.click('.seg button:has-text("敵将の名簿")'); await p.waitForTimeout(400);
    await shot('08-officer-roster');
    await p.click('.pills button:has-text("盗賊団")'); await p.waitForTimeout(300);
    await shot('09-officer-roster-bandit');
    await p.click('.ofc-row >> nth=0'); await p.waitForTimeout(400);
    await shot('10-officer-sheet');
  }
  if (want('rival')) {
    await open(path.join(dir, 'roster.json'));
    await closeAll();
    await p.click('nav.tabs button:has-text("生徒")'); await p.waitForTimeout(300);
    await p.click('.seg button:has-text("簡易")').catch(() => undefined); await p.waitForTimeout(300);
    await shot('11-roster-notebook');
    await p.click('.seg button:has-text("カード")').catch(() => undefined); await p.waitForTimeout(200);
    // 宿敵のいる子の個人ページを探す
    let opened = false;
    const n = (await p.$$('.stucard')).length;
    for (let i = 0; i < n && !opened; i++) {
      const cards = await p.$$('.stucard');
      await cards[i].click(); await p.waitForTimeout(250);
      if (await p.$('.card:has(h3:text-is("宿敵")) .ofc-face')) { opened = true; break; }
      await p.click('button:has-text("戻る")'); await p.waitForTimeout(200);
    }
    if (opened) {
      await p.evaluate(() => [...document.querySelectorAll('h3')].find((h) => h.textContent.startsWith('分かったこと'))?.scrollIntoView({ block: 'start' }));
      await shot('12-student-discover');
      await p.evaluate(() => [...document.querySelectorAll('h3')].find((h) => h.textContent === '宿敵')?.scrollIntoView({ block: 'start' }));
      await shot('13-student-rival');
    } else console.log('宿敵のいる子が見つからない');
  }
  if (want('discovery')) {
    await open(path.join(dir, 'discovery.json'));
    for (let k = 0; k < 8; k++) {
      await p.waitForTimeout(1300);
      const dc = await p.$('.dc-wrap'); const ru = await p.$('.ru-wrap');
      if (dc) { const st = await p.evaluate(() => document.querySelector('.dc-wrap')?.className || ''); await shot(`14-discovery-${k}-${st.replace(/.*stage/, 'stage')}`); await p.click('.dc-wrap button:has-text("閉じる")'); continue; }
      if (ru) { await p.waitForTimeout(900); await shot(`15-rankup-${k}`); for (let t = 0; t < 6; t++) { const c = await p.$('.ru-wrap button:has-text("閉じる")'); if (c) break; await p.click('.ru-wrap'); await p.waitForTimeout(1300); } const c = await p.$('.ru-wrap button:has-text("閉じる")'); if (c) { await shot(`15-rankup-${k}-all`); await c.click(); } continue; }
      const c = await p.$('.sheet button:has-text("閉じる")'); if (c) await c.click(); else break;
    }
  }
  console.log('wide:', wide.length ? wide.join(', ') : 'なし');
  console.log('errors:', errors.length ? errors.join('\n') : 'なし');
  await b.close();
})();
