ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS quote_approved boolean;
