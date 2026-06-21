import { createClient, createAdminClient } from '@/lib/supabase/server';
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
    const rawContractors = contractorsData ?? [];

    // Enrich registered contractors with their self-reported profile data (name, phone).
    // Profiles have strict RLS (own-row only), so we need the admin client.
    // Non-fatal: if enrichment fails the page still renders with directory-only data.
    try {
      const contractorEmails = rawContractors
        .map((c) => (c.email as string | null)?.toLowerCase())
        .filter((e): e is string => Boolean(e));

      if (contractorEmails.length > 0) {
        const admin = createAdminClient();
        const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const matched = users.filter(
          (u) => u.email && contractorEmails.includes(u.email.toLowerCase())
        );

        if (matched.length > 0) {
          const { data: profiles } = await admin
            .from('profiles')
            .select('id, full_name, phone')
            .in('id', matched.map((u) => u.id));

          const profileByUserId = new Map(
            (profiles ?? []).map((p) => [p.id as string, p])
          );
          const userIdByEmail = new Map(
            matched.map((u) => [u.email!.toLowerCase(), u.id])
          );

          contractors = rawContractors.map((c) => {
            const email = (c.email as string | null)?.toLowerCase() ?? '';
            const userId = userIdByEmail.get(email);
            const prof = userId ? profileByUserId.get(userId) : null;
            return {
              ...c,
              is_registered: !!prof,
              profile_name: (prof?.full_name as string | null) ?? null,
              profile_phone: (prof?.phone as string | null) ?? null,
            };
          });
        } else {
          contractors = rawContractors;
        }
      } else {
        contractors = rawContractors;
      }
    } catch {
      // Enrichment failed — fall back to directory-only data
      contractors = rawContractors;
    }
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
