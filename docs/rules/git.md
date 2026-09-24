# Git運用ルール

## ブランチ構成

- `main`: 本番・提出用。常に動作する状態を保つ。
- `develop`: 開発の統合先。
- 作業ブランチ: 必ず `develop` から切る（`main` から切らない）。

## マージ権限（最重要）

- **`develop` から `main` へのマージは、GitHubアカウント `kdix-23-240`（カシュー）以外は絶対に禁止。**
- `main` への直接pushも禁止。

## develop までのルール

- `develop` へ push / マージする前に、必ず手元でテスト・動作確認を行い、確実に動く状態にする。
- 動かないコードを `develop` に入れない。壊れた場合は直ちに修正または revert する。

## 作業の流れ

1. `develop` を最新にする（`git pull`）。
2. `develop` から作業ブランチを切る（例: `feature/frontend-login`, `fix/backend-auth`）。
3. 小さい単位でコミットする。メッセージは何をしたかが分かるように書く。
4. テスト後、`develop` へ Pull Request を出す。
5. レビュー後に `develop` へマージする。

## その他

- 仕様は各ディレクトリの `docs/spec/spec01.md` を正とする。
- 議事録・コミット・PRに個人名を書かない。
- 秘密情報（APIキー、パスワード、`.env`）はコミットしない。
- force push（特に `develop` / `main`）は禁止。
- 他人のブランチに無断でpushしない。
