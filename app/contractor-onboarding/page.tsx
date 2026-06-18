import { redirect } from 'next/navigation';
import { createClient, getCurrentUserRole } from '@/lib/supabase/server';
import { ContractorOnboardingClient } from './contractor-onboarding-client';

export const metadata = { title: 'Contractor Setup' };

export default async function ContractorOnboardingPage() {
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

  if (role !== 'contractor') {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded')
    .eq('id', user.id)
    .single();

  // Already completed contractor onboarding
  if (profile?.onboarded) {
    redirect('/contractor');
  }

  return <ContractorOnboardingClient />;
}
