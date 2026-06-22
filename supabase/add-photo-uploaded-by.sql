-- ──────────────────────────────────────────────────────────────────────────────
-- Photo uploader ownership — adds per-user delete control
-- ──────────────────────────────────────────────────────────────────────────────
-- Before this migration:
--   • work_order_photos had only uploaded_by_role ('landlord'|'contractor'), which
--     tracks which *role* uploaded — not *which specific user*.
--   • The DELETE RLS allowed any work order participant (landlord OR assigned
--     contractor) to delete any photo on the work order, regardless of who
--     uploaded it.
--
-- After this migration:
--   • uploaded_by (uuid → auth.users) tracks the specific user who uploaded.
--   • DELETE RLS: landlord (work_orders.user_id = auth.uid()) can still delete
--     any photo on their own work orders. Everyone else can only delete photos
--     where uploaded_by = auth.uid().
--
-- Backfill notes:
--   • Landlord-uploaded photos (uploaded_by_role = 'landlord') → work_orders.user_id.
--     These are always attributable since work orders always have a user_id.
--   • Contractor-uploaded photos (uploaded_by_role = 'contractor') → attributed to
--     work_orders.assigned_contractor_id *when it exists*. Older rows uploaded
--     before the hybrid contractor-id model was added (add-contractor-id-to-work-orders.sql)
--     may have assigned_contractor_id = NULL and will remain with uploaded_by = NULL.
--     This is acceptable — landlords can still delete those photos via the owner branch
--     of the RLS policy, and contractors cannot delete them (safe default).
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add the column
ALTER TABLE public.work_order_photos
  ADD COLUMN IF NOT EXISTS uploaded_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- 2. Backfill: landlord-uploaded photos → work order owner
UPDATE public.work_order_photos wp
SET    uploaded_by = wo.user_id
FROM   public.work_orders wo
WHERE  wp.work_order_id = wo.id
  AND  wp.uploaded_by IS NULL
  AND  wp.uploaded_by_role = 'landlord';

-- 3. Backfill: contractor-uploaded photos where the contractor account is linked
--    Old contractor photos with no assigned_contractor_id are left as NULL (see note above).
UPDATE public.work_order_photos wp
SET    uploaded_by = wo.assigned_contractor_id
FROM   public.work_orders wo
WHERE  wp.work_order_id = wo.id
  AND  wp.uploaded_by IS NULL
  AND  wp.uploaded_by_role = 'contractor'
  AND  wo.assigned_contractor_id IS NOT NULL;

-- 4. Drop the old broad "any work order participant can delete any photo" policy
DROP POLICY IF EXISTS "Users can delete photos for their work orders"
  ON public.work_order_photos;

-- 5. New hierarchical DELETE policy:
--    Branch A — Landlord override: owner of the work order can delete any photo.
--    Branch B — Uploader: any user can delete photos they personally uploaded.
--    Contractors fall into branch B only (they can only delete their own uploads).
CREATE POLICY "Users can delete photos for their work orders"
  ON public.work_order_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders
      WHERE work_orders.id = work_order_photos.work_order_id
        AND work_orders.user_id = auth.uid()
    )
    OR uploaded_by = auth.uid()
  );
