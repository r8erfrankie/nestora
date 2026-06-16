import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';'use server';

// Magic link email is sent using Resend via a Server Action only.
// We use Supabase (admin.generateLink with service role - the underlying mechanism for signInWithOtp magic links)
// to generate the secure magic link WITHOUT triggering Supabase's native email sender.
// Then we send the actual email (with the link) using Resend from inside this Server Action.
// The client component only ever calls this Server Action (never touches Resend or the key).


'use server';

import { createServerClient } from '@supabase/ssr';

export async function sendMagicLink(email: string) {
  const trimmed = email.trim().toLowerCase();

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const emailRedirectTo = `${protocol}://${host}/auth/callback`;

  console.log('[Magic Link] Using redirectTo:', emailRedirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error('signInWithOtp error:', error);
    return { error: error.message || 'Failed to send magic link.' };
  }

  return { success: true };
}
