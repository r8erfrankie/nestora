import { createClient } from '@/lib/supabase/server';
import { WorkOrdersClient } from './work-orders-client';

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const autoOpenCreate = params.create === '1';

  // Fetch the current user's email before the parallel queries so we can
  // filter work_order_user_archives to this user only.
  // (Unauthenticated users are redirected by proxy before reaching here.)
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = (user?.email ?? '').toLowerCase();

  const [
    { data: workOrders, error: workOrdersError },
    { data: properties },
    { data: contractors },
    { data: archivedEntries },
    { data: convertedRequests },
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        `
        *,
        properties (id, name)
      `
      )
      .order('created_at', { ascending: false }),
    supabase.from('properties').select('id, name').order('name'),
    supabase.from('contractors').select('id, name, email, phone, trade').order('name'),
    supabase
      .from('work_order_user_archives')
      .select('work_order_id')
      .eq('user_email', userEmail),
    // Derive which work orders originated from a maintenance request.
    // maintenance_requests.converted_to_work_order_id already stores this link;
    // we reverse it here so the work orders list can show a badge without needing
    // a schema migration on work_orders.
    supabase
      .from('maintenance_requests')
      .select('converted_to_work_order_id')
      .not('converted_to_work_order_id', 'is', null),
  ]);

  const archivedWorkOrderIds = (archivedEntries ?? []).map((e) => e.work_order_id as string);

  // Set of work_order IDs that were converted from a maintenance request.
  const linkedWorkOrderIds = (convertedRequests ?? [])
    .map((r) => r.converted_to_work_order_id as string)
    .filter(Boolean);

  if (workOrdersError) {
    // error will be passed to client for display
  }

  return (
    <div className="p-6">
      <WorkOrdersClient
        initialWorkOrders={workOrders || []}
        properties={properties || []}
        contractors={contractors || []}
        archivedWorkOrderIds={archivedWorkOrderIds}
        linkedWorkOrderIds={linkedWorkOrderIds}
        loadError={workOrdersError}
        autoOpenCreate={autoOpenCreate}
      />
    </div>
  );
}
