// 16夜目の画面撮影（最後にまとめて1回）：出撃前の山札、札の戦い（開戦・札を出す・札を選んだ・結果・ここぞの判断・決着）、
// 遊び方、個人ページの戦技と魔法・スキル（条件の印・＋）、技の図鑑、15夜目版のセーブのお知らせ、幅360・430
// 使い方：npm run build のあと dist を配って、npx tsx scripts/mkshots16.ts <dir> のあと SHOTS_DIR=<dir> URL=<URL> node scripts/ui-night16.cjs [出力先]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night16';
const dir = process.env.SHOTS_DIR;
const URL = process.env.URL || 'http://localhost:4173/rimina-academy/';
const SCALE = Number(process.env.SCALE || 2);
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const errors = [];
  const wide = [];
  const run = async (W, prefix, only) => {
    const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: SCALE });
    p.on('pageerror', (e) => errors.push(`${W} pageerror: ` + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`${W} console: ` + m.text()); });
    p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
    const shot = async (n, full = false) => { await p.waitForTimeout(500); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > W + 1) wide.push(`${prefix}${n}: ${w}px`); await p.screenshot({ path: `${out}/${prefix}${n}.png`, fullPage: full }); console.log('shot', prefix + n); };
    const closeAll = async () => { for (let i = 0; i < 20; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("丁重に断る")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
    const open = async (file, keep) => {
      await p.goto(URL);
      await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
      await p.reload(); await p.waitForTimeout(500);
      await p.setInputFiles('input[type=file]', path.join(dir, file));
      await p.waitForSelector('nav.tabs, .cb-view', { timeout: 15000 }).catch(() => errors.push('timeout ' + file));
      await p.waitForTimeout(700);
      if (!keep) await closeAll();
    };
    const click = async (sel) => { await p.click(sel, { timeout: 5000 }).catch(() => errors.push(`${W} click ` + sel)); await p.waitForTimeout(350); };
    // 札の戦い：開戦 → 札を出す
    await open('open.json', true); await shot('01-battle-open');
    await click('.cb-go'); await shot('02-battle-play');
    if (only) { await p.close(); return; }
    await click('.cb-help'); await shot('03-battle-help'); await click('.sheet button:has-text("閉じる")');
    // 札を2枚選ぶ・敵を押して狙う
    await click('.cb-card >> nth=0'); await click('.cb-card >> nth=1'); await click('.cb-foe >> nth=0'); await shot('04-battle-selected');
    await click('.cb-btns .cb-go'); await p.waitForTimeout(1500); await shot('05-battle-fx');
    await p.waitForTimeout(12000); await shot('06-battle-result', true);
    // ここぞの判断（一騎打ち・宿命の対決の演出のあと）
    await open('later.json', true); await p.waitForTimeout(300); await shot('07-battle-duel-fx');
    const ov = await p.$('.fx-over'); if (ov) { await ov.click(); await p.waitForTimeout(500); }
    await shot('07b-battle-choice');
    // おまかせで最後まで → 決着 → 結果
    await open('play.json', true); await click('.cb-btns button:has-text("最後まで")'); await p.waitForTimeout(1200); await shot('08-battle-end');
    await click('.cb-go'); await p.waitForTimeout(1200); await shot('09-after-battle');
    // 出撃前の山札
    await open('board.json', true); await click('.sheet .tap:has-text("タップして組む") >> nth=0'); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('.cb-deck')?.scrollIntoView()); await click('.cb-deck > .btn'); await p.evaluate(() => document.querySelector('.cb-deck')?.scrollIntoView()); await shot('10-sortie-deck');
    // 個人ページの戦技と魔法・スキル（条件の印・＋）と、技の図鑑
    await open('main.json'); await click('nav.tabs button >> nth=1');
    await click('.stucard >> nth=0'); await click('button:has-text("技能")'); await p.evaluate(() => document.querySelector('.arts-card')?.scrollIntoView()); await shot('12-arts', false);
    await click('nav.tabs button >> nth=3'); await click('.seg button:has-text("図鑑")'); await click('.seg button:text-is("技")'); await shot('13-book-arts');
    // 15夜目版のセーブのお知らせ
    await open('v15.json', true); await shot('11-night16-notice');
    await p.close();
  };
  await run(390, '');
  await run(360, 'w360-', true);
  await run(430, 'w430-', true);
  console.log('wide:', wide.join(', ') || 'なし');
  console.log('errors:', errors.join('\n') || 'なし');
  await b.close();
})();
