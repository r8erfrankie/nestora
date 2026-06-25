'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { insertNotification } from '@/lib/notifications';

export async function archiveTenantRequest(requestId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('tenant_request_archives')
    .upsert(
      { user_id: user.id, request_id: requestId },
      { onConflict: 'user_id,request_id' }
    );
}

export async function withdrawTenantRequest(requestId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // RLS enforces tenant_id = auth.uid() — only the submitting tenant can withdraw.
  // Only allow withdrawal while still Submitted (before landlord acts on it).
  const { error } = await supabase
    .from('maintenance_requests')
    .update({ status: 'Withdrawn' })
    .eq('id', requestId)
    .eq('tenant_id', user.id)
    .eq('status', 'Submitted');

  if (error) throw new Error(error.message);

  // Auto-archive so it moves to the Hidden tab on the tenant dashboard.
  await supabase
    .from('tenant_request_archives')
    .upsert(
      { user_id: user.id, request_id: requestId },
      { onConflict: 'user_id,request_id' }
    );

  // Notify the landlord (non-fatal)
  try {
    const admin = createAdminClient();
    const { data: request } = await admin
      .from('maintenance_requests')
      .select('title, property:property_id(user_id, name)')
      .eq('id', requestId)
      .single();
    const property = request?.property as unknown as { user_id: string; name: string } | null;
    if (property?.user_id) {
      await insertNotification({
        userId: property.user_id,
        type: 'request_withdrawn',
        title: 'Request withdrawn',
        message: `"${request!.title}"${property.name ? ` at ${property.name}` : ''} — your tenant withdrew this request.`,
        link: '/tenants',
      });
    }
  } catch { /* non-fatal */ }

  revalidatePath('/tenant');
  revalidatePath('/tenants');
}

export async function unarchiveTenantRequest(requestId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('tenant_request_archives')
    .delete()
    .eq('user_id', user.id)
    .eq('request_id', requestId);
}
