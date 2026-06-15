'use server';

import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { validateEnv } from '@/lib/env';

// Validate required env vars on server startup (this runs in Node, not the browser)
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

export async function notifyContractorNewWorkOrder(data: {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  propertyName?: string | null;
  assigned_contractor_email: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - skipping email notification');
    return;
  }

  if (!data.assigned_contractor_email) return;

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'Nestora <onboarding@resend.dev>',
      to: data.assigned_contractor_email,
      subject: `New Work Order Assigned: ${data.title}`,
      text: `Hello,

A new work order has been created and assigned to you.

Title: ${data.title}
Property: ${data.propertyName || 'N/A'}
Priority: ${data.priority}
Due Date: ${data.due_date || 'Not specified'}

Description:
${data.description || 'No description provided.'}

Please log in to Nestora to view full details and accept the work order.

Best regards,
Nestora Team`,
    });
  } catch (error) {
    // email send failure is non-fatal for the user flow
  }
}

export async function notifyLandlordStatusChange(data: {
  title: string;
  propertyName?: string | null;
  oldStatus: string;
  newStatus: string;
  landlordEmail: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - skipping email notification');
    return;
  }

  if (!data.landlordEmail) return;

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'Nestora <onboarding@resend.dev>',
      to: data.landlordEmail,
      subject: `Work Order Status Updated: ${data.title}`,
      text: `Hello,

The status of the following work order has been changed:

Title: ${data.title}
Property: ${data.propertyName || 'N/A'}
Previous Status: ${data.oldStatus}
New Status: ${data.newStatus}

Please log in to Nestora to view the details.

Best regards,
Nestora Team`,
    });
  } catch (error) {
    // email send failure is non-fatal for the user flow
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
