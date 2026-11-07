# 1枚絵の置き場所（public/art/）

ここに画像を置き、下の `index.json` の `files` にファイル名を書くと、ゲームの中に表示されます。
（ブラウザからはフォルダの中身を一覧できないため、ファイル名の一覧が必要です）

```json
{ "files": ["season_spring.webp", "event_graduation.webp"] }
```

形式は webp・png・jpg のどれでも大丈夫です。横長（たとえば 1200×500 くらい）がきれいに見えます。

## 使える名前

| ファイル名 | 出る場所 |
|---|---|
| `season_spring` `season_summer` `season_autumn` `season_winter` | ホームのカレンダーの背景（季節ごと） |
| `event_entrance` | 入学試験・入学式の画面 |
| `event_camp` | 7月（夏の合宿）のホーム |
| `event_exhibition` | 9月（公開演武会）の依頼の画面 |
| `event_festival` | 12月（収穫祭）の週末の交流の画面 |
| `event_graduation` | 卒業式の画面 |
| `event_newspaper` | 新聞の上 |
| `ending_peace` `ending_unify` `ending_ceasefire` `ending_neutral` | エンディングの最初の場面（和平の円卓・統一・疲弊の停戦・学校の中立宣言） |

画像がない名前は、これまでどおり絵なしで表示されます。
（3夜目から、ホームの校舎の絵はなくなりました。`school_*` の画像を置いても表示されません）
