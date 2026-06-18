-- ============================================================
-- Role-selection migration for Nestora
-- Run this in Supabase SQL Editor ONCE.
-- Safe to re-run (uses IF NOT EXISTS / DO NOTHING).
-- ============================================================

-- 1. Drop NOT NULL so new accounts start with role = NULL
--    (existing accounts keep their stored role value)
ALTER TABLE public.profiles
  ALTER COLUMN role DROP NOT NULL;

-- 2. Remove the 'landlord' default so the trigger (below) and
--    any direct inserts don't silently assign a role.
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT NULL;

-- 3. Add optional profile columns used by both onboarding flows
--    (safe to run even if columns already exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trade        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes        text;

-- 4. Update the signup trigger so new users start with role = NULL
--    instead of being silently defaulted to 'landlord'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, onboarded)
  VALUES (new.id, new.email, NULL, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
