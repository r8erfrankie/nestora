-- Unit label type for properties.
-- Controls whether unit numbers display as "Unit 101", "Room 12", or "Apt 3B".
-- DEFAULT 'unit' automatically backfills all existing rows.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS unit_label_type text NOT NULL DEFAULT 'unit'
  CHECK (unit_label_type IN ('room', 'unit', 'apt'));
