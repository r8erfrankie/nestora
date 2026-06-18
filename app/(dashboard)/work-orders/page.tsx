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

  const [{ data: workOrders, error: workOrdersError }, { data: properties }] = await Promise.all([
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
  ]);

  if (workOrdersError) {
    // error will be passed to client for display
  }

  return (
    <div className="p-6">
      <WorkOrdersClient
        initialWorkOrders={workOrders || []}
        properties={properties || []}
        loadError={workOrdersError}
        autoOpenCreate={autoOpenCreate}
      />
    </div>
  );
}
