-- Make work_order_user_archives email-change safe
-- ────────────────────────────────────────────────────────────────────────────
-- The previous RLS policy used `lower(user_email) = lower(auth.jwt() ->> 'email')`.
-- If a user changes their email, that check fails and they silently lose access
-- to every work order they personally archived.
--
-- Fix: add a user_id FK column, backfill from profiles, and rewrite the policy
-- to use `user_id = auth.uid()` instead. user_email is kept for display on
-- historical rows but is no longer load-bearing for access control.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.work_order_user_archives
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill: resolve existing user_email values to auth user IDs via profiles.
UPDATE public.work_order_user_archives a
SET    user_id = p.id
FROM   public.profiles p
WHERE  lower(a.user_email) = lower(p.email)
  AND  a.user_id IS NULL;

-- Drop the email-based policy and replace with ID-based policy.
DROP POLICY IF EXISTS "Users manage their own archive entries" ON public.work_order_user_archives;

CREATE POLICY "Users manage their own archive entries"
  ON public.work_order_user_archives
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
