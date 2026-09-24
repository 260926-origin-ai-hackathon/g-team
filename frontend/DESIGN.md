---
name: 家族の毎日
colors:
  primary: '#285c48'
  text: '#292b29'
  muted: '#666963'
  background: '#faf9f6'
  surface: '#ffffff'
  border: '#e5e4de'
typography:
  body:
    fontFamily: Noto Sans JP
    fontSize: 16px
    lineHeight: '1.7'
  heading:
    fontFamily: Noto Sans JP
    fontSize: 28px
    fontWeight: 700
rounded:
  control: 12px
  card: 20px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
---

## Overview
子ども側の写真共有・見守り画面。静かで明快な状態表示と、写真の温かさを両立する。既存API・チーム仕様を保持し、親用Webアプリはこの変更に含めない。

## Colors
配色・文字サイズの実装は `src/theme.css` にまとめ、配置や動きと分けて調整する。
背景は温かい白、カードは白、本文はチャコール。緑は主要操作と生活反応に限定する。いいねは控えめな赤茶。赤茶は無反応の確認、黄土色は機器の通信、灰色は未取得を表す。色だけで区別せず、文言・アイコン・時刻を添える。

## Typography
補足14px、本文・操作16px、節見出し20px、画面見出し28px、重要な数値32pxの5段階。本文400、操作500、見出し・重要情報700を基本にする。日本語を使い、装飾目的の英語見出しを入れない。数値は等幅数字。見出しは自然な改行を優先する。

## Layout
最終検知→写真→順番の管理。24〜32pxで情報群を分け、群の内部は8〜16px。スマホは一列、デスクトップは写真と補助操作の二列。読み込み中も写真の比率を保持する。

## Elevation & Depth
写真カードにごく薄い影。ダイアログは背景を暗くし、写真・操作に集中させる。不要な飾りは増やさない。

## Shapes
外側の角丸から内側の余白を引いて写真の角丸を決める。操作領域は原則44px以上。写真は表示用の切り抜きを保持し、詳細では原寸全体を見せる。

## Components
ボタン押下160ms、ダイアログ出現240〜260ms、退出140ms。状態の更新で画面全体を動かさない。いいねは表示時に短い反応を添え、記録は残す。閉じる操作を遅い演出で妨げない。動きを減らす設定ではアニメーションを無効にする。モーダルは背景スクロールを止め、閉じたら元の操作へフォーカスを戻す。

## Do's and Don'ts
- 取得失敗・未取得・機器オフライン・生活反応なしを混同しない。
- サーバーが選択した写真を、実機で表示成功した証拠と断定しない。
- いいね・警告ともOSのPush通知は使わない。アプリを開いている間のポーリングで表示を更新する。
- デモは常にデモと明示する。デモ画像は実際の家族写真ではない。
- API契約の推測や新しい依存追加を、見た目の改善に混ぜない。

参考: https://jakub.kr/writing/details-that-make-interfaces-feel-better
参考: https://emilkowal.ski/ui/you-dont-need-animations
調査メモ: codex-ui-research.md (2026-09-25)。上記の細部と動きの指針を本画面に合わせて適用。
