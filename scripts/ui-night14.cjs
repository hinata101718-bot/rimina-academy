// 14夜目の画面撮影：案内（机の案内・3枚だけの1日目・案内の吹き出し・最初の面談・最初の出撃）、ホームの手帳の赤い字、
// 武器庫の棚と図鑑・伝説の武器、1年の振り返り、戦技と心得の札、引き継ぎの文字、戦いの画面（雑兵の札）、主な画面の幅360・390・430
// 使い方：npx vite を起動し、npx tsx scripts/mkshots14.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night14.cjs [出力先=docs/screenshots/night14]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night14';
const dir = process.env.SHOTS_DIR;
const W = 390;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { await p.waitForTimeout(500); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > p.viewportSize().width + 1) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const closeAll = async () => { for (let i = 0; i < 20; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("わかりました"), .sheet button:has-text("丁重に断る"), .rv-sheet button:has-text("とばす")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const open = async (file, keep) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForSelector('nav.tabs, .ab-view, .legend-wrap, .rv-overlay', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(700);
    if (!keep) await closeAll();
  };
  const click = async (sel) => { await p.click(sel).catch(() => errors.push('click ' + sel)); await p.waitForTimeout(350); };
  const tab = async (i) => { await click(`nav.tabs button >> nth=${i}`); };

  // ---- ① 最初の1時間の案内 ----
  await open('tour.json', true);
  await shot('01-tour-start');
  await click('.desktour'); await shot('02-tour-note');
  for (let i = 0; i < 5; i++) await click('.desktour');
  await shot('03-tour-command');
  await click('.desktour');
  await click('.command'); await shot('04-first-day-3cards');
  await open('lesson.json', true);
  await shot('05-first-lesson-result');
  for (let i = 0; i < 12 && !(await p.$('.guide-tip')); i++) { const nx = await p.$('.sheet button.primary, .sheet button:has-text("次へ"), .sheet button:has-text("閉じる")'); if (!nx) break; await nx.click(); await p.waitForTimeout(300); }
  await shot('06-guide-lesson1');
  await open('talk.json', true);
  for (let i = 0; i < 6 && !(await p.$('.tchoice')); i++) { await p.click('.sheet', { position: { x: 100, y: 100 } }).catch(() => undefined); await p.waitForTimeout(400); }
  await shot('07-first-talk-choice');
  await open('board.json', true); await shot('08-guide-quest');
  await closeAll(); await shot('09-first-quest-board');

  // ---- 途中の追加：ホーム（作戦地図をなくし、手帳の赤い字） ----
  await open('main.json');
  await shot('10-home-no-map');
  await click('.desknote li.red >> nth=0'); await p.waitForTimeout(900); await shot('11-map-change-from-note');
  // ---- ③ 武器庫 ----
  await open('main.json');
  await click('.drawer:has-text("武器庫")'); await shot('12-armory-shelves', true);
  await click('.wcard >> nth=0'); await shot('13-armory-card-open');
  await click('button:has-text("武器の図鑑")'); await shot('14-weapon-book', true);
  await open('legend.json', true); await p.waitForTimeout(900); await shot('15-legend-1');
  for (let i = 0; i < 4; i++) { await p.click('.legend-wrap'); await p.waitForTimeout(500); }
  await shot('16-legend-lore');
  await open('main.json'); await tab(3); await click('button:has-text("記録")'); await p.evaluate(() => [...document.querySelectorAll('h3')].find((x) => x.textContent.includes('伝説の武器の行方'))?.scrollIntoView()); await shot('17-legend-whereabouts');
  // ---- ② 1年の振り返り ----
  await open('review.json', true); await shot('18-review-1');
  for (let i = 2; i <= 6; i++) { if (!(await p.$('.rv-overlay'))) break; await p.click('.rv-overlay', { position: { x: 20, y: 20 } }); await p.waitForTimeout(500); if (await p.$('.rv-overlay')) await shot(`18-review-${i}`); }
  await open('main.json'); await tab(3); await click('button:has-text("振り返り")'); await shot('19-yearbook-reviews');
  // ---- 途中の追加：戦技と心得 ----
  await tab(1); await click('.stucard >> nth=0'); await click('button:has-text("技能")');
  await p.evaluate(() => document.querySelector('.arts-card')?.scrollIntoView()); await shot('20-arts-card');
  await click('.art-tile >> nth=0'); await shot('21-art-detail');
  await closeAll();
  // ---- ④ 引き継ぎの文字 ----
  await tab(4); await click('button:has-text("引き継ぎの文字を作る")'); await p.waitForTimeout(1200); await shot('22-transfer-code');
  await p.goto('http://localhost:5173/rimina-academy/'); await p.waitForTimeout(800); await click('button:has-text("引き継ぎの文字を貼りつける")'); await shot('23-title-paste');
  // ---- 戦いの画面（雑兵は兵種の印の札） ----
  await open('battle.json', true); await p.waitForTimeout(800);
  for (let i = 0; i < 10; i++) { await p.click('.dq-msg').catch(() => undefined); await p.waitForTimeout(250); }
  await shot('24-battle-grunt-cards');

  // ---- ⑨ 主な画面の幅360・390・430 ----
  const checked = [];
  const measure = async (name, w) => {
    await p.waitForTimeout(350);
    const r = await p.evaluate(() => {
      const de = document.documentElement;
      const bad = [...document.querySelectorAll('.sheet, .ab-view, .content')].map((x) => ({ c: x.className, sw: x.scrollWidth, cw: x.clientWidth, ox: getComputedStyle(x).overflowX })).filter((x) => x.sw > x.cw + 1 && x.ox !== 'hidden' && x.ox !== 'clip');
      return { doc: de.scrollWidth, bad: bad.map((x) => `${x.c.split(' ')[0]}:${x.sw}`) };
    });
    checked.push(`${name}@${w}`);
    if (r.doc > w || r.bad.length) wide.push(`${name}@${w}: ページ${r.doc}px ${r.bad.join(' ')}`);
  };
  for (const w of [360, 390, 430]) {
    await p.setViewportSize({ width: w, height: 844 });
    await open('tour.json', true); await measure('ホーム（机の案内）', w);
    await open('main.json');
    await measure('ホーム', w);
    if (w === 390) { const fit = await p.evaluate(() => { const c = document.querySelector('.command'); return c ? c.getBoundingClientRect().bottom : 9999; }); if (fit > 844 - 64) wide.push(`ホーム@390x844: 授業の札が画面の外（${Math.round(fit)}px）`); }
    await click('.command'); await measure('授業', w); await click('button:has-text("戻る")');
    await click('.drawer:has-text("武器庫")'); await measure('武器庫', w); await click('button:has-text("武器の図鑑")'); await measure('武器の図鑑', w); await click('button:has-text("戻る")');
    await tab(1); await measure('名簿', w);
    await click('.stucard >> nth=0');
    for (const tb of ['能力', '技能', '人柄', '関係', '記録']) { await click(`button:has-text("${tb}")`); await measure(`個人ページ・${tb}`, w); }
    await tab(2); await measure('戦況', w);
    await click('button:has-text("敵将の名簿")'); await measure('組織図', w);
    await tab(3); await measure('年鑑', w);
    for (const tb of ['振り返り', '記録']) { await click(`button:has-text("${tb}")`); await measure(`年鑑・${tb}`, w); }
    await tab(4); await measure('設定', w);
    await open('review.json', true); await measure('1年の振り返り', w);
    await open('legend.json', true); await measure('伝説の武器', w);
    await open('battle.json', true); await measure('戦いの画面', w);
    if (w !== 390) await p.screenshot({ path: `${out}/25-battle-${w}.png` });
    await open('board.json', true); await closeAll(); await measure('最初の出撃', w);
  }
  console.log('checked', checked.length, '画面×幅');
  console.log('wide', wide.join('\n') || 'なし');
  console.log('errors', [...new Set(errors)].join('\n') || 'なし');
  await b.close();
})();
