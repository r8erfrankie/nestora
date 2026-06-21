'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendContractorInvitation } from '@/app/actions/email';
import { validateEnv } from '@/lib/env';

validateEnv();

export type CreateContractorResult =
  | { success: true; contractor: Record<string, unknown>; linked: boolean; inviteToken?: string; message?: string }
  | { success: false; error: string };

export async function createContractor(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  trade?: string | null;
  notes?: string | null;
}): Promise<CreateContractorResult> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return { success: false, error: 'Not authenticated' };
  if (!data.name?.trim()) return { success: false, error: 'Name is required' };

  const normalizedEmail = data.email?.trim().toLowerCase() || null;

  // 1. Prevent duplicates: if this landlord already has a contractor with this email,
  //    return the existing record rather than creating a second entry.
  if (normalizedEmail) {
    const { data: existing } = await supabase
      .from('contractors')
      .select('id, name, email, phone, trade, notes, user_id, landlord_id')
      .eq('landlord_id', user.id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        contractor: existing,
        linked: !!(existing as any).user_id,
        message: 'Contractor already exists in your directory',
      };
    }
  }

  // 2. Look up a matching Nestora profile by email to auto-link the contractor account.
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
  const { data: inserted, error: insertError } = await supabase
    .from('contractors')
    .insert({
      landlord_id: user.id,   // ownership — enforced by RLS
      user_id: linkedUserId,  // nullable link to the contractor's Nestora profile
      name: data.name.trim(),
      email: normalizedEmail,
      phone: data.phone?.trim() || null,
      trade: data.trade || null,
      notes: data.notes?.trim() || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[createContractor]', insertError.message);
    return { success: false, error: `Failed to create contractor: ${insertError.message}` };
  }

  const inviteToken = (inserted as any).invite_token as string | undefined;

  // Send an invitation email only when:
  //   • an email address was provided, AND
  //   • the contractor has no linked account yet (user_id is still null)
  if (normalizedEmail && !linkedUserId && inviteToken) {
    try {
      await sendContractorInvitation({
        contractorEmail: normalizedEmail,
        inviteToken,
      });
    } catch (emailError) {
      console.error('[createContractor] invitation email failed (non-fatal):', emailError);
    }
  }

  return {
    success: true,
    contractor: inserted,
    linked: !!linkedUserId,
    inviteToken,
  };
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
