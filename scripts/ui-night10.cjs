// 10夜目の画面撮影：新しい戦いの画面・同行しない部隊の結果・戦利品・技能タブの得意苦手と芽・開花の演出・出撃前
// 使い方：npx vite を起動し、npx tsx scripts/mkshots10.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night10.cjs [出力先=docs/screenshots/night10]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night10';
const dir = process.env.SHOTS_DIR;
const W = Number(process.env.W || 390);
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: Number(process.env.DPR || 2) });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { await p.waitForTimeout(450); const w = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('.sheet')].map((x) => x.scrollLeft > 0 ? 9999 : 0))); if (w > W) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const open = async (file, keep) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForSelector('nav.tabs, .ab-view, .bloom-wrap', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(700);
    if (!keep) await closeAll();
  };
  const closeAll = async () => { for (let i = 0; i < 16; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("OK"), .sheet button:has-text("丁重に断る")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const click = async (sel) => { await p.click(sel).catch(() => errors.push('click ' + sel)); await p.waitForTimeout(350); };
  const tab = async (i) => { await click(`nav.tabs button >> nth=${i}`); };
  // 出撃前（同行しない部隊）
  await open('board.json', true); await closeAll();
  await shot('01-sortie-away');
  await click('.sq-card >> nth=0 >> .tap');
  await p.evaluate(() => document.querySelector('.sq-leads')?.scrollIntoView());
  await shot('02-captain-rank');
  // 新しい戦いの画面
  await open('battle.json', true); await p.waitForTimeout(800);
  await shot('03-battle-open');
  const got = new Set();
  for (let i = 0; i < 300; i++) {
    for (const [sel, name] of [['.fx-cutin', '05-crit'], ['.fx-kill', '06-kill'], ['.fx-strat', '07-strat'], ['.fx-vs', '08-duel']]) {
      if (!got.has(name) && await p.$(sel)) { got.add(name); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); }
    }
    if (await p.$('.fx-over')) { await p.click('.fx-over').catch(() => undefined); await p.waitForTimeout(150); continue; }
    if (await p.$('.ab-copt')) { if (!got.has('choice')) { got.add('choice'); await shot('09-choice'); } await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(400); continue; }
    const end = await p.$('.ab-endbtn');
    if (end) { await end.click(); await p.waitForTimeout(800); break; }
    await p.mouse.click(W / 2, 420); await p.waitForTimeout(500);
    if (i === 8) await shot('04-battle-attack');
    if (i === 40 && !got.has('foe')) { got.add('foe'); await shot('04b-battle-enemy-turn'); }
  }
  await p.click('.rb-ctrl button:has-text("文を見返す")').catch(() => undefined);
  // 同行しない部隊の結果と戦利品
  await open('result.json', true);
  await shot('10-sortie-result-away');
  await p.evaluate(() => document.querySelector('.aw-block')?.scrollIntoView());
  await click('.sr-card >> nth=1'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.aw-block')?.scrollIntoView());
  await shot('11-away-detail');
  for (let i = 0; i < 6 && !(await p.$('.lt-wrap')); i++) { const c = await p.$('.sheet button:has-text("戦利品を見る"), .sheet button.btn.primary'); if (!c) break; await c.click(); await p.waitForTimeout(500); }
  await p.waitForTimeout(800);
  await shot('12-loot');
  // 技能タブ（得意・苦手・芽）
  await open('skills.json');
  await tab(1); await p.waitForTimeout(300);
  await shot('13-roster-bud');
  await click('.stucard >> nth=0');
  await click('button:has-text("技能")');
  await shot('14-skills-tab');
  await p.evaluate(() => document.querySelector('.apt-card')?.scrollIntoView());
  await shot('15-skills-apt');
  await click('.lb-help'); await shot('16-help');
  // 開花の演出
  await open('bloom.json', true);
  await p.waitForTimeout(1200); await shot('17-bloom');
  await p.click('.bloom-wrap'); await p.waitForTimeout(400); await p.click('.bloom-wrap'); await p.waitForTimeout(400); await p.click('.bloom-wrap'); await p.waitForTimeout(600);
  await shot('18-bloom-teacher');
  // 幅360・430でも横にずれないか
  for (const w of [360, 430]) {
    await p.setViewportSize({ width: w, height: 844 });
    for (const f of ['board.json', 'battle.json', 'skills.json']) {
      await open(f, f !== 'skills.json');
      if (f === 'skills.json') { await tab(1); await click('.stucard >> nth=0'); await click('button:has-text("技能")'); }
      if (f === 'board.json') { await closeAll(); await click('.sq-card >> nth=0 >> .tap'); }
      const sw = await p.evaluate(() => [document.documentElement.scrollWidth, ...[...document.querySelectorAll('.sheet')].map((x) => x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflowX !== 'hidden' ? 9999 : 0)]);
      if (Math.max(...sw) > w) wide.push(`${f}@${w}: ${sw.join('/')}`);
      if (f === 'battle.json') await p.screenshot({ path: `${out}/19-battle-${w}.png` });
    }
  }
  console.log('wide', wide.join(', ') || 'なし');
  console.log('errors', errors.join('\n') || 'なし');
  await b.close();
})();
