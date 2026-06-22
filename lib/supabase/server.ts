import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { validateEnv } from '@/lib/env';
import type { UserRole } from '@/lib/roles';
export type { UserRole };

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
            // Called from a Server Component — safe to ignore if
            // proxy.ts is refreshing sessions (see proxy.ts).
          }
        },
      },
    }
  );
}

/**
 * Returns the effective role for the current user, or null if no role has been
 * chosen yet (new accounts land on /select-role).
 *
 * In development the 'dev_role' cookie overrides the DB value so you can test
 * both views without switching accounts.
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Development-only role override via cookie (set by the dev switcher)
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    const devRole = cookieStore.get('dev_role')?.value;
    if (devRole === 'landlord' || devRole === 'contractor' || devRole === 'tenant') {
      console.log(`[DevRole] Using cookie override: ${devRole}`);
      return devRole as UserRole;
    }
  }

  // Fetch from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role;
  if (role === 'landlord' || role === 'contractor' || role === 'tenant') return role;
  return null;
}

/**
 * Returns the current user's role and nav badge counts in a single round-trip
 * (role + last_seen timestamps in one profiles query, then two parallel count
 * queries for landlords). Used by the dashboard layout to drive sidebar badges.
 */
export async function getNavData(): Promise<{
  role: UserRole;
  badges: { tenants: number; workOrders: number };
}> {
  const NO_BADGES = { tenants: 0, workOrders: 0 };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: 'landlord', badges: NO_BADGES };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, last_seen_tenants_at, last_seen_work_orders_at')
      .eq('id', user.id)
      .single();

    const r = profile?.role;
    const effectiveRole: UserRole =
      r === 'landlord' || r === 'contractor' || r === 'tenant' ? r : 'landlord';

    if (effectiveRole !== 'landlord' || !profile) {
      return { role: effectiveRole, badges: NO_BADGES };
    }

    const lastSeenTenants    = profile.last_seen_tenants_at    as string | null;
    const lastSeenWorkOrders = profile.last_seen_work_orders_at as string | null;

    let tenantsCount = 0;
    let workOrdersCount = 0;

    // === Tenants badge: New tenants + New maintenance requests ===
    if (lastSeenTenants) {
      // 1. New tenant links
      const { count: newTenants } = await supabase
        .from('tenant_property_links')
        .select('*', { count: 'exact', head: true })
        .eq('landlord_id', user.id)
        .gt('created_at', lastSeenTenants);

      // 2. New maintenance requests (only unactioned ones)
      const { count: newRequests } = await supabase
        .from('maintenance_requests')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastSeenTenants)
        .eq('status', 'Submitted');

      tenantsCount = (newTenants ?? 0) + (newRequests ?? 0);
    }

    // === Work Orders badge (unchanged) ===
    if (lastSeenWorkOrders) {
      const { count } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('created_at', lastSeenWorkOrders);

      workOrdersCount = count ?? 0;
    }

    return {
      role: effectiveRole,
      badges: { tenants: tenantsCount, workOrders: workOrdersCount },
    };
  } catch {
    return { role: 'landlord', badges: NO_BADGES };
  }
}

/**
 * Creates a Supabase admin client using the service role key.
 * ONLY use in Server Actions / server code. Never expose the service role key to the client.
 * Used e.g. for generating magic links (so we can send the email ourselves via Resend instead of Supabase).
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations like generating magic links.');
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
