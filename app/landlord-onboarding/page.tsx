import { redirect } from 'next/navigation';
import { createClient, getCurrentUserRole } from '@/lib/supabase/server';
import { Onboarding } from '@/components/onboarding';

export const metadata = { title: 'Get Started' };

export default async function LandlordOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = await getCurrentUserRole();

  if (role === null) {
    redirect('/select-role');
  }

  if (role !== 'landlord') {
    redirect('/contractor');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded, full_name')
    .eq('id', user.id)
    .single();

  // Already onboarded — go straight to the dashboard
  if (profile?.onboarded) {
    redirect('/');
  }

  const fullName = (profile as any)?.full_name as string | null | undefined;
  const greetingName = fullName ? fullName.trim().split(/\s+/)[0] : 'there';

  return <Onboarding greetingName={greetingName} />;
}
