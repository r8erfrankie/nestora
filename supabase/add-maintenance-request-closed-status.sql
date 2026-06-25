-- Add 'Closed' as a valid maintenance_request status.
-- Used when the linked work order is deleted by the landlord — semantically
-- distinct from 'Declined' (explicit rejection) and 'Resolved' (issue fixed).

ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_status_check;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_status_check
  CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Declined', 'Closed', 'Withdrawn'));
