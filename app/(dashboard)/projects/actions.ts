'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createProject(data: {
  name: string;
  description?: string | null;
  status: string;
  due_date?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: inserted, error } = await supabase
    .from('projects')
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status: data.status,
      due_date: data.due_date || null,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/projects');
  return inserted;
}

export async function updateProject(
  id: string,
  data: { name: string; description?: string | null; status: string; due_date?: string | null }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: updated, error } = await supabase
    .from('projects')
    .update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status: data.status,
      due_date: data.due_date || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/projects');
  return updated;
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
  revalidatePath('/projects');
}
