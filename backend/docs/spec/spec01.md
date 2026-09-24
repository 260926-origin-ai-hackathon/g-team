# バックエンド / DB 設計書

## 1. 前提

- Cloudflare Workers。Hono を使用
- Supabase (Postgres + Storage)
- MVP では認証なし。device_id / user_id は固定値
- Workers を通るのは JSON のみ。画像は Storage 直送

---

## 2. DB スキーマ

### devices — デバイス1台の状態
```sql
device_id         text        primary key
user_id           text        not null
current_image_id  uuid        null      -- いま Core2 に表示中
display_seq       int         default 0 -- 表示済みの通し番号
last_detected_at  timestamptz null      -- 最終検知 → 警告判定の基準
last_seen_at      timestamptz null      -- 最終ポーリング → 死活判定の基準
reset_hours       int         default 12
switch_time       time        default '00:00'  -- 切替時刻(JST)
last_switched_on  date        null      -- 最後に切り替えた日(重複防止)
test_mode         boolean     default false
warned_at         timestamptz null      -- 警告の重複防止 / 警告中の判定(子アプリはこれを見る)
warning_reason    text        null      -- no_detection|device_offline|demo
```

**last_detected_at と last_seen_at を分ける理由**
前者が古い → 親が動いていない。後者が古い → デバイスが落ちた。
この2つがないと、警告の原因を区別できない。

### images — 投稿画像
```sql
image_id       uuid        primary key
device_id      text        not null references devices
original_path  text        not null    -- 原寸(長辺1600px)
display_path   text        not null    -- 表示用(320×240)
crop_x         int         not null    -- 切り取り座標(原寸基準)
crop_y         int         not null
crop_w         int         not null
crop_h         int         not null
sort_order     double precision not null
status         text        default 'queued'  -- queued|displayed|deleted
displayed_at   timestamptz null
created_at     timestamptz default now()
```

**sort_order を double にする理由**

int だと並べ替えのたびに後続を全部振り直すことになる。
double なら `(前 + 後) / 2` で済み、UPDATE は1行。

```
[1.0] [2.0] [3.0]         初期
[1.0] [1.5] [2.0] [3.0]   間に挿入 → 1行UPDATEのみ
```

末尾追加は `MAX(sort_order) + 1.0`。
同じ隙間に50回以上挿し込むと精度が尽きるが、個人利用では起きない。
念のため、算出した間隔が 0.0001 未満なら全体を 1.0 刻みで振り直す。

**crop を持つ理由**
切り直しのとき、前回の枠を初期値として出せる。
表示用画像を作り直しても原寸は再利用できる。

### detections — 通過検知ログ
```sql
detection_id  uuid        primary key
device_id     text        not null references devices
detected_at   timestamptz not null
notified      boolean     not null  -- リセット後の初回だったか
```
全件残す。通知したものだけ残すと
「反応はあったが通知不要だった」が消え、デバッグできない。

### likes — いいねログ
```sql
like_id    uuid        primary key
device_id  text        not null references devices
image_id   uuid        null references images  -- 押された時の表示画像
liked_at   timestamptz not null
```

### push_subscriptions — 通知先
```sql
subscription_id uuid  primary key
user_id         text  not null
endpoint        text  not null
keys            jsonb not null
created_at      timestamptz default now()
```

### インデックス
```sql
create index on images (device_id, status, sort_order);
create index on detections (device_id, detected_at desc);
```

### Storage
```
images/{device_id}/{image_id}_original.jpg
images/{device_id}/{image_id}_display.jpg
```
バケットは非公開。署名付きURLで配布する(有効期限1時間)。

---

## 3. API

### ① 画像投稿
```
POST /devices/{device_id}/images
Content-Type: multipart/form-data

  original : <JPEG 長辺1600px>
  display  : <JPEG 320×240>
  crop     : {"x":120,"y":80,"w":1200,"h":900}

201
{ "image_id": "...", "sort_order": 8.0, "queued_count": 8 }
```
処理: Storage に2枚保存 → images に status='queued',
sort_order = MAX+1.0 で INSERT。**親への通知は行わない。**

### ② 画像リスト取得
```
GET /devices/{device_id}/images?status=all

200
{
  "current_image_id": "uuid-c",
  "display_seq": 5,
  "queued_count": 7,
  "last_detected_at": "2026-09-24T08:00:00Z",
  "images": [
    { "image_id":"uuid-a",
      "original_url":"https://...(署名付き)",
      "display_url":"https://...(署名付き)",
      "crop": {"x":120,"y":80,"w":1200,"h":900},
      "status":"displayed",
      "displayed_at":"2026-09-20T15:00:00Z",
      "sort_order":1.0 }
  ]
}
```

### ③ 並べ替え
```
PATCH /devices/{device_id}/images/{image_id}
  { "after_image_id": "uuid-a" }   -- この直後に置く
  { "after_image_id": null }       -- 先頭に置く

200 { "sort_order": 1.5 }
```
**中間値はサーバーが計算する。**
複数端末からの同時操作でも不整合が起きない。

```
after が null   → new = MIN(sort_order) - 1.0
after が末尾    → new = after.sort_order + 1.0
それ以外        → new = (after + 次) / 2
間隔が 0.0001 未満 → 全体を 1.0 刻みで振り直す
```
status='displayed' は対象外(400を返す)。

### 画像の削除
```
DELETE /devices/{device_id}/images/{image_id}
  → status='deleted' に更新(論理削除)
```
status='displayed' は削除不可。履歴として残す。

### ④ 設定変更
```
PATCH /devices/{device_id}/settings
  { "test_mode": true }
  { "switch_time": "07:00" }

200 { 更新後の設定 }
```
test_mode の意味:
```
true  → reset_hours 相当 = 1秒 / ポーリング間隔 = 5秒
false → reset_hours = 12時間  / ポーリング間隔 = 600秒
```

### テスト用の即時切替
```
POST /devices/{device_id}/display/advance
  → 日次切替と同一の関数を呼ぶ
```
**本番とテストで経路を分けない。**
分けると、テストで通った道と本番の道が別物になる。

### Push購読の登録
```
POST /users/{user_id}/push-subscriptions
  { "endpoint": "...", "keys": {...} }
```

### 状態取得(子アプリ用)
```
GET /devices/{device_id}/status

200 { "last_seen_at":..., "last_detected_at":..., "warned_at":...,
      "warning_reason":"no_detection|device_offline|demo|null",
      "is_offline": false, "test_mode": false, ... }
```
`GET /images` にも同じ項目と、画像ごとの `like_count` / `last_liked_at` を含める。
Push は使わない。子アプリはポーリングで `warned_at` を見て警告を表示する。

### 警告のデモ発火
```
POST   /devices/{device_id}/warnings  { "reason": "demo" }  -- 警告状態にする
DELETE /devices/{device_id}/warnings                         -- 手動解除
```
次の検知(リセット後の初回)でも自動解除される。

### ⑥ 通過検知
```
POST /devices/{device_id}/detections
  { "detected_at": "2026-09-24T10:00:00Z" }   -- 省略・{} 可(サーバー受信時刻を使う)

200 { "ok": true }
```

### ⑦ いいね
```
POST /devices/{device_id}/likes
  { "image_id": "uuid-c" }

200 { "ok": true }
```

### ⑧ ポーリング(ハートビート兼用)
```
GET /devices/{device_id}/display?current={表示中のimage_id}

変化なし 200
  { "changed": false, "next_poll_sec": 600 }

変化あり 200
  { "changed": true,
    "image_id": "uuid-d",
    "url": "https://...(署名付き、display_path)",
    "next_poll_sec": 600 }
```
- current を渡すので、通常時は数十バイトで済む
- **next_poll_sec を返すことで、テストモード切替に
  ファーム更新が不要になる**
- このリクエストの到達で last_seen_at を更新 → 死活監視を兼ねる

---

## 4. 内部処理

### 通過検知の判定(⑥ の中)
```
detections に INSERT
  ↓
last_detected_at + reset_hours <= now ?
  ├ YES → リセット後の初回
  │        devices.last_detected_at = now
  │        devices.warned_at = null      ← 警告状態を解除
  │        notified = true
  │        子へ Push(type=detection)
  └ NO  → 期間内の2回目以降
           devices.last_detected_at = now
           notified = false
           通知しない
```
**判定をサーバーに置く理由**
デバイス側に持たせると再起動で状態が飛び、
間隔の変更にファーム更新が必要になる。

### Cron(10分ごと)

警告判定と表示切替を1つにまとめる。
切替時刻を自由に設定できるようにしたため、日次固定にできない。

```
【表示切替】
switch_time を過ぎている かつ last_switched_on < 今日 ?
  ↓ YES
  status='queued' を sort_order 昇順で1件取得
    ├ あり → status='displayed', displayed_at=now
    │        current_image_id を更新, display_seq += 1
    │        last_switched_on = 今日
    │        子へ Push(type=display_changed)
    └ なし → last_switched_on = 今日(前日の表示を継続)

【警告判定】
now - last_detected_at >= reset_hours かつ warned_at が未設定 ?
  → 子へ Push(type=warning, reason=no_detection)
     warned_at = now

now - last_seen_at >= 30分 かつ warned_at が未設定 ?
  → 子へ Push(type=warning, reason=device_offline)
     warned_at = now
```

**切替ロジックはこの関数だけに閉じる。**
「最新1枚」「1日複数回」等に変えるときも、触るのはここのみ。
メイン側は devices.current_image_id しか見ない。

**warned_at の役割**
10分ごとの判定で警告が連投されるのを防ぐ。
次の検知で null に戻り、再び警告できる状態になる。

### 時刻の扱い
- DB はすべて UTC で保存する
- switch_time は JST。判定時に UTC へ変換する
- Cloudflare の Cron は UTC 基準

---

## 5. データ量の見積もり

```
ポーリング  10分間隔 = 144回/日、数十バイト/回   → 無視できる
検知POST    数十回/日、約100バイト/回           → 無視できる
画像取得    1回/日、20〜40KB                   → 1日40KB
画像投稿    数枚/日、原寸 数百KB + 表示用 30KB   → Storage 直行

年間のStorage: 1日1枚として約 150MB(Supabase無料枠 1GB)
```

---

## 6. 将来の拡張に向けた準備

| 項目 | 準備 |
|---|---|
| 認証 | 全テーブルに device_id / user_id を保持済み |
| 複数デバイス | API が /devices/{device_id}/ 形式 |
| 親側アプリ | 原寸を保存済み。画像リストAPIをそのまま使える |
| 画面切り替え | current_display の概念を独立させてある |
| 切替方式の変更 | Cron内の切替関数1つを差し替えるだけ |