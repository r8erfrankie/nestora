'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function sendMagicLink(email: string) {
  const supabase = await createClient();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  // Helpful guard when using placeholder env vars (server-side now)
  if (!supabaseUrl || supabaseUrl.includes('your-project-ref')) {
    return {
      error: 'Supabase not configured yet. Update .env.local with your real project URL and anon key, then restart the server.',
    };
  }

  const trimmed = email.trim().toLowerCase();

  // Compute redirect URL on server to avoid hardcoding
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const emailRedirectTo = `${protocol}://${host}/auth/callback`;

  const { error: signInError } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      // Magic link will redirect here after clicking the email link
      emailRedirectTo,
    },
  });

  if (signInError) {
    return { error: signInError.message };
  }

  return { success: true };
}
