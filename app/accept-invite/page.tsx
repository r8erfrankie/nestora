import Link from 'next/link';
import { Layers, MailCheck, LinkIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createAdminClient } from '@/lib/supabase/server';

export const metadata = { title: 'Contractor Invitation — Nestora' };

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // ── Invalid / missing token ───────────────────────────────────────────────
  if (!token) {
    return <InviteError reason="missing" />;
  }

  // Admin client required: RLS on contractors uses landlord_id = auth.uid(),
  // so an unauthenticated request would be blocked by the regular client.
  const admin = createAdminClient();

  const { data: contractor } = await admin
    .from('contractors')
    .select('id, name, email, user_id')
    .eq('invite_token', token)
    .maybeSingle();

  // Token not found
  if (!contractor) {
    return <InviteError reason="invalid" />;
  }

  // Token already consumed (contractor has a linked account)
  if (contractor.user_id) {
    return <InviteError reason="used" />;
  }

  // ── Valid pending invite ──────────────────────────────────────────────────
  // Pass email + token to the login/signup page so it can pre-fill the email
  // and the auto-linking in setUserRoleAction can connect the account on signup.
  const signupUrl = `/login?email=${encodeURIComponent(contractor.email ?? '')}&invite=${encodeURIComponent(token)}`;

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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <MailCheck className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <CardTitle>You&apos;ve been invited</CardTitle>
            <CardDescription className="mt-1">
              A property manager has added you to their contractor directory on Nestora.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {contractor.email && (
              <div className="rounded-lg bg-muted px-4 py-3 text-center">
                <p className="text-muted-foreground text-xs">Invited as</p>
                <p className="mt-0.5 text-sm font-medium">{contractor.email}</p>
              </div>
            )}

            <p className="text-muted-foreground text-center text-sm">
              Create your account to start receiving and managing work orders.
            </p>

            <Button asChild className="w-full">
              <Link href={signupUrl}>Create your account</Link>
            </Button>

            <p className="text-muted-foreground text-center text-xs">
              Already have an account?{' '}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Error states ─────────────────────────────────────────────────────────────

function InviteError({ reason }: { reason: 'missing' | 'invalid' | 'used' }) {
  const messages = {
    missing: 'No invitation token was provided.',
    invalid: 'This invitation link is invalid or has already been used.',
    used:    'This invitation has already been accepted. Sign in to access your account.',
  };

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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <LinkIcon className="text-muted-foreground h-6 w-6" />
              </div>
            </div>
            <CardTitle>Invalid invitation</CardTitle>
            <CardDescription className="mt-1">{messages[reason]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {reason === 'used' && (
              <Button asChild className="w-full">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
