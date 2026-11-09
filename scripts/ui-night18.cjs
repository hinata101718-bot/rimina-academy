// 18夜目の画面撮影（最後にまとめて1回）：
//  ⓪ 札を出す画面（幅360・375・390・393・430 × 手札5・7・9）と「戦い方が新しくなりました」→ ui-hand18.cjs
//  ① 個人ページの「戦技と魔法・スキル」（熟練のゲージ・進化・連携技・スキル3つ）、記録の「育てた技」
//  ② 進化の2択と、選んだ瞬間
//  ③ 連携技：金の縁の手札・続けて選んだとき・合体の演出・結果の文、会話のあとの発見、図鑑の連携技と進化した技、遊び方の手引き
//  17夜目版のセーブのお知らせ
// 使い方：npm run build && npx vite preview のあと、npx tsx scripts/mkshots18.ts <dir> → SHOTS_DIR=<dir> node scripts/ui-night18.cjs [出力先]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night18';
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
    p.on('pageerror', (e) => errors.push(W + ' pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(W + ' console: ' + m.text()); });
    p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
    const shot = async (n, full = false) => { await p.waitForTimeout(500); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > W + 1) wide.push(prefix + n + ': ' + w + 'px'); await p.screenshot({ path: out + '/' + prefix + n + '.png', fullPage: full }); console.log('shot', prefix + n); };
    const open = async (file, keepSheets) => {
      await p.goto(URL);
      await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
      await p.reload(); await p.waitForTimeout(400);
      await p.setInputFiles('input[type=file]', path.join(dir, file));
      await p.waitForSelector('nav.tabs, .cb-view, .sheet', { timeout: 15000 }).catch(() => errors.push('timeout ' + file));
      await p.waitForTimeout(700);
      if (!keepSheets) for (let i = 0; i < 8; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("わかりました")'); if (!c) break; await c.click(); await p.waitForTimeout(200); }
    };
    const click = async (sel) => { await p.click(sel, { timeout: 5000 }).catch(() => errors.push(W + ' click ' + sel)); await p.waitForTimeout(350); };
    // ③ 連携技：手札の金の縁 → 2枚を続けて選ぶ → 出す → 合体の演出 → 結果の文
    await open('combo.json');
    const go = await p.$('.cb-view > .cb-go'); if (go) { await go.click(); await p.waitForTimeout(500); }
    await shot('01-combo-hand');
    await click('.cb-card.combo >> nth=0'); await click('.cb-card.combo:not(.on) >> nth=0');
    await shot('02-combo-selected');
    if (only) { await p.close(); return; }
    await click('.cb-btns .cb-go');
    await p.waitForSelector('.fx-combo', { timeout: 9000 }).catch(() => errors.push(W + ' 合体の演出が出ない'));
    await p.waitForTimeout(700);
    await shot('03-combo-fx');
    for (let i = 0; i < 6; i++) { const ov = await p.$('.fx-over'); if (!ov) break; await ov.click(); await p.waitForTimeout(300); }
    await p.waitForTimeout(6000); await p.click('.cb-view').catch(() => {}); await p.waitForTimeout(600);
    await p.evaluate(() => { const v = document.querySelector('.cb-view'); if (v) v.scrollTo(0, 0); });
    await shot('04-combo-result');
    // ① 個人ページ
    await open('main.json'); await click('nav.tabs button >> nth=1');
    const who = require('fs').readFileSync(path.join(dir, 'who.txt'), 'utf8').trim();
    await click('.stucard:has-text("' + who + '") >> nth=0'); await click('button:has-text("技能")');
    await p.evaluate(() => document.querySelector('.arts-card')?.scrollIntoView());
    await shot('05-arts');
    await p.evaluate(() => { const c = document.querySelector('.arts-card'); if (c) window.scrollBy(0, c.getBoundingClientRect().height - 500); });
    await shot('06-arts-combo-skills');
    // 個人ページから進化させる
    const ev = await p.$('.evo-ready'); if (ev) { await ev.click(); await p.waitForTimeout(600); await shot('07-evolve-from-page'); await click('.sheet .evo-opt >> nth=0'); await p.waitForTimeout(900); await shot('08-evolve-chosen'); await click('.sheet button:has-text("閉じる")'); } else errors.push(W + ' 進化させるがない');
    await click('button:has-text("記録")'); await p.evaluate(() => [...document.querySelectorAll('h4')].find((h) => h.textContent.includes('育てた技'))?.scrollIntoView({ block: 'center' })); await shot('09-record-evolved');
    // 図鑑：連携技と進化した技
    await click('nav.tabs button >> nth=3'); await click('.seg button:has-text("図鑑")'); await click('.seg button:text-is("技")');
    await p.evaluate(() => [...document.querySelectorAll('h4')].find((h) => h.textContent.includes('連携技'))?.scrollIntoView({ block: 'start' }));
    await shot('10-book-combo');
    // ② 進化の2択（戦いのあとの処理待ち）
    await open('evolve.json', true); await p.waitForSelector('.evo-opt', { timeout: 5000 }).catch(() => errors.push(W + ' 進化の2択が出ない')); await shot('11-evolve-pending');
    // ③ 会話のあとの発見
    await open('talk.json', true);
    for (let i = 0; i < 40; i++) { if (await p.$('.tk-combo')) break; const t = await p.$('.tplayer'); if (!t) break; await t.click(); await p.waitForTimeout(120); }
    if (!(await p.$('.tk-combo'))) errors.push(W + ' 連携技の発見が出ない');
    await shot('12-talk-combo');
    // 遊び方の手引き（連携技・技を育てる）
    await open('hand5.json'); const g2 = await p.$('.cb-view > .cb-go'); if (g2) { await g2.click(); await p.waitForTimeout(400); }
    await click('.cb-help'); await click('.mn-tab:has-text("連携技")'); await shot('13-manual-combo'); await click('.mn-tab:has-text("技を育てる")'); await shot('14-manual-evolve');
    // 17夜目版のセーブのお知らせ
    await open('v17.json', true); await shot('15-night18-notice');
    await p.close();
  };
  await run(390, '');
  await run(360, 'w360-', true);
  await run(430, 'w430-', true);
  await b.close();
  console.log('はみ出し', wide.length ? wide : 0, 'エラー', errors.length ? errors : 0);
})();
