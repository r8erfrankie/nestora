-- ============================================================
-- Tenant Maintenance Requests — Phase 1 Schema Migration
-- ============================================================
-- Adds: join_code on properties, 'tenant' role, tenant_property_links,
--       maintenance_requests, maintenance_request_photos,
--       maintenance_request_notes — plus all RLS policies.
--
-- Safe to run multiple times (IF NOT EXISTS, DROP … IF EXISTS).
-- Run in the Supabase SQL Editor.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 0. Ensure set_updated_at() helper exists
--    (already created by earlier migrations; included here so
--    this file is self-contained if run on a fresh schema)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 1. generate_join_code() — 8-char uppercase hex string
--    Produces codes like A3F7C201. Used as the DEFAULT for
--    properties.join_code. Not security-sensitive — the code
--    just needs to be unique and easy to read/type.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text LANGUAGE sql AS $$
  SELECT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. properties — add join_code column
-- ─────────────────────────────────────────────────────────────
-- nullable first so we can backfill before enforcing NOT NULL.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS join_code text UNIQUE DEFAULT public.generate_join_code();

-- Backfill rows that have no code (should be none if DEFAULT fired,
-- but explicit backfill is safe and required for ADD COLUMN IF NOT EXISTS
-- on rows that already existed before the DEFAULT was added).
UPDATE public.properties
  SET join_code = public.generate_join_code()
  WHERE join_code IS NULL;

-- Lock in NOT NULL now that every row has a value.
ALTER TABLE public.properties
  ALTER COLUMN join_code SET NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 3. profiles — extend role CHECK to include 'tenant'
--    The auto-generated constraint name is profiles_role_check.
--    NULL still passes (new users have role = NULL until they pick).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('landlord', 'contractor', 'tenant'));


-- ─────────────────────────────────────────────────────────────
-- 4. tenant_property_links
-- ─────────────────────────────────────────────────────────────
-- One row per (property, tenant_email) pair.
-- Created by either party; approved only by the landlord.
--
--   initiated_by = 'landlord' → landlord added the tenant's email
--   initiated_by = 'tenant'   → tenant self-requested via join code
--
-- tenant_id is NULL when the landlord adds an email before the
-- tenant has signed up; it gets stamped during tenant onboarding.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_property_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id   uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  -- Always store lowercase so case-insensitive comparisons are simple.
  tenant_email  text        NOT NULL,
  tenant_id     uuid        REFERENCES auth.users(id),
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'removed')),
  unit          text,
  initiated_by  text        NOT NULL DEFAULT 'landlord'
                            CHECK (initiated_by IN ('landlord', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  approved_at   timestamptz,
  -- One link per property + email; prevents duplicate requests.
  CONSTRAINT tenant_property_links_uniq UNIQUE (property_id, tenant_email)
);

ALTER TABLE public.tenant_property_links ENABLE ROW LEVEL SECURITY;

-- Landlord: full CRUD on all links for properties they own.
DROP POLICY IF EXISTS "Landlord manages own tenant links" ON public.tenant_property_links;
CREATE POLICY "Landlord manages own tenant links"
  ON public.tenant_property_links
  FOR ALL
  USING  (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- Tenant: read-only view of their own links (shows pending/approved status).
DROP POLICY IF EXISTS "Tenant reads own links" ON public.tenant_property_links;
CREATE POLICY "Tenant reads own links"
  ON public.tenant_property_links
  FOR SELECT
  USING (lower(tenant_email) = lower(auth.jwt() ->> 'email'));

-- Tenant self-request INSERT. Guards:
--   • tenant_id and email must match the calling user.
--   • status must be 'pending' (tenants can never self-approve).
--   • initiated_by must be 'tenant'.
--   • landlord_id must be the actual owner of the property
--     (prevents a tenant from forging a link to an arbitrary landlord).
DROP POLICY IF EXISTS "Tenant can self-request access" ON public.tenant_property_links;
CREATE POLICY "Tenant can self-request access"
  ON public.tenant_property_links
  FOR INSERT
  WITH CHECK (
    tenant_id    = auth.uid()
    AND lower(tenant_email) = lower(auth.jwt() ->> 'email')
    AND status        = 'pending'
    AND initiated_by  = 'tenant'
    AND landlord_id   = (
      SELECT user_id FROM public.properties WHERE id = property_id
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 5. maintenance_requests
-- ─────────────────────────────────────────────────────────────
-- A tenant-submitted issue report for a property. Separate from
-- work_orders — the landlord converts an approved request into a
-- work order when they decide to act on it.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id                uuid        NOT NULL REFERENCES public.properties(id),
  tenant_email               text        NOT NULL,
  title                      text        NOT NULL CHECK (char_length(title) > 0),
  description                text,
  category                   text        CHECK (category IN (
                               'Plumbing', 'Electrical', 'HVAC', 'Appliance',
                               'Structural', 'Pest Control', 'Other'
                             )),
  priority                   text        NOT NULL DEFAULT 'Medium'
                             CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  -- Submitted   → just created by tenant, awaiting landlord action
  -- In Progress → landlord converted to work order
  -- Resolved    → landlord marked complete
  -- Declined    → landlord declined
  status                     text        NOT NULL DEFAULT 'Submitted'
                             CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Declined')),
  -- Set when the landlord converts this request to a work order.
  converted_to_work_order_id uuid        REFERENCES public.work_orders(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Tenant sees their own requests.
DROP POLICY IF EXISTS "Tenant views own requests" ON public.maintenance_requests;
CREATE POLICY "Tenant views own requests"
  ON public.maintenance_requests
  FOR SELECT
  USING (tenant_id = auth.uid());

-- Landlord sees requests for any of their properties.
DROP POLICY IF EXISTS "Landlord views requests on own properties" ON public.maintenance_requests;
CREATE POLICY "Landlord views requests on own properties"
  ON public.maintenance_requests
  FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  );

-- Tenant can create a request only when approved for this property.
DROP POLICY IF EXISTS "Approved tenant can submit request" ON public.maintenance_requests;
CREATE POLICY "Approved tenant can submit request"
  ON public.maintenance_requests
  FOR INSERT
  WITH CHECK (
    tenant_id = auth.uid()
    AND lower(tenant_email) = lower(auth.jwt() ->> 'email')
    AND EXISTS (
      SELECT 1 FROM public.tenant_property_links tpl
      WHERE tpl.property_id          = maintenance_requests.property_id
        AND lower(tpl.tenant_email)  = lower(auth.jwt() ->> 'email')
        AND tpl.status               = 'approved'
    )
  );

-- Landlord can update status and set converted_to_work_order_id.
DROP POLICY IF EXISTS "Landlord updates requests on own properties" ON public.maintenance_requests;
CREATE POLICY "Landlord updates requests on own properties"
  ON public.maintenance_requests
  FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS set_maintenance_requests_updated_at ON public.maintenance_requests;
CREATE TRIGGER set_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS maintenance_requests_tenant_id_idx
  ON public.maintenance_requests (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS maintenance_requests_property_id_idx
  ON public.maintenance_requests (property_id, created_at DESC);


-- ─────────────────────────────────────────────────────────────
-- 6. maintenance_request_photos
-- ─────────────────────────────────────────────────────────────
-- Mirrors work_order_photos. Photos are uploaded client-side to
-- Supabase Storage; this table stores the public URL + display name.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_request_photos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid        NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  url         text        NOT NULL,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_request_photos ENABLE ROW LEVEL SECURITY;

-- SELECT / INSERT / DELETE: the submitting tenant OR the landlord who owns the property.
-- Reused as a subquery across all three operations to keep logic consistent.
DROP POLICY IF EXISTS "Request participants view photos" ON public.maintenance_request_photos;
CREATE POLICY "Request participants view photos"
  ON public.maintenance_request_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_request_photos.request_id
        AND (
          mr.tenant_id = auth.uid()
          OR mr.property_id IN (
            SELECT id FROM public.properties WHERE user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Request participants insert photos" ON public.maintenance_request_photos;
CREATE POLICY "Request participants insert photos"
  ON public.maintenance_request_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_request_photos.request_id
        AND (
          mr.tenant_id = auth.uid()
          OR mr.property_id IN (
            SELECT id FROM public.properties WHERE user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Request participants delete photos" ON public.maintenance_request_photos;
CREATE POLICY "Request participants delete photos"
  ON public.maintenance_request_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_request_photos.request_id
        AND (
          mr.tenant_id = auth.uid()
          OR mr.property_id IN (
            SELECT id FROM public.properties WHERE user_id = auth.uid()
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS maintenance_request_photos_request_id_idx
  ON public.maintenance_request_photos (request_id, created_at);


-- ─────────────────────────────────────────────────────────────
-- 7. maintenance_request_notes
-- ─────────────────────────────────────────────────────────────
-- Mirrors work_order_notes exactly except:
--   • author_role is constrained to 'landlord' | 'tenant' (no 'contractor')
--   • FK is request_id → maintenance_requests
-- System notes are written by server actions on mutations.
-- Manual notes can be edited by the author only.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_request_notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid        NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  author_email text        NOT NULL,
  author_role  text        NOT NULL CHECK (author_role IN ('landlord', 'tenant')),
  note_type    text        NOT NULL CHECK (note_type IN ('manual', 'system')),
  content      text        NOT NULL CHECK (char_length(content) > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_request_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant who submitted the request, or the landlord who owns the property.
DROP POLICY IF EXISTS "Request participants view notes" ON public.maintenance_request_notes;
CREATE POLICY "Request participants view notes"
  ON public.maintenance_request_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_request_notes.request_id
        AND (
          mr.tenant_id = auth.uid()
          OR mr.property_id IN (
            SELECT id FROM public.properties WHERE user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: same participants.
DROP POLICY IF EXISTS "Request participants insert notes" ON public.maintenance_request_notes;
CREATE POLICY "Request participants insert notes"
  ON public.maintenance_request_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_request_notes.request_id
        AND (
          mr.tenant_id = auth.uid()
          OR mr.property_id IN (
            SELECT id FROM public.properties WHERE user_id = auth.uid()
          )
        )
    )
  );

-- UPDATE: only the author, only on their own manual notes.
DROP POLICY IF EXISTS "Author edits own manual notes" ON public.maintenance_request_notes;
CREATE POLICY "Author edits own manual notes"
  ON public.maintenance_request_notes
  FOR UPDATE
  USING (
    lower(author_email) = lower(auth.jwt() ->> 'email')
    AND note_type = 'manual'
  )
  WITH CHECK (
    lower(author_email) = lower(auth.jwt() ->> 'email')
    AND note_type = 'manual'
  );

DROP TRIGGER IF EXISTS set_maintenance_request_notes_updated_at ON public.maintenance_request_notes;
CREATE TRIGGER set_maintenance_request_notes_updated_at
  BEFORE UPDATE ON public.maintenance_request_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS maintenance_request_notes_request_id_idx
  ON public.maintenance_request_notes (request_id, created_at);
