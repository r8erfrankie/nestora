'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createProperty(data: {
  name: string;
  address?: string | null;
  type?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: inserted, error } = await supabase
    .from('properties')
    .insert({
      name: data.name.trim(),
      address: data.address?.trim() || null,
      type: data.type || null,
      notes: data.notes?.trim() || null,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/properties');
  revalidatePath('/');
  return inserted;
}

export async function updateProperty(
  id: string,
  data: { name: string; address?: string | null; type?: string | null; notes?: string | null }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: updated, error } = await supabase
    .from('properties')
    .update({
      name: data.name.trim(),
      address: data.address?.trim() || null,
      type: data.type || null,
      notes: data.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/properties');
  return updated;
}
