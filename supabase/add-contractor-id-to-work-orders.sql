-- Hybrid contractor assignment model
-- ────────────────────────────────────────────────────────────────────────────
-- assigned_contractor_email  →  set at assignment time; works for pre-signup
--                               contractors. Auth checks in contractor-actions.ts
--                               rely on this column.
-- assigned_contractor_id     →  populated when the contractor is already
--                               registered (immediate lookup in crud-actions.ts)
--                               or when they sign up later (backfill in
--                               role-actions.ts). If a contractor changes their
--                               email in the future, this FK keeps the link
--                               correct without touching historical work orders.
--
-- Never assume assigned_contractor_id is set — it may be NULL for work orders
-- assigned before the contractor created an account.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS assigned_contractor_id uuid
  REFERENCES profiles(id) ON DELETE SET NULL;

-- One-time backfill: link any work orders whose contractor email already
-- matches a registered profile so existing data is immediately consistent.
UPDATE work_orders wo
SET    assigned_contractor_id = p.id
FROM   profiles p
WHERE  wo.assigned_contractor_email = p.email
  AND  wo.assigned_contractor_id IS NULL;
