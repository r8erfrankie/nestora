alter table tenant_property_links
  add column if not exists notes text;
