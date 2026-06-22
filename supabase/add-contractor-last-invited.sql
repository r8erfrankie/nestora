-- Track when an invite email was last sent to a contractor.
-- Used to show "Invited X ago" in the Teams UI and enforce a 60-minute
-- resend rate limit to prevent accidental spam.

ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS last_invited_at timestamptz;
