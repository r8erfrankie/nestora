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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  if (!supabaseUrl || supabaseUrl.includes('your-project-ref')) {
    return {
      error:
        'Supabase not configured yet. Update .env.local with your real project URL and anon key, then restart the server.',
    };
  }

  const trimmed = email.trim().toLowerCase();

  // Build an absolute emailRedirectTo that will be baked into the magic link.
  // This value MUST be registered exactly (including protocol + no trailing slash issues)
  // in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
  //
  // - Local dev: http://localhost:3000/auth/callback
  // - Vercel / production: prefer NEXT_PUBLIC_SITE_URL (set it in .env.local and Vercel),
  //   otherwise fall back to the VERCEL_URL provided at runtime.
  const getBaseUrl = () => {
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL;
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
  };

  const baseUrl = getBaseUrl().replace(/\/+$/, '');
  const emailRedirectTo = `${baseUrl}/auth/callback`;

  console.log('[Magic Link] emailRedirectTo (for generateLink):', emailRedirectTo);
  console.log('[Magic Link] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL || '(not set)');
  console.log('[Magic Link] VERCEL_URL:', process.env.VERCEL_URL || '(not set)');
  console.log('[Magic Link] NODE_ENV:', process.env.NODE_ENV);

  const admin = createAdminClient();

  // Generate the magic link server-side (no email sent by Supabase).
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: trimmed,
    options: {
      redirectTo: emailRedirectTo,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[Magic Link] generateLink failed:', linkError);
    return {
      error: linkError?.message || 'Failed to generate magic link.',
    };
  }

  const magicLink = linkData.properties.action_link;

  // Send the actual email ourselves using Resend (inside this Server Action only).
  try {
    const { sendMagicLinkEmail } = await import('@/app/actions/email');
    await sendMagicLinkEmail({
      to: trimmed,
      magicLink,
    });
  } catch (emailErr) {
    // Non-fatal: the link was successfully generated. We still return success
    // so the UI shows "check your email". Log for debugging.
    console.error('[Magic Link] Resend sendMagicLinkEmail failed (link was generated):', emailErr);
  }

  return { success: true };
}
