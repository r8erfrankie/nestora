'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { insertNotification } from '@/lib/notifications';

// Contractors may only move status forward along this chain.
// Landlords control Open→Archived and have full edit access via crud-actions.ts.
const VALID_TRANSITIONS: Record<string, string> = {
  Open: 'In Progress',
  'In Progress': 'Completed',
};

export async function acceptOrCompleteWorkOrder(workOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('assigned_contractor_email, status, user_id, title')
    .eq('id', workOrderId)
    .single();

  if (fetchErr || !wo) throw new Error('Work order not found');
  if (wo.assigned_contractor_email?.toLowerCase() !== user.email?.toLowerCase()) throw new Error('Not authorized');

  // Determine the transition from the DB's actual status so optimistic UI
  // state on the client can never cause this check to fire incorrectly.
  const nextStatus = VALID_TRANSITIONS[wo.status];
  if (!nextStatus) throw new Error('No valid transition from current status');

  const { error } = await supabase
    .from('work_orders')
    .update({ status: nextStatus })
    .eq('id', workOrderId); // RLS enforces contractor ownership; no extra filter needed

  if (error) throw error;

  try {
    await supabase.from('work_order_notes').insert({
      work_order_id: workOrderId,
      author_email: user.email.toLowerCase(),
      author_role: 'contractor',
      note_type: 'system',
      content: `Status changed from ${wo.status} to ${nextStatus}`,
    });
  } catch { /* non-fatal */ }

  // Notify the landlord when the contractor accepts (In Progress) or completes the job.
  if (nextStatus === 'In Progress') {
    try {
      if (wo.user_id) {
        await insertNotification({
          userId: wo.user_id as string,
          type: 'work_order_accepted',
          title: 'Work order accepted',
          message: `A contractor has accepted and started work on "${wo.title}".`,
          link: '/work-orders',
        });
      }
    } catch { /* non-fatal */ }
  }

  // When the contractor marks a work order Completed:
  // 1. Resolve the linked maintenance request (contractor RLS can't do this directly).
  // 2. Notify the landlord.
  // 3. Notify the tenant if there was a linked maintenance request.
  if (nextStatus === 'Completed') {
    try {
      const admin = createAdminClient();

      // Resolve the maintenance request and retrieve tenant info for notification.
      const { data: resolved } = await admin
        .from('maintenance_requests')
        .update({ status: 'Resolved' })
        .eq('converted_to_work_order_id', workOrderId)
        .select('id, tenant_id');

      // Notify landlord
      if (wo.user_id) {
        await insertNotification({
          userId: wo.user_id as string,
          type: 'work_order_completed',
          title: 'Work order completed',
          message: `"${wo.title}" has been marked as completed by the contractor.`,
          link: '/work-orders',
        });
      }

      // Notify tenant (only when the work order originated from a maintenance request)
      const linkedRequest = resolved?.[0];
      if (linkedRequest?.tenant_id) {
        await insertNotification({
          userId: linkedRequest.tenant_id as string,
          type: 'work_order_completed',
          title: 'Your maintenance request has been completed',
          message: `"${wo.title}" has been completed.`,
          link: `/tenant/requests/${linkedRequest.id}`,
        });
      }
    } catch { /* non-fatal — work order status is already updated */ }
  }

  return { newStatus: nextStatus };
}

export async function saveContractorQuote(workOrderId: string, quoteRaw: string) {
  const parsed = parseFloat(quoteRaw);
  if (isNaN(parsed) || parsed < 0) throw new Error('Quote must be a positive number');

  const quote = Math.round(parsed * 100) / 100; // round to 2dp

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('assigned_contractor_email, user_id, title')
    .eq('id', workOrderId)
    .single();

  if (fetchErr || !wo) throw new Error('Work order not found');
  if (wo.assigned_contractor_email?.toLowerCase() !== user.email.toLowerCase()) throw new Error('Not authorized');

  const { error } = await supabase
    .from('work_orders')
    .update({ contractor_quote: quote })
    .eq('id', workOrderId); // RLS enforces contractor ownership

  if (error) throw error;

  try {
    await supabase.from('work_order_notes').insert({
      work_order_id: workOrderId,
      author_email: user.email.toLowerCase(),
      author_role: 'contractor',
      note_type: 'system',
      content: `Quote of $${quote.toFixed(2)} submitted`,
    });
  } catch { /* non-fatal */ }

  // Notify the landlord who owns the work order
  if (wo.user_id) {
    await insertNotification({
      userId: wo.user_id as string,
      type: 'quote_submitted',
      title: 'New quote received',
      message: `A quote of $${quote.toFixed(2)} was submitted for "${wo.title}".`,
      link: '/work-orders',
    });
  }

  return { quote };
}
