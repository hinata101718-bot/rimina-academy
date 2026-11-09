// 15夜目の画面撮影：ホーム（手帳・書状）、手帳の頁、郵便受け、授業、月末の出撃（1部隊・3部隊・出撃前のたたみ）、設定、武器庫、
// 年鑑の図鑑（兵種・技・武器・敵将）、戦況、組織図、個人ページの戦技と魔法・スキル、兵種試験、14夜目版のセーブのお知らせ、主な画面の幅360・390・430
// 使い方：ビルドした dist を配って、npx tsx scripts/mkshots15.ts <dir> のあと SHOTS_DIR=<dir> URL=<URL> node scripts/ui-night15.cjs [出力先=docs/screenshots/night15]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night15';
const dir = process.env.SHOTS_DIR;
const URL = process.env.URL || 'http://localhost:5173/rimina-academy/';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const wide = [];
  const shot = async (n, full = false) => { await p.waitForTimeout(450); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > p.viewportSize().width + 1) wide.push(`${n}: ${w}px`); await p.screenshot({ path: `${out}/${n}.png`, fullPage: full }); console.log('shot', n); };
  const closeAll = async () => { for (let i = 0; i < 20; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("丁重に断る")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const open = async (file, keep) => {
    await p.goto(URL);
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForSelector('nav.tabs, .ab-view', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(700);
    if (!keep) await closeAll();
  };
  const click = async (sel) => { await p.click(sel).catch(() => errors.push('click ' + sel)); await p.waitForTimeout(350); };
  const tab = async (i) => { await click(`nav.tabs button >> nth=${i}`); };

  // 14夜目版のセーブを読みこんだときのお知らせ
  await open('v14.json', true); await shot('00-night15-notice');
  // ① ホーム・手帳・書状
  await open('main.json');
  await shot('01-home');
  await click('.desknote .dn-title'); await shot('02-notebook', true);
  await click('button:has-text("戻る")'); await click('.deskletter'); await shot('03-mailbox');
  const merged = await p.$('.pcard.tap:has-text("今月の誕生日")'); if (merged) { await merged.click(); await p.waitForTimeout(300); await merged.scrollIntoViewIfNeeded(); await shot('03b-mail-birthday'); }
  await click('button:has-text("すべて読んだ")'); await click('button:has-text("戻る")'); await shot('04-home-after-read');
  // ① 授業
  await click('.command'); await shot('05-lesson');
  await click('.lb-help'); await shot('05b-lesson-help');
  // ① 出撃前
  await open('board1.json', true); await shot('06-sortie-board-1squad');
  await click('.overlay .sheet .pcard.tap'); await shot('07-sortie-prep-folded');
  await click('.sq-fold .btn'); await shot('07b-sortie-prep-open');
  await open('board3.json', true); await shot('08-sortie-3squads');
  // ① 設定
  await open('main.json'); await tab(4); await p.evaluate(() => { const d = [...document.querySelectorAll('details.fold')][0]; if (d) { d.open = true; d.scrollIntoView(); } }); await shot('09-settings-manual-fold');
  // ③ 武器庫
  await tab(0); await click('.drawer:has-text("武器庫")'); await shot('10-armory');
  await click('.shelf.rar-rare .shelf-head'); await click('.shelf.rar-rare .ruled.tap >> nth=0'); await shot('10b-armory-rare-open');
  // ③ 年鑑の図鑑
  await tab(3); await click('.seg button:has-text("図鑑")'); await shot('11-book-class');
  for (const [k, n] of [['技', '12-book-art'], ['武器', '13-book-weapon'], ['敵将', '14-book-officer']]) { await click(`.seg button:text-is("${k}")`); await shot(n); }
  await click('.seg button:has-text("記録")'); await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('因縁の敵将'))?.scrollIntoView()); await shot('15-records-nemesis-line');
  // ② 戦況
  await tab(2); await shot('16-war', true);
  await click('button:has-text("敵将の名簿")'); await shot('17-orgchart');
  // 途中の追加：個人ページの戦技と魔法・スキル
  await tab(1);
  const caster = await p.$('.stucard:has-text("魔")'); await (caster ?? (await p.$('.stucard'))).click(); await p.waitForTimeout(400);
  await click('button:has-text("技能")'); await p.evaluate(() => document.querySelector('.arts-card')?.scrollIntoView()); await shot('18-arts-and-spells');
  // ③ 兵種試験（2タップ）：手帳の「兵種試験」の行 → 兵種を選ぶ → 演出
  await tab(0); const ex = await p.$('.desknote li:has-text("兵種試験")'); if (ex) { await ex.click(); await p.waitForTimeout(500); await shot('19-exam-sheet'); await click('.sheet .pcard button.btn.primary >> nth=0'); await p.waitForTimeout(600); await shot('20-exam-done'); }

  // ④ 主な画面の幅360・390・430
  const checked = [];
  const measure = async (name, w) => {
    await p.waitForTimeout(300);
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
    await open('main.json');
    await measure('ホーム', w);
    if (w === 390) { const fit = await p.evaluate(() => { const c = document.querySelector('.command'); return c ? c.getBoundingClientRect().bottom : 9999; }); if (fit > 844 - 64) wide.push(`ホーム@390x844: 授業の札が画面の外（${Math.round(fit)}px）`); }
    await click('.desknote .dn-title'); await measure('教官手帳', w); await click('button:has-text("戻る")');
    await click('.deskletter'); await measure('郵便受け', w); await click('button:has-text("戻る")');
    await click('.command'); await measure('授業', w); await click('button:has-text("戻る")');
    await click('.drawer:has-text("武器庫")'); await click('.shelf.rar-rare .shelf-head'); await measure('武器庫', w); await click('button:has-text("戻る")');
    await click('.drawer:has-text("施設")'); await measure('施設・講師', w); await click('button:has-text("戻る")');
    await tab(1); await measure('名簿', w);
    await click('.stucard >> nth=0');
    for (const tb of ['能力', '技能', '人柄', '関係', '記録']) { await click(`button:has-text("${tb}")`); await measure(`個人ページ・${tb}`, w); }
    await tab(2); await measure('戦況', w);
    await click('button:has-text("敵将の名簿")'); await measure('組織図', w);
    await tab(3); await measure('年鑑', w);
    await click('.seg button:has-text("図鑑")'); for (const k of ['兵種', '技', '武器', '敵将']) { await click(`.seg button:text-is("${k}")`); await measure(`図鑑・${k}`, w); }
    for (const tb of ['振り返り', '記録', '年表']) { await click(`.seg button:has-text("${tb}")`); await measure(`年鑑・${tb}`, w); }
    await tab(4); await measure('設定', w);
    await open('board1.json', true); await measure('月末の掲示板（1部隊）', w);
    await click('.overlay .sheet .pcard.tap'); await measure('出撃前（たたんだ）', w); await click('.sq-fold .btn'); await measure('出撃前（開いた）', w);
    if (w !== 390) await p.screenshot({ path: `${out}/21-sortie-prep-${w}.png` });
    await open('board3.json', true); await measure('月末の出撃（3部隊）', w);
    if (w !== 390) await p.screenshot({ path: `${out}/22-sortie-3squads-${w}.png` });
  }
  console.log('checked', checked.length, '画面×幅');
  console.log('wide', wide.join('\n') || 'なし');
  console.log('errors', [...new Set(errors)].join('\n') || 'なし');
  await b.close();
})();
