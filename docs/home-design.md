# ホーム画面 設計書

## 目的
ゲーム開始前にログイン選択とスタートの意思決定を行い、将来的に Supabase 認証とセーブデータ連携を可能にする画面を分離する。

## スコープ
- MVP: Google ログイン / ゲストプレイ の選択ボタンとゲーム開始ボタン
- Supabase 統合は未実装。フォルダとインターフェイスだけ先に用意
- ログイン状態に応じてセーブデータを保存・復元できるようにする前提で設計

## 画面構成
```
src/scenes/HomeScene.js      # ホーム画面の状態管理と描画
src/auth/
  auth.js                    # 認証状態の保持（ローカルストレージ / Supabase 予定）
  providers/
    google.js                # Supabase Google Provider 連携予定
  supabase-client.js         # Supabase クライアント初期化予定
src/ui/
  home-ui.js                 # ボタンの描画とイベント
src/data/
  save/
    local-save.js            # ゲスト用ローカル保存
    cloud-save.js            # Supabase 用（将来）
```

## UI 要素
- タイトルロゴ
- 「Google でログイン」ボタン
  - クリック時に `auth.js` の `signInWithGoogle()` を呼ぶ想定。現状はダミーでゲストへ遷移
- 「ゲストでプレイ」ボタン
  - `auth.setGuest()` → `HomeScene.startGame()`
- 「ゲーム開始」ボタン
  - ログイン済み or ゲスト選択済みの場合のみ有効
  - 有効時は `GameLoop` を開始して `MainGameScene` に遷移

## 状態遷移
HomeScene → 初期表示
  ├─ Google ログイン → auth 状態更新 → ゲーム開始可能
  └─ ゲストプレイ → auth 状態更新 → ゲーム開始可能
ゲーム開始 → MainGameScene 初期化

## 技術メモ
- 認証は Supabase Auth for Google を想定
- セーブデータはユーザー ID ごとに Supabase Table `saves` に保存
- ゲストは `localStorage` に保存。ログイン時にマイグレーションを提示
- ホーム画面は Canvas 2D で描画。`GameLoop` はホームでも共通利用
- ルーティングは単一ページ。シーン切り替えで実装

## 今後のタスク
1. `HomeScene` のスケルトン作成
2. ボタンの描画とクリックハンドラ
3. `auth.js` のインターフェイス実装（ダミー）
4. Supabase 設定時に `supabase-client.js` と Google Provider 実装
5. セーブデータ同期ロジック実装
