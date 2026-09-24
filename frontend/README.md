# frontend

フロントエンド 領域のディレクトリ。

## 仕様

このディレクトリでは [docs/spec/spec01.md](docs/spec/spec01.md) を**正（唯一の基準）**として進める。
仕様に変更が必要な場合は、まず spec01.md を更新してから実装する。

## 開発環境

React + Vite + TypeScript の PWA。

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # 型チェック + ビルド
npm run lint
```

主なライブラリ: react-easy-crop / TanStack Query / dnd-kit / vite-plugin-pwa
