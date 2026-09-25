# g-team

ビジネス重視ハッカソン（24時間）向けのチームリポジトリ。

| ディレクトリ | 内容 |
|---|---|
| [frontend](frontend/README.md) | フロントエンド |
| [backend](backend/README.md) | バックエンド |
| [hardware](hardware/README.md) | ハードウェア |
| [docs](docs/README.md) | 議事録・仕様・ルール |

Gitの運用は [docs/rules/git.md](docs/rules/git.md) を参照。

## デモ・デプロイ

- デプロイURL: https://g-team-frontend.originteamg.workers.dev/
- デモ動画（YouTube）: https://www.youtube.com/shorts/zTLzuCo8vfQ

## アプリの実行方法

### デプロイ版を使う（推奨）

上記のデプロイURLをスマホまたはPCのブラウザで開くだけで利用できる。

### ローカルで実行する

Node.js 22 が必要。

```bash
cd frontend
npm ci
VITE_API_MODE=demo 
npm run dev   # http://127.0.0.1:5173
```

- `VITE_API_MODE=demo` はバックエンド・ハードウェア無しでUIのみ確認できるモード。状態はメモリ内のみで、再読み込みで消える。
- 実接続する場合は `frontend/.env.example` を `frontend/.env.local` にコピーして設定する。バックエンドの起動手順は [backend/README.md](backend/README.md) を参照。

### ハードウェアを使うため利用できない機能

本アプリは専用ハードウェア（デバイス）と連携する。デバイスが手元に無い環境（デプロイ版・ローカルのdemoモード）では、次の機能は動作しない、または模擬データの表示になる。

- デバイスからの実データ取得・実機への写真送信
- 実機の状態に基づく警告・いいねの通知
- デモモードのサンプル写真・状態は実データではない

上記以外（ホーム、ギャラリー、写真投稿、並べ替え、設定などのUI操作）は、デバイス無しでも確認できる。
