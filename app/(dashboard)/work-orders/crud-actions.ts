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

export async function updateWorkOrderBudget(id: string, cost: number | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('work_orders')
    .update({ cost })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function updateWorkOrderStatus(id: string, newStatus: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch current for ownership + notify details
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

  // Send notification via Resend (Server Action only, dynamic import for isolation)
  if (user.email) {
    try {
      const { notifyLandlordStatusChange } = await import('@/app/actions/email');
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

export async function updateContractorAssignment(
  id: string,
  data: {
    assigned_contractor: string | null;
    assigned_contractor_email: string | null;
    assigned_contractor_phone: string | null;
    trade: string | null;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch current row for ownership check + fields needed for notification
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('user_id, title, description, priority, due_date, assigned_contractor_email, properties(name)')
    .eq('id', id)
    .single() as {
      data: {
        user_id: string;
        title: string;
        description: string | null;
        priority: string;
        due_date: string | null;
        assigned_contractor_email: string | null;
        properties: { name: string } | null;
      } | null;
      error: any;
    };

  if (fetchErr || !wo || wo.user_id !== user.id) {
    throw new Error('Not authorized to update this work order');
  }

  const previousEmail = wo.assigned_contractor_email;

  const { error } = await supabase
    .from('work_orders')
    .update({
      assigned_contractor: data.assigned_contractor,
      assigned_contractor_email: data.assigned_contractor_email?.trim().toLowerCase() ?? null,
      assigned_contractor_phone: data.assigned_contractor_phone,
      trade: data.trade,
    })
    .eq('id', id);

  if (error) throw error;

  // Notify contractor when email is added for the first time or changed to a new address.
  // Skip when email is unchanged (name/trade-only edit) to avoid duplicate notifications.
  if (data.assigned_contractor_email && data.assigned_contractor_email !== previousEmail) {
    try {
      const { notifyContractorNewWorkOrder } = await import('@/app/actions/email');
      await notifyContractorNewWorkOrder({
        title: wo.title,
        description: wo.description,
        priority: wo.priority,
        due_date: wo.due_date,
        propertyName: wo.properties?.name || null,
        assigned_contractor_email: data.assigned_contractor_email,
      });
    } catch {
      // non-fatal — update already committed
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
  assigned_contractor_phone?: string | null;
  trade?: string | null;
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
      assigned_contractor_email: data.assigned_contractor_email?.trim().toLowerCase() || null,
      assigned_contractor_phone: data.assigned_contractor_phone || null,
      trade: data.trade || null,
      cost: data.cost || 0,
      user_id: user.id,
      status: 'Open',
    })
    .select()
    .single();

  if (error) throw error;

  // Send notification to contractor via Resend if email provided (Server Action only, dynamic import for isolation)
  if (data.assigned_contractor_email) {
    try {
      const { notifyContractorNewWorkOrder } = await import('@/app/actions/email');
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
