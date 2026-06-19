import { redirect } from 'next/navigation';
import { createClient, getCurrentUserRole } from '@/lib/supabase/server';
import { SelectRoleClient } from './select-role-client';

export const metadata = { title: 'Choose Your Role' };

export default async function SelectRolePage({
  searchParams,
}: {
  searchParams: Promise<{ hint?: string; join?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = await getCurrentUserRole();

  // Already chose a role — send to the right home
  if (role !== null) {
    redirect(role === 'contractor' ? '/contractor' : role === 'tenant' ? '/tenant' : '/');
  }

  const { hint, join } = await searchParams;

  return <SelectRoleClient hint={hint} join={join} />;
}
