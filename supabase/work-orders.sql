-- ============================================================
-- Work Orders schema for Nestora
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- Enable extensions if needed
create extension if not exists "uuid-ossp";

-- Main work_orders table
create table if not exists public.work_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  due_date date,
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Completed', 'Archived')),
  assigned_contractor text,
  assigned_contractor_email text,
  notes text,  -- comments / updates from assigned contractor
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Photos attached to work orders (stored in Supabase Storage)
create table if not exists public.work_order_photos (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  url text not null,
  name text,                     -- user-provided or default filename
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.work_orders enable row level security;
alter table public.work_order_photos enable row level security;

-- RLS Policies for work_orders 
-- Owners (user_id) have full access to their WOs.
-- Assigned contractors (by email) can view + update their assigned WOs (UI limits what they change).
create policy "Users can view their own or assigned work orders"
  on public.work_orders for select
  using (
    auth.uid() = user_id 
    OR assigned_contractor_email = (auth.jwt() ->> 'email')
  );

create policy "Users can insert their own work orders"
  on public.work_orders for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own or assigned work orders"
  on public.work_orders for update
  using (
    auth.uid() = user_id 
    OR assigned_contractor_email = (auth.jwt() ->> 'email')
  );

create policy "Users can delete their own work orders"
  on public.work_orders for delete
  using (auth.uid() = user_id);

-- RLS Policies for photos (tied to work order ownership OR assigned contractor)
create policy "Users can view photos for their work orders"
  on public.work_order_photos for select
  using (
    exists (
      select 1 from public.work_orders 
      where work_orders.id = work_order_photos.work_order_id 
        and (
          work_orders.user_id = auth.uid()
          OR work_orders.assigned_contractor_email = (auth.jwt() ->> 'email')
        )
    )
  );

create policy "Users can insert photos for their work orders"
  on public.work_order_photos for insert
  with check (
    exists (
      select 1 from public.work_orders 
      where work_orders.id = work_order_photos.work_order_id 
        and (
          work_orders.user_id = auth.uid()
          OR work_orders.assigned_contractor_email = (auth.jwt() ->> 'email')
        )
    )
  );

create policy "Users can delete photos for their work orders"
  on public.work_order_photos for delete
  using (
    exists (
      select 1 from public.work_orders 
      where work_orders.id = work_order_photos.work_order_id 
        and (
          work_orders.user_id = auth.uid()
          OR work_orders.assigned_contractor_email = (auth.jwt() ->> 'email')
        )
    )
  );

-- Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_work_orders_updated_at on public.work_orders;
create trigger set_work_orders_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();

-- ============================================================
-- STORAGE BUCKET SETUP (manual step required)
-- ============================================================
-- 1. Go to Storage → Buckets in your Supabase dashboard:
--    https://supabase.com/dashboard/project/wohjmkqdpvetrqsesxif/storage/buckets
-- 2. Click "New bucket" and name it EXACTLY: work-order-photos
-- 3. Recommended: Make the bucket PUBLIC (simplest for photo viewing in this app).
--    This allows anyone with the URL to see the photos (common for work order attachments).
--
-- If you prefer a private bucket, add these policies (Storage → Policies):
--    -- Allow authenticated uploads
--    CREATE POLICY "Allow authenticated uploads to work-order-photos"
--    ON storage.objects FOR INSERT TO authenticated
--    WITH CHECK (bucket_id = 'work-order-photos');
--
--    -- Allow authenticated reads (or public if bucket is public)
--    CREATE POLICY "Allow reads from work-order-photos"
--    ON storage.objects FOR SELECT TO authenticated
--    USING (bucket_id = 'work-order-photos');
--
-- After creating the bucket, photo uploads in the Work Orders section will work.
-- The table + RLS for the work_orders and work_order_photos tables are created by the rest of this script.

-- ============================================================
-- STORAGE POLICIES (required for photo uploads)
-- ============================================================
-- These policies are **required** so that authenticated users can INSERT objects
-- into the "work-order-photos" bucket.
--
-- Without the INSERT policy you get exactly:
-- "new row violates row-level security policy" (StorageApiError)
--
-- Run the block below in the SQL Editor.

-- Drop first (idempotent)
drop policy if exists "Allow authenticated uploads to work-order-photos" on storage.objects;
drop policy if exists "Public can view work-order-photos" on storage.objects;

-- 1. Allow logged-in users to upload photos to this bucket
create policy "Allow authenticated uploads to work-order-photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'work-order-photos');

-- 2. Allow anyone (public) to read/download the photos.
-- This is needed because we use getPublicUrl() for <img> tags.
-- Only add this if your bucket is set to "Public".
create policy "Public can view work-order-photos"
on storage.objects
for select
to public
using (bucket_id = 'work-order-photos');

-- (Optional but recommended) Allow users to delete their own photos later
drop policy if exists "Allow authenticated deletes from work-order-photos" on storage.objects;
create policy "Allow authenticated deletes from work-order-photos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'work-order-photos');

-- Ensure status constraint includes Archived (for older installs)
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_status_check;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_status_check 
  CHECK (status IN ('Open', 'In Progress', 'Completed', 'Archived'));

-- Idempotent column adds for notes and cost (for reports)
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS cost numeric(10,2) DEFAULT 0;