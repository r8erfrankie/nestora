import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TenantsClient, type TenantLink, type MaintenanceRequest } from './tenants-client';
import { MarkVisited } from '@/components/mark-visited';

export const metadata = { title: 'Tenants' };

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ expandRequest?: string }>;
}) {
  const supabase = await createClient();
  const { expandRequest } = await searchParams;
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
        'id, tenant_id, tenant_email, status, unit, initiated_by, notes, created_at, property_id, property:property_id(id, name, address)'
      )
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false }),
    supabase
      .from('properties')
      .select('id, name, address, join_code')
      .order('name', { ascending: true }),
    supabase
      .from('maintenance_requests')
      .select(
        'id, tenant_id, property_id, title, description, category, priority, status, tenant_email, converted_to_work_order_id, created_at, property:property_id(id, name, address)'
      )
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const links = (rawLinks ?? []) as unknown as TenantLink[];
  const rawPending = links.filter((l) => l.status === 'pending');
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
    priority: string; status: string; tenant_email: string;
    converted_to_work_order_id: string | null; created_at: string;
    property: { id: string; name: string; address: string | null } | null;
  };
  const rawRequests = (rawRequestsData ?? []) as unknown as RawRequest[];

  // Look up names by email, not by tenant_id.
  // tenant_property_links.tenant_id is null for landlord-invited tenants (inserted with
  // tenant_id = null). profiles.email is always populated by the handle_new_user() trigger,
  // and tenant_email is always present on both tables — so email is a reliable key.
  // profiles RLS is own-row-only; admin client required.
  const allEmails = [
    ...new Set([
      ...rawApproved.map((l) => l.tenant_email.toLowerCase()),
      ...rawPending.map((l) => l.tenant_email.toLowerCase()),
      ...rawRequests.map((r) => r.tenant_email.toLowerCase()),
    ]),
  ];
  const nameByEmail = new Map<string, string | null>();
  const phoneByEmail = new Map<string, string | null>();
  const ecNameByEmail = new Map<string, string | null>();
  const ecPhoneByEmail = new Map<string, string | null>();
  if (allEmails.length > 0) {
    const admin = createAdminClient();
    const { data: tenantProfiles } = await admin
      .from('profiles')
      .select('email, full_name, phone, emergency_contact_name, emergency_contact_phone')
      .in('email', allEmails);
    for (const p of tenantProfiles ?? []) {
      const key = (p.email as string).toLowerCase();
      nameByEmail.set(key, (p.full_name as string | null) ?? null);
      phoneByEmail.set(key, (p.phone as string | null) ?? null);
      ecNameByEmail.set(key, (p.emergency_contact_name as string | null) ?? null);
      ecPhoneByEmail.set(key, (p.emergency_contact_phone as string | null) ?? null);
    }
  }

  const approvedLinks: TenantLink[] = rawApproved.map((l) => {
    const key = l.tenant_email.toLowerCase();
    return {
      ...l,
      tenant_name: nameByEmail.get(key) ?? null,
      // nameByEmail only contains emails present in profiles. If the email is
      // absent the profile row was deleted after the link was created.
      profileMissing: !nameByEmail.has(key),
      phone: phoneByEmail.get(key) ?? null,
      ec_name: ecNameByEmail.get(key) ?? null,
      ec_phone: ecPhoneByEmail.get(key) ?? null,
    };
  });

  const pendingLinks: TenantLink[] = rawPending.map((l) => ({
    ...l,
    tenant_name: nameByEmail.get(l.tenant_email.toLowerCase()) ?? null,
    phone: null,
    ec_name: null,
    ec_phone: null,
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
    tenant_name: nameByEmail.get(r.tenant_email.toLowerCase()) ?? null,
    phone: phoneByEmail.get(r.tenant_email.toLowerCase()) ?? null,
    unit: unitMap.get(`${r.property_id}::${r.tenant_email.toLowerCase()}`) ?? null,
    converted_to_work_order_id: r.converted_to_work_order_id,
    created_at: r.created_at,
    property: r.property,
  }));

  return (
    <div className="max-w-3xl p-6">
      <MarkVisited section="tenants" />
      <TenantsClient
        pendingLinks={pendingLinks}
        approvedLinks={approvedLinks}
        properties={properties ?? []}
        maintenanceRequests={maintenanceRequests}
        expandRequest={expandRequest ?? null}
      />
    </div>
  );
}
