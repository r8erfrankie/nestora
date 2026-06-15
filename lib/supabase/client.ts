import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in Client Components.
 * This client runs in the browser and handles auth state via cookies.
 *
 * Usage in a Client Component:
 *   'use client'
 *   import { createClient } from '@/lib/supabase/client'
 *   const supabase = createClient()
 *
 * Note: Required NEXT_PUBLIC_SUPABASE_* vars are validated on the server
 * (see lib/env.ts). They are inlined by Next.js at build time for the client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
