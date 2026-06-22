'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendContractorInviteEmail } from '@/lib/email';
import { validateEnv } from '@/lib/env';

validateEnv();

export type CreateContractorResult =
  | { success: true; contractor: Record<string, unknown>; linked: boolean; message?: string }
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

  // Send an invitation email only when:
  //   • an email address was provided, AND
  //   • the contractor has no linked account yet (user_id is still null)
  if (normalizedEmail && !linkedUserId) {
    try {
      const inviteToken = (inserted as unknown as Record<string, unknown>).invite_token as string | undefined;
      const { data: landlordProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      const landlordName = (landlordProfile?.full_name as string | null) ?? null;

      if (inviteToken) {
        await sendContractorInviteEmail({
          to: normalizedEmail,
          contractorName: data.name.trim(),
          landlordName,
          inviteToken,
        });
        // Record when the invite was sent.
        await supabase
          .from('contractors')
          .update({ last_invited_at: new Date().toISOString() })
          .eq('id', (inserted as unknown as Record<string, unknown>).id as string);
      }
    } catch (emailError) {
      console.error('[createContractor] invitation email failed (non-fatal):', emailError);
    }
  }

  return {
    success: true,
    contractor: inserted,
    linked: !!linkedUserId,
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

export async function resendContractorInvite(
  contractorId: string
): Promise<{ success: true; email: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Admin client: contractors RLS is landlord_id = auth.uid(), but we also
  // need to read invite_token which is excluded from landlord reads for safety.
  const admin = createAdminClient();

  const { data: contractor } = await admin
    .from('contractors')
    .select('id, name, email, user_id, landlord_id, invite_token, last_invited_at')
    .eq('id', contractorId)
    .single();

  if (!contractor) return { success: false, error: 'Contractor not found' };
  if (contractor.landlord_id !== user.id) return { success: false, error: 'Not authorized' };
  if (!contractor.email) return { success: false, error: 'This contractor has no email address' };
  if (contractor.user_id) return { success: false, error: 'This contractor has already accepted the invitation' };

  // Rate limit: one resend per 60 minutes per contractor.
  if (contractor.last_invited_at) {
    const minutesSince = (Date.now() - new Date(contractor.last_invited_at as string).getTime()) / 60_000;
    if (minutesSince < 60) {
      const wait = Math.ceil(60 - minutesSince);
      return {
        success: false,
        error: `Invite sent recently. Please wait ${wait} more minute${wait !== 1 ? 's' : ''} before resending.`,
      };
    }
  }

  if (!contractor.invite_token) return { success: false, error: 'No invite token found. Delete and re-add this contractor.' };

  // Fetch landlord name for personalization.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const landlordName = (profile?.full_name as string | null) ?? null;

  await sendContractorInviteEmail({
    to: contractor.email as string,
    contractorName: contractor.name as string,
    landlordName,
    inviteToken: contractor.invite_token as string,
  });

  await admin
    .from('contractors')
    .update({ last_invited_at: new Date().toISOString() })
    .eq('id', contractorId);

  return { success: true, email: contractor.email as string };
}

export async function deleteContractor(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Admin client required: RLS on contractors is scoped to landlord_id = auth.uid(),
    // which blocks a regular client from reading or deleting rows it doesn't own.
    const admin = createAdminClient();

    const { data: contractor, error: fetchErr } = await admin
      .from('contractors')
      .select('id, landlord_id')
      .eq('id', id)
      .single();

    if (fetchErr || !contractor) {
      console.error('[deleteContractor] fetch failed:', fetchErr?.message);
      return { success: false, error: 'Contractor not found' };
    }

    if (contractor.landlord_id !== user.id) {
      return { success: false, error: 'Not authorized to delete this contractor' };
    }

    const { error: deleteErr } = await admin
      .from('contractors')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      console.error('[deleteContractor] delete failed:', deleteErr.message, deleteErr.code);

      if (deleteErr.code === '23503') {
        return {
          success: false,
          error: 'Cannot delete this contractor — they still have work orders assigned. Reassign or complete those work orders first.',
        };
      }

      return { success: false, error: `Failed to delete contractor: ${deleteErr.message}` };
    }

    return { success: true };
  } catch (err) {
    console.error('[deleteContractor] unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
