# メール自動送信

## 方針（現在の本線）

**学校 Workspace 制約のため、本線は GAS + `mail_queue` です。**  
手順は [`EMAIL-GAS.md`](./EMAIL-GAS.md) を参照。

- 通知（admin/teacher 発信）時に、`user_profiles.email` が登録されているユーザーへメール
- `notify_email === false` のユーザーは除外
- 差出人: GAS 実行アカウント（推奨 `r25347sh@hs.reitaku.jp`）

## 代替: Resend + Edge Function

ドメイン認証や SMTP が使える場合のオプション。本線が GAS のため、通常は不要。

1. Resend アカウント作成 → API Key 発行
2. Resend で Domain `hs.reitaku.jp` を追加し、学校側 DNS に SPF/DKIM を設定  
   （触れない場合は暫定で `onboarding@resend.dev` を From、Reply-To を学校メアド）
3. Supabase CLI:

```bash
supabase login
supabase link --project-ref ngjculhtbbxazgkkelvi
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set MAIL_FROM=r25347sh@hs.reitaku.jp
supabase secrets set MAIL_FROM_NAME="G⁵ Portal"
supabase functions deploy send-notification-email
```

4. サイト側は `G5Email` が無い場合のみ `G5Supabase.notifyEmail`（Edge Function）を呼ぶ

## 動作条件

- 受信者はアカウントメニューから **メールアドレス登録** 済み
- **本線**: `mail_queue` テーブル + GAS トリガー
- **代替**: Edge Function デプロイ + Secrets

## 方式比較

| 方式 | メリット | デメリット |
|------|----------|------------|
| **mail_queue + GAS（採用・本線）** | 学校メアドから送れる・匿名公開不要 | GAS トリガー設定が必要 |
| Resend + Edge Function | 実装が軽い | ドメイン認証が必要 |
| 学校 SMTP 直叩き | From を確実に学校メアドに | 資格情報・TLS 設定 |
| EmailJS などクライアント送信 | 手早い | キー露出・件数制限 |
