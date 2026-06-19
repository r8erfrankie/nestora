'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function approveTenantRequest(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tenant_property_links')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('landlord_id', user.id); // belt-and-suspenders (RLS already enforces landlord_id)

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}

export async function rejectTenantRequest(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Delete the row so the tenant can re-request if needed.
  // 'rejected' is not in the status CHECK constraint, so we don't set it.
  const { error } = await supabase
    .from('tenant_property_links')
    .delete()
    .eq('id', linkId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}
