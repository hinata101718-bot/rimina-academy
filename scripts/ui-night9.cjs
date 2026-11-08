// 9夜目の画面撮影：3部隊の出撃前・策の選択・戦いの記録（必殺・撃破・宿命の対決）・組織図と変化・結果の評価
// 使い方：npx vite を起動し、npx tsx scripts/mkshots9.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night9.cjs [出力先=docs/screenshots/night9]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night9';
const dir = process.env.SHOTS_DIR;
const W = Number(process.env.W || 390);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: Number(process.env.DPR || 2) });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { await p.waitForTimeout(450); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > W) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const open = async (file, keep) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForSelector('nav.tabs, .ab-view', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(700);
    if (!keep) await closeAll();
  };
  const closeAll = async () => { for (let i = 0; i < 16; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("OK"), .sheet button:has-text("丁重に断る")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const click = async (sel) => { await p.click(sel).catch((e) => errors.push('click ' + sel)); await p.waitForTimeout(350); };
  const tab = async (i) => { await click(`nav.tabs button >> nth=${i}`); };
  const want = (k) => !ONLY || ONLY.includes(k);
  if (want('board')) {
    await open('board.json', true);
    await closeAll();
    await shot('01-sortie-squads');
    await click('.sq-card >> nth=0 >> .tap');
    await shot('02-squad-editor');
    await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.includes('策')); h && h.scrollIntoView(); });
    await shot('03-strat-select');
    await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.includes('陣形')); h && h.scrollIntoView(); });
    await shot('04-formation');
  }
  const got = new Set();
  const playBattle = async (file, prefix) => {
    await open(file, true); await p.waitForTimeout(800);
    for (let i = 0; i < 6; i++) await click('.bl-log');
    if (!got.has('log')) { got.add('log'); await shot(`${prefix}-battle-log`); }
    for (let i = 0; i < 400; i++) {
      for (const [sel, name] of [['.fx-cutin', '06-crit-cutin'], ['.fx-kill', '07-kill-stamp'], ['.fx-vs', '08-fate-duel'], ['.fx-fall', '09-student-fall']]) {
        if (!got.has(name) && await p.$(sel)) { got.add(name); await p.waitForTimeout(sel === '.fx-kill' ? 250 : 600); await p.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); }
      }
      if (await p.$('.fx-over')) { await p.click('.fx-over').catch(() => undefined); await p.waitForTimeout(150); continue; }
      if (await p.$('.ab-copt')) { if (!got.has('choice')) { got.add('choice'); await shot(`${prefix}-choice`); } await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(400); continue; }
      const end = await p.$('.ab-endbtn');
      if (end) { const txt = await end.textContent(); if (!got.has('fresh')) { got.add('fresh'); } await end.click(); await p.waitForTimeout(800); if (txt.includes('結果')) break; continue; }
      await p.click('.bl-log').catch(() => undefined); await p.waitForTimeout(140);
      if (i === 30 && !got.has('cards')) { got.add('cards'); await shot('05b-attack-cards'); }
    }
  };
  if (want('battle')) {
    await playBattle('duel.json', '05');
    if (!got.has('06-crit-cutin') || !got.has('07-kill-stamp')) await playBattle('battle.json', '05c');
    if (await p.$('.sheet')) await shot('10b-after-battles');
  }
  if (want('result')) {
    await open('result.json', true);
    await shot('10-sortie-result');
    await click('.sheet .btn.primary'); await p.waitForTimeout(300);
    for (let i = 0; i < 12; i++) { if (await p.$('.ev-card')) break; const c = await p.$('.sheet button:has-text("スキップ"), .sheet button:has-text("次へ"), .sheet button:has-text("閉じる")'); if (!c) break; await c.click(); await p.waitForTimeout(250); }
    await p.evaluate(() => document.querySelector('.ev-card')?.scrollIntoView());
    await shot('11-evals');
  }
  if (want('strat')) { await open('strat.json', true); await p.waitForTimeout(900); await shot('12-new-strat'); }
  if (want('org')) {
    await open('org.json');
    await tab(2); await click('button:has-text("敵将の名簿")');
    const dot = await p.$('.ofc-tabs button:has(.org-dot)'); if (dot) { await dot.click(); await p.waitForTimeout(400); }
    await shot('20-orgchart'); await shot('20b-orgchart-full', true);
    await click('.org-playbtn'); await p.waitForTimeout(1400); await shot('21-org-change-play');
    await click('.org-player'); await p.waitForTimeout(1400); await shot('22-org-change-play2');
  }
  if (want('ui')) {
    await open('org.json');
    await tab(0); await click('.command'); await shot('30-today-lessons');
    await tab(1); await shot('31-roster');
    await click('.stucard >> nth=0'); await shot('32-detail');
  }
  console.log('wide', wide.join(', ') || 'なし');
  console.log('errors', errors.join('\n') || 'なし');
  await b.close();
})();
