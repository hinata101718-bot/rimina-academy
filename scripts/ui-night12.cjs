// 12夜目の画面撮影：技能タブの戦技と心得・覚えた演出・戦いの技の名前・敵将の「〇〇の使い手」・兵種図鑑
// 使い方：npx vite を起動し、npx tsx scripts/mkshots10.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night12.cjs [出力先=docs/screenshots/night12]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night12';
const dir = process.env.SHOTS_DIR;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const edit = (from, to, f) => { const j = JSON.parse(fs.readFileSync(path.join(dir, from), 'utf8')); f(j.state); fs.writeFileSync(path.join(dir, to), JSON.stringify(j)); };
  edit('skills.json', 'artlearn.json', (s) => { const id = Object.keys(s.students).find((k) => s.students[k].status === 'enrolled'); s.pending = [{ type: 'art', studentId: id, ids: ['sw_art1', 'sw_mind2'] }]; });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const shot = async (n) => { await p.waitForTimeout(450); await p.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForTimeout(1400);
  };
  const closeAll = async () => { for (let i = 0; i < 16; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("OK")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const click = async (sel) => { await p.click(sel).catch(() => errors.push('click ' + sel)); await p.waitForTimeout(350); };
  // 覚えた演出
  await open('artlearn.json'); await p.waitForTimeout(700);
  // 12夜目のお知らせなどを先に閉じる
  for (let i = 0; i < 6 && !(await p.$('.lt-card')); i++) { const c = await p.$('.sheet button:has-text("閉じる")'); if (!c) break; await c.click(); await p.waitForTimeout(300); }
  await shot('01-art-learn');
  // 技能タブ
  await open('skills.json'); await closeAll();
  await click('nav.tabs button >> nth=1'); await click('.stucard >> nth=0'); await click('button:has-text("技能")');
  await p.evaluate(() => document.querySelector('.arts-card')?.scrollIntoView());
  await shot('02-skills-arts');
  // 出撃前の敵将（〇〇の使い手）
  await open('board.json'); await closeAll(); await click('.sq-card >> nth=0 >> .tap');
  await p.evaluate(() => document.querySelector('.ofc-trait.art, .ab-intel')?.scrollIntoView());
  await shot('03-leader-arts');
  // 戦いの技の名前
  await open('battle.json');
  let got = 0;
  for (let i = 0; i < 240 && got < 2; i++) {
    if (await p.$('.fx-over')) { await p.click('.fx-over').catch(() => undefined); await p.waitForTimeout(150); continue; }
    if (await p.$('.ab-copt')) { await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(400); continue; }
    if (await p.$('.ab-endbtn')) break;
    await p.mouse.click(195, 420); await p.waitForTimeout(650);
    if (await p.$('.dq-line.art')) { got++; await shot(`04-battle-art-${got}`); }
  }
  // 兵種図鑑
  await open('skills.json'); await closeAll();
  await click('nav.tabs button >> nth=1');
  await click('button:has-text("図鑑")');
  await click('.cb-leaf >> nth=1'); await click('.cb-leaf >> nth=1');
  await shot('05-classbook');
  console.log('errors', errors.join('\n') || 'なし');
  await b.close();
})();
