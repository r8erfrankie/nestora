'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type PropertyDeleteImpact = {
  tenants: number;
  maintenanceRequests: number;
  workOrders: number;
};

export async function getPropertyDeleteImpact(
  propertyId: string
): Promise<PropertyDeleteImpact> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Ownership check — also ensures RLS allows the sub-queries below
  const { data: prop } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single();
  if (!prop) throw new Error('Property not found');

  const [
    { count: tenants },
    { count: maintenanceRequests },
    { count: workOrders },
  ] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .neq('status', 'removed'),
    supabase
      .from('maintenance_requests')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId),
    supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId),
  ]);

  return {
    tenants: tenants ?? 0,
    maintenanceRequests: maintenanceRequests ?? 0,
    workOrders: workOrders ?? 0,
  };
}

export async function createProperty(data: {
  name: string;
  address?: string | null;
  type?: string | null;
  unit_label_type?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: inserted, error } = await supabase
    .from('properties')
    .insert({
      name: data.name.trim(),
      address: data.address?.trim() || null,
      type: data.type || null,
      unit_label_type: data.unit_label_type || 'unit',
      notes: data.notes?.trim() || null,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/properties');
  revalidatePath('/');
  return inserted;
}

export async function updateProperty(
  id: string,
  data: { name: string; address?: string | null; type?: string | null; unit_label_type?: string | null; notes?: string | null }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: updated, error } = await supabase
    .from('properties')
    .update({
      name: data.name.trim(),
      address: data.address?.trim() || null,
      type: data.type || null,
      unit_label_type: data.unit_label_type || 'unit',
      notes: data.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/properties');
  return updated;
}
