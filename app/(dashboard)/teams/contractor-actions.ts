'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { validateEnv } from '@/lib/env';

validateEnv();

export async function createContractor(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  trade?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: inserted, error } = await supabase
    .from('contractors')
    .insert({
      user_id: user.id,
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      trade: data.trade || null,
      notes: data.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;

  // If the contractor has an existing account with no role yet, set it to 'contractor'.
  // Uses the admin client because RLS prevents a landlord from updating another user's profile.
  if (data.email) {
    try {
      const adminClient = createAdminClient();
      await adminClient
        .from('profiles')
        .update({ role: 'contractor' })
        .eq('email', data.email.trim().toLowerCase())
        .is('role', null);
    } catch {
      // Non-fatal: the contractor may not have a Nestora account yet, or
      // SUPABASE_SERVICE_ROLE_KEY may not be configured in this environment.
    }
  }

  return inserted;
}

export async function updateContractor(
  id: string,
  data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    trade?: string | null;
    notes?: string | null;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing, error: fetchErr } = await supabase
    .from('contractors')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchErr || !existing || existing.user_id !== user.id) {
    throw new Error('Not authorized to update this contractor');
  }

  const { error } = await supabase
    .from('contractors')
    .update({
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      trade: data.trade || null,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteContractor(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing, error: fetchErr } = await supabase
    .from('contractors')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchErr || !existing || existing.user_id !== user.id) {
    throw new Error('Not authorized to delete this contractor');
  }

  const { error } = await supabase.from('contractors').delete().eq('id', id);
  if (error) throw error;
}
