-- G⁵ Portal Supabase schema
-- Project: ngjculhtbbxazgkkelvi
-- SQL Editor で実行してください

-- 1. shifts（シフト本体）
create table if not exists public.shifts (
  shift_id text primary key,
  user_id text,
  date text default '2026-09-12',
  time_start text not null,
  time_end text not null,
  tanto text,
  note text,
  open boolean default false,
  urgent boolean default false,
  target jsonb default '"all"',
  slots_needed int default 1,
  slots_filled int default 0,
  assignees jsonb default '[]',
  filled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. user_profiles（メール・LINE連携）
create table if not exists public.user_profiles (
  user_id text primary key,
  email text,
  line_user_id text,
  line_display_name text,
  notify_email boolean default true,
  notify_line boolean default true,
  updated_at timestamptz default now()
);

-- 3. notifications（admin/teacher → 一方通知）
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id text not null,
  author_name text,
  author_role text,
  target jsonb default '"all"',  -- "all" | ["userId", ...]
  created_at timestamptz default now()
);

-- 4. notification_replies（生徒からの返信）
create table if not exists public.notification_replies (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  author_id text not null,
  author_name text,
  body text not null,
  created_at timestamptz default now()
);

-- RLS（anon で読み書きできるよう当面は緩め。本番では role ベースに締めてください）
alter table public.shifts enable row level security;
alter table public.user_profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_replies enable row level security;

create policy "shifts_all" on public.shifts for all using (true) with check (true);
create policy "profiles_all" on public.user_profiles for all using (true) with check (true);
create policy "notif_all" on public.notifications for all using (true) with check (true);
create policy "replies_all" on public.notification_replies for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.notification_replies;

-- インデックス
create index if not exists idx_shifts_time on public.shifts (time_start);
create index if not exists idx_notif_created on public.notifications (created_at desc);
create index if not exists idx_replies_nid on public.notification_replies (notification_id);
