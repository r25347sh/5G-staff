-- G⁵ Portal — 管理者ツール向けインデックス / 補助（任意）
-- Supabase SQL Editor で実行可能。既存スキーマを壊しません。

-- シフト検索・並び替え高速化
create index if not exists idx_shifts_time_start on public.shifts (time_start);
create index if not exists idx_shifts_tanto on public.shifts (tanto);
create index if not exists idx_shifts_user on public.shifts (user_id);
create index if not exists idx_shifts_open_urgent on public.shifts (open, urgent) where open = true;

-- 通知・返信（既存と重複しても if not exists で安全）
create index if not exists idx_notif_created on public.notifications (created_at desc);
create index if not exists idx_replies_nid on public.notification_replies (notification_id);
create index if not exists idx_replies_author on public.notification_replies (author_id);

-- 役割別集計の参考ビュー（クライアントでも可。DB側で見たい場合用）
create or replace view public.v_shift_tanto_stats as
select
  coalesce(nullif(tanto, ''), '（未設定）') as tanto,
  count(*)::int as total,
  count(*) filter (where coalesce(open, false) = false and user_id is not null and user_id <> 'open')::int as confirmed,
  count(*) filter (where coalesce(open, false) = true or user_id is null or user_id = 'open')::int as open_slots,
  count(*) filter (where coalesce(urgent, false) = true and (coalesce(open, false) = true or user_id is null or user_id = 'open'))::int as urgent_open
from public.shifts
group by 1
order by 1;

-- Realtime が未設定の環境向け（既に追加済みならエラーを無視してよい）
-- alter publication supabase_realtime add table public.shifts;
-- alter publication supabase_realtime add table public.notifications;
-- alter publication supabase_realtime add table public.notification_replies;
