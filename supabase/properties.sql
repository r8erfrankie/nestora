-- Run this in the Supabase SQL Editor for your project (wohjmkqdpvetrqsesxif)
-- Creates the properties table with RLS so users can only access their own properties.

-- Enable UUID extension if not already
create extension if not exists "uuid-ossp";

-- Table
create table if not exists public.properties (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text,
  type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.properties enable row level security;

-- Policies (users can only CRUD their own rows)
create policy "Users can view own properties"
  on public.properties for select
  using (auth.uid() = user_id);

create policy "Users can insert own properties"
  on public.properties for insert
  with check (auth.uid() = user_id);

create policy "Users can update own properties"
  on public.properties for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own properties"
  on public.properties for delete
  using (auth.uid() = user_id);

-- Trigger to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_properties_updated_at on public.properties;
create trigger set_properties_updated_at
  before update on public.properties
  for each row
  execute function public.set_updated_at();

comment on table public.properties is 'User-owned properties for the Nestora workspace.';