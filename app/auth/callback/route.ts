import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Supabase auth callback (magic links, OAuth, etc.).
 * Uses the project's standard createClient (SSR cookie handling).
 *
 * On success: exchange the PKCE code and redirect to the final destination (dashboard by default).
 * On error: redirect to a friendly error page (instead of bouncing straight back to the login form).
 *
 * IMPORTANT: The emailRedirectTo / redirectTo you pass in signInWithOtp (or generateLink)
 * must be *exactly* registered in Supabase Dashboard → Authentication → Redirect URLs.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Default to root (the dashboard in this app). Can be overridden with ?next=...
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
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
      console.error('[Auth Callback] exchangeCodeForSession error:', error);
    }
  }

  // Graceful error handling: dedicated page instead of /login?error=...
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
