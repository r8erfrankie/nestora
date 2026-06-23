'use server';

import { createClient } from '@/lib/supabase/server';

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
