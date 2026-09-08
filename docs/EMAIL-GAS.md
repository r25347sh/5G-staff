# メール通知（Google Apps Script / 学校 Workspace）

麗澤の Google Workspace 向け。差出人はデプロイした学校アカウント（例: r25347sh@hs.reitaku.jp）。

## 手順

1. [Google Apps Script](https://script.google.com) を **学校アカウント** で開く
2. 新しいプロジェクト → `gas/Code.gs` の内容を貼る
3. `SEND_TOKEN` を長いランダム文字列に変更（例: 32文字以上）
4. 上部「デプロイ」→「新しいデプロイ」
   - 種類: **ウェブアプリ**
   - 実行ユーザー: **自分**
   - アクセスできるユーザー: **全員**
5. 承認（学校の権限ダイアログ）を許可
6. 表示された URL をコピー
7. サイトの `js/email.js` を編集:
   ```js
   var GAS_URL = "https://script.google.com/macros/s/XXXX/exec";
   var GAS_TOKEN = "（Code.gs と同じトークン）";
   ```
8. コミット / デプロイ後、管理画面から通知を送り、登録メールに届くか確認

## 受信者

右上アカウントメニュー → **メールアドレス登録** をしたユーザーのみ。

## 制限（目安）

- Workspace の Gmail 送信上限（通常は個人より緩い）
- 1通知あたり BCC 分割で送信

## セキュリティ

- URL はリポジトリに入るが、**トークン無しでは送れない**
- トークンは coee と email.js で一致させる
- 漏洩したら SEND_TOKEN を変えて再デプロイ
