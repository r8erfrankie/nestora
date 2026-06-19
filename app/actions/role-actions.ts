'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

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

  redirect(role === 'contractor' ? '/contractor-onboarding' : '/landlord-onboarding');
}
