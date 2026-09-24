# frontend

フロントエンド 領域のディレクトリ。

## 仕様

このディレクトリでは [docs/spec/spec01.md](docs/spec/spec01.md) を**正（唯一の基準）**として進める。
仕様に変更が必要な場合は、まず spec01.md を更新してから実装する。

## 起動・確認

Node.js 22 を使用。

```bash
cd frontend
npm ci
# UIだけを確認。実機・サーバーへの送信はしない
VITE_API_MODE=demo npm run dev
npm test
npm run build
npm run preview
```

実接続は `.env.example` を `.env.local` にコピーして設定する。デフォルトは live で、未設定なら接続準備中を表示する。API障害時にデモへ自動で切り替えることはない。demoの状態はメモリ内のみで、再読み込みすると消える。サンプル画像は自作SVGで実際の家族写真ではない。

Cloudflare Pages: root directory `frontend`、build command `npm run build`、output `dist`。環境変数はビルド前に設定する。公開操作はチームの担当者が行う。PWAは本番ビルドとHTTPS上で確認する。Service Workerはアプリの静的ファイルのみキャッシュし、API・写真は永続キャッシュしない。

## 実装範囲

- スマホ/デスクトップ対応のホーム、写真投稿、設定
- 長辺1600px JPEG化 → 4:3トリミング → 320×240 JPEG生成
- dnd-kitによる並べ替え、キーボード/矢印操作、失敗時ロールバック
- 未表示写真の削除確認、削除後の再投稿による切り直し
- 原寸での履歴表示、通信/未取得/エラー表示
- アプリを開いている間の警告・いいね表示（Pushなし）
- テストモードの常時表示、即時切替

接続契約と未確定事項は [docs/integration.md](docs/integration.md) を参照。
