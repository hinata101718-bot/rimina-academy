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
| `npm run sim -- 30 10` | 長期シミュレーション（30年×10回）。結果は `docs/sim-report.md` |

## フォルダの中身

- `src/core/` … ゲームの計算（画面に依存しない。シード付き乱数）
- `src/ui/` … 画面（Preact）
- `src/data/` … 数値・文章・兵種・武器・名前・会話・マップの型（**数値の調整は `src/data/balance.ts`**）
- `public/faces/` … 顔画像の差し替え口（`README.md` を参照）
- `public/bgm/` … BGM の置き場所（`peace.mp3` など）
- `scripts/` … シミュレーションや画面確認の道具
