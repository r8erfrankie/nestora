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

  // Single query — property name/address joined in one round-trip.
  // RLS "Landlord manages own tenant links" filters to landlord_id = auth.uid().
  // Properties are also landlord-readable via normal RLS, so no admin client needed.
  const { data: rawLinks } = await supabase
    .from('tenant_property_links')
    .select(
      'id, tenant_email, status, unit, initiated_by, created_at, property_id, property:property_id(id, name, address)'
    )
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  const links = (rawLinks ?? []) as unknown as TenantLink[];
  const pendingLinks = links.filter((l) => l.status === 'pending');
  const approvedLinks = links.filter((l) => l.status === 'approved');

  return (
    <div className="max-w-3xl p-6">
      <TenantsClient pendingLinks={pendingLinks} approvedLinks={approvedLinks} />
    </div>
  );
}
