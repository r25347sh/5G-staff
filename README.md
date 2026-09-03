# G⁵ Portal (5G-staff)

麗澤高等学校 5年G組 スタッフポータル。

## 機能
- シフト確認（リアルタイムステータス：外 / 間近 / 中 / 終了）
- マニュアル動的表示
- 管理画面（ログイン・シフトCRUD・バナー）
- PWA対応・通知ベル（間近シフトでバッジ＆通知）
- デザインは 5g-fest 完全準拠、MENUは radial Echo Bloom 型

## ユーザー
- admin / teacher / temporary / student（21名ランダム）
- 詳細は `src/data/users.json`

## 技術
- 静的サイト + GitHub Contents API（暗号化済みPATを実行時復号）
- CSS分割、共通 style.css + ページ固有

## デプロイ
GitHub Pages（/5G-staff/ パス想定）

© 2026 Reitaku H.S. 5G
