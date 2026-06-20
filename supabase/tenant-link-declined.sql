-- Add 'declined' to the tenant_property_links.status check constraint.
--
-- The inline CHECK on the status column was auto-named by PostgreSQL as
-- 'tenant_property_links_status_check'. We drop and recreate with the
-- additional value so landlords can mark requests as declined rather than
-- deleting the row (preserving history and enabling re-request UI).
--
-- Safe to run more than once — DROP IF EXISTS guards the first step.

ALTER TABLE public.tenant_property_links
  DROP CONSTRAINT IF EXISTS tenant_property_links_status_check;

ALTER TABLE public.tenant_property_links
  ADD CONSTRAINT tenant_property_links_status_check
  CHECK (status IN ('pending', 'approved', 'removed', 'declined'));
