'use server';

import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';

export async function sendMagicLink(email: string) {
  const trimmed = email.trim().toLowerCase();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const emailRedirectTo = siteUrl 
    ? `${siteUrl}/auth/callback` 
    : `https://${process.env.VERCEL_URL}/auth/callback`;

  // Use SERVICE ROLE key here
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
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

  try {
    const { sendMagicLinkEmail } = await import('@/app/actions/email');
    await sendMagicLinkEmail({ to: trimmed, magicLink });
  } catch (e) {
    console.error('Resend error:', e);
  }

  return { success: true };
}
