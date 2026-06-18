-- Add contractor_quote to work_orders.
-- This is the contractor's cost estimate, separate from the landlord's internal `cost` field.
-- Run in the Supabase SQL Editor.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS contractor_quote numeric(10, 2);
