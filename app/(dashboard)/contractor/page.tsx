import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGreeting } from '@/lib/utils';
import { ContractorClient, type ContractorWorkOrder } from './contractor-client';
import { PushPrompt } from '@/app/components/push-prompt';

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

  const userEmail = (user?.email ?? '').toLowerCase();

  const [
    { data: workOrders, error: workOrdersError },
    { data: archivedEntries },
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        `
        id,
        title,
        description,
        status,
        priority,
        due_date,
        unit,
        trade,
        notes,
        cost,
        contractor_quote,
        created_at,
        updated_at,
        properties (id, name, address)
      `
      )
      .eq('assigned_contractor_email', userEmail)
      .order('created_at', { ascending: false }),
    supabase
      .from('work_order_user_archives')
      .select('work_order_id')
      .eq('user_id', user?.id ?? ''),
  ]);

  if (workOrdersError) {
    console.error('[ContractorDashboard] work_orders query failed:', workOrdersError.message);
  }

  const archivedWorkOrderIds = (archivedEntries ?? []).map((e) => e.work_order_id as string);

  return (
    <>
      <PushPrompt role="contractor" />
      <ContractorClient
        workOrders={((workOrders ?? []) as any) as ContractorWorkOrder[]}
        greeting={greeting}
        firstName={firstName}
        archivedWorkOrderIds={archivedWorkOrderIds}
        currentUserId={user?.id ?? ''}
      />
    </>
  );
}
