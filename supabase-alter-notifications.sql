-- 既存 notifications に不足カラムを追加（任意）
-- JS 側は type/level/link なしでも動作するよう修正済み
alter table public.notifications add column if not exists type text default 'broadcast';
alter table public.notifications add column if not exists level text default 'normal';
alter table public.notifications add column if not exists link text;
