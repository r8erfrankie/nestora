-- ============================================================
-- Apply all pending contractor migrations (safe to run once).
-- Paste this entire file into the Supabase SQL Editor and run.
-- ============================================================


-- ── 1. contractors: add landlord_id + repurpose user_id ──────────────────────
-- Adds landlord_id for ownership (was previously stored in user_id).
-- Repurposes user_id as a nullable FK to profiles(id) for contractor linking.
-- Updates RLS to use landlord_id = auth.uid().

ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill landlord_id from the existing user_id (which was the landlord's UID).
UPDATE public.contractors
  SET landlord_id = user_id
  WHERE landlord_id IS NULL;

-- Enforce NOT NULL now that every row has a value.
ALTER TABLE public.contractors
  ALTER COLUMN landlord_id SET NOT NULL;

-- Swap RLS policy to use landlord_id.
DROP POLICY IF EXISTS "Owner can manage their contractors" ON public.contractors;

CREATE POLICY "Owner can manage their contractors" ON public.contractors
  FOR ALL
  USING  (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- Repurpose user_id: drop the old NOT NULL + FK to auth.users, then re-add
-- as a nullable FK to profiles(id) for linking a contractor's Nestora account.
ALTER TABLE public.contractors DROP CONSTRAINT IF EXISTS contractors_user_id_fkey;
ALTER TABLE public.contractors ALTER COLUMN user_id DROP NOT NULL;

-- Only clear user_id where it still holds the landlord's UID (the old pattern).
-- Guard: rows already linked (user_id ≠ landlord_id) are left untouched, so
-- running this script twice will not break any existing contractor links.
UPDATE public.contractors
  SET user_id = NULL
  WHERE user_id = landlord_id;

ALTER TABLE public.contractors
  ADD CONSTRAINT contractors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contractors_landlord_id_idx
  ON public.contractors (landlord_id);

CREATE INDEX IF NOT EXISTS contractors_user_id_idx
  ON public.contractors (user_id)
  WHERE user_id IS NOT NULL;


-- ── 2. contractors: add invite_token ─────────────────────────────────────────
-- Postgres generates a UUID token automatically on insert.
-- Used in contractor invitation emails: /accept-invite?token=<invite_token>

ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS invite_token uuid UNIQUE DEFAULT gen_random_uuid();

-- Backfill any rows that got NULL (created before this migration).
UPDATE public.contractors
  SET invite_token = gen_random_uuid()
  WHERE invite_token IS NULL;


-- ── 3. maintenance_requests: fix work order FK to SET NULL on delete ──────────
-- The old constraint defaulted to RESTRICT, blocking work order deletion
-- whenever a tenant maintenance request had been converted to that work order.

ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_converted_to_work_order_id_fkey;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_converted_to_work_order_id_fkey
  FOREIGN KEY (converted_to_work_order_id)
  REFERENCES public.work_orders(id)
  ON DELETE SET NULL;


-- ── 4. maintenance_requests: add 'Closed' status ─────────────────────────────
-- Used when the linked work order is deleted — distinct from 'Resolved' or 'Declined'.

ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_status_check;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_status_check
  CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Declined', 'Closed'));
