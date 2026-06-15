'use server';

// IMPORTANT: Magic link authentication uses ONLY Supabase's native signInWithOtp.
// NO Resend, RESEND_API_KEY, or any custom email client is used or imported here (or anywhere in app/login/*).
// This guarantees that RESEND_API_KEY never appears in client bundles or auth headers for the sign-in page.
// Work order notification emails (using Resend) are isolated via *double* dynamic import (crud -> email-actions -> 'resend' inside funcs) and only in other Server Actions. Login flow has zero reference.

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
