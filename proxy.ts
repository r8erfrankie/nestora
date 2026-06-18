import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROLE_COOKIE = 'nestora_role'
const ROLE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
} as const

function validRole(value: string | undefined): 'landlord' | 'contractor' | null {
  if (value === 'landlord' || value === 'contractor') return value
  return null
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session so tokens stay current on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── 1. Auth routes: never block ─────────────────────────────────────────────
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    return response
  }

  // ── 2. Unauthenticated → login ───────────────────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── 3. Authenticated user on /login → send home ──────────────────────────────
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── 4. Server Action POSTs: skip role routing (each action enforces its own auth)
  if (request.method !== 'GET') {
    return response
  }

  // ── 5. Role-flow pages: only require authentication, not a role ──────────────
  const isRoleFlow =
    pathname === '/select-role' ||
    pathname.startsWith('/landlord-onboarding') ||
    pathname.startsWith('/contractor-onboarding')

  // ── 6. Determine role — fast path from cookie; DB fallback if cookie absent ──
  // The cookie is set by the auth callback on login and by the role-selection
  // action when the user first picks a role. Users whose sessions predate the
  // cookie will hit the DB exactly once; the cookie then carries them on every
  // subsequent request.
  const isDev = process.env.NODE_ENV === 'development'
  const rawCookieRole = isDev
    ? (request.cookies.get('dev_role')?.value ?? request.cookies.get(ROLE_COOKIE)?.value)
    : request.cookies.get(ROLE_COOKIE)?.value

  let role = validRole(rawCookieRole)
  let roleCookieToStamp: string | null = null

  if (role === null && !isRoleFlow) {
    // Cookie missing: one DB round-trip to find the real role. We stamp the
    // cookie on the way out so the next request takes the fast path.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    role = validRole(profile?.role as string | undefined)
    if (role !== null) {
      roleCookieToStamp = role
    }
  }

  // Stamps the role cookie on whichever response we're about to return.
  function stamp<T extends NextResponse>(res: T): T {
    if (roleCookieToStamp) {
      res.cookies.set(ROLE_COOKIE, roleCookieToStamp, ROLE_COOKIE_OPTIONS)
    }
    return res
  }

  // ── 7. Visiting /select-role with a role already set: send to their home ─────
  if (pathname === '/select-role' && role) {
    return stamp(
      NextResponse.redirect(new URL(role === 'contractor' ? '/contractor' : '/', request.url))
    )
  }

  // ── 8. Role-flow pages: allow through ───────────────────────────────────────
  if (isRoleFlow) {
    return stamp(response)
  }

  // ── 9. All other routes require a role ──────────────────────────────────────
  if (!role) {
    return NextResponse.redirect(new URL('/select-role', request.url))
  }

  // ── 10. Cross-role access control ────────────────────────────────────────────
  if (role === 'contractor') {
    const allowed =
      pathname.startsWith('/contractor') || pathname.startsWith('/settings')
    if (!allowed) {
      return stamp(NextResponse.redirect(new URL('/contractor', request.url)))
    }
  }

  if (role === 'landlord' && pathname.startsWith('/contractor')) {
    return stamp(NextResponse.redirect(new URL('/', request.url)))
  }

  // ── 11. All checks passed: allow the request through ────────────────────────
  return stamp(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
