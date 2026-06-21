-- ============================================================
-- Link contractors to their Nestora user account (if one exists).
--
-- The contractors table originally used user_id for the landlord's
-- auth UID (ownership). This migration:
--   1. Adds landlord_id to take over the ownership role.
--   2. Backfills landlord_id from the existing user_id values.
--   3. Repurposes user_id as a nullable FK → profiles(id) so we can
--      link a contractor directory entry to an actual Nestora account.
--   4. Updates the RLS policy to use landlord_id.
-- ============================================================

-- 1. Add landlord_id column (mirrors what user_id currently means)
ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill from existing user_id (the landlord's UID)
UPDATE public.contractors
  SET landlord_id = user_id
  WHERE landlord_id IS NULL;

-- 3. Enforce NOT NULL now that every row has a value
ALTER TABLE public.contractors
  ALTER COLUMN landlord_id SET NOT NULL;

-- 4. Swap RLS policy to use landlord_id
DROP POLICY IF EXISTS "Owner can manage their contractors" ON public.contractors;

CREATE POLICY "Owner can manage their contractors" ON public.contractors
  FOR ALL
  USING  (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- 5. Repurpose user_id: drop the old NOT NULL + FK, clear stale values,
--    then re-add as a nullable FK → profiles(id) for contractor linking.
ALTER TABLE public.contractors DROP CONSTRAINT IF EXISTS contractors_user_id_fkey;
ALTER TABLE public.contractors ALTER COLUMN user_id DROP NOT NULL;

-- user_id previously held the landlord's UID; null it out so the column
-- is ready to hold the contractor's profile id instead.
UPDATE public.contractors SET user_id = NULL;

ALTER TABLE public.contractors
  ADD CONSTRAINT contractors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS contractors_landlord_id_idx
  ON public.contractors (landlord_id);

CREATE INDEX IF NOT EXISTS contractors_user_id_idx
  ON public.contractors (user_id)
  WHERE user_id IS NOT NULL;
