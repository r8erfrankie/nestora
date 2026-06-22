import Link from 'next/link';
import { Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createAdminClient } from '@/lib/supabase/server';

export const metadata = { title: 'Contractor Invitation — Nestora' };

const TEAL = '#0F766E';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <InviteError reason="missing" />;
  }

  // Admin client required: contractors RLS is landlord_id = auth.uid();
  // this page is visited unauthenticated.
  const admin = createAdminClient();

  const { data: contractor } = await admin
    .from('contractors')
    .select('id, name, email, user_id, landlord_id')
    .eq('invite_token', token)
    .maybeSingle();

  if (!contractor) {
    return <InviteError reason="invalid" />;
  }

  if (contractor.user_id) {
    return <InviteError reason="used" />;
  }

  // Fetch the landlord's display name — non-fatal if missing.
  let landlordName: string | null = null;
  if (contractor.landlord_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', contractor.landlord_id)
      .single();
    landlordName = (profile?.full_name as string | null) ?? null;
  }

  const signupUrl = `/login?email=${encodeURIComponent(contractor.email ?? '')}&invite=${encodeURIComponent(token)}`;

  const headline = landlordName
    ? `${landlordName} invited you to join their team`
    : "You've been invited to join a team";

  const subline = landlordName
    ? `${landlordName} uses Nestora to manage their properties and has added you as a contractor.`
    : 'A property manager has added you as a contractor on Nestora.';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50/60 to-white px-6 py-16">

      {/* Wordmark */}
      <div className="mb-8">
        <span style={{ color: TEAL }} className="text-2xl font-bold tracking-tight">
          Nestora
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-lg shadow-teal-900/5">

        {/* Teal banner */}
        <div style={{ background: TEAL }} className="px-8 py-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm font-medium text-teal-100">Contractor invitation</p>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          <h1 className="mb-2 text-xl font-700 text-gray-900 leading-snug font-bold">
            {headline}
          </h1>
          <p className="mb-6 text-sm text-gray-500 leading-relaxed">
            {subline}
          </p>

          {/* Invite detail pill */}
          {(contractor.name || contractor.email) && (
            <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 space-y-2">
              {contractor.name && (
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-gray-400">Name</span>
                  <span className="text-sm font-medium text-gray-800">{contractor.name}</span>
                </div>
              )}
              {contractor.email && (
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-gray-400">Email</span>
                  <span className="min-w-0 truncate text-sm font-medium text-gray-800">{contractor.email}</span>
                </div>
              )}
            </div>
          )}

          {/* Value props */}
          <ul className="mb-7 space-y-2">
            {[
              'Receive and manage work orders',
              'View job details and property info',
              'Communicate directly with your manager',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                {item}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <a
            href={signupUrl}
            style={{ background: TEAL }}
            className="flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Set Up My Account
          </a>

          <p className="mt-4 text-center text-xs text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-gray-700 underline underline-offset-4 hover:text-gray-900">
              Sign in instead
            </Link>
          </p>
        </div>
      </div>

      {/* Fine print */}
      <p className="mt-8 max-w-xs text-center text-xs text-gray-400 leading-relaxed">
        No account will be created without your action. You can safely ignore this page if you weren't expecting an invitation.
      </p>
    </div>
  );
}

// ── Error states ──────────────────────────────────────────────────────────────

function InviteError({ reason }: { reason: 'missing' | 'invalid' | 'used' }) {
  const copy = {
    missing: {
      headline: 'No invitation found',
      body: "This link doesn't include an invitation token. Please check the link in your email and try again.",
    },
    invalid: {
      headline: 'Invalid invitation',
      body: 'This invitation link is invalid or has expired. Reach out to your property manager and ask them to resend the invite.',
    },
    used: {
      headline: 'Already accepted',
      body: 'This invitation has already been accepted. Sign in to access your Nestora account.',
    },
  }[reason];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50/60 to-white px-6 py-16">

      {/* Wordmark */}
      <div className="mb-8">
        <span style={{ color: TEAL }} className="text-2xl font-bold tracking-tight">
          Nestora
        </span>
      </div>

      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md">

        {/* Header band */}
        <div className="bg-gray-50 px-8 py-6 text-center border-b border-gray-100">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <AlertCircle className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Invitation error</p>
        </div>

        <div className="px-8 py-7 text-center">
          <h1 className="mb-2 text-xl font-bold text-gray-900">{copy.headline}</h1>
          <p className="mb-7 text-sm text-gray-500 leading-relaxed">{copy.body}</p>

          <div className="space-y-3">
            {reason === 'used' && (
              <a
                href="/login"
                style={{ background: TEAL }}
                className="flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Sign in
              </a>
            )}
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
