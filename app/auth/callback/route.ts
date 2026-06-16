import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Support redirecting to a specific page after login (e.g. ?next=/projects)
  // Sanitize next to prevent open redirect attacks
  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/';
  }

  // Handle errors passed by Supabase (e.g. invalid/expired magic link)
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  if (error) {
    const message = errorDescription || error || 'Unable to sign in with magic link';
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      // Exchange failed (e.g. invalid/expired code or PKCE mismatch)
      const message = exchangeError.message || 'Unable to sign in with magic link';
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(message)}`
      );
    }
  }

  // No code and no explicit error -> generic failure
  return NextResponse.redirect(`${origin}/login?error=Unable to sign in with magic link`);
}
