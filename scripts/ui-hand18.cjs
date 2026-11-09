// 18夜目⓪の点検：札を出す画面で、手札が1行・札どうしが重ならない・ボタンにかぶらない・はみ出さない・文字12px以上（幅360・375・390・393・430）
// 使い方：npm run build && npx vite preview のあと、npx tsx scripts/mkshots18.ts <dir> → SHOTS_DIR=<dir> node scripts/ui-hand18.cjs [撮影の出力先（なければ撮らない）]
const { chromium } = require('playwright');
const path = require('path');
const dir = process.env.SHOTS_DIR;
const URL = process.env.URL || 'http://localhost:4173/rimina-academy/';
const out = process.argv[2];
(async () => {
  if (out) require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const issues = [];
  const errors = [];
  for (const W of [360, 375, 390, 393, 430]) for (const f of ['hand5', 'hand7', 'hand9', 'offer']) {
    const H = W === 375 ? 667 : 844;
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: out ? 2 : 1 });
    p.on('pageerror', (e) => errors.push(W + ' ' + f + ' pageerror: ' + e.message));
    p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
    await p.goto(URL);
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(400);
    await p.setInputFiles('input[type=file]', path.join(dir, f + '.json'));
    await p.waitForSelector('.cb-view', { timeout: 15000 }).catch(() => errors.push(W + ' ' + f + ' no cb-view'));
    await p.waitForTimeout(500);
    for (let i = 0; i < 6; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("わかりました")'); if (!c) break; await c.click(); await p.waitForTimeout(200); }
    const go = await p.$('.cb-view > .cb-go'); if (go) { await go.click(); await p.waitForTimeout(500); }
    if (f === 'offer') {
      const offer = await p.$('.overlay.top .guide-tip');
      if (!offer) issues.push(W + ' offer: お知らせが出ない');
      if (out) await p.screenshot({ path: out + '/w' + W + '-offer.png' });
      await p.close(); continue;
    }
    // 2枚選ぶ（持ち上がった札もかぶらないか）
    const cards = await p.$$('.cb-hand .cb-card:not(.off)');
    for (const c of cards.slice(0, 2)) { await c.click(); await p.waitForTimeout(120); }
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const rect = (e) => e.getBoundingClientRect();
      const cs = [...document.querySelectorAll('.cb-hand .cb-card')].map(rect);
      const btn = rect(document.querySelector('.cb-btns'));
      const peek = rect(document.querySelector('.cb-peek'));
      let overlap = 0;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i], c = cs[j]; if (a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom && c.top < a.bottom) overlap++; }
      const minW = Math.min(...cs.map((x) => x.width));
      const overBtn = cs.filter((x) => x.bottom > btn.top + 0.5).length;
      const overPeek = cs.filter((x) => x.top < peek.bottom - 0.5).length;
      const small = [...document.querySelectorAll('.cb-hand .cb-card *')].filter((e) => e.textContent.trim() && e.children.length === 0 && parseFloat(getComputedStyle(e).fontSize) < 12).length;
      const scrollW = document.documentElement.scrollWidth;
      const h = document.querySelector('.cb-hand');
      const handScroll = h.scrollWidth > h.clientWidth + 1;
      const lefts = cs.map((x) => Math.round(x.bottom));
      return { n: cs.length, rows: new Set(cs.map((x) => Math.round(x.top + 10 * 0))).size > 2 ? 3 : 1, lefts, overlap, minW: Math.round(minW), overBtn, overPeek, small, scrollW, handScroll, btnBottom: Math.round(btn.bottom), vh: innerHeight };
    });
    const bad = [];
    if (r.overlap) bad.push('重なり ' + r.overlap);
    if (r.minW < 44) bad.push('幅 ' + r.minW + 'px');
    if (r.overBtn) bad.push('ボタンにかぶる ' + r.overBtn);
    if (r.overPeek) bad.push('説明の帯にかぶる ' + r.overPeek);
    if (r.small) bad.push('12px未満の文字 ' + r.small);
    if (r.scrollW > W + 1) bad.push('はみ出し ' + r.scrollW);
    if (r.btnBottom > r.vh + 1) bad.push('ボタンが画面の外 ' + r.btnBottom + '/' + r.vh);
    console.log(W + 'x' + H + ' ' + f + ': 札' + r.n + ' 最小幅' + r.minW + ' 横スクロール' + (r.handScroll ? 'あり' : 'なし') + ' ' + (bad.length ? 'NG ' + bad.join('・') : 'OK'));
    if (bad.length) issues.push(W + ' ' + f + ': ' + bad.join('・'));
    if (out) await p.screenshot({ path: out + '/w' + W + '-' + f + '.png' });
    await p.close();
  }
  await b.close();
  console.log('点検', issues.length ? issues : 'すべてOK', 'エラー', errors.length ? errors : 0);
})();
