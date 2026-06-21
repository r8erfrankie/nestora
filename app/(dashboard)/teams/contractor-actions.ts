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

  if (!data.name?.trim()) throw new Error('Name is required');

  const normalizedEmail = data.email?.trim().toLowerCase() || null;

  // 1. Prevent duplicates: return the existing record if this landlord already has
  //    a contractor with this email rather than creating a second entry.
  if (normalizedEmail) {
    const { data: existing } = await supabase
      .from('contractors')
      .select('id, name, email, phone, trade, notes, user_id, landlord_id')
      .eq('landlord_id', user.id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) return existing;
  }

  // 2. Look up a matching Nestora profile by email to auto-link the account.
  //    profiles.email is populated by the handle_new_user() trigger on signup.
  let linkedUserId: string | null = null;

  if (normalizedEmail) {
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

  // 3. Create the contractor directory entry.
  const { data: inserted, error } = await supabase
    .from('contractors')
    .insert({
      landlord_id: user.id,    // ownership — used by RLS
      user_id: linkedUserId,   // nullable link to the contractor's Nestora profile
      name: data.name.trim(),
      email: normalizedEmail,
      phone: data.phone?.trim() || null,
      trade: data.trade || null,
      notes: data.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[createContractor]', error.message);
    throw new Error(`Failed to create contractor: ${error.message}`);
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
