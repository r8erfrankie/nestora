import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Accept only relative URLs to prevent open redirects.
  // A bare '/' means "no specific destination" so fall through to role defaults.
  const safeNext = next.startsWith('/') && next.length > 1 ? next : null

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const role = profile?.role

        const roleCookieOptions = {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          maxAge: 60 * 60 * 24 * 365, // 1 year
        }

        if (!role) {
          // New user (or profile was reset after previous session).
          // We must explicitly expire the nestora_role cookie before redirecting.
          //
          // Without this, a stale cookie from a previous session causes an
          // infinite redirect loop:
          //   1. Callback → /select-role (no cookie cleared)
          //   2. Proxy step 7: cookie says 'landlord' → redirect to /
          //   3. Root page: DB says role=null → redirect to /select-role
          //   4. Proxy step 7: cookie says 'landlord' → redirect to /
          //   ... loop
          //
          // The proxy skips its DB fallback on isRoleFlow pages (including
          // /select-role), so there is no self-healing path once the stale
          // cookie is present. Expiring it here breaks the loop at the source.
          //
          // If safeNext is set (e.g. a landlord invite link), go there directly —
          // the destination page (tenant-onboarding) will assign the role when
          // the tenant completes their profile.
          const target = safeNext ?? '/select-role'
          const res = NextResponse.redirect(`${origin}${target}`)
          res.cookies.set('nestora_role', '', {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 0,
          })
          return res
        }

        // If the magic link carried a specific destination (e.g. an invite),
        // honour it even for users who already have a role.
        const destination = safeNext
          ? `${origin}${safeNext}`
          : role === 'contractor' ? `${origin}/contractor`
          : role === 'tenant'     ? `${origin}/tenant`
          : `${origin}/`
        const res = NextResponse.redirect(destination)
        res.cookies.set('nestora_role', role, roleCookieOptions)
        return res
      }

      return NextResponse.redirect(`${origin}${safeNext ?? '/'}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
