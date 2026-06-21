-- Backfill work_orders.unit for work orders that were converted from maintenance
-- requests before the unit column was added (or before unit was explicitly saved).
--
-- Logic: find the maintenance request that was converted to each work order,
-- then look up the tenant's unit from tenant_property_links using property + email.
--
-- Safe to run multiple times (only updates rows where unit IS NULL).
-- Run in the Supabase SQL Editor.

UPDATE public.work_orders wo
SET unit = tpl.unit
FROM public.maintenance_requests mr
JOIN public.tenant_property_links tpl
  ON  tpl.property_id = mr.property_id
  AND lower(tpl.tenant_email) = lower(mr.tenant_email)
WHERE mr.converted_to_work_order_id = wo.id
  AND wo.unit IS NULL
  AND tpl.unit IS NOT NULL;
