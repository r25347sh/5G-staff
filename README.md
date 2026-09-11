# G⁵ Portal（5G-staff）

麗澤高校 5年G組スタッフポータル。

## 主な機能

- **ログイン**: ID/パスワード + QRコード（カメラ前面/背面切替対応）+ **LINEログイン**
- **セッション永続化**: localStorage によりブラウザを閉じてもログイン状態を維持
- **シフト**: Supabase 優先（フォールバック: `src/data/shift.json` + GitHub Contents API）
- **通知**: admin / teacher からの一方通知 + 生徒の返信（生徒同士チャットは廃止）
- **アカウントメニュー**: メール登録（通知用）・LINE連携（LIFF）・ログアウト
- **LINE連携の恩恵**: プロフィール画像をアイコン表示 / 次回からLINEログインで自動サインイン / 連携状態表示
- **UI**: 未ログイン時は右上ログイン、ログイン後は右上アカウントメニュー（LINE画像対応）

## QRコード形式

```json
{"id":"ユーザーID","pass":"パスワード"}
```

または `id:pass` 形式も可。

## Supabase セットアップ（必須推奨）

1. [Supabase Dashboard](https://supabase.com/dashboard) → プロジェクト `ngjculhtbbxazgkkelvi`
2. SQL Editor で `supabase-schema.sql` の内容を実行
3. （任意）既存 `src/data/shift.json` のデータを `shifts` テーブルへ import

 anon key は `js/supabase.js` に埋め込み済み。

## LINE LIFF

`js/auth-ui.js` 先頭の `LIFF_ID` に、LINE Developers で作成した LIFF App ID を設定。

### 設定チェック（400 Bad Request が出るとき）

1. [LINE Developers](https://developers.line.biz/) → 対象チャネル → LIFF
2. **Endpoint URL** をサイトのルートに合わせる（例: `https://＜user＞.github.io/5G-staff/`）
3. LIFF アプリのサイズは Full 推奨。**外部ブラウザで開く**を許可
4. コールバックは LIFF が管理するため、独自の redirect をクエリ付きで渡さない（本リポジトリは pathname のみ使用）
5. 初回は **ID/パスワードでログイン → アカウントメニューから LINE 連携**。以降は LINE ログイン可

## ローカル確認

静的ホスト（GitHub Pages 等）で配信。PAT は `js/common.js` のフォールバックに依存（GitHub 書き込み時）。

## ファイル構成（主要）

```
index.html          … ポータルホーム（ログイン後の着地）
login.html          … ログイン（QRカメラ切替）
shift.html          … シフト
notifications.html  … 通知＋返信
admin.html          … 管理
js/
  common.js         … セッション・認証
  qr-login.js       … QRスキャン＋カメラ切替
  supabase.js       … Supabase クライアント
  auth-ui.js        … 右上ログイン / アカウントメニュー
  api.js            … GitHub Contents API（フォールバック）
supabase-schema.sql … テーブル定義
```

## 変更履歴（2026-09-08）

- QRログイン: 前面/背面カメラ切替
- ログイン後は `index.html` へ統一遷移
- シフト R/W を Supabase 優先に
- 生徒間チャット廃止 → 通知＋返信のみ
- 右上ログイン / アカウントメニュー（メール・LINE）
- **セッションを localStorage 永続化**（再訪問でもログイン維持）
- **LINEログイン**（連携済みなら自動サインイン）＋プロフィール画像をアイコン表示
- LINE連携時に pictureUrl を保存し、メニューに「LINE連携済み」表示
