-- ============================================================
-- Link work_orders back to their originating maintenance_request
-- Run in the Supabase SQL Editor.
-- ============================================================
--
-- maintenance_requests already has converted_to_work_order_id → work_orders(id).
-- This adds the reverse: work_orders.maintenance_request_id → maintenance_requests(id).
-- Both FKs are nullable (neither side forces the other to exist), so the
-- circular reference is valid in PostgreSQL.
--
-- ON DELETE SET NULL: if a maintenance request is ever deleted, the work
-- order stays intact — it just loses the back-reference.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS maintenance_request_id uuid
  REFERENCES public.maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS work_orders_maintenance_request_id_idx
  ON public.work_orders (maintenance_request_id)
  WHERE maintenance_request_id IS NOT NULL;
