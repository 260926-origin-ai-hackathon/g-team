# firmware

M5Stack Core2 + PIR センサー用ファーム。仕様は [../docs/spec/spec01.md](../docs/spec/spec01.md)。

## セットアップ

```bash
cp src/config.h.example src/config.h   # Wi-Fi / サーバーURL / device_id を編集
pio run                                # ビルド
pio run -t upload                      # 書き込み
```

PIR 出力は GPIO36（Port B）に接続。いいねは物理ボタンA。
