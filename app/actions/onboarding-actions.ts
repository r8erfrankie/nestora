'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveOnboardingProfile(data: {
  full_name: string;
  phone?: string | null;
  company_name?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name,
      phone: data.phone ?? null,
      company_name: data.company_name ?? null,
    })
    .eq('id', user.id);

  if (error) throw error;
}

export async function createOnboardingProperty(data: {
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
  return inserted as { id: string; name: string };
}

export async function createOnboardingWorkOrder(data: {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  property_id: string;
  assigned_contractor_email?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('work_orders').insert({
    title: data.title.trim(),
    description: data.description?.trim() || null,
    priority: data.priority,
    due_date: data.due_date || null,
    property_id: data.property_id,
    assigned_contractor_email: data.assigned_contractor_email?.trim() || null,
    user_id: user.id,
    status: 'Open',
  });

  if (error) throw error;
}

export async function markUserOnboarded() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
  revalidatePath('/');
}
