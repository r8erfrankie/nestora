import { redirect } from 'next/navigation';
import { createClient, getCurrentUserRole } from '@/lib/supabase/server';
import { getGreeting } from '@/lib/utils';
import { ContractorClient, type ContractorWorkOrder } from './contractor-client';

export default async function ContractorDashboardPage() {
  const supabase = await createClient();
  const role = await getCurrentUserRole();

  if (role === null) {
    redirect('/select-role');
  }

  if (role !== 'contractor') {
    redirect('/');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user?.id ?? '')
    .single();

  const fullName = (profile as any)?.full_name as string | null | undefined;
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : null;
  const greeting = getGreeting();

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select(
      `
      id,
      title,
      description,
      status,
      priority,
      due_date,
      trade,
      notes,
      cost,
      created_at,
      updated_at,
      properties (id, name, address)
    `
    )
    .eq('assigned_contractor_email', user?.email ?? '')
    .order('created_at', { ascending: false });

  return (
    <ContractorClient
      workOrders={((workOrders ?? []) as any) as ContractorWorkOrder[]}
      greeting={greeting}
      firstName={firstName}
    />
  );
}
