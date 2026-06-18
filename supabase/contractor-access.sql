-- Contractor access policy for properties
-- Allows contractors to read property details for work orders assigned to them.
-- Run this in your Supabase SQL editor.

CREATE POLICY "Contractors can view properties of their assigned work orders"
  ON public.properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders
      WHERE work_orders.property_id = properties.id
        AND work_orders.assigned_contractor_email = (auth.jwt() ->> 'email')
    )
  );
