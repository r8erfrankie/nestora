-- Fix: maintenance_requests.converted_to_work_order_id had no ON DELETE clause,
-- which defaults to RESTRICT and blocks deletion of any work order that was
-- converted from a tenant maintenance request.
-- Change to SET NULL so the reference is cleared when the work order is deleted.

ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_converted_to_work_order_id_fkey;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_converted_to_work_order_id_fkey
  FOREIGN KEY (converted_to_work_order_id)
  REFERENCES public.work_orders(id)
  ON DELETE SET NULL;
