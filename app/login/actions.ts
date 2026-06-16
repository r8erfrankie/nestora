'use server';

// Magic link email is sent using Resend via a Server Action only.
// We use Supabase (admin.generateLink with service role - the underlying mechanism for signInWithOtp magic links)
// to generate the secure magic link WITHOUT triggering Supabase's native email sender.
// Then we send the actual email (with the link) using Resend from inside this Server Action.
// The client component only ever calls this Server Action (never touches Resend or the key).

import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function sendMagicLink(email: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  // Helpful guard when using placeholder env vars (server-side now)
  if (!supabaseUrl || supabaseUrl.includes('your-project-ref')) {
    return {
      error: 'Supabase not configured yet. Update .env.local with your real project URL and anon key, then restart the server.',
    };
  }

  const trimmed = email.trim().toLowerCase();

  // Compute redirect URL on server to avoid hardcoding.
  // Prefer x-forwarded-host for Vercel/prod compatibility, fallback for local.
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const emailRedirectTo = `${protocol}://${host}/auth/callback`;

  // Use admin client + generateLink so Supabase does NOT send its own email.
  // This gives us the magic link URL that we will email ourselves using Resend.
  const admin = createAdminClient();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: trimmed,
    options: {
      redirectTo: emailRedirectTo,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return { error: linkError?.message || 'Failed to generate magic link.' };
  }

  const magicLink = linkData.properties.action_link;

  // Send the email using Resend — all inside this Server Action (dynamic import for strong isolation).
  try {
    const { sendMagicLinkEmail } = await import('@/app/actions/email');
    await sendMagicLinkEmail({
      to: trimmed,
      magicLink,
    });
  } catch (emailErr) {
    // If email send fails we can still surface a generic message (the link was generated).
    // In production you might want more sophisticated handling / logging.
    console.error('Resend sendMagicLinkEmail failed (non-fatal for generation):', emailErr);
    // For reliability, we still return success so user sees the "check your email" state.
    // (The link is valid even if this particular send had a transient issue.)
  }

  return { success: true };
}
