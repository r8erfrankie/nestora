-- Add invite_token to contractors for generating invitation links.
-- gen_random_uuid() fills new rows automatically via the DEFAULT.

ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS invite_token uuid UNIQUE DEFAULT gen_random_uuid();

-- Backfill any existing rows that somehow got NULL (e.g. rows created
-- before this migration on an older schema without the DEFAULT).
UPDATE public.contractors
  SET invite_token = gen_random_uuid()
  WHERE invite_token IS NULL;
