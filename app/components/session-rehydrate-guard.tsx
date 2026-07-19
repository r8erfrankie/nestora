'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * On a cold launch of the installed iOS PWA, the very first request can
 * beat WebKit's cookie store to the punch — it goes out before the session
 * cookie is reattached, so the server-rendered root page sees no user and
 * falls back to the guest landing page even though the session is fine.
 *
 * This re-checks auth client-side a moment later (by which point the
 * cookie store has settled) and, if a session actually exists, refreshes
 * so the server re-renders with the now-visible cookie and redirects
 * properly. No-op for genuinely logged-out visitors.
 */
export function SessionRehydrateGuard() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!cancelled && user) router.refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
