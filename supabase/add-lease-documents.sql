-- 1. Create the lease_documents table
CREATE TABLE IF NOT EXISTS public.lease_documents (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id      uuid NOT NULL REFERENCES public.tenant_property_links(id) ON DELETE CASCADE,
  name         text NOT NULL,
  url          text NOT NULL,
  size         bigint,
  uploaded_by  uuid REFERENCES public.profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;

-- Landlord: full CRUD on docs for properties they own
CREATE POLICY "Landlord manages lease docs"
  ON public.lease_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_property_links tpl
      JOIN public.properties p ON p.id = tpl.property_id
      WHERE tpl.id = lease_documents.link_id
        AND p.user_id = auth.uid()
    )
  );

-- Tenant: read-only on their own links
CREATE POLICY "Tenant reads own lease docs"
  ON public.lease_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_property_links tpl
      WHERE tpl.id = lease_documents.link_id
        AND tpl.tenant_id = auth.uid()
    )
  );

-- 3. Storage bucket
-- Run in Supabase dashboard → Storage → New bucket:
--   Name: lease-documents
--   Public: true (URLs are UUID-scoped and hard to guess; can be made private later)
--
-- Or via SQL (Supabase internal):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lease-documents', 'lease-documents', true)
-- ON CONFLICT (id) DO NOTHING;
