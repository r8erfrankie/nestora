'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type LeaseData = {
  id: string;
  link_id: string;
  lease_type: 'fixed' | 'month_to_month' | null;
  lease_start: string | null;
  lease_end: string | null;
  security_deposit: number | null;
  notes: string | null;
};

export type LeaseInput = {
  lease_type: 'fixed' | 'month_to_month' | null;
  lease_start: string | null;
  lease_end: string | null;
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
        security_deposit: input.security_deposit ?? null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'link_id' }
    );

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}
