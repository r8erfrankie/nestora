'use server';

import { createAdminClient } from '@/lib/supabase/server';

export async function sendMagicLink(email: string) {
  const trimmed = email.trim().toLowerCase();

  // Determine the app base URL. NEXT_PUBLIC_SITE_URL must be set in production.
  // VERCEL_URL is set automatically by Vercel as a fallback.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!base) {
    console.error('[sendMagicLink] Neither NEXT_PUBLIC_SITE_URL nor VERCEL_URL is set.');
    return { error: 'App URL is not configured. Set NEXT_PUBLIC_SITE_URL in your environment variables.' };
  }

  const emailRedirectTo = `${base}/auth/callback`;
  console.log(`[sendMagicLink] emailRedirectTo: ${emailRedirectTo}`);

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (err: any) {
    console.error('[sendMagicLink] createAdminClient failed:', err.message);
    return { error: err.message };
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: trimmed,
    options: { redirectTo: emailRedirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[sendMagicLink] generateLink error:', linkError?.message);
    return { error: linkError?.message || 'Failed to generate magic link.' };
  }

  const magicLink = linkData.properties.action_link;

  try {
    const { sendMagicLinkEmail } = await import('@/app/actions/email');
    await sendMagicLinkEmail({ to: trimmed, magicLink });
  } catch (err: any) {
    console.error('[sendMagicLink] Resend error:', err.message);
    return { error: `Failed to send email: ${err.message}` };
  }

  return { success: true };
}
