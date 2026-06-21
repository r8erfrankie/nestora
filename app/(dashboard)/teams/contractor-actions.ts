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

  // If an email is provided, try to link this directory entry to an existing Nestora account.
  // profiles.email is populated by the handle_new_user() trigger on signup.
  let linkedUserId: string | null = null;

  if (data.email) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      linkedUserId = existingProfile.id as string;

      // Best-effort: stamp the role as 'contractor' if the account has no role yet.
      // Admin client required — RLS prevents a landlord from writing another user's profile.
      if (!existingProfile.role) {
        try {
          await createAdminClient()
            .from('profiles')
            .update({ role: 'contractor' })
            .eq('id', existingProfile.id);
        } catch {
          // Non-fatal: SUPABASE_SERVICE_ROLE_KEY may not be configured, or
          // the profile row may have been updated concurrently.
        }
      }
    }
  }

  const { data: inserted, error } = await supabase
    .from('contractors')
    .insert({
      landlord_id: user.id,         // ownership — used by RLS
      user_id: linkedUserId,        // nullable link to the contractor's Nestora profile
      name: data.name.trim(),
      email: data.email?.trim().toLowerCase() || null,
      phone: data.phone?.trim() || null,
      trade: data.trade || null,
      notes: data.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;

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
    .select('landlord_id')
    .eq('id', id)
    .single();

  if (fetchErr || !existing || existing.landlord_id !== user.id) {
    throw new Error('Not authorized to update this contractor');
  }

  const { error } = await supabase
    .from('contractors')
    .update({
      name: data.name.trim(),
      email: data.email?.trim().toLowerCase() || null,
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
    .select('landlord_id')
    .eq('id', id)
    .single();

  if (fetchErr || !existing || existing.landlord_id !== user.id) {
    throw new Error('Not authorized to delete this contractor');
  }

  const { error } = await supabase.from('contractors').delete().eq('id', id);
  if (error) throw error;
}
