-- Notifications table for in-app real-time notifications.
-- Run in the Supabase SQL Editor.

create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null,
  title       text        not null,
  message     text        not null,
  link        text,
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Fast per-user queries and ordering
create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

-- RLS
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark own notifications read"
  on public.notifications for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inserts are done exclusively via the service-role admin client (server-side),
-- so no INSERT policy is needed for regular users.

-- Enable Supabase Realtime on this table so clients can subscribe to INSERTs.
-- REPLICA IDENTITY FULL ensures all columns are available in the WAL for filtering.
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.notifications;
