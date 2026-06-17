'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(data: { full_name: string; role: 'landlord' | 'contractor' }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: data.full_name.trim() || null, role: data.role })
    .eq('id', user.id);

  if (error) throw error;

  revalidatePath('/settings');
  revalidatePath('/');
}
