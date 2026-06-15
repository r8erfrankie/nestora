import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { validateEnv } from '@/lib/env';

// Validate required env vars on server startup (this runs in Node, not the browser)
validateEnv();

/**
 * Supabase Auth proxy for Next.js App Router.
 * (Uses the "proxy" file convention per this version of Next — middleware.ts is deprecated.)
 *
 * Refreshes the user's session on every request and handles cookie-based auth.
 * Protects dashboard routes and redirects unauthenticated users to /login.
 *
 * The aggressive matcher below ensures this never runs for dev HMR chunks, static assets,
 * or font files — preventing script load failures and refresh loops on hard reloads.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not add any logic between createServerClient and
  // supabase.auth.getUser(). A mistake here can cause hard-to-debug
  // auth issues (users randomly logged out).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Define public paths that don't require authentication
  const isPublicPath = pathname === '/login' || pathname.startsWith('/auth');

  if (!user && !isPublicPath) {
    // User is not logged in and trying to access protected route -> redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    // Preserve any cookies (including refreshed session cookies) set by Supabase during getUser()
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user && pathname === '/login') {
    // Already logged in, redirect away from login page
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run proxy on all routes except:
     * - Everything under /_next/ (static chunks, images, Turbopack/Webpack HMR client scripts,
     *   hot updates, dev websocket, etc.). This prevents HMR script load failures and refresh loops.
     * - Static assets (images, fonts, icons, etc.)
     * - Favicon
     */
    '/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
