-- Structured lease data for a tenant-property relationship.
-- One row per tenant_property_links row (enforced by UNIQUE on link_id).
-- All fields optional — landlords can fill in gradually.
-- Expand by adding columns with DEFAULT NULL; no schema changes needed for
-- tenants already in the table.

CREATE TABLE IF NOT EXISTS public.leases (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id           uuid          NOT NULL UNIQUE
                                    REFERENCES public.tenant_property_links(id)
                                    ON DELETE CASCADE,
  landlord_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_type        text          CHECK (lease_type IN ('fixed', 'month_to_month')),
  lease_start       date,
  lease_end         date,
  security_deposit  numeric(12,2),
  notes             text,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Landlords can create, read, update, and delete leases they own.
CREATE POLICY "Landlords manage own leases"
  ON public.leases FOR ALL
  USING  (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

-- Tenants can read the lease tied to their own approved link.
CREATE POLICY "Tenants read own lease"
  ON public.leases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_property_links tpl
      WHERE tpl.id = leases.link_id
        AND tpl.tenant_id = auth.uid()
        AND tpl.status = 'approved'
    )
  );
