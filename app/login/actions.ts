'use server';

import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';

export async function sendMagicLink(email: string) {
  const trimmed = email.trim().toLowerCase();

  // Use stable site URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const emailRedirectTo = siteUrl 
    ? `${siteUrl}/auth/callback` 
    : `${process.env.VERCEL_URL ? 'https' : 'http'}://${process.env.VERCEL_URL || 'localhost:3000'}/auth/callback`;

  console.log('[Magic Link] Generating link with redirectTo:', emailRedirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  // Generate magic link (does NOT send email)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: trimmed,
    options: {
      redirectTo: emailRedirectTo,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('generateLink error:', linkError);
    return { error: linkError?.message || 'Failed to generate magic link.' };
  }

  const magicLink = linkData.properties.action_link;

  // Send email using Resend (dynamic import)
  try {
    const { sendMagicLinkEmail } = await import('@/app/actions/email');
    await sendMagicLinkEmail({
      to: trimmed,
      magicLink,
    });
  } catch (emailErr) {
    console.error('Resend sendMagicLinkEmail failed:', emailErr);
  }

  return { success: true };
}

