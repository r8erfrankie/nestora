'use server';

import { createClient } from '@/lib/supabase/server';

const FIELD = {
  tenants:     'last_seen_tenants_at',
  work_orders: 'last_seen_work_orders_at',
} as const;

export async function markSectionVisited(section: keyof typeof FIELD) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('profiles')
    .update({ [FIELD[section]]: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to mark section visited:', error);
  }
}
