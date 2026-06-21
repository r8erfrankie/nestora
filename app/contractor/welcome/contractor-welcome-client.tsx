'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Layers, HardHat, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { claimContractorRole, type ClaimContractorRoleState } from '@/app/actions/role-actions';

interface Props {
  email: string | null;
  isAuthenticated: boolean;
  loginUrl: string;
}

const initialState: ClaimContractorRoleState = {};

export function ContractorWelcomeClient({ email, isAuthenticated, loginUrl }: Props) {
  const [state, formAction, isPending] = useActionState(claimContractorRole, initialState);

  // Refs for the auto-submit path (authenticated users only).
  // formRef targets the hidden form; submitted guards against double-firing.
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || submitted.current) return;
    submitted.current = true;
    const t = setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  // ── Authenticated path ───────────────────────────────────────────────────────
  // Show a minimal screen — the welcome card was already seen before sign-in.
  // The hidden form auto-submits on mount; on error we surface a retry button.
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-6 text-center">
          {state?.error ? (
            <>
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
              </div>
              <div>
                <p className="font-medium">Something went wrong</p>
                <p className="text-muted-foreground mt-1 text-sm">{state.error}</p>
              </div>
              {email && (
                <div className="bg-muted rounded-lg px-4 py-2 text-center">
                  <p className="text-muted-foreground text-xs">Account</p>
                  <p className="mt-0.5 text-sm font-medium">{email}</p>
                </div>
              )}
              <form action={formAction}>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Trying again…
                    </>
                  ) : (
                    'Try again'
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">Setting up your contractor account…</p>
            </>
          )}

          {/* Hidden form that fires on mount via formRef.current.requestSubmit() */}
          <form ref={formRef} action={formAction} className="hidden" aria-hidden />
        </div>
      </div>
    );
  }

  // ── Unauthenticated path ─────────────────────────────────────────────────────
  // Full welcome card shown only once, before the user signs in.
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4 text-center">
            <div className="mb-3 flex justify-center">
              <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                <HardHat className="text-primary h-6 w-6" />
              </div>
            </div>
            <CardTitle>Welcome to Nestora</CardTitle>
            <CardDescription className="mt-1">
              A property manager has added you as a contractor. Create your account to start
              receiving and managing work orders.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {email && (
              <div className="bg-muted rounded-lg px-4 py-3 text-center">
                <p className="text-muted-foreground text-xs">Invited as</p>
                <p className="mt-0.5 text-sm font-medium">{email}</p>
              </div>
            )}

            <Button asChild className="w-full">
              <Link href={loginUrl}>Sign in to get started</Link>
            </Button>

            <p className="text-muted-foreground text-center text-xs">
              Already have an account?{' '}
              <Link
                href={email ? `/login?email=${encodeURIComponent(email)}` : '/login'}
                className="text-foreground underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
