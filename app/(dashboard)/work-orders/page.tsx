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
  const prefillPropertyId = typeof params.prefill_property === 'string' ? params.prefill_property : undefined;
  const prefillUnit = typeof params.prefill_unit === 'string' ? params.prefill_unit : undefined;

  // Fetch the current user's email before the parallel queries so we can
  // filter work_order_user_archives to this user only.
  // (Unauthenticated users are redirected by proxy before reaching here.)
  let userEmail = '';
  try {
    const { data } = await supabase.auth.getUser();
    userEmail = (data?.user?.email ?? '').toLowerCase();
  } catch {
    // Non-fatal — archives filter falls back to empty string (no archived IDs returned)
  }

  // All data fetching is wrapped in try/catch so that if Next.js triggers an
  // automatic RSC re-render (e.g. after a Server Action sets a session cookie),
  // a transient query failure renders a graceful empty state instead of crashing
  // the page with "An error occurred in the Server Components render".
  let workOrders = null;
  let workOrdersError = null;
  let properties: { id: string; name: string }[] = [];
  let contractors: { id: string; name: string; email: string; phone: string | null; trade: string | null }[] = [];
  let archivedWorkOrderIds: string[] = [];
  let linkedWorkOrderMap: Record<string, { requestId: string; unit: string | null }> = {};

  try {
    const [
      { data: workOrdersData, error: workOrdersErr },
      { data: propertiesData },
      { data: contractorsData },
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

    workOrders = workOrdersData;
    workOrdersError = workOrdersErr;
    properties = propertiesData ?? [];
    contractors = contractorsData ?? [];
    archivedWorkOrderIds = (archivedEntries ?? []).map((e) => e.work_order_id as string);

    // Map: "propertyId::email" → unit
    const unitByPropertyEmail = new Map<string, string | null>();
    for (const link of tenantLinks ?? []) {
      const tenantEmail = (link.tenant_email as string | null)?.toLowerCase();
      if (!tenantEmail) continue;
      unitByPropertyEmail.set(`${link.property_id}::${tenantEmail}`, link.unit as string | null);
    }

    // Map: work_order_id → { requestId, unit } (for deep-link + unit display)
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
  } catch (err) {
    console.error('[WorkOrdersPage] data fetch failed:', err);
    // Page renders with empty state — client shows the loadError if workOrdersError is set,
    // or a blank list if the outer try/catch caught a network-level throw.
  }

  return (
    <div className="p-6">
      <WorkOrdersClient
        initialWorkOrders={workOrders || []}
        properties={properties}
        contractors={contractors}
        archivedWorkOrderIds={archivedWorkOrderIds}
        linkedWorkOrderMap={linkedWorkOrderMap}
        loadError={workOrdersError}
        autoOpenCreate={autoOpenCreate}
        prefillPropertyId={prefillPropertyId}
        prefillUnit={prefillUnit}
      />
    </div>
  );
}
