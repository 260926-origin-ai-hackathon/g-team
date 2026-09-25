# firmware

M5Stack Core2 + PIR センサー用ファーム。仕様は [../docs/spec/spec01.md](../docs/spec/spec01.md)。

## セットアップ

```bash
cp src/config.h.example src/config.h   # Wi-Fi / サーバーURL / device_id を編集
pio run                                # ビルド
pio run -t upload                      # 書き込み
```

VL53L5CX（ToF距離センサー）を Port A（赤）に接続: 3V3 / GND / SDA=G32 / SCL=G33。**電源は3V3（5Vは不可）**。
いいねは物理ボタンA。

### 配線確認用

```bash
pio run -e diag -t upload && pio device monitor   # I2Cアドレスを表示
```

## ローカル確認用モックサーバー

バックエンドなしで画像表示を確認する場合に使う。`test.jpg`（320x240 JPEG）を
`hardware/firmware/` に置き、`tools/mock_server.py` 内の IP を自分の PC に書き換えてから実行する。

```bash
python3 tools/mock_server.py   # ポート8000で待ち受け
```

## 切り分け用ファーム

センサーが反応しないときに使う。

```bash
pio run -e tofdiag -t upload && pio device monitor   # 測距できるか（Wi-Fi不使用）
pio run -e diag -t upload && pio device monitor      # I2Cアドレス一覧
```
