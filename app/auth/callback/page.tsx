'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const next = searchParams.get('next') ?? '/';

    // With flowType:'implicit' the SDK automatically processes #access_token= hash
    // fragments during initialization, then fires SIGNED_IN via onAuthStateChange.
    // We also handle ?code= (from PKCE if ever used) explicitly.
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('PKCE exchange error:', error.message);
          router.replace('/auth/auth-code-error');
        } else {
          router.replace(next);
        }
      });
      return;
    }

    // Implicit flow: listen for the SIGNED_IN event the SDK fires after processing
    // the hash fragment. Also check session immediately in case it fired before subscribe.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace(next);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next);
    });

    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) router.replace('/auth/auth-code-error');
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Signing you in…</p>
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
