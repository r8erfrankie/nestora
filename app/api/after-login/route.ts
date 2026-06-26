import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ROLE_COOKIE = 'nestora_role';
const ROLE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
};

// Called after OTP verification to re-stamp the role cookie from the DB.
// This prevents stale-cookie redirect loops when signing in with a different
// role than the previous session (e.g. landlord → contractor on the same browser).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') ?? '';
  const safeNext = next.startsWith('/') && next.length > 1 ? next : null;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | null;

  const destination = safeNext
    ? safeNext
    : role === 'contractor' ? '/contractor'
    : role === 'tenant'     ? '/tenant'
    : role === 'landlord'   ? '/overview'
    : '/select-role';

  const response = NextResponse.redirect(new URL(destination, origin));

  // Always write the correct role cookie, overwriting any stale value.
  if (role === 'landlord' || role === 'contractor' || role === 'tenant') {
    response.cookies.set(ROLE_COOKIE, role, ROLE_COOKIE_OPTIONS);
  } else {
    response.cookies.set(ROLE_COOKIE, '', { ...ROLE_COOKIE_OPTIONS, maxAge: 0 });
  }

  return response;
}
