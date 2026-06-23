-- Fix: maintenance_requests.property_id had no ON DELETE clause, which
-- defaults to RESTRICT and blocks deletion of any property that has
-- maintenance requests linked to it.
--
-- Adding ON DELETE CASCADE means deleting a property automatically deletes
-- its maintenance requests (and their child records — photos, notes, archives —
-- which already have their own CASCADE constraints).
--
-- The two circular FKs between work_orders and maintenance_requests are both
-- ON DELETE SET NULL, so they resolve cleanly when both sides are being
-- deleted in the same cascade chain.

ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_property_id_fkey;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_property_id_fkey
  FOREIGN KEY (property_id)
  REFERENCES public.properties(id)
  ON DELETE CASCADE;
