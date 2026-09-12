-- notifications に type / level / link が無い環境向け
-- Supabase SQL Editor で実行

alter table public.notifications add column if not exists type text default 'broadcast';
alter table public.notifications add column if not exists level text default 'normal';
alter table public.notifications add column if not exists link text;

-- 既存行の NULL を補完
update public.notifications set type = 'broadcast' where type is null;
update public.notifications set level = 'normal' where level is null;
