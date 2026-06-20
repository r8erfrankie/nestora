-- Add optional emergency contact fields to tenant profiles.
alter table profiles
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text; -- E.164 format
