-- Add Accepted to the work_orders status constraint.
-- Run in the Supabase SQL editor.
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_status_check;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_status_check
  CHECK (status IN ('Open', 'Accepted', 'In Progress', 'On Hold', 'Needs Materials', 'Completed', 'Archived'));
