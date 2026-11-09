// 15夜目④：1か月の操作の数（タップとスクロール）を数える。授業の20日と、月末の出撃前（依頼の掲示板が出てから戦いが始まるまで）
// 使い方：ビルドした dist を配って、node scripts/tapcount15.cjs <URL> <セーブ.json> [ラベル]
// 数え方：押す物が画面の外にあれば「スクロール1回」と数えてから押す。会話は「スキップ」、結果は「次へ」「閉じる」で進める（どの版でも同じ）
const { chromium } = require('playwright');
const [url, file, label = ''] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url); await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy')); await p.reload(); await p.waitForTimeout(600);
  await p.setInputFiles('input[type=file]', file);
  await p.waitForSelector('nav.tabs', { timeout: 15000 }); await p.waitForTimeout(600);
  // 読みこみのお知らせ（「〇夜目の新しいこと」）は数えない
  for (let i = 0; i < 10; i++) { const c = await p.$('.overlay .sheet button.btn.primary'); if (!c) break; await c.click(); await p.waitForTimeout(200); }
  const n = { dayTap: 0, dayScroll: 0, sortieTap: 0, sortieScroll: 0, days: 0 };
  let phase = 'day';
  const tap = async (el, pos) => {
    const inView = await el.evaluate((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0; });
    if (!inView) { n[phase + 'Scroll']++; await el.scrollIntoViewIfNeeded(); }
    n[phase + 'Tap']++;
    if (process.env.DEBUG) console.log(phase, (await el.evaluate((e) => (e.className + ' ' + e.textContent).slice(0, 60))));
    await el.click(pos ? { position: pos } : undefined); await p.waitForTimeout(160);
  };
  const vis = async (sel) => { for (const e of await p.$$(sel)) if (await e.isVisible()) return e; return null; };
  const title = async () => (await p.$$eval('.overlay .sheet h2', (es) => (es.length ? es[es.length - 1].textContent : '')).catch(() => '')) || '';
  for (let g = 0; g < Number(process.env.MAXG || 600); g++) {
    if (await p.$('.ab-view, .battle')) break;
    const t = await title();
    if (/月末の依頼掲示板|月末の出撃|出撃前：|部隊：/.test(t) || (await p.$('.sticky-go'))) phase = 'sortie';
    if (phase === 'sortie') {
      const sticky = await vis('.sticky-go');
      if (sticky) { await tap(sticky); continue; }
      if (/月末の依頼掲示板/.test(t)) { await tap(await vis('.overlay .sheet .pcard.tap')); continue; }
      const go = await vis('.overlay .sheet button.btn.accent');
      if (go) { await tap(go); continue; }
      console.log('sortie: 押すものがない', t); break;
    }
    if (await p.$('.overlay')) {
      const btn = (await vis('.overlay .sheet button.btn.primary')) || (await vis('.overlay button:has-text("スキップ")')) || (await vis('.overlay .sheet button.btn.block')) || (await vis('.overlay .sheet button.btn.accent'));
      if (btn) { await tap(btn); continue; }
      const sh = (await vis('.overlay .sheet')) || (await vis('.overlay'));
      if (sh) { n.dayTap++; if (process.env.DEBUG) console.log('sheet-click'); await sh.click({ position: { x: 30, y: 30 } }).catch(() => undefined); await p.waitForTimeout(160); continue; }
    }
    const cmd = await vis('.command');
    if (cmd) { await tap(cmd); continue; }
    const card = (await vis('.lcard:has(.lc-rec)')) || (await vis('.lcard'));
    if (card) {
      await tap(card, { x: 12, y: 12 }); // 札の顔を押すと顔の説明が出るので、札の左上を押す
      const go = await vis('.lessonbar .btn.primary');
      if (go) { await tap(go); n.days++; }
      await p.waitForTimeout(250);
      continue;
    }
    // 迷ったらホームへ
    n.dayTap++; await p.click('nav.tabs button >> nth=0'); await p.waitForTimeout(200);
  }
  const per20 = (x) => Math.round((x / Math.max(1, n.days)) * 20);
  console.log(JSON.stringify({ label, ...n, dayTapPer20: per20(n.dayTap), dayScrollPer20: per20(n.dayScroll), errors }));
  await b.close();
})();
