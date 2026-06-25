'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type LeaseDocument = {
  id: string;
  link_id: string;
  name: string;
  url: string;
  size: number | null;
  created_at: string;
};

export async function saveLeaseDocument(doc: {
  linkId: string;
  name: string;
  url: string;
  size: number | null;
}): Promise<LeaseDocument> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify landlord owns this link's property before saving.
  const { data: link } = await supabase
    .from('tenant_property_links')
    .select('id, property:property_id(user_id)')
    .eq('id', doc.linkId)
    .single();

  const property = link?.property as unknown as { user_id: string } | null;
  if (property?.user_id !== user.id) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('lease_documents')
    .insert({
      link_id: doc.linkId,
      name: doc.name,
      url: doc.url,
      size: doc.size,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
  return data as LeaseDocument;
}

export async function deleteLeaseDocument(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch doc to get the storage path and verify ownership via RLS.
  const { data: doc } = await supabase
    .from('lease_documents')
    .select('id, url, link_id')
    .eq('id', id)
    .single();

  if (!doc) throw new Error('Document not found');

  // Extract storage path from the public URL (everything after /lease-documents/).
  const marker = '/lease-documents/';
  const idx = (doc.url as string).indexOf(marker);
  if (idx !== -1) {
    const storagePath = (doc.url as string).slice(idx + marker.length);
    await supabase.storage.from('lease-documents').remove([storagePath]);
  }

  const { error } = await supabase.from('lease_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}

export type LeaseData = {
  id: string;
  link_id: string;
  lease_type: 'fixed' | 'month_to_month' | null;
  lease_start: string | null;
  lease_end: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  notes: string | null;
};

export type LeaseInput = {
  lease_type: 'fixed' | 'month_to_month' | null;
  lease_start: string | null;
  lease_end: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  notes: string | null;
};

export async function upsertLease(linkId: string, input: LeaseInput): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: link } = await supabase
    .from('tenant_property_links')
    .select('id')
    .eq('id', linkId)
    .eq('landlord_id', user.id)
    .single();
  if (!link) throw new Error('Tenant link not found');

  const { error } = await supabase
    .from('leases')
    .upsert(
      {
        link_id: linkId,
        landlord_id: user.id,
        lease_type: input.lease_type ?? null,
        lease_start: input.lease_start || null,
        lease_end: input.lease_type === 'month_to_month' ? null : (input.lease_end || null),
        monthly_rent: input.monthly_rent ?? null,
        security_deposit: input.security_deposit ?? null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'link_id' }
    );

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}
