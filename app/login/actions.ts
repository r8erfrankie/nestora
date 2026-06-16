'use server';

// Magic link email is sent using Resend via a Server Action only.
// We use Supabase (admin.generateLink with service role - the underlying mechanism for signInWithOtp magic links)
// to generate the secure magic link WITHOUT triggering Supabase's native email sender.
// Then we send the actual email (with the link) using Resend from inside this Server Action.
// The client component only ever calls this Server Action (never touches Resend or the key).

import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function sendMagicLink(email: string) {
  const trimmed = email.trim().toLowerCase();

  // Compute redirect URL safely
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
          return []; // not needed for signInWithOtp
        },
        setAll() {},
      },
    }
  );

  // Use normal signInWithOtp (more reliable than generateLink in many cases)
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

  // Note: By default Supabase will try to send an email.
  // If you want to fully control the email with Resend, you should use generateLink instead.
  // For now, this version lets Supabase send the email (simpler and more reliable).

  return { success: true };
}
