# 顔画像の置き場所

ここに `{国}_{性別}_{髪色}_{番号}.png` の名前で顔画像を置き、`index.json` の `files` に
ファイル名を書き足すと、条件に合う生徒の似顔絵が画像に差し替わります。

- 国：kingdom / empire / alliance（辺境出身は kingdom の画像を使います）
- 性別：m / f
- 髪色：black / brown / chestnut / gold / blond / red / silver / blue
- 例：`kingdom_f_blond_01.png`

```json
{ "files": ["kingdom_f_blond_01.png", "empire_m_black_01.png"] }
```
