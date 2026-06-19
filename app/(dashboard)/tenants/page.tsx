import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TenantsClient, type TenantLink, type MaintenanceRequest } from './tenants-client';

export const metadata = { title: 'Tenants' };

export default async function TenantsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'landlord') redirect('/');

  // Parallel fetch — links (with property join), property list, and maintenance requests.
  // RLS handles scoping: tenant_property_links by landlord_id, maintenance_requests by
  // "property_id IN (SELECT id FROM properties WHERE user_id = auth.uid())".
  const [{ data: rawLinks }, { data: properties }, { data: rawRequestsData }] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select(
        'id, tenant_id, tenant_email, status, unit, initiated_by, created_at, property_id, property:property_id(id, name, address)'
      )
      .neq('status', 'removed')
      .order('created_at', { ascending: false }),
    supabase
      .from('properties')
      .select('id, name, address, join_code')
      .order('name', { ascending: true }),
    supabase
      .from('maintenance_requests')
      .select(
        'id, tenant_id, property_id, title, description, category, priority, status, tenant_email, created_at, property:property_id(id, name, address)'
      )
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const links = (rawLinks ?? []) as unknown as TenantLink[];
  const pendingLinks = links.filter((l) => l.status === 'pending');
  const rawApproved = links.filter((l) => l.status === 'approved');

  // Unit lookup built from the already-fetched links — no extra query needed.
  // Key: "propertyId::lowercaseEmail"
  const unitMap = new Map<string, string | null>();
  for (const link of links) {
    unitMap.set(`${link.property_id}::${link.tenant_email.toLowerCase()}`, link.unit);
  }

  type RawRequest = {
    id: string; tenant_id: string; property_id: string;
    title: string; description: string | null; category: string | null;
    priority: string; status: string; tenant_email: string; created_at: string;
    property: { id: string; name: string; address: string | null } | null;
  };
  const rawRequests = (rawRequestsData ?? []) as unknown as RawRequest[];

  // Collect all unique tenant IDs across both approved links and maintenance requests.
  // profiles RLS is own-row-only — admin client required; one batch covers both lists.
  const allTenantIds = [
    ...new Set([
      ...rawApproved.map((l) => l.tenant_id).filter((id): id is string => !!id),
      ...rawRequests.map((r) => r.tenant_id).filter(Boolean),
    ]),
  ];
  const nameMap = new Map<string, string | null>();
  if (allTenantIds.length > 0) {
    const admin = createAdminClient();
    const { data: tenantProfiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', allTenantIds);
    for (const p of tenantProfiles ?? []) {
      nameMap.set(p.id as string, (p.full_name as string | null) ?? null);
    }
  }

  // Enrich approved links with resolved tenant names.
  const approvedLinks: TenantLink[] = rawApproved.map((l) => ({
    ...l,
    tenant_name: nameMap.get(l.tenant_id ?? '') ?? null,
  }));

  const maintenanceRequests: MaintenanceRequest[] = rawRequests.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    tenant_email: r.tenant_email,
    tenant_name: nameMap.get(r.tenant_id) ?? null,
    unit: unitMap.get(`${r.property_id}::${r.tenant_email.toLowerCase()}`) ?? null,
    created_at: r.created_at,
    property: r.property,
  }));

  return (
    <div className="max-w-3xl p-6">
      <TenantsClient
        pendingLinks={pendingLinks}
        approvedLinks={approvedLinks}
        properties={properties ?? []}
        maintenanceRequests={maintenanceRequests}
      />
    </div>
  );
}
