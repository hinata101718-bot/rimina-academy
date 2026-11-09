// 19夜目の画面の撮影（最後にまとめて1回）：node scripts/shots19.cjs（先に npm run build と vite preview --port 4173）
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night19';
const URL = 'http://localhost:4173/rimina-academy/?debug';
fs.mkdirSync(OUT, { recursive: true });
const report = [];

async function page(b, w) {
  const p = await b.newPage({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2 });
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => !!window.__rimina, null, { timeout: 15000 });
  await p.waitForTimeout(700);
  return p;
}
async function check(p, name) {
  const r = await p.evaluate(() => {
    const over = document.documentElement.scrollWidth > window.innerWidth + 1;
    const small = [...document.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && x.height > 0 && (x.height < 43.5 || x.width < 43.5) && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.tb-board'); }).length;
    // 札どうしの重なり
    const cards = [...document.querySelectorAll('.tb-card')].map((c) => c.getBoundingClientRect());
    let overlap = 0;
    for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) { const a = cards[i], c = cards[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) overlap++; }
    const tiny = [...document.querySelectorAll('body *')].filter((e) => { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; const fs = parseFloat(getComputedStyle(e).fontSize); return fs < 11.5 && e.getBoundingClientRect().width > 0; }).length;
    return { over, small, overlap, tiny, cards: cards.length };
  });
  report.push({ name, ...r, errors: p.errs.slice(0, 3) });
}
async function shot(p, name) { await p.screenshot({ path: `${OUT}/${name}.png` }); await check(p, name); }
async function closeGuide(p) { for (let i = 0; i < 4; i++) { const g = await p.$('.tb-guide button'); if (!g) break; await g.click(); await p.waitForTimeout(150); } }

(async () => {
  const b = await chromium.launch();
  // ---- 1. 着任の道中の戦い（3つの幅） ----
  for (const w of [360, 390, 430]) {
    const p = await page(b, w);
    await p.waitForTimeout(800);
    await p.evaluate(() => { const R = window.__rimina; const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 19 }); R.store.setGame(g); });
    await p.waitForSelector('.tb-wrap', { timeout: 10000 });
    await p.waitForTimeout(2600);
    await shot(p, `01-opening-guide-${w}`);
    await closeGuide(p);
    await p.waitForTimeout(300);
    const u = (await p.$$('.tb-u.me:not(.teacher)'))[0];
    const bx = await u.boundingBox();
    await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
    await p.waitForTimeout(300);
    await shot(p, `02-opening-select-${w}`);
    await p.close();
  }
  // ---- 2. 宿敵戦（直接タップで札が並んだところ・1対1・ブレイク） ----
  for (const w of [360, 390, 430]) {
    const p = await page(b, w);
    await p.evaluate(() => {
      const R = window.__rimina;
      const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 7, opening: false });
      R.auto.autoYears(g, 2);
      g.pending = [];
      let bonded = R.nemesis.bondedOfficers(g);
      const o = bonded[0] ?? g.officers.find((x) => x.status === 'active' && x.kind !== 'monster');
      R.flow.freshQuests(g);
      const q = g.quests.find((x) => x.real) ?? g.quests[0];
      q.nemesisId = o.id; q.nemesisKind = 'quest'; q.objective = 'boss';
      const sq = R.sortie.recommendSquad(g, q, true);
      g.battle = R.flow.buildBattle(g, q, sq.deploy);
      // 撮るために、教え子の1人を宿敵の近くに置き、盾を1つに
      const bs = g.battle.units.find((x) => x.boss);
      const me = g.battle.units.find((x) => x.side === 'me' && !x.teacher);
      me.x = bs.x; me.y = Math.min(7, bs.y + 2);
      bs.sh = 1; if (!bs.weak.includes(me.type)) bs.weak = [me.type, ...bs.weak.slice(0, 1)]; bs.known = [me.type];
      R.store.setGame(g);
      window.__meUid = me.uid;
    });
    await p.waitForTimeout(3200);
    await closeGuide(p);
    await p.waitForTimeout(300);
    if (w === 390) await shot(p, `03-nemesis-start-${w}`);
    const meUid = await p.evaluate(() => window.__meUid);
    const units = await p.$$('.tb-u.me:not(.teacher)');
    let picked = null;
    for (const u of units) { const bx = await u.boundingBox(); await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.waitForTimeout(200); if (await p.$('.tb-cell.tgt')) { picked = u; break; } }
    const boss = await p.$('.tb-u.boss');
    if (boss) { const bx = await boss.boundingBox(); await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); }
    await p.waitForTimeout(400);
    await shot(p, `04-nemesis-cards-${w}`);
    if (w === 390) {
      const card = await p.$('.tb-card.weak:not([disabled])') ?? await p.$('.tb-card:not([disabled])');
      if (card) {
        await card.click();
        await p.waitForTimeout(450);
        await shot(p, `05-nemesis-duel-${w}`);
        await p.waitForTimeout(700);
        await shot(p, `06-nemesis-break-${w}`);
        await p.waitForTimeout(2600);
        await shot(p, `07-nemesis-after-${w}`);
      }
    }
    void meUid; void picked;
    await p.close();
  }
  // ---- 3. 因縁の帳（再会：昔の札と今の札）・帳の頁 ----
  {
    const p = await page(b, 390);
    await p.evaluate(() => {
      const R = window.__rimina;
      const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 23, opening: false });
      R.auto.autoYears(g, 4);
      g.pending = [];
      const o = R.nemesis.bondedOfficers(g).find((x) => x.lastCard) ?? g.officers.find((x) => x.lastCard);
      if (o) { o.lastCard = { ...o.lastCard, wounds: Math.max(0, (o.wounds ?? []).length - 1), level: o.level - 3 }; R.nemesis.pushReunion(g, o, [], 'reunion', [`依頼の先に、${o.given}がいる。`, ...R.nemesis.reunionLines(g, o)]); }
      R.store.setGame(g);
      window.__oid = o?.id;
    });
    await p.waitForTimeout(900);
    await shot(p, '08-reunion-390');
    await p.evaluate(() => { const R = window.__rimina; const g = R.store.getGame(); g.pending = []; R.store.emit(); R.store.navigate({ tab: 'school', page: 'ledger' }); });
    await p.waitForTimeout(700);
    await shot(p, '09-ledger-390');
    await p.evaluate(() => { const R = window.__rimina; R.store.navigate({ tab: 'school', page: 'ledger', id: window.__oid }); });
    await p.waitForTimeout(700);
    await shot(p, '10-ledger-card-390');
    // ---- 4. 毎週の授業と交流 ----
    await p.evaluate(() => { const R = window.__rimina; R.store.navigate({ tab: 'school', page: 'today' }); });
    await p.waitForTimeout(900);
    await shot(p, '11-week-390');
    await p.mouse.wheel(0, 700); await p.waitForTimeout(300);
    await shot(p, '12-week-social-390');
    // ---- 5. 勢力図の顔 ----
    await p.evaluate(() => { const R = window.__rimina; R.store.navigate({ tab: 'war' }); });
    await p.waitForTimeout(1200);
    const zoom = await p.$('text=拡大する'); if (zoom) await zoom.click();
    await p.waitForTimeout(800);
    await shot(p, '13-map-faces-390');
    const label = (await p.$$('.wm-label:not(.school)'))[1];
    if (label) { await label.click(); await p.waitForTimeout(600); await shot(p, '14-map-ruler-390'); }
    await p.close();
  }
  // ---- 6. 新入生を選ぶ ----
  for (const w of [360, 390]) {
    const p = await page(b, w);
    await p.evaluate(() => { const R = window.__rimina; const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 31, opening: false }); g.reputation = 55; g.pending = []; R.flow.prepareEntrance(g); R.store.setGame(g); });
    await p.waitForTimeout(900);
    await shot(p, `15-admission-${w}`);
    await p.close();
  }
  // ---- 7. タイトル（古いセーブのお知らせ）・難しさ ----
  {
    const p = await page(b, 390);
    await p.waitForTimeout(600);
    const btn = await p.$('text=はじめから'); if (btn) { await btn.click(); await p.waitForTimeout(500); await p.mouse.wheel(0, 900); await p.waitForTimeout(300); await shot(p, '16-newgame-difficulty-390'); }
    await p.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/check.json`, JSON.stringify(report, null, 1));
  console.log(report.map((r) => [r.name, r.over ? 'はみ出し' : '', r.small ? `小さいボタン${r.small}` : '', r.overlap ? `札の重なり${r.overlap}` : '', r.tiny ? `小さい字${r.tiny}` : '', r.errors.length ? r.errors.join('|') : ''].filter(Boolean).join(' ')).join('\n'));
})();
