'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
      // PKCE flow: exchange the code for a session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('PKCE exchange error:', error.message);
          setError(true);
          router.replace('/auth/auth-code-error');
        } else {
          router.replace(next);
        }
      });
      return;
    }

    // Implicit flow: tokens land in the URL hash fragment (#access_token=...).
    // createBrowserClient auto-detects and processes them on init.
    // Use onAuthStateChange to know when the session is ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();
        router.replace(next);
      }
    });

    // Fallback: if nothing fires within 4 seconds, redirect to error
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      setError(true);
      router.replace('/auth/auth-code-error');
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">{error ? 'Redirecting…' : 'Signing you in…'}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground text-sm">Signing you in…</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
