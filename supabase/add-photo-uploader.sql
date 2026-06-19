-- Track which role uploaded each work order photo.
-- Default 'landlord' keeps all existing rows consistent without a backfill.
ALTER TABLE public.work_order_photos
  ADD COLUMN IF NOT EXISTS uploaded_by_role text NOT NULL DEFAULT 'landlord';
