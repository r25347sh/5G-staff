# G⁵ Portal (5G-staff)

麗澤高等学校 5年G組 スタッフポータル。

## 機能

- **シフト確認** … **9/12 固定**（時間のみ設定）。ステータス（外 / 間近10分前 / 中 / 終了）
- **一括登録** … 同じ時間帯に複数人を一括追加
- **役割** … 受付 / 総務 / ブラックジャック / ポーカー / チンチロ / 大富豪
- **急募** … 全員 / 特定複数人向け。人数指定。定員到達で急募終了通知。**急募投稿時は対象者へ通知**
- **通知** … サイト内ベル + ブラウザ／PWA プッシュ。admin/teacher から一対一・一対多送信可
- **スレッド** … 掲示板（投稿・返信）
- **クラスチャット** … スタッフ用グループチャット
- **ログイン** … 独立 `login.html`（ID/PASS・QR・前回ID記憶）
- **CSV / PDF エクスポート** / **バナー / PWA / MENU**

## ページ

| ファイル | 内容 |
|----------|------|
| `index.html` | トップ |
| `login.html` | ログイン（専用） |
| `shift.html` | シフト一覧・急募応募 |
| `chat.html` | クラスチャット |
| `threads.html` | スレッド |
| `manual.html` | マニュアル |
| `admin.html` | 管理（シフト / 急募 / 通知送信 / バナー 等） |

## データ

- `src/data/shift.json` / `users.json` / `banner.json`
- `src/data/notifications.json` … 通知キュー
- `src/data/threads.json` … スレッド
- `src/data/chat.json` … チャットメッセージ
- `src/data/manual/` … `.gitkeep`（md 追加でマニュアル復活）

## ユーザー（初期）

- `r25347sh` / `kes-2592` (admin)

## デプロイ

GitHub Pages。

© 2026 Reitaku H.S. 5G
