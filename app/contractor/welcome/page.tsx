import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ContractorWelcomeClient } from './contractor-welcome-client';

export const metadata = { title: 'Welcome — Nestora' };

export default async function ContractorWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If already a contractor, skip onboarding entry point and go to dashboard.
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'contractor') {
      redirect('/contractor');
    }
  }

  // Build the login URL so unauthenticated visitors come back here after sign-in.
  const returnUrl = `/contractor/welcome${email ? `?email=${encodeURIComponent(email)}` : ''}`;
  const loginUrl = `/login${email ? `?email=${encodeURIComponent(email)}&` : '?'}redirectTo=${encodeURIComponent(returnUrl)}`;

  return (
    <ContractorWelcomeClient
      email={email ?? null}
      isAuthenticated={!!user}
      loginUrl={loginUrl}
    />
  );
}
