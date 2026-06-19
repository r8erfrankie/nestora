-- Personal per-user work order archive.
-- Archiving hides a work order from the user's active list only; it does not
-- change the work order's status or visibility for any other user.
--
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.work_order_user_archives (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid        NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_email    text        NOT NULL,
  archived_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_order_user_archives_uniq UNIQUE (work_order_id, user_email)
);

ALTER TABLE public.work_order_user_archives ENABLE ROW LEVEL SECURITY;

-- Each user can only read and write their own archive entries.
CREATE POLICY "Users manage their own archive entries"
  ON public.work_order_user_archives
  FOR ALL
  USING  (lower(user_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));
