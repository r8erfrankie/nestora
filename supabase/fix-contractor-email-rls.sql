-- Fix case-sensitive email comparison in work_orders RLS policies.
--
-- Root cause: assigned_contractor_email was stored as entered by the landlord
-- (potentially mixed case), but auth.jwt() ->> 'email' always returns lowercase
-- because Supabase normalises emails to lowercase on signup/login.
-- PostgreSQL text equality is case-sensitive, so
--   'Contractor@Co.com' = 'contractor@co.com'  →  false
-- The row was invisible to the contractor even though they were the assignee.
--
-- Run this entire script in the Supabase SQL Editor.

-- ── Step 1: Normalise existing data ─────────────────────────────────────────
-- Any rows already stored with mixed-case emails are invisible to contractors.
-- Lowercase them now so the query filter in contractor/page.tsx works without
-- needing a lower() call on the client side.
UPDATE public.work_orders
SET assigned_contractor_email = lower(assigned_contractor_email)
WHERE assigned_contractor_email IS NOT NULL
  AND assigned_contractor_email <> lower(assigned_contractor_email);

-- ── Step 2: Fix the work_orders SELECT policy ────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own or assigned work orders" ON public.work_orders;

CREATE POLICY "Users can view their own or assigned work orders"
  ON public.work_orders FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(assigned_contractor_email) = lower(auth.jwt() ->> 'email')
  );

-- ── Step 3: Fix the work_orders UPDATE policy ────────────────────────────────
-- Contractors need UPDATE to change status and contractor_quote.
DROP POLICY IF EXISTS "Users can update their own or assigned work orders" ON public.work_orders;

CREATE POLICY "Users can update their own or assigned work orders"
  ON public.work_orders FOR UPDATE
  USING (
    auth.uid() = user_id
    OR lower(assigned_contractor_email) = lower(auth.jwt() ->> 'email')
  );

-- ── Step 4: Fix the properties SELECT policy ────────────────────────────────
-- Same case bug — contractors couldn't see property details for their work orders.
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
