-- Add paid tracking column to work_orders.
-- Run in the Supabase SQL Editor.
alter table work_orders add column if not exists paid boolean default false;
