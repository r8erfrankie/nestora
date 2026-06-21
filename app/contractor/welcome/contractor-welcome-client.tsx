'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Layers, HardHat, Loader2 } from 'lucide-react';
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

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Nestora logo mark */}
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

            {state?.error && (
              <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {state.error}
              </div>
            )}

            {isAuthenticated ? (
              // Authenticated: claim the contractor role and go to onboarding.
              <form action={formAction}>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up your account…
                    </>
                  ) : (
                    'Get Started'
                  )}
                </Button>
              </form>
            ) : (
              // Not authenticated: send to login, pre-filling the email and returning here.
              <Button asChild className="w-full">
                <Link href={loginUrl}>Sign in to get started</Link>
              </Button>
            )}

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
