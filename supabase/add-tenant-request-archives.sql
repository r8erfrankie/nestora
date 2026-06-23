-- Tenant-side soft-archive for maintenance requests.
-- Mirrors the work_order_user_archives pattern — visibility only,
-- landlords/owners always see all requests regardless of this table.

CREATE TABLE IF NOT EXISTS tenant_request_archives (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_id uuid        REFERENCES maintenance_requests(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, request_id)
);

ALTER TABLE tenant_request_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own request archives"
  ON tenant_request_archives FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
