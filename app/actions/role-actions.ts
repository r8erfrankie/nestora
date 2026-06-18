'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/roles';

export async function setUserRole(role: UserRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', user.id);

  if (error) throw error;

  redirect(role === 'contractor' ? '/contractor-onboarding' : '/');
}
