'use server';

import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
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

export async function saveContractorOnboarding(data: {
  full_name: string;
  trade?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name.trim(),
      trade: data.trade?.trim() || null,
      phone: data.phone?.trim() || null,
      notes: data.notes?.trim() || null,
      onboarded: true,
    })
    .eq('id', user.id);

  if (error) throw error;

  // Sync accurate contractor data back to any linked directory entries.
  // Uses admin client because the contractors RLS policy is landlord_id = auth.uid()
  // — the contractor themselves cannot update those rows via a regular client.
  // A contractor can appear in multiple landlords' directories, so we update all
  // matching rows. Notes are intentionally excluded (landlord-managed field).
  try {
    const updates: Record<string, string> = {};
    if (data.full_name.trim()) updates.name  = data.full_name.trim();
    if (data.phone?.trim())     updates.phone = data.phone.trim();
    if (data.trade?.trim())     updates.trade = data.trade.trim();

    if (Object.keys(updates).length > 0) {
      await createAdminClient()
        .from('contractors')
        .update(updates)
        .eq('user_id', user.id);
    }
  } catch (dirError) {
    console.error('[saveContractorOnboarding] directory sync failed (non-fatal):', dirError);
  }

  redirect('/contractor');
}
