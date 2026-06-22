-- Track when the landlord last visited Tenants and Work Orders sections
-- so the sidebar can show a badge for new items since their last visit.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_tenants_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_work_orders_at timestamptz;
