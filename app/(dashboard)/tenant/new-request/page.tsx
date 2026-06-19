import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NewRequestClient } from './new-request-client';

export const metadata = { title: 'Submit Maintenance Request' };

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { property: defaultPropertyId } = await searchParams;

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

  if (profile?.role !== 'tenant') redirect('/');

  // Fetch approved links (RLS filters to this tenant's email).
  const { data: links } = await supabase
    .from('tenant_property_links')
    .select('property_id, unit')
    .eq('status', 'approved');

  const propertyIds = (links ?? []).map((l) => l.property_id);

  // No approved properties — nothing to submit a request for.
  if (propertyIds.length === 0) redirect('/tenant');

  // Tenant RLS blocks reading other users' properties — use admin client.
  const admin = createAdminClient();
  const { data: props } = await admin
    .from('properties')
    .select('id, name, address')
    .in('id', propertyIds);

  const unitMap: Record<string, string | null> = {};
  (links ?? []).forEach((l) => {
    unitMap[l.property_id] = l.unit;
  });

  const properties = (props ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    address: (p.address ?? null) as string | null,
    unit: unitMap[p.id] ?? null,
  }));

  // Validate the ?property= param — ignore IDs the tenant doesn't have access to.
  const validDefaultId =
    defaultPropertyId && propertyIds.includes(defaultPropertyId) ? defaultPropertyId : null;

  return (
    <div className="max-w-2xl p-6">
      <NewRequestClient properties={properties} defaultPropertyId={validDefaultId} />
    </div>
  );
}
