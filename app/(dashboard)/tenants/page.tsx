import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TenantsClient, type TenantLink } from './tenants-client';

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

  // Parallel fetch — links (with property join) and the landlord's property list.
  const [{ data: rawLinks }, { data: properties }] = await Promise.all([
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
  ]);

  const links = (rawLinks ?? []) as unknown as TenantLink[];
  const pendingLinks = links.filter((l) => l.status === 'pending');
  const approvedLinks = links.filter((l) => l.status === 'approved');

  return (
    <div className="max-w-3xl p-6">
      <TenantsClient
        pendingLinks={pendingLinks}
        approvedLinks={approvedLinks}
        properties={properties ?? []}
      />
    </div>
  );
}
