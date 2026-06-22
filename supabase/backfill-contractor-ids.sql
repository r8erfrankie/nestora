-- One-time backfill: assign assigned_contractor_id on historical work orders
-- ────────────────────────────────────────────────────────────────────────────
-- Strategy
-- ─────────
-- Three-layer approach to ensure every work order eventually has
-- assigned_contractor_id set whenever a matching profile exists:
--
--   1. This script  — run once (or re-run safely — idempotent) to bulk-fix
--                     all historical rows in one pass.
--   2. role-actions — setUserRoleAction / claimContractorRole backfill the
--                     contractor's own work orders the moment they sign up.
--   3. page.tsx     — on-demand heal pass on every work orders page load;
--                     fixes any row still missing an ID and logs the count.
--
-- Together these ensure that over time, as landlords use the app and
-- contractors register, every work order gains a durable ID link.
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  updated_count integer;
BEGIN
  -- Case-insensitive match so mixed-case emails stored historically are caught.
  UPDATE public.work_orders wo
  SET    assigned_contractor_id = p.id
  FROM   public.profiles p
  WHERE  lower(wo.assigned_contractor_email) = lower(p.email)
    AND  wo.assigned_contractor_id IS NULL
    AND  p.email IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'backfill-contractor-ids: updated % work order(s) with assigned_contractor_id', updated_count;
END;
$$;
