-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text        NOT NULL,
  user_role  text,
  subject    text        NOT NULL,
  message    text        NOT NULL,
  status     text        NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can submit tickets for themselves only.
CREATE POLICY "Users can insert own support tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can read their own past tickets.
CREATE POLICY "Users can view own support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (user_id = auth.uid());
