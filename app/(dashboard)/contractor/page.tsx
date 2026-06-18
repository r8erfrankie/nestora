import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGreeting } from '@/lib/utils';
import { ContractorClient, type ContractorWorkOrder } from './contractor-client';

export default async function ContractorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Single query for role + name (replaces getCurrentUserRole() + separate profile fetch).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user?.id ?? '')
    .single();

  // Defense-in-depth (proxy already routes by role).
  if (profile?.role !== 'contractor') {
    redirect('/');
  }

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
