import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingPage from './landing/page';

export const metadata = {
  title: 'Nestora — Maintenance made simple for small landlords',
  description:
    'The simple pipeline that connects tenants, landlords, and contractors. Submit requests with photos, assign work orders, and keep everyone in sync.',
};

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | null;

  if (role === 'contractor') redirect('/contractor');
  if (role === 'tenant') redirect('/tenant');
  if (!role) redirect('/select-role');
  redirect('/overview');
}
