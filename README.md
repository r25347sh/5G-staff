# G⁵ Portal (5G-staff)

麗澤高等学校 5年G組 スタッフポータル。

## 機能
- **シフト確認** … リアルタイムステータス（シフト外 / 間近 / 中 / 終了）＋ログインで「自分のシフトのみ」
- **マニュアル** … `src/data/manuals.json` 経由で md を動的一覧・表示
- **管理画面** … admin/teacher/temporary ログイン後、シフト CRUD（追加・編集・削除）＋バナー（ページ選択可）を GitHub に保存
- **PWA** … manifest + Service Worker
- **通知ベル** … シフト間近のバッジ・通知
- **MENU** … 空白クリックで radial Echo Bloom 型
- デザインは **5g-fest** 準拠

## ページ
| ファイル | 内容 |
|----------|------|
| `index.html` | トップ |
| `shift.html` | シフト一覧・ログイン・ステータス |
| `manual.html` | マニュアル |
| `admin.html` | 管理 |

## データ
- `src/data/shift.json`
- `src/data/users.json`
- `src/data/banner.json`
- `src/data/manuals.json` + `src/data/manual/*.md`

## ユーザー（初期）
- `r25347sh` / `kes-2592` (admin)
- `temporary1` / `ajrT%b&#hi` (temporary)
- `temporary2` / `bR12)njsufnNnsi` (temporary)

## デプロイ
GitHub Pages。相対パス対応済み。

© 2026 Reitaku H.S. 5G
