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

    // Implicit flow: tokens are in the URL hash fragment (#access_token=...).
    // With flowType:'pkce' set, the SDK ignores hash fragments automatically,
    // so we parse them manually and call setSession directly.
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            console.error('setSession error:', error.message);
            setError(true);
            router.replace('/auth/auth-code-error');
          } else {
            router.replace(next);
          }
        });
      return;
    }

    // No code, no hash tokens — nothing we can do
    setError(true);
    router.replace('/auth/auth-code-error');
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
