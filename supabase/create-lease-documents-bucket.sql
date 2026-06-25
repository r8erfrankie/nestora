-- Create the lease-documents storage bucket for tenant PDF uploads.
-- Run in the Supabase SQL editor.

INSERT INTO storage.buckets (id, name, public)
VALUES ('lease-documents', 'lease-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated landlords to upload to their tenants' folders.
DROP POLICY IF EXISTS "Landlords can upload lease documents" ON storage.objects;
CREATE POLICY "Landlords can upload lease documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lease-documents'
  AND EXISTS (
    SELECT 1 FROM public.tenant_property_links tpl
    JOIN public.properties p ON p.id = tpl.property_id
    WHERE tpl.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);

-- Allow authenticated users to read (public bucket handles most of this,
-- but add an explicit policy for belt-and-suspenders).
DROP POLICY IF EXISTS "Authenticated users can read lease documents" ON storage.objects;
CREATE POLICY "Authenticated users can read lease documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lease-documents');

-- Allow landlords to delete documents in their tenants' folders.
DROP POLICY IF EXISTS "Landlords can delete lease documents" ON storage.objects;
CREATE POLICY "Landlords can delete lease documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lease-documents'
  AND EXISTS (
    SELECT 1 FROM public.tenant_property_links tpl
    JOIN public.properties p ON p.id = tpl.property_id
    WHERE tpl.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);
