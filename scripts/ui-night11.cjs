// 11夜目の画面撮影：戦の描写（濃い・凄惨）、戦の描写の設定、書き直した画面の文（授業・個人ページ・出撃前）、弔いの場面
// 使い方：npx vite を起動し、npx tsx scripts/mkshots10.ts <dir> のあと SHOTS_DIR=<dir> node scripts/ui-night11.cjs [出力先=docs/screenshots/night11]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || 'docs/screenshots/night11';
const dir = process.env.SHOTS_DIR;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  // 撮影用に、セーブの設定や場面を書きかえたものを作る
  const edit = (from, to, f) => { const j = JSON.parse(fs.readFileSync(path.join(dir, from), 'utf8')); f(j.state); fs.writeFileSync(path.join(dir, to), JSON.stringify(j)); };
  edit('battle.json', 'battle-brutal.json', (s) => { s.settings.battleProse = 'brutal'; s.settings.proseAsked = true; });
  edit('skills.json', 'grief.json', (s) => {
    const ids = Object.keys(s.students).filter((k) => s.students[k].status === 'enrolled');
    const a = s.students[ids[0]], f = s.students[ids[1]];
    s.pending = [{ type: 'scene', title: `${a.given}を弔う夜`, lines: [
      { by: 'narr', faces: [a.id], text: `その夜、学校の食堂は静まりかえっていた。${a.given}の席だけが、ぽつんと空いている。` },
      { by: 'narr', text: `${f.given}は皿に手をつけず、窓の外を見ていた。` },
      { by: f.id, text: `なんでだよ……一緒に帰るって言っただろ` },
      { by: 'narr', text: `先生は${a.given}の机に、そっと花を置いた。` },
    ] }];
  });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '1' : undefined));
  const shot = async (n) => { await p.waitForTimeout(450); await p.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
  const open = async (file) => {
    await p.goto('http://localhost:5173/rimina-academy/');
    await p.evaluate(() => indexedDB.deleteDatabase('rimina-academy'));
    await p.reload(); await p.waitForTimeout(500);
    await p.setInputFiles('input[type=file]', path.join(dir, file));
    await p.waitForTimeout(1400);
  };
  const closeAll = async () => { for (let i = 0; i < 16; i++) { const c = await p.$('.sheet button:has-text("閉じる"), .sheet button:has-text("スキップ"), .sheet button:has-text("OK")'); if (!c) break; await c.click(); await p.waitForTimeout(150); } };
  const click = async (sel) => { await p.click(sel).catch(() => errors.push('click ' + sel)); await p.waitForTimeout(350); };
  const play = async (file, prefix, n) => {
    await open(file);
    let shots = 0;
    for (let i = 0; i < 200 && shots < n; i++) {
      if (await p.$('.fx-over')) { if (prefix === '02' && (await p.$('.fx-over.splat')) && shots < n) { await p.waitForTimeout(500); await shot(`${prefix}-splat`); shots++; } await p.click('.fx-over').catch(() => undefined); await p.waitForTimeout(150); continue; }
      if (await p.$('.ab-copt')) { await p.click('.ab-copt >> nth=0'); await p.waitForTimeout(400); continue; }
      if (await p.$('.ab-endbtn')) break;
      await p.mouse.click(195, 420); await p.waitForTimeout(700);
      if (await p.$('.dq-line.prose')) { await shot(`${prefix}-prose-${shots + 1}`); shots++; await p.waitForTimeout(300); }
    }
  };
  await play('battle.json', '01', 3);
  await play('battle-brutal.json', '02', 3);
  // 戦の描写の設定
  await open('skills.json'); await closeAll();
  await click('nav.tabs button >> nth=4');
  await p.evaluate(() => { const x = [...document.querySelectorAll('.small')].find((e) => e.textContent.includes('戦の描写')); x && x.scrollIntoView(); });
  await shot('03-setting-prose');
  // 書き直した画面の文
  await click('nav.tabs button >> nth=0'); await click('.command'); await shot('04-lessons-text');
  await click('button:has-text("戻る")');
  await click('nav.tabs button >> nth=1'); await click('.stucard >> nth=0'); await shot('05-detail-text');
  await click('button:has-text("記録")'); await shot('06-record-text');
  await open('board.json'); await closeAll(); await shot('07-sortie-text');
  // 弔いの場面
  await open('grief.json'); await p.waitForTimeout(600); await shot('08-grief-scene');
  for (let i = 0; i < 3; i++) { await p.click('.sheet').catch(() => undefined); await p.waitForTimeout(400); }
  await shot('09-grief-scene2');
  console.log('errors', errors.join('\n') || 'なし');
  await b.close();
})();
