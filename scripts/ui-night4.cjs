// 4夜目の画面確認：3夜目版のセーブを読み込んで全画面を撮る（幅390×高さ844）。横にはみ出した画面も報告する
// 使い方：npx vite を起動してから SHOTS_DIR=<npx tsx scripts/mkshots.ts の出力先> node scripts/ui-night4.cjs [出力先=docs/screenshots/night4] [撮る画面の名前...]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night4';
const only = process.argv.slice(3);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { if (only.length && !only.some((o) => n.includes(o))) return; await p.waitForTimeout(250); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 390) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); };
  const closeSheets = async (n = 20) => {
    for (let k = 0; k < n; k++) {
      const c = await p.$('.sheet button:has-text("スキップ"), .sheet button:has-text("閉じる"), .sheet button:has-text("まとめに戻る")');
      if (!c) break;
      await c.click(); await p.waitForTimeout(100);
    }
  };
  const hallFile = process.env.SHOTS_DIR ? path.join(process.env.SHOTS_DIR, 'hall.json') : '';
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    if (hallFile && require('fs').existsSync(hallFile)) {
      const h = require('fs').readFileSync(hallFile, 'utf8');
      await p.evaluate(async (h) => { await new Promise((res) => { const r = indexedDB.open('rimina-academy', 1); r.onupgradeneeded = () => r.result.createObjectStore('saves'); r.onsuccess = () => { const tx = r.result.transaction('saves', 'readwrite'); tx.objectStore('saves').put(h, 'hall'); tx.oncomplete = res; }; }); }, h);
    }
    await p.setInputFiles('input[type=file]', file);
    await p.waitForTimeout(900);
  };
  const tab = async (label) => { await p.click(`nav.tabs button:has-text("${label}")`); await p.waitForTimeout(200); };
  await open(path.join(__dirname, '../tests/fixtures/v3-save.json'));
  await shot('00-loaded');
  await closeSheets();
  await shot('01-home');
  await shot('01-home-full', true);
  await tab('生徒');
  await shot('02-roster');
  await shot('02-roster-full', true);
  await p.click('.seg button:has-text("簡易")'); await shot('03-roster-compact');
  await p.click('.seg button:has-text("カード")');
  await p.click('.stucard >> nth=0'); await shot('04-detail-full', true);
  await tab('生徒');
  await p.click('button:has-text("兵種試験")'); await shot('05-exam-full', true);
  await tab('学校');
  await p.click('button:has-text("施設・講師")'); await shot('06-facilities-full', true);
  await tab('学校');
  await p.click('button:has-text("教官・副教官")'); await shot('06b-instructor-full', true);
  await tab('学校');
  await p.click('button:has-text("武器庫")'); await shot('07-armory');
  await tab('戦況'); await shot('08-war-full', true);
  await tab('年鑑'); await shot('09-yearbook');
  await p.click('.seg button:has-text("写真")'); await shot('10-photos');
  await p.click('.seg button:has-text("新聞")'); await shot('11-news');
  await p.click('.seg button:has-text("年表")'); await shot('12-chronicle');
  await p.click('.seg button:has-text("記録")'); await shot('12b-records');
  await p.click('.seg button:has-text("殿堂")'); await p.waitForTimeout(400); await shot('19-hall-full', true);
  if (await p.$('.hallcard')) {
    await p.click('.hallcard >> nth=0'); await p.waitForTimeout(400); await shot('19b-hallpage-full', true);
    const prev = await p.$('.photo-nav button >> nth=0'); if (prev && await prev.isEnabled()) { await prev.click(); await shot('19c-hallpage-photo'); }
  }
  await tab('設定'); await shot('20-settings-full', true);
  await tab('学校');
  // 週を進めて、まとめと依頼掲示板
  for (let w = 0; w < 4; w++) {
    const nb = await p.$('button.next-week'); if (!nb) break;
    await nb.click(); await p.waitForTimeout(900);
    if (w === 0) { await shot('13-weeksummary'); }
    const sum = await p.$('.sheet h2:has-text("今週のまとめ")');
    if (await p.$('text=月末の依頼掲示板')) break;
    await closeSheets();
    if (await p.$('text=月末の依頼掲示板')) break;
  }
  await closeSheets(3);
  if (await p.$('text=月末の依頼掲示板')) {
    await shot('14-questboard');
    await p.click('.sheet .pcard >> nth=0'); await shot('15-deploy');
  }
  // 追加のセーブ（入学試験・引退・エンディング）があれば撮る
  const extra = [['entrance', '16-entrance'], ['retire', '17-retire'], ['ending', '18-ending'], ['talk', '21-talk']];
  for (const [f, n] of extra) {
    const file = path.join(process.env.SHOTS_DIR || '', `${f}.json`);
    if (!process.env.SHOTS_DIR || !require('fs').existsSync(file)) continue;
    await open(file);
    for (let k = 0; k < 15; k++) { if (await p.$('.scene') || await p.$('button:has-text("会話を見る")') || await p.$('button:has-text("引退して")') || await p.$('button:has-text("合格にする")') || await p.$('button:has-text("この学校を続ける")')) break; const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ")'); if (!c) break; await c.click(); await p.waitForTimeout(100); }
    await p.waitForTimeout(1500);
    await shot(n);
    if (f === 'ending') {
      for (let k = 0; k < 6; k++) { await p.click('.scene'); await p.waitForTimeout(60); await p.click('.scene'); await p.waitForTimeout(60); }
      await p.waitForTimeout(1200); await shot('18b-ending-epilogue');
      const sk = await p.$('.scene button:has-text("読み飛ばす")'); if (sk) await sk.click();
      await p.waitForTimeout(300); await shot('18c-ending-choice');
    }
    if (f === 'talk') {
      const v = await p.$('button:has-text("会話を見る")'); if (v) { await v.click(); await p.waitForTimeout(1500); await shot('21-talk'); }
      for (let k = 0; k < 8; k++) { const t = await p.$('.tbox'); if (t) { await t.click(); await p.waitForTimeout(80); } }
      await shot('21b-talk-more');
      const all = await p.$('button:has-text("すべて表示")'); if (all) { await all.click(); await p.waitForTimeout(200); await shot('21c-talk-all-full', true); }
    }
    if (f === 'retire') {
      await p.click('text=引退して、後継を選ぶ'); await p.waitForTimeout(1800); await shot('17b-farewell');
      const sk = await p.$('.scene button:has-text("読み飛ばす")'); if (sk) await sk.click();
      await p.waitForTimeout(300); await shot('17c-successor');
    }
  }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  console.log('wide:', wide.length ? wide.join('\n') : 'none');
  await b.close();
})();
