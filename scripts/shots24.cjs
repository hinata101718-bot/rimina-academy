// 24夜目の画面の撮影（最後にまとめて1回）：node scripts/shots24.cjs [名前の一部]（先に npm run build と vite preview --port 4173）
// 撮るもの：戦場の敵の駒（360・390・430）・出撃の画面の相性の印・新聞の一面・卒業生の手紙（3通ほど）
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night24';
const URL = 'http://localhost:4173/rimina-academy/?debug';
const ONLY = process.argv[2] || '';
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
    const small = [...document.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && x.height > 0 && (x.height < 43.5 || x.width < 43.5) && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.tb-board'); }).map((b) => (b.className + ':' + b.textContent).slice(0, 40));
    const tiny = [...document.querySelectorAll('body *')].filter((e) => { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; const f = parseFloat(getComputedStyle(e).fontSize); return f < 11.5 && e.getBoundingClientRect().width > 0; }).length;
    const cell = document.querySelector('.tb-cell'); const cw = cell ? Math.round(cell.getBoundingClientRect().width) : null;
    const hit = (a, c) => a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5;
    // 24夜目⑦：敵の駒。兵種の文字と弱点の帯が重ならない・盾が駒の内側（上のマスにはみ出さない）・駒どうしの印が重ならない
    let letterHit = 0, shieldOut = 0, foes = 0;
    const bands = [];
    for (const u of document.querySelectorAll('.tb-u.foe')) {
      foes++;
      const box = u.getBoundingClientRect();
      const letter = u.querySelector('.tb-mark');
      const band = u.querySelector('.tb-marks');
      const ss = u.querySelector('.tb-ss');
      if (band && band.children.length) { const br = band.getBoundingClientRect(); bands.push(br); if (letter) { const range = document.createRange(); range.selectNodeContents(letter); const lr = range.getBoundingClientRect(); if (hit(lr, br)) { letterHit++; (window.__hits = window.__hits || []).push(`帯${Math.round(lr.bottom - br.top)}`); } } }
      if (ss && ss.children.length) { const sr = ss.getBoundingClientRect(); if (sr.top < box.top - 0.5 || sr.left < box.left - 0.5 || sr.right > box.right + 0.5) shieldOut++; if (letter) { const range = document.createRange(); range.selectNodeContents(letter); const r2 = range.getBoundingClientRect(); if (hit(r2, sr)) { letterHit++; (window.__hits = window.__hits || []).push(`盾${Math.round(sr.bottom - r2.top)}`); } } }
    }
    let overlap = 0; for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) if (hit(bands[i], bands[j])) overlap++;
    // 24夜目⑧：相性の札の大きさ
    const aff = [...document.querySelectorAll('.tb-mem .aff')].map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize)));
    return { over, small: small.length, smallList: small.slice(0, 5), tiny, cell: cw, foes, letterHit, shieldOut, overlap, affFont: aff.length ? Math.min(...aff) : null, hits: (window.__hits || []).slice(0, 6).join(',') };
  });
  report.push({ name, ...r, errors: p.errs.slice(0, 3) });
}
async function shot(p, name, full) { if (ONLY && !name.includes(ONLY)) return; await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!full }); await check(p, name); }

/** 6年遊んだ学校（卒業生がいて、新聞と手紙がたまっている） */
const SETUP = () => {
  const R = window.__rimina;
  const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 24, opening: false });
  R.auto.autoYears(g, 6);
  g.pending = [];
  g.tutorial = { tour: 99, seen: ['tactics', 'exam'] };
  window.__g = g;
  return true;
};
async function go(p, route) { await p.evaluate((r) => { const R = window.__rimina; if (R.store.getGame() !== window.__g) R.store.setGame(window.__g); R.store.navigate(r); }, route); await p.waitForTimeout(900); }
async function setG(p) { await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); }); await p.waitForTimeout(600); }

const BOARD = () => {
  const R = window.__rimina; const g = window.__g;
  g.quests = g.quests.filter((q) => q.real || q.kind === 'drill');
  R.march.ensureStages(g);
  const real = g.quests.filter((x) => x.real && !x.small);
  const q = real.find((x) => R.flow.officerForQuest(g, x)) || real[0] || g.quests[0];
  q.stages = 1;
  let o = R.flow.officerForQuest(g, q);
  if (!o) { o = (g.officers || []).find((x) => x.status === 'active' && x.kind !== 'monster' && x.rank <= 2); if (o) q.officerId = o.id; }
  if (o) {
    q.officerId = o.id; R.tsetup.ensureOfficerCombat(o); o.knownWeak = (o.weak || []).slice(0, 2);
    // 因縁のある子を1人（相性の札「因縁」を見せる）
    const kid = Object.values(g.students).find((x) => x.status === 'enrolled' && x.grade >= 2);
    if (kid) { g.rivalries = g.rivalries || {}; g.rivalries[`${kid.id}|${o.id}`] = g.rivalries[`${kid.id}|${o.id}`] || { sid: kid.id, oid: o.id, battles: 1, stage: 1, log: [] }; }
  }
  window.__q = q.id; window.__qt = q.title;
  g.quests = [q];
  g.pending = [{ type: 'questBoard' }];
  return true;
};
const START = () => {
  const R = window.__rimina; const g = window.__g;
  const q = g.quests.find((x) => x.id === window.__q);
  const deploy = R.sortie.recommendSquad(g, q).deploy;
  g.pending = [];
  R.flow.startBattle(g, q.id, deploy, false);
  const b = g.battle; b.fx = [];
  // 敵の弱点を見えるように（見抜いた・当てて分かったようす）。盾の数もいろいろ
  b.units.filter((u) => u.side === 'foe').forEach((u, i) => { u.known = i % 3 === 2 ? [] : u.weak.slice(0, i % 3 === 0 ? 2 : 1); });
  R.tengine.intents(b);
  return true;
};

(async () => {
  const b = await chromium.launch();
  for (const w of [390, 360, 430]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await setG(p);
    const W = `-${w}`;
    // 出撃の画面の相性の印
    await p.evaluate(BOARD);
    await setG(p);
    await p.evaluate(() => { const b = [...document.querySelectorAll('.tb-quest')][0]; b && b.click(); });
    await p.waitForTimeout(800);
    await p.evaluate(() => { const e = document.querySelector('.tb-legend-row'); if (e) e.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300);
    if (w !== 430) await shot(p, `01-sortie-affinity${W}`);
    // 戦場の敵の駒
    await p.evaluate(START);
    await setG(p);
    await p.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) await p.evaluate(() => { const o = document.querySelector('.tb-ov'); if (o) o.click(); const gd = document.querySelector('.tb-guide button'); if (gd) gd.click(); });
    await p.waitForTimeout(600);
    await p.evaluate(() => { const e = document.querySelector('.tb-board'); if (e) e.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300);
    await shot(p, `02-board-foes${W}`);
    if (w === 390) {
      // 新聞の一面（いちばん新しい後期号）
      await p.evaluate(() => { const g = window.__g; g.battle = null; g.march = null; g.pending = []; window.__rimina.store.setGame(g); });
      await go(p, { tab: 'school', page: 'news' });
      await shot(p, `03-news-front${W}`);
      await p.evaluate(() => { const e = document.querySelector('.np-second') || document.querySelector('.np-cols'); if (e) e.scrollIntoView({ block: 'start' }); });
      await p.waitForTimeout(300);
      await shot(p, `04-news-second${W}`);
      await p.evaluate(() => { const e = document.querySelector('.np-moves'); if (e) e.scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(300);
      await shot(p, `05-news-moves${W}`);
      // 卒業生の手紙（型のちがう3通を開く）
      await p.evaluate(() => {
        const g = window.__g;
        const own = new Set(['近況のご報告', 'ひさしぶりの便り']);
        const seen = new Set();
        const keep = [];
        for (const m of g.mail) { if (!m.studentId || /差し入れ|昇格|誕生日|家族|果たし状|恨み言|捕らわれ|うわさ|気になる|最前線/.test(m.title) || own.has(m.title)) continue; const k = m.title.replace(/^.+(と再会しました|のこと|へ)$/, '$1'); if (seen.has(k)) continue; seen.add(k); keep.push(m); if (keep.length >= 3) break; }
        g.mail = keep.map((m) => ({ ...m, read: true }));
        window.__rimina.store.setGame(g);
      });
      await go(p, { tab: 'school', page: 'mail' });
      for (let i = 0; i < 3; i++) { await p.evaluate((i) => { const c = document.querySelectorAll('.pcard.tap')[i]; c && c.click(); }, i); await p.waitForTimeout(300); await shot(p, `06-letter${i + 1}${W}`); }
    }
    await p.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.name, 'はみ出し', r.over, '小さいボタン', r.small, r.smallList.join(' / '), '小さい字', r.tiny, 'マス', r.cell, '敵', r.foes, '文字と印の重なり', r.letterHit, '盾のはみ出し', r.shieldOut, '印どうしの重なり', r.overlap, '相性の札の字', r.affFont, r.hits || '', r.errors.join(' | '));
})();
