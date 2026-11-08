# 辺境士官学校 ―戦争が終わる日まで―

三国の国境に取り残された廃校寸前の士官学校で、教官として生徒を3年かけて育て、三国へ送り出す育成シミュレーションRPG（スマホ縦画面のブラウザゲーム）。

- 遊ぶ：https://hinata101718-bot.github.io/rimina-academy/ （GitHub Pages）
- 設計書：`docs/design.md` ／ ヒアリング記録：`docs/hearing.md` ／ 作業の報告：`docs/reports/`

## 開発用のコマンド

| コマンド | 内容 |
|---|---|
| `npm install` | 準備（最初の1回） |
| `npm run dev` | 手元で動かす（http://localhost:5173/rimina-academy/） |
| `npm run build` | 公開用のファイルを `dist/` に作る |
| `npm test` | 自動テスト |
| `npm run sim -- 40 10` | 長期シミュレーション（40年×10回を、進路の方針「和平狙い・統一狙い・何もしない・中立狙い」ごとに。エンディングのあとは「この学校を続ける」）。結果は `docs/sim-report.md` |
| `npx tsx scripts/mkshots5.ts <フォルダ>` → `SHOTS_DIR=<フォルダ> node scripts/ui-night5.cjs` | 自動の戦闘の画面の撮影（出撃前・場面・選択・結果・因縁の敵将） |
| `npx tsx scripts/mkshots6.ts <フォルダ>` → `SHOTS_DIR=<フォルダ> node scripts/ui-night6.cjs` | 6夜目の画面の撮影（敵将の名簿・敵将の顔が出る出撃前と場面・宿命の対決・個人ページの宿敵欄・才能判明の演出） |
| `npx tsx scripts/officer-diag.ts [年数] [種]` | 宿敵の仕組みの様子を見る（敵将・二つ名・宿敵・誓い・決着の数を1年ごとに） |
| `npx tsx scripts/auto-demo.ts [番号]` | 自動の戦闘を1回、文字だけで流して場面と選択を見る |
| `npx tsx scripts/auto-compare.ts [セーブ] [回数]` | 4夜目までの戦い方（手動のオートプレイ）と自動の戦闘で、勝率・戦死・重傷を比べる |
| `npx tsx scripts/mkshots.ts <フォルダ>` → `SHOTS_DIR=<フォルダ> node scripts/ui-night4.cjs` | 画面の撮影（`npx vite` を起動してから。3夜目版のセーブを読み込んで全画面を撮り、横にはみ出した画面を知らせる） |
| `npx tsx scripts/neutral-diag.ts neutral 6 40` | 学校の中立宣言の届きやすさを方針ごとに調べる |
| `npx tsx scripts/check-talks.ts` | 会話データの検証（行数・分岐・10性格の文面・差し込み） |

## フォルダの中身

- `src/core/` … ゲームの計算（画面に依存しない。シード付き乱数）
- `src/ui/` … 画面（Preact）
- `src/data/` … 数値・文章・兵種・武器・名前・会話・マップの型（**数値の調整は `src/data/balance.ts`**）
- `public/faces/` … 顔画像の差し替え口（`README.md` を参照）
- `public/art/` … 季節・行事・エンディングの1枚絵の差し替え口（`README.md` を参照）
- `src/core/instructor.ts` … 教官（技能の成長・引退と後継・副教官） ／ `src/core/ending.ts` … エンディングと殿堂
- `public/enemies/` … 敵将の顔画像（王国・帝国・同盟・盗賊団 各20。`README.md` を参照）
- `src/core/officers.ts` … 宿敵の仕組み（敵将の名簿と勢力図・敵将の記憶・宿敵と仇討ちの誓い・弱点・卒業生の敵将）。数値は `src/data/officers.ts`、文章は `src/data/officers_text.ts`
- `src/core/discovery.ts` … 手応えと発見の演出（ランクアップ・隠れた才能の段階・意外な一面）。数値と文章は `src/data/discovery.ts`
- `docs/screenshots/night6/` … 6夜目の画面（幅390×高さ844）
- `docs/screenshots/night5/` … 5夜目の自動の戦闘の画面（幅390×高さ844）
- `docs/screenshots/night4/` … 4夜目の画面の撮影（幅390×高さ844。3夜目は `night3/`）
- `src/data/talks/` … 支援会話と面談の流れ・文面（`talks.ts`＝支援会話の流れ、`interviews.ts`＝面談の流れと先生のセリフ、`phrases*.ts`＝性格ごとの文面）
- `src/data/spells.ts` … 魔法（技能ランクで覚える）
- `public/bgm/` … BGM の置き場所（`peace.mp3`・`ending.mp3` など）
- `scripts/` … シミュレーションや画面確認の道具
