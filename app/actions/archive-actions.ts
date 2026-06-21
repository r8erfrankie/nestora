'use server';

import { createClient } from '@/lib/supabase/server';

export async function archiveWorkOrderForUser(workOrderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('work_order_user_archives')
    .insert({
      work_order_id: workOrderId,
      user_id: user.id,
      user_email: user.email?.toLowerCase() ?? null, // kept for display on historical rows
    });

  // 23505 = unique_violation: already archived — treat as success
  if (error && error.code !== '23505') throw error;
}

export async function unarchiveWorkOrderForUser(workOrderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('work_order_user_archives')
    .delete()
    .eq('work_order_id', workOrderId)
    .eq('user_id', user.id);

  if (error) throw error;
}
