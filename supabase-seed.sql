-- 既存 notifications.json の1件を移行
-- ※ notifications.id が text の場合用。uuid のままだと id 指定 insert は型に合わせて調整してください。

-- スキーマで id が uuid の場合は gen に任せる版:
insert into public.notifications (
  title, body, author_id, author_name, target, type, level, link, created_at
) values (
  '急募のお知らせ',
  '13:00–15:00（大富豪）募集中 — みんなおうぼしてー！',
  'r25347sh',
  '管理者',
  '"all"',
  'urgent',
  'urgent',
  'shift.html',
  '2026-09-07T23:14:44.217Z'
);

-- shift.json は空 [] のためシード不要
