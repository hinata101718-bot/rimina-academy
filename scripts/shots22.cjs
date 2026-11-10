// 22夜目の画面の撮影（最後にまとめて1回）：node scripts/shots22.cjs（先に npm run build と vite preview --port 4173）
// 撮るもの：⑦敵が歩いている途中・枠が乗った敵・記録の行・台詞の▼／⑧駒の印・金色に光る敵・敵の説明／個人ページ（7つの能力と人望・装備）・武器を選ぶ一覧・名簿のカード・兵種試験の候補（枝分かれの先でないもの）・兵種の図鑑・目標技能の画面
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night22';
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
    const small = [...document.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && x.height > 0 && (x.height < 43.5 || x.width < 43.5) && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.tb-board'); }).map((b) => (b.className + ':' + b.textContent).slice(0, 40));
    const tiny = [...document.querySelectorAll('body *')].filter((e) => { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; const f = parseFloat(getComputedStyle(e).fontSize); return f < 11.5 && e.getBoundingClientRect().width > 0; }).length;
    return { over, small: small.length, smallList: small.slice(0, 5), tiny };
  });
  report.push({ name, ...r, errors: p.errs.slice(0, 3) });
}
async function shot(p, name) { await p.screenshot({ path: `${OUT}/${name}.png` }); await check(p, name); }


/** 6年遊んだ学校を作り、1人に剣と槍のCを持たせ、武器庫に武器を足して装備させる */
const SETUP = () => {
  const R = window.__rimina;
  const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 22, opening: false });
  R.auto.autoYears(g, 6);
  g.pending = [];
  g.tutorial = { tour: 99, seen: ['tactics', 'exam'] };
  const kids = Object.values(g.students).filter((x) => x.status === 'enrolled').sort((a, b) => a.grade - b.grade || b.level - a.level);
  // 試験：剣士で、剣C・槍C・魔道D（剣豪・魔剣士のほか、上槍兵も受けられる）
  const ex = kids.find((x) => x.grade === 2) || kids[0];
  ex.classId = 'swordsman'; ex.level = Math.max(ex.level, 12); ex.battles = Math.max(ex.battles, 6);
  ex.skills.sword = 210; ex.skills.lance = 200; ex.skills.magic = 90; ex.skills.axe = 40;
  ex.trust = 70;
  ex.mind = { fight: 55, calm: 72, grudge: 20 };
  ex.epithet = '盾の'; ex.history.push({ year: g.year - 1, text: `${ex.given}は「盾の${ex.given}」と呼ばれるようになった` });
  // 武器庫
  g.armory.push({ uid: 'shot_w1', weaponId: 'steel_sword', uses: { [ex.id]: 4 } }, { uid: 'shot_w2', weaponId: 'silver_sword', affix: [] }, { uid: 'shot_w3', weaponId: 'killing_edge' });
  const other = kids.find((x) => x !== ex && R.sortie.canEquip(x, 'silver_sword'));
  if (other) other.equip = 'shot_w2'; else { const o2 = kids.find((x) => x !== ex); if (o2) { o2.classId = 'swordsman'; o2.skills.sword = Math.max(o2.skills.sword, 300); o2.equip = 'shot_w2'; } }
  ex.equip = 'shot_w1';
  window.__g = g; window.__ex = ex.id;
  return true;
};
async function go(p, route) { await p.evaluate((r) => { const R = window.__rimina; if (R.store.getGame() !== window.__g) R.store.setGame(window.__g); R.store.navigate(r); }, route); await p.waitForTimeout(900); }
async function scrollTo(p, re) { await p.evaluate((src) => { const r = new RegExp(src); const e = [...document.querySelectorAll('h3, b, .small')].find((x) => r.test(x.textContent || '')); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); }, re.source); await p.waitForTimeout(300); }

/** 戦いを始める：教え子1人目の攻撃の種類を弱点として分かっている敵を1人置く */
const BATTLE = () => {
  const R = window.__rimina; const g = window.__g;
  const q = g.quests.find((x) => x.real && !x.nemesisId) || g.quests[0];
  q.objective = 'rout'; q.nemesisId = undefined;
  const deploy = R.sortie.recommendSquad(g, q).deploy.slice(0, 4);
  R.flow.startBattle(g, q.id, deploy);
  const b = g.battle; b.fx = [];
  const kids = b.units.filter((u) => u.side === 'me' && !u.teacher);
  const foes = b.units.filter((u) => u.side === 'foe');
  const k0 = kids[0]; const f0 = foes.find((f) => !f.boss) || foes[0];
  if (k0 && f0) { f0.weak = [k0.type, f0.weak.find((w) => w !== k0.type) || 'dark']; f0.known = [k0.type]; }
  const f1 = foes.find((f) => f !== f0 && !f.boss); if (f1 && k0) { f1.resist = [k0.type]; f1.weak = f1.weak.filter((w) => w !== k0.type); }
  R.tengine.intents(b);
  window.__kids = kids.map((u) => u.uid);
  return true;
};
async function tapUnit(p, uid) {
  const xy = await p.evaluate((id) => { const b = window.__rimina.store.getGame().battle; const u = b.units.find((x) => x.uid === id); return u ? u.y * b.w + u.x : -1; }, uid);
  if (xy < 0) return;
  const cells = await p.$$('.tb-cell');
  await cells[xy].click();
  await p.waitForTimeout(500);
}
async function battleShots(b) {
  for (const w of [360, 390]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await p.evaluate(BATTLE);
    await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); });
    await p.waitForTimeout(1200);
    await shot(p, `14-board-marks-${w}`);
    await tapUnit(p, await p.evaluate(() => window.__kids[0]));
    await shot(p, `15-gold-weak-${w}`);
    if (w === 390) {
      // 敵をタップ：その敵の説明
      await p.click('text=選びなおす');
      await p.waitForTimeout(300);
      const fid = await p.evaluate(() => window.__rimina.store.getGame().battle.units.find((u) => u.side === 'foe' && u.alive && !u.boss).uid);
      await tapUnit(p, fid);
      await shot(p, '16-foe-info-390');
      // 印の意味
      await p.click('text=印の意味 ？');
      await p.waitForTimeout(300);
      await p.evaluate(() => document.querySelector('.atk-legend-box')?.scrollIntoView({ block: 'center' }));
      await shot(p, '17-atk-legend-390');
      await p.evaluate(() => window.scrollTo(0, 0));
      // 敵の番：枠が乗る → 歩く途中 → 攻撃（数枚の連続）
      await p.click('text=ターンを終える');
      for (let n = 0; n < 6; n++) { await p.waitForTimeout(n === 0 ? 900 : 260); await p.screenshot({ path: `${OUT}/18-foe-walk-${n + 1}-390.png` }); }
      await check(p, '18-foe-walk-390');
      // 台詞の▼（タップで進む）：戦いを作り直して、はじめの台詞を出す
      await p.waitForTimeout(6000);
      await p.evaluate(SETUP);
      await p.evaluate(BATTLE);
      await p.evaluate(() => { const R = window.__rimina; const g = window.__g; const bo = g.battle.units.find((u) => u.side === 'foe' && u.alive); g.battle.fx = [{ k: 'say', by: bo.uid, text: 'ここで終わりにしてやる。' }]; R.store.setGame(window.__g); });
      await p.waitForTimeout(1500);
      await shot(p, '19-say-tap-390');
    }
    await p.close();
  }
}

(async () => {
  const b = await chromium.launch();
  // ---- 1. 個人ページ：7つの能力・人望・装備 ----
  for (const w of [360, 390, 430]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    const id = await p.evaluate(() => window.__ex);
    await go(p, { tab: 'students', page: 'detail', id, sub: 'stats' });
    await p.evaluate(() => { window.__rimina.store.act((g) => { g.settings.detailTab = 'stats'; }, false); });
    await p.waitForTimeout(300);
    await scrollTo(p, /^能力$/);
    await shot(p, `01-detail-stats-${w}`);
    await scrollTo(p, /^心と教訓$/);
    await shot(p, `02-detail-renown-${w}`);
    await scrollTo(p, /^装備$/);
    await shot(p, `03-detail-equip-${w}`);
    if (w === 390) {
      // 武器を選ぶ一覧
      await p.click('.eq-now');
      await p.waitForTimeout(500);
      await shot(p, '04-equip-list-390');
      await p.close();
      continue;
    }
    await p.close();
  }
  // ---- 2. 名簿のカード（装備中の武器） ----
  {
    const p = await page(b, 390);
    await p.evaluate(SETUP);
    await go(p, { tab: 'students' });
    await shot(p, '05-roster-weapon-390');
    // ---- 3. 兵種試験の候補（枝分かれの先でないものも並ぶ） ----
    const id = await p.evaluate(() => window.__ex);
    await go(p, { tab: 'students', page: 'exam', id });
    await shot(p, '06-exam-options-390');
    await p.evaluate(() => { const s = document.querySelector('.sheet'); if (s) s.scrollTop = 99999; });
    await p.waitForTimeout(300);
    await shot(p, '07-exam-options-bottom-390');
    // ---- 4. 兵種の図鑑（おすすめの道） ----
    await go(p, { tab: 'students', page: 'classbook' });
    const leaf = await p.$('.cb-leaf');
    if (leaf) { await leaf.click(); await p.waitForTimeout(500); }
    await shot(p, '08-classbook-390');
    await p.evaluate(() => { const e = document.querySelector('.ct-tree'); if (e) e.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300);
    await shot(p, '09-classbook-tree-390');
    await p.close();
  }
  // ---- 5. 目標技能の画面（360・390） ----
  for (const w of [360, 390]) {
    const p = await page(b, w);
    await p.evaluate(SETUP);
    await go(p, { tab: 'school', page: 'targets' });
    await shot(p, `10-targets-${w}`);
    await p.evaluate(() => window.scrollBy(0, 600));
    await p.waitForTimeout(300);
    await shot(p, `11-targets-more-${w}`);
    if (w === 390) {
      // 札をタップすると個人ページへ、戻るとこの画面へ
      await p.click('.tg-head');
      await p.waitForTimeout(700);
      await shot(p, '12-targets-to-detail-390');
      await p.click('text=← 戻る');
      await p.waitForTimeout(700);
      await shot(p, '13-targets-back-390');
    }
    await p.close();
  }
  await battleShots(b);
  await b.close();
  fs.writeFileSync(`${OUT}/check.json`, JSON.stringify(report, null, 1));
  console.log(report.map((r) => [r.name, r.over ? 'はみ出し' : '', r.small ? `小さいボタン${r.small} ${r.smallList.join('/')}` : '', r.tiny ? `小さい字${r.tiny}` : '', r.errors.length ? r.errors.join('|') : ''].filter(Boolean).join(' ')).join('\n'));
})();
