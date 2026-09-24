# フロントエンド接続メモ

正の仕様は `docs/spec/spec01.md`。本書は未定義部分を確定扱いせず、実装の接続境界を示す。

## API担当と合わせる事項

1. `VITE_API_BASE_URL`（末尾スラッシュなし）、固定 `VITE_DEVICE_ID` / `VITE_USER_ID`。
2. CORS: Pagesとlocalhostの必要なorigin、GET/POST/PATCH/DELETE/OPTIONS。
3. 写真: フロント仕様とAPI①どおり、現時点では `POST /devices/{id}/images` の multipart。全体/バックエンド前提の「Storage直送・WorkersはJSONのみ」と矛盾している。直送を選ぶなら署名アップロード予約・確定APIの契約が必要。フロントは `src/lib/api.ts` のuploadのみ差し替える。
4. 状態取得APIは未定義。`VITE_STATUS_PATH` にパスを設定するまで取得しない。期待形式は下記。未取得を正常表示にしない。
5. 設定GETも未定義。`VITE_SETTINGS_PATH` で指定する。未取得の初期時刻はサーバー保存済みとは扱わない。
6. 切り直しはUI実装済み。`VITE_RECROP_PATH` が未設定なら無効。暫定adapterはPATCH multipart（display/crop）だが、正式契約確定後に更新する。
7. いいねの一覧取得形式は未定義。任意 `images[].liked_at` を扱う。未提供なら「いいね情報は未取得」とする。
8. PushのVAPID公開鍵とpayload形式（type/reason/id）。秘密鍵はフロントへ入れない。

パス設定では `{device_id}` / `{image_id}` を置換できる。環境変数名がAPI自体の存在を保証するものではない。

```json
{
  "last_detected_at": "2026-09-25T00:00:00Z",
  "last_seen_at": "2026-09-25T00:01:00Z",
  "reset_hours": 12,
  "test_mode": false
}
```

設定GET/PATCHの期待応答:

```json
{"switch_time":"00:00","test_mode":false}
```

cropは縮小済み原寸JPEGに対する整数ピクセル `{x,y,w,h}`。react-easy-cropの `{width,height}` とadapterで変換する。

## 確認の境界

- 前画面の参考計画のAuth/親iPad/Resendは採用しない。現在のチーム仕様どおり子側PWAのみ。
- 認証なしの固定IDデモ。公開する場合も実際の家族写真・個人情報を入れない。複数家庭の実運用は範囲外。
- サーバーのcurrent_image_idは「表示指示」を表す。実機描画完了の確認応答がない現行仕様では実機が実際に表示した証明にはならない。
- warningのrequireInteractionは要求を付与するが、OS/ブラウザによる保持を保証しない。
- Push許可はユーザーの「通知を設定」操作時に求める。iOSはホーム追加を先に案内。拒否や公開鍵未設定を成功扱いしない。
- テストモードは実機短周期ポーリングと通知間隔の変更。画面デモ（サーバー未接続）とは別。
- ステータスの30秒取得は、サーバーのCronの実行間隔を短縮しない。
- 署名付きURLは5分ごと/復帰/通知時に画像リストを再取得。切り直しの原寸取得にはStorage側のCORSが必要。

## 実機接続後の確認

1. 固定IDで画像一覧・設定・観測を取得。
2. 縦向き写真を投稿し、原寸1600px以内/表示用320×240/crop基準を確認。
3. 並べ替え、削除、切り直しを実APIで確認。失敗時の巻き戻しも確認。
4. iPhoneのホーム追加、Push許可、バックエンド登録、アプリ閉鎖中の実受信を確認。
5. Core2の切替といいねを確認。現在の表示指示と実機表示を照合。
6. 通信断/未検知を確認。PWA更新が編集中の写真を破棄しないことを確認。

## 検証記録（2026-09-25）

- TypeScript + Vite本番ビルド、PWA Service Worker生成：成功。
- Vitest 15件：状態分離、未来時刻、並べ替え、画像寸法、通知文言を確認。
- ローカルブラウザの画面デモ：スマホ/デスクトップ表示、警告/通信断、画像選択と投稿、切り直しとプレビュー、矢印並べ替え、削除確認、07:30の保存とテストモード切替を確認。ブラウザコンソールのerror/warnなし。
- npm audit: 開発依存Vitest/@vitest/mockerのmoderate 2件。テストサーバーは公開しない。修正版への更新と再テストが必要。強制更新は未実施。
- 未検証：実API接続、実機Core2、実iPhoneでのPush、Cloudflare Pages公開、ドラッグの実スマホ操作、オフラインの本番SW動作。
