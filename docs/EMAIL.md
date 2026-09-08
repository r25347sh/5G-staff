# メール自動送信

## 方針

- 通知（admin/teacher 発信）時に、`user_profiles.email` が登録されているユーザーへメール
- 送信元: `r25347sh@hs.reitaku.jp`（推奨）
- 実装: Supabase Edge Function + Resend（無料枠あり）

## セットアップ手順

1. Resend アカウント作成 → API Key 発行
2. Resend で Domain `hs.reitaku.jp` を追加し、学校側 DNS に SPF/DKIM を設定  
   （学校ドメインの DNS を触れない場合は暫定で `onboarding@resend.dev` を From にし、Reply-To を `r25347sh@hs.reitaku.jp` にする）
3. Supabase CLI:

```bash
supabase login
supabase link --project-ref ngjculhtbbxazgkkelvi
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set MAIL_FROM=r25347sh@hs.reitaku.jp
supabase secrets set MAIL_FROM_NAME="G⁵ Portal"
supabase functions deploy send-notification-email
```

4. サイト側は通知送信時に自動で `G5Supabase.notifyEmail` を呼びます（未デプロイなら無視）

## 動作条件

- 受信者はアカウントメニューから **メールアドレス登録** 済みであること
- Edge Function がデプロイされ、Secrets が設定されていること

## 代替案

| 方式 | メリット | デメリット |
|------|----------|------------|
| Resend + Edge Function（採用） | 実装が軽い・配信品質 | ドメイン認証が必要 |
| 学校 SMTP 直叩き | From を確実に学校メアドにできる | SMTP 資格情報・TLS 設定が必要 |
| EmailJS などクライアント送信 | 手早い | キー露出・件数制限 |

学校の SMTP（Outlook/Google Workspace 等）が使えるなら、Edge Function 内を SMTP 送信に差し替え可能です。
