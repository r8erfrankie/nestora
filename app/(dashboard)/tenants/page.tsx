import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TenantsClient, type TenantLink, type MaintenanceRequest } from './tenants-client';
import { type LeaseData } from './lease-actions';
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

  // Parallel fetch — links (with property join), property list, maintenance requests, and leases.
  // RLS handles scoping: tenant_property_links by landlord_id, maintenance_requests by
  // "property_id IN (SELECT id FROM properties WHERE user_id = auth.uid())".
  const [{ data: rawLinks }, { data: properties }, { data: rawRequestsData }, { data: rawLeases }] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select(
        'id, tenant_id, tenant_email, status, unit, unit_label_type, initiated_by, notes, created_at, property_id, property:property_id(id, name, address, unit_label_type)'
      )
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false }),
    supabase
      .from('properties')
      .select('id, name, address, join_code, unit_label_type')
      .order('name', { ascending: true }),
    supabase
      .from('maintenance_requests')
      .select(
        'id, tenant_id, property_id, title, description, category, priority, status, tenant_email, converted_to_work_order_id, created_at, property:property_id(id, name, address)'
      )
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('leases')
      .select('id, link_id, lease_type, lease_start, lease_end, monthly_rent, security_deposit, notes'),
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

  const leaseByLinkId = new Map<string, LeaseData>();
  for (const l of rawLeases ?? []) {
    leaseByLinkId.set(l.link_id as string, l as unknown as LeaseData);
  }

  // Fetch lease documents — try/catch so a missing table degrades gracefully.
  type RawDoc = { id: string; link_id: string; name: string; url: string; size: number | null; created_at: string };
  const docsByLinkId = new Map<string, RawDoc[]>();
  try {
    const approvedLinkIds = rawApproved.map((l) => l.id);
    if (approvedLinkIds.length > 0) {
      const { data } = await supabase
        .from('lease_documents')
        .select('id, link_id, name, url, size, created_at')
        .in('link_id', approvedLinkIds)
        .order('created_at', { ascending: true });
      for (const d of (data ?? []) as RawDoc[]) {
        const existing = docsByLinkId.get(d.link_id) ?? [];
        existing.push(d);
        docsByLinkId.set(d.link_id, existing);
      }
    }
  } catch { /* table not yet migrated — show no documents */ }

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
      lease: leaseByLinkId.get(l.id) ?? null,
      documents: docsByLinkId.get(l.id) ?? [],
    };
  });

  const pendingLinks: TenantLink[] = rawPending.map((l) => ({
    ...l,
    tenant_name: nameByEmail.get(l.tenant_email.toLowerCase()) ?? null,
    phone: null,
    ec_name: null,
    ec_phone: null,
    lease: null,
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
