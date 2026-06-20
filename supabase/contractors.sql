-- Contractors table for Teams management
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.contractors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text, -- E.164 format (e.g. +15551234567)
  trade text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage their contractors" ON public.contractors
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Phone number on work orders (for contractor contact display)
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS assigned_contractor_phone text; -- E.164 format
