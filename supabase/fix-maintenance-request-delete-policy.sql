-- Add missing DELETE RLS policies for maintenance_requests and maintenance_request_notes.
-- Previously only SELECT/INSERT/UPDATE policies existed, so landlord deletes
-- were silently blocked — the row appeared to delete on the client but came
-- back on page refresh because the DB row was never removed.
-- Run in the Supabase SQL editor.

-- 1. Allow landlords to delete maintenance requests on their own properties.
DROP POLICY IF EXISTS "Landlord deletes requests on own properties" ON public.maintenance_requests;
CREATE POLICY "Landlord deletes requests on own properties"
  ON public.maintenance_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = maintenance_requests.property_id
        AND p.user_id = auth.uid()
    )
  );

-- 2. Allow landlords to delete notes on requests belonging to their properties.
DROP POLICY IF EXISTS "Landlord deletes notes on own properties" ON public.maintenance_request_notes;
CREATE POLICY "Landlord deletes notes on own properties"
  ON public.maintenance_request_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.maintenance_requests mr
      JOIN public.properties p ON p.id = mr.property_id
      WHERE mr.id = maintenance_request_notes.request_id
        AND p.user_id = auth.uid()
    )
  );
