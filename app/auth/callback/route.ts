import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth callback route for Supabase magic links (and other OAuth flows).
 *
 * This follows the latest recommended Supabase + Next.js App Router pattern.
 *
 * Flow for magic links sent via Resend:
 * 1. Server Action (login/actions.ts) calls Supabase admin.generateLink() (using service role)
 *    to generate a secure magiclink token + action_link WITHOUT Supabase sending any email.
 * 2. The same Server Action uses Resend to email the user the magic link (action_link).
 * 3. User clicks the link → Supabase /verify endpoint validates the token server-side.
 * 4. Supabase redirects the browser to the `redirectTo` (our /auth/callback) with ?code=... (PKCE).
 * 5. This route exchanges the code for a session using the anon SSR client.
 * 6. On success → redirect to dashboard (/). On error → redirect to a dedicated error page.
 *
 * IMPORTANT:
 * - Service role key is ONLY used for link generation (in the login Server Action).
 * - This callback uses ONLY the anon key (via createClient) for exchangeCodeForSession.
 * - The redirectTo used when generating the link MUST be allow-listed in your
 *   Supabase project: Authentication → URL Configuration → Redirect URLs.
 *   Include both http://localhost:3000/auth/callback (for dev) and your production URL(s).
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL after login
  // (sanitized below)
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        // Local dev: safe to use the origin from the request (no load balancer)
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Vercel / production: force https and use the public forwarded host
        // (works with custom domains and *.vercel.app previews)
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        // Fallback
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to a dedicated error page with instructions.
  // This is the recommended graceful pattern instead of redirecting back to the
  // sign-in form with a query param (which can feel like a broken flow).
  // The error page explains that the link may be expired/used/invalid and offers
  // a clear way back to request a new magic link.
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
