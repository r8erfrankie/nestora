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

  // Fetch current to get old status and details for notify, and check ownership
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id, title, status, properties(name)')
    .eq('id', id)
    .single() as {
      data: {
        user_id: string;
        title: string;
        status: string;
        properties: { name: string } | null;
      } | null;
      error: any;
    };

  if (fetchErr || !wo || wo.user_id !== user.id) {
    throw new Error('Not authorized to update this work order');
  }

  const previousStatus = wo.status;

  if (newStatus === previousStatus) {
    return; // no change
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: newStatus })
    .eq('id', id);

  if (updateErr) throw updateErr;

  // Send notification to landlord (the owner) -- server only
  if (user.email) {
    try {
      // Dynamic import to ensure email logic (which uses RESEND secret) is never part of client bundles
      const { notifyLandlordStatusChange } = await import('./email-actions');
      await notifyLandlordStatusChange({
        title: wo.title,
        propertyName: wo.properties?.name || null,
        oldStatus: previousStatus,
        newStatus,
        landlordEmail: user.email,
      });
    } catch (emailErr) {
      // non-fatal
    }
  }
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
  propertyName?: string | null;
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

  // Send notification to contractor if email provided -- this is server only
  if (data.assigned_contractor_email) {
    try {
      // Dynamic import to ensure email logic (which uses RESEND secret) is never part of client bundles
      const { notifyContractorNewWorkOrder } = await import('./email-actions');
      await notifyContractorNewWorkOrder({
        title: inserted.title,
        description: inserted.description,
        priority: inserted.priority,
        due_date: inserted.due_date,
        propertyName: data.propertyName,
        assigned_contractor_email: data.assigned_contractor_email,
      });
    } catch (emailErr) {
      // non-fatal
    }
  }

  return inserted;
}
