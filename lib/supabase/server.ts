import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from '@/lib/env';

// Validate required env vars on server startup (this runs in Node, not the browser)
validateEnv();

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. This properly handles cookie-based sessions for SSR.
 *
 * Usage in a Server Component:
 *   import { createClient } from '@/lib/supabase/server'
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('your_table').select()
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions (we do — see middleware.ts).
          }
        },
      },
    }
  );
}

export type UserRole = 'landlord' | 'contractor';

/**
 * Returns the effective role for the current user.
 * In development, this respects the 'dev_role' cookie override (for easy testing
 * of landlord vs contractor views without logging in as different users).
 * Falls back to the role stored in the user's profile (default 'landlord').
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return 'landlord';
  }

  // Development-only role override via cookie (set by the dev switcher)
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    const devRole = cookieStore.get('dev_role')?.value;
    if (devRole === 'landlord' || devRole === 'contractor') {
      console.log(`[DevRole] Using cookie override: ${devRole}`);
      return devRole;
    }
    console.log('[DevRole] No valid dev_role cookie found, falling back to profile/default');
  }

  // Fetch from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as UserRole | undefined;
  return role === 'contractor' ? 'contractor' : 'landlord';
}
