import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Cookie written by the auth callback and role-selection action.
// The proxy reads it to make routing decisions without a DB query on every request.
const ROLE_COOKIE = 'nestora_role'

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
          // Write refreshed session cookies onto the response so the browser
          // receives the latest tokens even when we issue a redirect below.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Always refresh the Supabase session first so tokens stay current.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── 1. Auth routes: never block ────────────────────────────────────────────
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    return response
  }

  // ── 2. Unauthenticated users: require login ─────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── 3. Authenticated user on /login: send home ──────────────────────────────
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── 4. Server Action POSTs: skip role routing (actions handle their own auth) ─
  // Server actions are POST requests to the page route they're declared on.
  if (request.method !== 'GET') {
    return response
  }

  // ── 5. Determine role from cookie ───────────────────────────────────────────
  // In development also respect the dev_role cookie (set by the dev switcher).
  const isDev = process.env.NODE_ENV === 'development'
  const rawRole = isDev
    ? (request.cookies.get('dev_role')?.value ?? request.cookies.get(ROLE_COOKIE)?.value)
    : request.cookies.get(ROLE_COOKIE)?.value
  const role = validRole(rawRole)

  // ── 6. Role-selection flow: auth required, no role cookie required ───────────
  const isRoleFlow =
    pathname === '/select-role' ||
    pathname === '/landlord-onboarding' ||
    pathname === '/contractor-onboarding'

  // If the user already has a role and visits /select-role, redirect home.
  if (pathname === '/select-role' && role) {
    return NextResponse.redirect(new URL(role === 'contractor' ? '/contractor' : '/', request.url))
  }

  if (isRoleFlow) {
    return response
  }

  // ── 7. All other routes require a role ──────────────────────────────────────
  if (!role) {
    return NextResponse.redirect(new URL('/select-role', request.url))
  }

  // ── 8. Cross-role access control ────────────────────────────────────────────
  if (role === 'contractor') {
    // Contractors may only access their own dashboard and shared settings.
    const allowed = pathname.startsWith('/contractor') || pathname.startsWith('/settings')
    if (!allowed) {
      return NextResponse.redirect(new URL('/contractor', request.url))
    }
  }

  if (role === 'landlord' && pathname.startsWith('/contractor')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
