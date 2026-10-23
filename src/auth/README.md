# 認証（今後実装）

このフォルダには Supabase Auth を利用した Google ログインを追加します。

- `supabase-client.js`: 環境変数から Supabase クライアントを初期化
- `auth.js`: ログイン状態、ログアウト、セッション復元を管理
- `providers/google.js`: Google OAuth の開始とコールバック処理

ログイン済みのユーザーにはユーザー ID ごとのセーブデータ同期を提供する予定です。現時点では認証処理・Supabase SDK・環境変数を追加していません。
