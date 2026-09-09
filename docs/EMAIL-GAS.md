# メール通知（麗澤 Google Workspace）

## なぜウェブアプリ「全員」が要らないか

学校契約では「アクセスできるユーザー」が **麗澤大学内の全員** などに固定され、  
外部サイトからの匿名 POST ができません。

そのため **メールキュー方式** を使います。

```
通知送信 → Supabase mail_queue に pending 追加
         → GAS が1分おきにキューを読む
         → GmailApp で学校メアドから送信
```

## あなたがやること（必須チェックリスト）

### A. Supabase
1. [Supabase Dashboard](https://supabase.com/dashboard) → プロジェクト `ngjculhtbbxazgkkelvi`
2. SQL Editor で `supabase-schema.sql` を実行（全体でOK）
3. Table Editor で `mail_queue` / `user_profiles` が見えることを確認

### B. GAS（学校アカウント）
1. **学校アカウント**（推奨: `r25347sh@hs.reitaku.jp`）で https://script.google.com
2. 新規プロジェクト → リポジトリの `gas/Code.gs` を**全文**貼り付け
3. エディタで `testSendSelf` を実行 → 権限承認 → 自分にテストメールが届くこと
4. `processMailQueue` を1回実行（空でも可・権限のため）
5. **トリガー** を追加:
   - 関数: `processMailQueue`
   - イベント: 時間主導型
   - 1分おき（または5分おき）

ウェブアプリのデプロイは **不要** です。

### C. 受信者（ポータル）
1. ポータルにログイン
2. 右上アカウントメニュー → **メールアドレス登録**
3. 自分の受信可能なメールを保存

### D. 動作確認
1. 管理画面（admin）→ 通知送信タブでテスト通知を送る
2. Supabase Table Editor → `mail_queue` に `status=pending` の行が増える
3. 最大1〜5分で GAS が `sent` にし、メールが届く
4. 届かない場合:
   - GAS 実行ログ（実行数）を確認
   - `mail_queue.error` 列を確認
   - 迷惑メールフォルダを確認
   - 受信者が `user_profiles.email` に入っているか確認

## 差出人
GAS を作ったアカウント（`r25347sh@hs.reitaku.jp` 推奨）

## 送信対象ルール（クライアント）

| 宛先 | メール送信先 |
|------|----------------|
| `all` | `email` 登録済み & `notify_email !== false` の全員 |
| `students` | users.json の student/temporary のうち同上 |
| `staff` | users.json の admin/teacher/temporary のうち同上 |
| 個別 ID / 配列 | 指定 user_id のうち同上 |

## 関連ファイル
- `js/email.js` … キュー投入
- `gas/Code.gs` … キュー処理・Gmail送信
- `supabase-schema.sql` … `mail_queue` 定義
- `js/notif.js` … 通知送信時に `G5Email.sendNotificationEmail` を呼ぶ
