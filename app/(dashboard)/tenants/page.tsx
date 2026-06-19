import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
  const [{ data: rawLinks }, { data: properties }, { data: rawRequests }] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select(
        'id, tenant_email, status, unit, initiated_by, created_at, property_id, property:property_id(id, name, address)'
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
        'id, title, description, category, priority, status, tenant_email, created_at, property:property_id(id, name, address)'
      )
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const links = (rawLinks ?? []) as unknown as TenantLink[];
  const pendingLinks = links.filter((l) => l.status === 'pending');
  const approvedLinks = links.filter((l) => l.status === 'approved');
  const maintenanceRequests = (rawRequests ?? []) as unknown as MaintenanceRequest[];

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
