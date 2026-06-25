-- Add monthly rental amount to the leases table.
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS monthly_rent numeric(12,2);
