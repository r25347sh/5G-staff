-- 通知レベル・種別・リンクを保存するために必須
alter table public.notifications add column if not exists type text default 'broadcast';
alter table public.notifications add column if not exists level text default 'normal';
alter table public.notifications add column if not exists link text;

-- 確認用
-- select column_name, data_type from information_schema.columns
-- where table_name = 'notifications' order by ordinal_position;
