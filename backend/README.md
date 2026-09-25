# backend

バックエンド 領域のディレクトリ。

## 仕様

このディレクトリでは [docs/spec/spec01.md](docs/spec/spec01.md) を**正（唯一の基準）**として進める。
仕様に変更が必要な場合は、まず spec01.md を更新してから実装する。

## 開発

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars   # Supabase / VAPID の値を設定
npm run dev        # wrangler dev
npm run typecheck
npm test
```

- DB: `supabase/migrations/0001_init.sql` を Supabase に適用(Storage の非公開バケット `images` も作成される)
- 本番の秘密情報は `wrangler secret put` で設定
- Cron は10分ごと(`wrangler.toml`)。表示切替と警告判定を `src/lib/cron.ts` にまとめている

## 動作確認用サイト

```bash
npm run dev                          # http://localhost:8787
python3 -m http.server 8000 -d test/frontend   # http://localhost:8000 (接続先はページ上部で リモート/ローカル を切替)
```
