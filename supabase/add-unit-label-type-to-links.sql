-- Add per-link unit label type so each tenant link can have its own label
-- (e.g. "Unit 1" and "Room B" at the same property).
-- Defaults to NULL which falls back to the property's unit_label_type.
-- Run in the Supabase SQL editor.

ALTER TABLE public.tenant_property_links
  ADD COLUMN IF NOT EXISTS unit_label_type text
  CHECK (unit_label_type IN ('unit', 'room', 'apt'));
