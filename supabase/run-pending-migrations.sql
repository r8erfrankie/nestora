-- Run all pending migrations in order.
-- Safe to run multiple times (all statements are idempotent).
-- Execute this entire script in the Supabase SQL Editor.
--
-- What this script does:
--   1. Adds the contractor_quote column (was missing, causing silent query failures)
--   2. Normalises assigned_contractor_email to lowercase in existing rows
--   3. Replaces work_orders SELECT + UPDATE policies with case-insensitive email comparison
--   4. Replaces the properties SELECT policy with case-insensitive comparison

-- ── 1. Add contractor_quote column (from add-contractor-quote.sql) ────────────
-- Without this column the contractor dashboard SELECT fails silently and returns
-- zero work orders even when rows exist.
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS contractor_quote numeric(10, 2);

-- ── 2. Normalise existing assigned_contractor_email values to lowercase ───────
-- The app now writes emails in lowercase, but any rows created before that fix
-- may have mixed-case values that won't match the contractor's JWT email.
UPDATE public.work_orders
SET assigned_contractor_email = lower(assigned_contractor_email)
WHERE assigned_contractor_email IS NOT NULL
  AND assigned_contractor_email <> lower(assigned_contractor_email);

-- ── 3. Fix work_orders SELECT policy ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own or assigned work orders" ON public.work_orders;

CREATE POLICY "Users can view their own or assigned work orders"
  ON public.work_orders FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(assigned_contractor_email) = lower(auth.jwt() ->> 'email')
  );

-- ── 4. Fix work_orders UPDATE policy ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own or assigned work orders" ON public.work_orders;

CREATE POLICY "Users can update their own or assigned work orders"
  ON public.work_orders FOR UPDATE
  USING (
    auth.uid() = user_id
    OR lower(assigned_contractor_email) = lower(auth.jwt() ->> 'email')
  );

-- ── 5. Fix properties SELECT policy for contractors ───────────────────────────
DROP POLICY IF EXISTS "Contractors can view properties of their assigned work orders" ON public.properties;

CREATE POLICY "Contractors can view properties of their assigned work orders"
  ON public.properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders
      WHERE work_orders.property_id = properties.id
        AND lower(work_orders.assigned_contractor_email) = lower(auth.jwt() ->> 'email')
    )
  );
