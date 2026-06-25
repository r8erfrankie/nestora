-- Fix overly strict RLS on lease-documents bucket.
-- The JOIN-based policy blocks uploads; simplify to authenticated-only for MVP.
-- Run in the Supabase SQL editor.

DROP POLICY IF EXISTS "Landlords can upload lease documents" ON storage.objects;
CREATE POLICY "Landlords can upload lease documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lease-documents');

DROP POLICY IF EXISTS "Authenticated users can read lease documents" ON storage.objects;
CREATE POLICY "Authenticated users can read lease documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lease-documents');

DROP POLICY IF EXISTS "Landlords can delete lease documents" ON storage.objects;
CREATE POLICY "Landlords can delete lease documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lease-documents');
