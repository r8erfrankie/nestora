-- Add 'Withdrawn' to the maintenance_requests status check constraint.
-- Drop the existing constraint and recreate it with the new value.

ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_status_check;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_status_check
  CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Declined', 'Withdrawn'));
