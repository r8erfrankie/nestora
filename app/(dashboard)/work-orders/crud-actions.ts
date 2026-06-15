'use server';

import { createClient } from '@/lib/supabase/server';
import { validateEnv } from '@/lib/env';

validateEnv();

export async function deleteWorkOrder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Explicit ownership check (defense in depth, RLS is primary)
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchErr || !wo || wo.user_id !== user.id) {
    throw new Error('Not authorized to delete this work order');
  }

  const { error } = await supabase.from('work_orders').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: prop, error: fetchErr } = await supabase
    .from('properties')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchErr || !prop || prop.user_id !== user.id) {
    throw new Error('Not authorized to delete this property');
  }

  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw error;
}

export async function updateWorkOrderStatus(id: string, newStatus: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check ownership and current status (defense in depth, RLS is primary)
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id, status')
    .eq('id', id)
    .single();

  if (fetchErr || !wo || wo.user_id !== user.id) {
    throw new Error('Not authorized to update this work order');
  }

  if (newStatus === wo.status) {
    return; // no change
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: newStatus })
    .eq('id', id);

  if (updateErr) throw updateErr;
}

export async function createWorkOrder(data: {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  property_id: string;
  assigned_contractor?: string | null;
  assigned_contractor_email?: string | null;
  cost?: number | null;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: inserted, error } = await supabase
    .from('work_orders')
    .insert({
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      due_date: data.due_date || null,
      property_id: data.property_id,
      assigned_contractor: data.assigned_contractor || null,
      assigned_contractor_email: data.assigned_contractor_email || null,
      cost: data.cost || 0,
      user_id: user.id,
      status: 'Open',
    })
    .select()
    .single();

  if (error) throw error;

  return inserted;
}
