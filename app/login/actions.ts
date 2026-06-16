'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * Magic link email is sent using Resend via a Server Action only.
 * We use Supabase admin.generateLink (service role) — the server-side equivalent
 * of what signInWithOtp does for the "magiclink" type — to generate a secure
 * one-time magic link *without* triggering Supabase's native email delivery.
 * We then email the user the link ourselves using Resend.
 *
 * The client component (login-client.tsx) only ever calls this Server Action.
 * Resend + the service role key are never exposed to the client.
 */
export async function sendMagicLink(email: string) {
  const trimmed = email.trim().toLowerCase();

  // Use stable site URL if available, otherwise fall back to dynamic host
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  
  let emailRedirectTo: string;

  if (siteUrl) {
    emailRedirectTo = `${siteUrl}/auth/callback`;
  } else {
    // Fallback for local/dev
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    emailRedirectTo = `${protocol}://${host}/auth/callback`;
  }

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
}}
