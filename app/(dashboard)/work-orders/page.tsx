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
    { data: tenantLinks },
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
    // Fetches tenant_email + property_id so we can look up the unit number below.
    supabase
      .from('maintenance_requests')
      .select('id, converted_to_work_order_id, tenant_email, property_id')
      .not('converted_to_work_order_id', 'is', null),
    // Unit lookup — RLS scopes this to the landlord's own properties.
    supabase
      .from('tenant_property_links')
      .select('property_id, tenant_email, unit'),
  ]);

  const archivedWorkOrderIds = (archivedEntries ?? []).map((e) => e.work_order_id as string);

  // Map: "propertyId::email" → unit
  const unitByPropertyEmail = new Map<string, string | null>();
  for (const link of tenantLinks ?? []) {
    const key = `${link.property_id}::${(link.tenant_email as string).toLowerCase()}`;
    unitByPropertyEmail.set(key, link.unit as string | null);
  }

  // Map: work_order_id → { requestId, unit } (for deep-link + unit display)
  const linkedWorkOrderMap: Record<string, { requestId: string; unit: string | null }> = {};
  for (const r of convertedRequests ?? []) {
    if (r.converted_to_work_order_id && r.id) {
      const email = (r.tenant_email as string | null)?.toLowerCase() ?? '';
      const unit = unitByPropertyEmail.get(`${r.property_id}::${email}`) ?? null;
      linkedWorkOrderMap[r.converted_to_work_order_id as string] = {
        requestId: r.id as string,
        unit,
      };
    }
  }

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
        linkedWorkOrderMap={linkedWorkOrderMap}
        loadError={workOrdersError}
        autoOpenCreate={autoOpenCreate}
      />
    </div>
  );
}
