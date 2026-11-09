// 17夜目の画面撮影（最後にまとめて1回）：案内つきの最初の札の戦い（①予告 ②かばう ③攻める・出したあと）、
// 16夜目版のセーブの「戦い方が新しくなりました」、遊び方の手引き（7ページ）、設定の「案内を見なおす」、幅360・430
// 使い方：npm run build && npx vite preview のあと、npx tsx scripts/mkshots17.ts <dir> → SHOTS_DIR=<dir> URL=<URL> node scripts/ui-night17.cjs [出力先]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night17';
const dir = process.env.SHOTS_DIR;
const URL = process.env.URL || 'http://localhost:4173/rimina-academy/';
const SCALE = Number(process.env.SCALE || 2);
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const errors = [];
  const wide = [];
  const small = [];
  const run = async (W, prefix, only) => {
    const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: SCALE });
    p.on('pageerror', (e) => errors.push(`${W} pageerror: ` + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`${W} console: ` + m.text()); });
    p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
    const check44 = async (n) => {
      const bad = await p.evaluate(() => [...document.querySelectorAll('.cb-guide button, .cb-card.gglow, .cb-go.gglow, .mn-nav button, .sheet .guide-tip ~ button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); }).map((e) => `${e.textContent.trim().slice(0, 12)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
      if (bad.length) small.push(`${prefix}${n}: ${bad.join(' / ')}`);
    };
    const shot = async (n, full = false) => { await p.waitForTimeout(600); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > W + 1) wide.push(`${prefix}${n}: ${w}px`); await check44(n); await p.screenshot({ path: `${out}/${prefix}${n}.png`, fullPage: full }); console.log('shot', prefix + n); };
    const open = async (file) => {
      await p.goto(URL);
      await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
      await p.reload(); await p.waitForTimeout(500);
      await p.setInputFiles('input[type=file]', path.join(dir, file));
      await p.waitForSelector('nav.tabs, .cb-view', { timeout: 15000 }).catch(() => errors.push('timeout ' + file));
      await p.waitForTimeout(700);
    };
    const click = async (sel) => { await p.click(sel, { timeout: 5000 }).catch(() => errors.push(`${W} click ` + sel)); await p.waitForTimeout(400); };
    const intoView = (sel) => p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
    // ① 案内つきの最初の札の戦い
    await open('tut.json');
    await click('.cb-go'); // 開戦 → 札を見る
    await p.waitForSelector('.cb-guide', { timeout: 5000 }).catch(() => errors.push(`${W} no guide`));
    await p.evaluate(() => document.querySelector('.cb-view')?.scrollTo(0, 0));
    await shot('01-guide-intent');
    if (only === 'intent') { await p.close(); return; }
    await click('.cb-gnext'); await p.waitForTimeout(500); await shot('02-guide-cover');
    // 光っていない札を押しても選べない（確かめ）
    const before = await p.$$eval('.cb-card.on', (x) => x.length);
    await p.click('.cb-card.off >> nth=0', { timeout: 2000 }).catch(() => {});
    const after = await p.$$eval('.cb-card.on', (x) => x.length);
    if (after !== before) errors.push(`${W} 光っていない札が選べた`);
    await click('.cb-card.gglow'); await p.waitForTimeout(500); await shot('03-guide-attack');
    await click('.cb-card.gglow'); await p.waitForTimeout(500); await shot('04-guide-play');
    await click('.cb-btns .cb-go'); await p.waitForTimeout(9000);
    await p.click('.cb-view').catch(() => {}); await p.waitForTimeout(800);
    await p.evaluate(() => { const v = document.querySelector('.cb-view'); if (v) v.scrollTo(0, v.scrollHeight); });
    await shot('05-guide-after');
    await click('.cb-go'); await p.waitForTimeout(600);
    if (await p.$('.cb-guide')) errors.push(`${W} 案内が残っている`);
    await shot('06-turn2-normal');
    // ② 16夜目版のセーブ：次の戦いのはじめに「戦い方が新しくなりました」
    await open('v16.json');
    for (let i = 0; i < 12; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("わかりました"), .sheet button:has-text("次へ")'); if (!c) break; await c.click(); await p.waitForTimeout(200); }
    await click('.cb-go');
    await p.waitForSelector('.sheet .guide-tip', { timeout: 5000 }).catch(() => errors.push(`${W} no offer`));
    await shot('07-offer');
    await click('.sheet button:has-text("案内を見る")'); await shot('08-offer-guide');
    // ③ 遊び方の手引き（「？」から）
    await click('.cb-guide .cb-gskip'); await p.waitForTimeout(300);
    if (await p.$('.cb-guide')) errors.push(`${W} 飛ばしても案内が残っている`);
    await click('.cb-help');
    for (let i = 0; i < 7; i++) { await shot(`09-manual-${i + 1}`); if (i < 6) await click('.mn-nav button:has-text("次へ")'); }
    await click('.mn-nav button:has-text("閉じる")');
    // ④ 設定の「案内を見なおす」と「手引きを読む」
    await open('main.json');
    for (let i = 0; i < 20; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("わかりました")'); if (!c) break; await c.click(); await p.waitForTimeout(150); }
    await click('nav.tabs button:has-text("設定")');
    await p.locator('button:has-text("案内を見なおす")').scrollIntoViewIfNeeded().catch(() => errors.push('no replay button')); await shot('10-settings');
    await p.close();
  };
  await run(390, '');
  await run(360, 'w360-', 'intent');
  await run(430, 'w430-', 'intent');
  // 幅360で手引きも
  console.log('wide:', wide.join(', ') || 'なし');
  console.log('small:', small.join('\n') || 'なし');
  console.log('errors:', errors.join('\n') || 'なし');
  await b.close();
})();
