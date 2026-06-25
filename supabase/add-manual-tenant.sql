-- Allow tenants to be added without an email address (for record-keeping).
-- Run in the Supabase SQL editor.

-- 1. Add tenant_name column so manual tenants have a display name.
ALTER TABLE public.tenant_property_links
  ADD COLUMN IF NOT EXISTS tenant_name text;

-- 2. Drop the NOT NULL constraint on tenant_email.
ALTER TABLE public.tenant_property_links
  ALTER COLUMN tenant_email DROP NOT NULL;

-- 3. Replace the blanket UNIQUE constraint with a partial index
--    so only non-null emails must be unique per property.
--    (Multiple manual/no-email tenants are allowed per property.)
ALTER TABLE public.tenant_property_links
  DROP CONSTRAINT IF EXISTS tenant_property_links_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_property_links_email_uniq
  ON public.tenant_property_links (property_id, lower(tenant_email))
  WHERE tenant_email IS NOT NULL;
