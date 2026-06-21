'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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
    } catch (linkError) {
      console.error('[setUserRoleAction] contractor auto-link failed:', linkError);
      // Non-fatal — user proceeds to contractor-onboarding regardless.
    }
  }

  redirect(role === 'contractor' ? '/contractor-onboarding' : '/landlord-onboarding');
}
