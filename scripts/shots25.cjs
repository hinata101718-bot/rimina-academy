// 25夜目の画面の撮影（最後にまとめて1回）：node scripts/shots25.cjs（先に npm run build と vite preview --port 4173）
// 撮るもの：技の欄で選ぶところ・入れ替えの確認・出撃の画面の「持っていく技」・雑兵が1人ずつ歩いている途中（数枚）
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night25';
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
    const small = [...document.querySelectorAll('.tp-row, .tp-swap button, .tp-wrap button, .tb-mw')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && x.height > 0 && (x.height < 43.5 || x.width < 43.5); }).map((b) => (b.className + ':' + b.textContent).slice(0, 40));
    const tiny = [...document.querySelectorAll('.tp-wrap *, .tb-line, .tb-fname')].filter((e) => { if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; return parseFloat(getComputedStyle(e).fontSize) < 11.5 && e.getBoundingClientRect().width > 0; }).length;
    const focus = [...document.querySelectorAll('.tb-u.focus')].map((u) => u.textContent.trim().slice(0, 8));
    const dim = document.querySelector('.tb-board.foeturn') ? document.querySelectorAll('.tb-board.foeturn .tb-u:not(.focus)').length : 0;
    return { over, small: small.length, smallList: small.slice(0, 4), tiny, focus: focus.join(','), dim };
  });
  report.push({ name, ...r, errors: p.errs.slice(0, 3) });
}
async function shot(p, name, full) { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!full }); await check(p, name); }

const SETUP = () => {
  const R = window.__rimina;
  const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 25, opening: false });
  R.auto.autoYears(g, 5);
  g.pending = [];
  g.tutorial = { tour: 99, seen: ['tactics', 'exam'] };
  // 技の多い子（弓と剣のボウナイト：弓の技も剣の技も使える。使えない技も混ぜる）
  const kid = Object.values(g.students).filter((x) => x.status === 'enrolled').sort((a, b) => b.level - a.level)[0];
  kid.classId = 'bowknight';
  kid.techs = ['firearrow', 'aimshot', 'twin', 'swallow', 'iai', 'moonlight', 'charge', 'fire'];
  delete kid.techPick;
  window.__kid = kid.id;
  window.__g = g;
  return true;
};
async function setG(p) { await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); }); await p.waitForTimeout(600); }
async function go(p, route) { await p.evaluate((r) => { const R = window.__rimina; if (R.store.getGame() !== window.__g) R.store.setGame(window.__g); R.store.navigate(r); }, route); await p.waitForTimeout(900); }

const BATTLE = () => {
  const R = window.__rimina; const g = window.__g;
  g.quests = g.quests.filter((q) => q.real || q.kind === 'drill');
  R.march.ensureStages(g);
  const q = g.quests.filter((x) => x.real && !x.small)[0] || g.quests[0];
  q.stages = 1;
  const deploy = R.sortie.recommendSquad(g, q).deploy;
  g.pending = [];
  R.flow.startBattle(g, q.id, deploy, false);
  const b = g.battle; b.fx = [];
  // 敵をこちらへ少し寄せておく（すぐに歩いて攻めてくるところを撮る）
  for (const u of b.units) if (u.side === 'foe' && !u.boss) u.y = Math.min(u.y + 2, 6);
  R.tengine.intents(b);
  window.__q = q.id;
  return true;
};

(async () => {
  const b = await chromium.launch();
  for (const w of [390, 360]) {
    const p = await page(b, w);
    const W = `-${w}`;
    await p.evaluate(SETUP);
    await setG(p);
    // ① 技の欄
    const kid = await p.evaluate(() => window.__kid);
    await go(p, { tab: 'students', page: 'detail', id: kid });
    await p.evaluate(() => { const t = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '技能'); t && t.click(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const e = document.querySelector('.tp-wrap'); if (e) e.closest('.card').scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300);
    await shot(p, `01-techs-auto${W}`);
    // 外す → 使えない技をタップ → 5つ目で入れ替えの確認
    await p.evaluate(() => { const r = [...document.querySelectorAll('.tp-row.on')][1]; r && r.click(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => { const r = document.querySelector('.tp-row.off'); r && r.click(); });
    await p.waitForTimeout(300);
    await shot(p, `02-techs-unusable${W}`);
    await p.evaluate(() => { const r = [...document.querySelectorAll('.tp-row:not(.on):not(.off)')][0]; r && r.click(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => { const r = [...document.querySelectorAll('.tp-row:not(.on):not(.off)')][0]; r && r.click(); });
    await p.waitForTimeout(400);
    await p.evaluate(() => { const e = document.querySelector('.tp-swap'); if (e) e.scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(300);
    await shot(p, `03-techs-swap${W}`);
    await p.evaluate(() => { const x = document.querySelector('.tp-swap-btn'); x && x.click(); });
    await p.waitForTimeout(400);
    await p.evaluate(() => { const e = document.querySelector('.tp-wrap'); if (e) e.closest('.card').scrollIntoView({ block: 'start' }); });
    await shot(p, `04-techs-picked${W}`);
    if (w === 390) {
      // 出撃の画面の「持っていく技」
      await p.evaluate(() => { const R = window.__rimina; const g = window.__g; g.quests = g.quests.filter((q) => q.real || q.kind === 'drill'); R.march.ensureStages(g); g.pending = [{ type: 'questBoard' }]; });
      await setG(p);
      await p.evaluate(() => { const b = [...document.querySelectorAll('.tb-quest')][0]; b && b.click(); });
      await p.waitForTimeout(800);
      await p.evaluate(() => { const e = [...document.querySelectorAll('.tb-arms .small b')].find((x) => x.textContent.includes('技')); if (e) e.scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(300);
      await shot(p, `05-sortie-techs${W}`);
      await p.evaluate(() => { const e = [...document.querySelectorAll('.tb-mw')].find((x) => x.textContent.includes('・') || x.textContent.includes('おまかせ）')); const all = [...document.querySelectorAll('.tb-mw')]; const t = all[all.length - 1]; t && t.click(); });
      await p.waitForTimeout(500);
      await shot(p, `06-sortie-techsheet${W}`);
      // ③ 雑兵が1人ずつ歩く（敵の番のとちゅうを何枚か）
      await p.evaluate(() => { const g = window.__g; g.pending = []; g.settings.foeSpeed = 'normal'; g.settings.duel = 'short'; });
      await p.evaluate(BATTLE);
      await setG(p);
      await p.waitForTimeout(1500);
      for (let i = 0; i < 4; i++) await p.evaluate(() => { const o = document.querySelector('.tb-ov'); if (o) o.click(); const gd = document.querySelector('.tb-guide button'); if (gd) gd.click(); });
      await p.waitForTimeout(500);
      const t0 = Date.now();
      await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('ターンを終える')); x && x.click(); });
      await p.waitForTimeout(150);
      await p.evaluate(() => { const e = document.querySelector('.tb-board'); if (e) e.scrollIntoView({ block: 'start' }); });
      const seen = new Set();
      let n = 0;
      for (let k = 0; k < 200 && n < 5; k++) {
        await p.waitForTimeout(90);
        const f = await p.evaluate(() => { const u = document.querySelector('.tb-board.foeturn .tb-u.focus'); return u ? u.getAttribute('data-uid') : null; });
        if (f && !seen.has(f) && seen.size % 2 === 0) { await p.waitForTimeout(140); n++; await shot(p, `${String(6 + n).padStart(2, '0')}-foe-turn${n}${W}`); }
        if (f) seen.add(f);
      }
      // 敵の番が終わるまでの時間
      let done = false;
      for (let k = 0; k < 400 && !done; k++) { await p.waitForTimeout(100); done = await p.evaluate(() => { const g = window.__rimina.store.getGame(); return !document.querySelector('.tb-board.foeturn') && !!g.battle && g.battle.phase !== 'enemy' && !document.querySelector('.tb-ov.phase'); }); }
      const foes = await p.evaluate(() => (window.__rimina.store.getGame().battle?.units ?? []).filter((u) => u.side === 'foe').length);
      report.push({ name: 'foe-turn-time', sec: (Date.now() - t0) / 1000, actors: seen.size, foes });
    }
    await p.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const r of report) console.log(JSON.stringify(r));
})();
