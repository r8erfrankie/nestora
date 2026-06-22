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

  // Fetch the current user's ID before the parallel queries so we can
  // filter work_order_user_archives to this user only.
  // (Unauthenticated users are redirected by proxy before reaching here.)
  let userId = '';
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? '';
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
        .eq('user_id', userId),
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

    // ── On-demand backfill ──────────────────────────────────────────────────
    // Find work orders that have assigned_contractor_email but no
    // assigned_contractor_id. If the email now matches a registered profile,
    // write the ID back to the DB and patch the in-memory object so the
    // email-enrichment block below immediately picks it up.
    // This heals historical rows progressively on every page load.
    // Complements: SQL backfill-contractor-ids.sql (bulk, run once) and
    // the signup-time backfill in role-actions.ts.
    const unlinkedWOs = (workOrders ?? []).filter(
      (wo: any) => !wo.assigned_contractor_id && wo.assigned_contractor_email
    );
    if (unlinkedWOs.length > 0) {
      const unlinkedEmails = [
        ...new Set(
          unlinkedWOs.map((wo: any) =>
            (wo.assigned_contractor_email as string).toLowerCase()
          )
        ),
      ];
      try {
        const admin = createAdminClient();
        const { data: matchedProfiles } = await admin
          .from('profiles')
          .select('id, email')
          .in('email', unlinkedEmails);

        const profileIdByEmail = new Map<string, string>(
          (matchedProfiles ?? [])
            .filter((p: any) => p.email)
            .map((p: any) => [(p.email as string).toLowerCase(), p.id as string])
        );

        if (profileIdByEmail.size > 0 && workOrders) {
          const toWrite: Array<{ id: string; contractorId: string }> = [];

          workOrders = workOrders.map((wo: any) => {
            if (wo.assigned_contractor_id || !wo.assigned_contractor_email) return wo;
            const contractorId = profileIdByEmail.get(
              (wo.assigned_contractor_email as string).toLowerCase()
            );
            if (!contractorId) return wo;
            toWrite.push({ id: wo.id as string, contractorId });
            return { ...wo, assigned_contractor_id: contractorId };
          });

          if (toWrite.length > 0) {
            try {
              const admin2 = createAdminClient();
              await Promise.all(
                toWrite.map(({ id, contractorId }) =>
                  admin2
                    .from('work_orders')
                    .update({ assigned_contractor_id: contractorId })
                    .eq('id', id)
                    .is('assigned_contractor_id', null) // skip if a concurrent write beat us
                )
              );
              console.log(
                `[WorkOrdersPage] on-demand backfill: linked assigned_contractor_id on ${toWrite.length} work order(s)`
              );
            } catch (writeErr) {
              // Non-fatal — in-memory data is already patched for this render
              console.error('[WorkOrdersPage] backfill write failed (non-fatal):', writeErr);
            }
          }
        }
      } catch {
        // Non-fatal — page renders correctly with the data as-is
      }
    }

    // ── Email enrichment ────────────────────────────────────────────────────
    // Hybrid contractor model: when a contractor has signed up
    // (assigned_contractor_id is set), their stored assigned_contractor_email
    // may be stale if they later changed their email. Fetch the current email
    // from profiles for every registered contractor referenced by these work
    // orders and replace the stored value before the data reaches the client.
    // This keeps every display site correct without per-site changes.
    // Fallback: if the lookup fails or assigned_contractor_id is null, the
    // original assigned_contractor_email is used unchanged.
    const contractorProfileIds = [
      ...new Set(
        (workOrders ?? [])
          .map((wo: any) => wo.assigned_contractor_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (contractorProfileIds.length > 0) {
      try {
        const admin = createAdminClient();
        const { data: contractorProfiles } = await admin
          .from('profiles')
          .select('id, email')
          .in('id', contractorProfileIds);

        const currentEmailById = new Map<string, string>(
          (contractorProfiles ?? [])
            .filter((p: any) => p.email)
            .map((p: any) => [p.id as string, (p.email as string).toLowerCase()])
        );

        if (currentEmailById.size > 0 && workOrders) {
          workOrders = workOrders.map((wo: any) => {
            if (!wo.assigned_contractor_id) return wo;
            const currentEmail = currentEmailById.get(wo.assigned_contractor_id as string);
            return currentEmail ? { ...wo, assigned_contractor_email: currentEmail } : wo;
          });
        }
      } catch {
        // Non-fatal — stale assigned_contractor_email is shown as fallback
      }
    }

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
        currentUserId={userId}
      />
    </div>
  );
}
