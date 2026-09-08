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

## あなたがやること

### A. Supabase
SQL Editor で `supabase-schema.sql` の **mail_queue** 部分を実行（まだならファイル全体でOK）。

### B. GAS
1. **学校アカウント** で https://script.google.com
2. 新規プロジェクト → リポジトリ `gas/Code.gs` を貼る
3. エディタで `testSendSelf` を実行 → 権限承認 → 自分にテストメール
4. `processMailQueue` を1回実行（空でも可・権限のため）
5. **トリガー** を追加:
   - 関数: `processMailQueue`
   - イベント: 時間主導型
   - 1分おき（または5分おき）

ウェブアプリのデプロイは **不要** です。

### C. 受信者
ポータル右上 → メールアドレス登録。

### D. 動作確認
1. 誰かの user_profiles に email を入れる
2. 管理画面から通知送信
3. Supabase Table Editor で `mail_queue` に pending が付く
4. 最大1〜5分で GAS が sent にし、メールが届く

## 差出人
GAS を作ったアカウント（`r25347sh@hs.reitaku.jp` 推奨）
