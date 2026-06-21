'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export type ClaimContractorRoleState = { error?: string };

const ROLE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

// Plain form action — called via <form action={setUserRoleAction}>.
// redirect() is safe here because it's invoked by a form POST, not an event
// handler, so Next.js handles the redirect response before any client code runs.
// All error paths also call redirect() (back to /select-role) so the client
// never receives an unhandled error.
export async function setUserRoleAction(formData: FormData) {
  const role = formData.get('role');
  // Optional join code passed through from /join/[code] → /select-role.
  // Forwarded to /tenant-onboarding so the property can be pre-filled.
  const join = formData.get('join');

  if (role !== 'landlord' && role !== 'contractor' && role !== 'tenant') {
    redirect('/select-role');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', user.id);

  if (error) {
    redirect('/select-role');
  }

  // Persist role in cookie so proxy can route without a DB query on every request.
  const cookieStore = await cookies();
  cookieStore.set('nestora_role', role, ROLE_COOKIE_OPTIONS);

  if (role === 'tenant') {
    const dest = join ? `/tenant-onboarding?join=${join}` : '/tenant-onboarding';
    redirect(dest);
  }

  // Auto-link pending contractor directory entries created by landlords before this
  // user had a Nestora account. The contractors table is RLS-guarded by landlord_id,
  // so the contractor themselves can't update those rows — admin client required.
  if (role === 'contractor' && user.email) {
    try {
      const admin = createAdminClient();
      const normalizedEmail = user.email.toLowerCase();

      // Fetch profile so we can fill in missing fields on the directory entries.
      // phone/trade live in profiles, not in auth user_metadata.
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, phone, trade')
        .eq('id', user.id)
        .single();

      // Find all pending directory entries for this email that haven't been linked yet.
      const { data: pending } = await admin
        .from('contractors')
        .select('id, name, phone, trade')
        .eq('email', normalizedEmail)
        .is('user_id', null);

      if (pending && pending.length > 0) {
        for (const row of pending) {
          const updates: Record<string, string> = { user_id: user.id };

          // Only fill in missing fields — never overwrite what the landlord entered.
          if (!row.name && profile?.full_name) updates.name = profile.full_name;
          if (!row.phone && profile?.phone)     updates.phone = profile.phone;
          if (!row.trade && profile?.trade)     updates.trade = profile.trade;

          await admin.from('contractors').update(updates).eq('id', row.id);
        }
      }

      // Hybrid model: backfill assigned_contractor_id on any work orders that were
      // assigned to this email before the contractor had a Nestora account.
      await admin
        .from('work_orders')
        .update({ assigned_contractor_id: user.id })
        .eq('assigned_contractor_email', normalizedEmail)
        .is('assigned_contractor_id', null);
    } catch (linkError) {
      console.error('[setUserRoleAction] contractor auto-link failed:', linkError);
      // Non-fatal — user proceeds to contractor-onboarding regardless.
    }
  }

  redirect(role === 'contractor' ? '/contractor-onboarding' : '/landlord-onboarding');
}

// Called from the /contractor/welcome page via useActionState.
// Sets role=contractor, stamps the session cookie, auto-links any pending
// contractor directory entries, then redirects to onboarding.
// Returns { error } on failure so the client can display it; calls redirect() on success.
export async function claimContractorRole(
  _prevState: ClaimContractorRoleState,
  _formData: FormData,
): Promise<ClaimContractorRoleState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to continue. Please sign in and try again.' };
  }

  // Fetch current role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Already a contractor — skip straight to onboarding
  if (profile?.role === 'contractor') {
    redirect('/contractor-onboarding');
  }

  // Conflict: account already belongs to a different role
  if (profile?.role) {
    return {
      error: `This account is already registered as a ${profile.role}. Sign out and use a different account to accept this invitation.`,
    };
  }

  // Set role
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'contractor' })
    .eq('id', user.id);

  if (updateError) {
    console.error('[claimContractorRole] profile update failed:', updateError.message);
    return { error: 'Failed to set up your account. Please try again.' };
  }

  // Stamp the role cookie so the proxy picks it up immediately
  const cookieStore = await cookies();
  cookieStore.set('nestora_role', 'contractor', ROLE_COOKIE_OPTIONS);

  // Auto-link any pending contractor directory entries that match this email.
  // Requires admin client — the contractor can't update rows owned by landlords via RLS.
  if (user.email) {
    try {
      const admin = createAdminClient();
      const normalizedEmail = user.email.toLowerCase();

      const { data: profileData } = await admin
        .from('profiles')
        .select('full_name, phone, trade')
        .eq('id', user.id)
        .single();

      const { data: pending } = await admin
        .from('contractors')
        .select('id, name, phone, trade')
        .eq('email', normalizedEmail)
        .is('user_id', null);

      if (pending && pending.length > 0) {
        for (const row of pending) {
          const updates: Record<string, string> = { user_id: user.id };
          if (!row.name && profileData?.full_name) updates.name = profileData.full_name;
          if (!row.phone && profileData?.phone)     updates.phone = profileData.phone;
          if (!row.trade && profileData?.trade)     updates.trade = profileData.trade;
          await admin.from('contractors').update(updates).eq('id', row.id);
        }
      }

      // Hybrid model: backfill assigned_contractor_id on any work orders that were
      // assigned to this email before the contractor had a Nestora account.
      await admin
        .from('work_orders')
        .update({ assigned_contractor_id: user.id })
        .eq('assigned_contractor_email', normalizedEmail)
        .is('assigned_contractor_id', null);
    } catch (linkError) {
      console.error('[claimContractorRole] auto-link failed (non-fatal):', linkError);
    }
  }

  redirect('/contractor-onboarding');
}
