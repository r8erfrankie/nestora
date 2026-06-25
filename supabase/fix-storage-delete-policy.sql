-- Tighten the work-order-photos storage delete policy.
-- Previously any authenticated user could delete any file in the bucket.
-- Now only the landlord who owns the work order OR the contractor assigned
-- to it can delete files in that work order's folder.
-- Run in the Supabase SQL editor.

drop policy if exists "Allow authenticated deletes from work-order-photos" on storage.objects;

create policy "Allow scoped deletes from work-order-photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'work-order-photos'
  and (
    -- The folder name is the work order UUID (first path segment).
    -- Allow if the user owns the work order (landlord)
    -- or is the assigned contractor.
    (storage.foldername(name))[1] in (
      select id::text
      from public.work_orders
      where
        user_id = auth.uid()
        or assigned_contractor_email = (auth.jwt() ->> 'email')
    )
  )
);
