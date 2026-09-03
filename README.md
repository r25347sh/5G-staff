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

## やりたいこと（次）
お願いします。
どれだけ時間をかけて熟考・生成・実行しても構いません。
また、追加仕様として、各userには、「name」の項目も追加。
そして、userに「idがランダムな5文字の文字列」で、「nameが未定義」で、「passがランダムな7文字の文字列」で、「roleがstudent」のアカウントを21個作成。また、「idがOhaShi」で「passが5g%&!Butsuri」で「roleがteacher」のアカウントを作成。そして、shift.jsonにidで、user_idと、shift_idを用意し、「user_id」は、users.jsonに紐付けられたidを使用し、「shift.id」はランダムなものを生成。
ログイン中のアカウントと紐付けられたshiftが間近ステータスになったら、通知（できればプッシュ通知。PWAでもそう。プッシュ通知ができてもできなくても、サイト画面の右上に常設されているベル型の通知アイコンに通知バッジを付与し、通知を出す。）
また、一人につき、シフトが複数発生する可能性がある。

PATは、ハードコアしていいよ。だけど、暗号化して、それを随時、復元したものを自動で使用。

モバイルでの表示崩れ厳禁。
