// 23夜目の画面の撮影（最後にまとめて1回）：node scripts/shots23.cjs [名前の一部]（先に npm run build と vite preview --port 4173）
// 撮るもの：名簿・入学の希望者・罠を置くところ・個人ページの兵種の欄から初級を選ぶところ・試験の候補の「同じ段階」・
// 出撃の画面（6人・敵将の札・相性の印）・8×10の盤（360・390・430）・依頼の札（戦場の数）・戦場と戦場のあいだ・道を選ぶ・
// 宿敵が次の戦場で待ち構える口上・進軍の地図
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/night23';
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
    // 駒の印（攻撃の種類・弱点・盾）が、となりの駒と重なっていないか
    const marks = [...document.querySelectorAll('.tb-u .tb-marks')].map((m) => m.getBoundingClientRect()).filter((x) => x.width > 0);
    let overlap = 0; for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) { const a = marks[i], c = marks[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) overlap++; }
    return { over, small: small.length, smallList: small.slice(0, 5), tiny, cell: cw, overlap };
  });
  report.push({ name, ...r, errors: p.errs.slice(0, 3) });
}
async function shot(p, name) { if (ONLY && !name.includes(ONLY)) return; await p.screenshot({ path: `${OUT}/${name}.png` }); await check(p, name); }

/** 5年遊んだ学校を作る（同じ名前の子が2人いる古いセーブのようす・初級の子・中級の子） */
const SETUP = () => {
  const R = window.__rimina;
  const g = R.game.newGame({ name: 'アルノルト', background: 'knight', seed: 23, opening: false });
  R.auto.autoYears(g, 5);
  g.pending = [];
  g.tutorial = { tour: 99, seen: ['tactics', 'exam'] };
  const kids = Object.values(g.students).filter((x) => x.status === 'enrolled').sort((a, b) => a.grade - b.grade || b.level - a.level);
  // 前からのセーブで、同じ名前の子が2人（姓の頭で見分ける）
  const two = kids.filter((x) => x.family && x.grade === 1);
  if (two.length >= 2) two[1].given = two[0].given;
  // 初級の子：剣士で、槍と弓も少し
  const novice = kids.find((x) => x.grade === 1 && x !== two[1]) || kids[0];
  novice.classId = 'swordsman'; novice.skills.lance = Math.max(novice.skills.lance, 30); novice.skills.bow = Math.max(novice.skills.bow, 30); novice.sideMonth = -1;
  // 中級の子：剣豪で、槍C（同じ段階の上槍兵）と剣B近く
  const mid = kids.find((x) => x.grade >= 2 && x !== novice) || kids[1];
  mid.classId = 'kensei'; mid.level = Math.max(mid.level, 14); mid.skills.sword = Math.max(mid.skills.sword, 200); mid.skills.lance = Math.max(mid.skills.lance, 150); mid.battles = Math.max(mid.battles, 8);
  // 斥候の子
  const sc = kids.find((x) => x !== novice && x !== mid && x.grade >= 2) || kids[2];
  sc.classId = 'scout'; sc.skills.sword = Math.max(sc.skills.sword, 60); sc.skills.bow = Math.max(sc.skills.bow, 60);
  window.__g = g; window.__novice = novice.id; window.__mid = mid.id; window.__scout = sc.id;
  return true;
};
async function go(p, route) { await p.evaluate((r) => { const R = window.__rimina; if (R.store.getGame() !== window.__g) R.store.setGame(window.__g); R.store.navigate(r); }, route); await p.waitForTimeout(900); }
async function setG(p) { await p.evaluate(() => { const R = window.__rimina; R.store.setGame(window.__g); }); await p.waitForTimeout(600); }

/** 月末の依頼（いちばん敵将のいる・戦場の多い依頼を、進軍3つにする） */
const BOARD = () => {
  const R = window.__rimina; const g = window.__g;
  g.quests = g.quests.filter((q) => q.real || q.kind === 'drill');
  R.march.ensureStages(g);
  const q = g.quests.find((x) => x.real && !x.small) || g.quests[0];
  q.stages = 3; q.stageNames = R.march.stageNames(q, 3); q.reward = Math.max(q.reward, 1200);
  // 宿敵にする（因縁のある子がいれば）
  const o = R.flow.officerForQuest(g, q);
  if (o) { q.officerId = o.id; o.knownWeak = (o.weak || []).slice(0, 1); }
  window.__q = q.id;
  g.pending = [{ type: 'questBoard' }];
  return true;
};
const START = (stageIdx) => {
  const R = window.__rimina; const g = window.__g;
  const q = g.quests.find((x) => x.id === window.__q);
  const deploy = R.sortie.recommendSquad(g, q).deploy;
  // 斥候を入れる
  if (!deploy.some((d) => d.studentId === window.__scout)) deploy[deploy.length - 1] = { studentId: window.__scout, armoryUid: null, item: null };
  g.pending = [];
  R.flow.startBattle(g, q.id, deploy, false);
  const b = g.battle; b.fx = [];
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
    if (w === 390) {
      await go(p, { tab: 'students' });
      await shot(p, `01-roster${W}`);
      // 入学の希望者
      await p.evaluate(() => { const R = window.__rimina; const g = window.__g; R.flow.prepareEntrance(g); R.store.setGame(g); });
      await p.waitForTimeout(900);
      await shot(p, `02-applicants${W}`);
      await p.evaluate(() => { const g = window.__g; g.pending = []; window.__rimina.store.setGame(g); });
      // 個人ページの兵種の欄から初級を選ぶ
      await go(p, { tab: 'students', page: 'detail', id: await p.evaluate(() => window.__novice) });
      await shot(p, `03-detail-side-btn${W}`);
      await p.click('.side-btn').catch(() => {});
      await p.waitForTimeout(500);
      await shot(p, `04-side-sheet${W}`);
      // 試験の候補の「同じ段階」
      await go(p, { tab: 'students', page: 'detail', id: await p.evaluate(() => window.__mid) });
      await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /兵種試験を受ける/.test(x.textContent)); b && b.click(); });
      await p.waitForTimeout(600);
      await p.evaluate(() => { const e = [...document.querySelectorAll('.flag')].find((x) => /同じ段階/.test(x.textContent)); if (e) e.scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(300);
      await shot(p, `05-exam-same-tier${W}`);
    }
    // 依頼の札（戦場の数）・出撃の画面
    await p.evaluate(BOARD);
    await setG(p);
    if (w === 390) await shot(p, `06-quest-board${W}`);
    await p.evaluate(() => { const b = [...document.querySelectorAll('.tb-quest')].find((x) => /戦場 3つ/.test(x.textContent)); b && b.click(); });
    await p.waitForTimeout(800);
    await shot(p, `07-sortie-foe${W}`);
    await p.evaluate(() => { const e = document.querySelector('.tb-mem'); if (e) e.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300);
    await shot(p, `08-sortie-members${W}`);
    // 8×10の盤
    await p.evaluate(START, 0);
    await setG(p);
    await p.waitForTimeout(1500);
    // 口上などが出ていれば閉じる
    for (let i = 0; i < 4; i++) await p.evaluate(() => { const o = document.querySelector('.tb-ov'); if (o) o.click(); const gd = document.querySelector('.tb-guide button'); if (gd) gd.click(); });
    await p.waitForTimeout(600);
    await shot(p, `09-board${W}`);
    if (w === 390) {
      // 罠を置くところ：斥候をタップ → 罠
      await p.evaluate(() => { const R = window.__rimina; const b = R.store.getGame().battle; const u = b.units.find((x) => x.studentId === window.__scout); const cells = document.querySelectorAll('.tb-cell'); cells[u.y * b.w + u.x].click(); });
      await p.waitForTimeout(500);
      await p.evaluate(() => { const bt = [...document.querySelectorAll('.tb-acts button')].find((x) => x.textContent.trim() === '罠'); bt && bt.click(); });
      await p.waitForTimeout(400);
      await shot(p, `10-trap-place${W}`);
      // 戦場1つ目を勝ったことにして、戦場と戦場のあいだ
      await p.evaluate(() => { const R = window.__rimina; const g = window.__g; const b = g.battle; for (const u of b.units) if (u.side === 'me' && !u.teacher) u.hp = Math.max(1, Math.round(u.max * (0.4 + Math.random() * 0.5))); const bu = b.units.find((u) => u.boss); for (const f of b.units) if (f.side === 'foe' && f !== bu) { f.alive = false; f.down = 'dead'; } if (bu && bu.officerId) { bu.hp = 3; const k = b.units.find((u) => u.side === 'me' && !u.teacher && u.alive); bu.broken = 2; bu.sh = 0; k.x = bu.x; k.y = bu.y + 1; R.tengine.attack(b, k.uid, bu.uid, null, { x: k.x, y: k.y }); } R.tengine.checkEnd(b); if (b.phase !== 'done') { for (const f of b.units) if (f.side === 'foe') { f.alive = false; } R.tengine.checkEnd(b); } b.fx = []; R.store.setGame(g); });
      await p.waitForTimeout(700);
      await shot(p, `11-stage-clear${W}`);
      await p.evaluate(() => { const bt = [...document.querySelectorAll('.tb-end button')][0]; bt && bt.click(); });
      await p.waitForTimeout(800);
      await shot(p, `12-march-break${W}`);
      await p.evaluate(() => { const e = [...document.querySelectorAll('.mm-card h3')].find((x) => /道を選ぶ/.test(x.textContent)); if (e) e.scrollIntoView({ block: 'start' }); });
      await p.waitForTimeout(300);
      await shot(p, `13-march-route${W}`);
      // 次の戦場へ：敵将の口上（逃げたことに触れる）と進軍の地図
      await p.evaluate(() => { const bt = document.querySelector('.mm-go'); bt && bt.click(); });
      await p.waitForTimeout(1300);
      await shot(p, `14-regroup-say${W}`);
      for (let i = 0; i < 4; i++) await p.evaluate(() => { const o = document.querySelector('.tb-ov'); if (o) o.click(); });
      await p.waitForTimeout(700);
      await shot(p, `15-march-map${W}`);
      // 敵の番（雑兵はまとめて歩く）
      await p.evaluate(() => { const bt = [...document.querySelectorAll('.tb-acts button')].find((x) => /ターンを終える/.test(x.textContent)); bt && bt.click(); });
      await p.waitForTimeout(1500);
      await shot(p, `16-foe-group-walk${W}`);
    }
    await p.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.name, 'はみ出し', r.over, '小さいボタン', r.small, r.smallList.join(' / '), '小さい字', r.tiny, 'マス', r.cell, '印の重なり', r.overlap, r.errors.join(' | '));
})();
