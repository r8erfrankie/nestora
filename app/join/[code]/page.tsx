import { redirect } from 'next/navigation';
import { createClient, getCurrentUserRole } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, UserX } from 'lucide-react';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated — send to login. The redirectTo param is preserved so
  // the login page can (in future) return the user directly here after sign-in.
  if (!user) {
    redirect(`/login?redirectTo=/join/${code}`);
  }

  const role = await getCurrentUserRole();

  // No role chosen yet — send to role selection with tenant hint + code.
  if (!role) {
    redirect(`/select-role?hint=tenant&join=${code}`);
  }

  // Tenant — send to onboarding with the code pre-filled.
  if (role === 'tenant') {
    redirect(`/tenant-onboarding?join=${code}`);
  }

  // ── Wrong role ───────────────────────────────────────────────────────────────
  // Landlord or contractor: show a clear message and a sign-out path.
  // After sign-out we return to this same /join/[code] URL so the unauthenticated
  // redirect picks up immediately and carries the code into the login flow.
  const roleLabel = role === 'landlord' ? 'Landlord' : 'Contractor';

  async function handleSignOut() {
    'use server';
    const sc = await createClient();
    await sc.auth.signOut();
    redirect(`/join/${code}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="flex justify-center">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <UserX className="text-muted-foreground h-6 w-6" />
              </div>
            </div>
            <CardTitle>Wrong account type</CardTitle>
            <CardDescription className="mt-1">
              This link is for tenants. You&apos;re currently signed in as a{' '}
              <strong className="text-foreground">{roleLabel}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSignOut}>
              <Button type="submit" className="w-full">
                Sign out and continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
