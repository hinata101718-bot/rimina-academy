# 1枚絵の置き場所（public/art/）

ここに画像を置き、下の `index.json` の `files` にファイル名を書くと、ゲームの中に表示されます。
（ブラウザからはフォルダの中身を一覧できないため、ファイル名の一覧が必要です）

```json
{ "files": ["school_0.webp", "school_1.webp", "event_graduation.webp"] }
```

形式は webp・png・jpg のどれでも大丈夫です。横長（たとえば 1200×500 くらい）がきれいに見えます。

## 使える名前

| ファイル名 | 出る場所 |
|---|---|
| `school_0` 〜 `school_3` | ホームの一番上の校舎。施設の段階の合計で切り替わります（0〜2＝ボロボロ、3〜7、8〜12、13以上＝立派） |
| `season_spring` `season_summer` `season_autumn` `season_winter` | ホームのカレンダーの背景（季節ごと） |
| `event_entrance` | 入学試験・入学式の画面 |
| `event_camp` | 7月（夏の合宿）のホーム |
| `event_exhibition` | 9月（公開演武会）の依頼の画面 |
| `event_festival` | 12月（収穫祭）の週末の交流の画面 |
| `event_graduation` | 卒業式の画面 |
| `event_newspaper` | 新聞の上 |

画像がない名前は、これまでどおり絵なし（校舎はゲームの中で描いた簡単な絵）で表示されます。
