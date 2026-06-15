import { createClient } from '@/lib/supabase/server';
import { WorkOrdersClient } from './work-orders-client';

export default async function WorkOrdersPage() {
  const supabase = await createClient();

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
      />
    </div>
  );
}
