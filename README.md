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
| `npm run sim -- 40 10` | 長期シミュレーション（40年×10回を、進路の方針「和平狙い・統一狙い・何もしない」ごとに。エンディングのあとは「この学校を続ける」）。結果は `docs/sim-report.md` |
| `node scripts/ui-night3.cjs` | 画面の撮影（`npx vite` を起動してから。2夜目版のセーブを読み込んで主要な画面を撮る） |
| `npx tsx scripts/check-talks.ts` | 会話データの検証（行数・分岐・10性格の文面・差し込み） |

## フォルダの中身

- `src/core/` … ゲームの計算（画面に依存しない。シード付き乱数）
- `src/ui/` … 画面（Preact）
- `src/data/` … 数値・文章・兵種・武器・名前・会話・マップの型（**数値の調整は `src/data/balance.ts`**）
- `public/faces/` … 顔画像の差し替え口（`README.md` を参照）
- `public/art/` … 季節・行事・エンディングの1枚絵の差し替え口（`README.md` を参照）
- `src/core/instructor.ts` … 教官（技能の成長・引退と後継・副教官） ／ `src/core/ending.ts` … エンディングと殿堂
- `docs/screenshots/night3/` … 3夜目の画面の撮影（幅390×高さ844）
- `src/data/talks/` … 支援会話と面談の流れ・文面（`talks.ts`＝支援会話の流れ、`interviews.ts`＝面談の流れと先生のセリフ、`phrases*.ts`＝性格ごとの文面）
- `src/data/spells.ts` … 魔法（技能ランクで覚える）
- `public/bgm/` … BGM の置き場所（`peace.mp3` など）
- `scripts/` … シミュレーションや画面確認の道具
