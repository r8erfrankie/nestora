'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { insertNotification } from '@/lib/notifications';

// Contractors may only move status forward along this chain (used by the list quick-action).
// Landlords control Open→Archived and have full edit access via crud-actions.ts.
const VALID_TRANSITIONS: Record<string, string> = {
  Open: 'Accepted',
  Accepted: 'In Progress',
  'In Progress': 'Completed',
};

// All valid targets a contractor can reach from each status (used by the detail view).
const CONTRACTOR_ALLOWED_TARGETS: Record<string, string[]> = {
  Open: ['Accepted'],
  Accepted: ['In Progress', 'On Hold', 'Needs Materials', 'Completed'],
  'In Progress': ['On Hold', 'Needs Materials', 'Completed'],
  'On Hold': ['In Progress', 'Needs Materials', 'Completed'],
  'Needs Materials': ['In Progress', 'On Hold', 'Completed'],
};

export async function acceptOrCompleteWorkOrder(workOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('assigned_contractor_email, status, user_id, title, properties(name)')
    .eq('id', workOrderId)
    .single() as {
      data: {
        assigned_contractor_email: string | null;
        status: string;
        user_id: string;
        title: string;
        properties: { name: string } | null;
      } | null;
      error: unknown;
    };

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

  // Notify the landlord when the contractor accepts the job.
  if (nextStatus === 'Accepted') {
    try {
      if (wo.user_id) {
        await insertNotification({
          userId: wo.user_id as string,
          type: 'work_order_accepted',
          title: 'Work Order Accepted',
          message: `"${wo.title}" has been accepted by contractor${wo.properties?.name ? ` at ${wo.properties.name}` : ''}`,
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
      const prop = wo.properties?.name;
      if (wo.user_id) {
        await insertNotification({
          userId: wo.user_id as string,
          type: 'work_order_completed',
          title: 'Work Order Completed',
          message: `"${wo.title}" has been completed by contractor${prop ? ` at ${prop}` : ''}`,
          link: '/work-orders',
        });
      }

      // Notify tenant (only when the work order originated from a maintenance request)
      const linkedRequest = resolved?.[0];
      if (linkedRequest?.tenant_id) {
        await insertNotification({
          userId: linkedRequest.tenant_id as string,
          type: 'work_order_completed',
          title: 'Request Completed',
          message: `"${wo.title}" has been completed${prop ? ` at ${prop}` : ''}`,
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
    .select('assigned_contractor_email, user_id, title, properties(name)')
    .eq('id', workOrderId)
    .single() as {
      data: {
        assigned_contractor_email: string | null;
        user_id: string;
        title: string;
        properties: { name: string } | null;
      } | null;
      error: unknown;
    };

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
    const prop = wo.properties?.name;
    await insertNotification({
      userId: wo.user_id as string,
      type: 'quote_submitted',
      title: 'New Quote',
      message: `"${wo.title}"${prop ? ` at ${prop}` : ''} — $${quote.toFixed(2)}`,
      link: '/work-orders',
    });
  }

  return { quote };
}

// Flexible status update used by the detail view. Supports On Hold and Needs Materials
// in addition to the linear chain. completionNote is logged as a manual note when the
// contractor marks as Completed.
export async function updateWorkOrderStatus(
  workOrderId: string,
  newStatus: string,
  completionNote?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('assigned_contractor_email, status, user_id, title, properties(name)')
    .eq('id', workOrderId)
    .single() as {
      data: {
        assigned_contractor_email: string | null;
        status: string;
        user_id: string;
        title: string;
        properties: { name: string } | null;
      } | null;
      error: unknown;
    };

  if (fetchErr || !wo) throw new Error('Work order not found');
  if (wo.assigned_contractor_email?.toLowerCase() !== user.email.toLowerCase()) throw new Error('Not authorized');

  const allowed = CONTRACTOR_ALLOWED_TARGETS[wo.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from "${wo.status}" to "${newStatus}"`);
  }

  const { error } = await supabase
    .from('work_orders')
    .update({ status: newStatus })
    .eq('id', workOrderId);
  if (error) throw error;

  const prop = wo.properties?.name;

  // Always log a system note for the status change.
  try {
    await supabase.from('work_order_notes').insert({
      work_order_id: workOrderId,
      author_email: user.email.toLowerCase(),
      author_role: 'contractor',
      note_type: 'system',
      content: `Status changed from ${wo.status} to ${newStatus}`,
    });
  } catch { /* non-fatal */ }

  // If the contractor added a completion note, log it as a manual note.
  if (newStatus === 'Completed' && completionNote?.trim()) {
    try {
      await supabase.from('work_order_notes').insert({
        work_order_id: workOrderId,
        author_email: user.email.toLowerCase(),
        author_role: 'contractor',
        note_type: 'manual',
        content: completionNote.trim(),
      });
    } catch { /* non-fatal */ }
  }

  // Notify landlord of relevant status changes.
  if (wo.user_id) {
    try {
      const admin = createAdminClient();

      if (newStatus === 'Completed') {
        // Resolve any linked maintenance request.
        const { data: resolved } = await admin
          .from('maintenance_requests')
          .update({ status: 'Resolved' })
          .eq('converted_to_work_order_id', workOrderId)
          .select('id, tenant_id');

        await insertNotification({
          userId: wo.user_id,
          type: 'work_order_completed',
          title: 'Work Order Completed',
          message: `"${wo.title}" has been completed by contractor${prop ? ` at ${prop}` : ''}`,
          link: '/work-orders',
        });

        const linked = resolved?.[0];
        if (linked?.tenant_id) {
          await insertNotification({
            userId: linked.tenant_id as string,
            type: 'work_order_completed',
            title: 'Request Completed',
            message: `"${wo.title}" has been completed${prop ? ` at ${prop}` : ''}`,
            link: `/tenant/requests/${linked.id}`,
          });
        }
      } else if (newStatus === 'Accepted') {
        await insertNotification({
          userId: wo.user_id,
          type: 'work_order_accepted',
          title: 'Work Order Accepted',
          message: `"${wo.title}" has been accepted by contractor${prop ? ` at ${prop}` : ''}`,
          link: '/work-orders',
        });
      } else if (newStatus === 'In Progress') {
        await insertNotification({
          userId: wo.user_id,
          type: 'work_order_status',
          title: 'Work Order In Progress',
          message: `"${wo.title}" is now in progress${prop ? ` at ${prop}` : ''}`,
          link: '/work-orders',
        });
      } else if (newStatus === 'On Hold') {
        await insertNotification({
          userId: wo.user_id,
          type: 'work_order_status',
          title: 'Work Order On Hold',
          message: `"${wo.title}" is on hold${prop ? ` at ${prop}` : ''}`,
          link: '/work-orders',
        });
      } else if (newStatus === 'Needs Materials') {
        await insertNotification({
          userId: wo.user_id,
          type: 'work_order_status',
          title: 'Needs Materials',
          message: `"${wo.title}" needs materials${prop ? ` at ${prop}` : ''}`,
          link: '/work-orders',
        });
      }

      // Email the landlord for the two most actionable transitions.
      if (newStatus === 'Accepted' || newStatus === 'Completed') {
        const [{ data: landlordAuth }, { data: contractorProfile }] = await Promise.all([
          admin.auth.admin.getUserById(wo.user_id),
          admin.from('profiles').select('full_name').eq('email', user.email.toLowerCase()).maybeSingle(),
        ]);
        const landlordEmail = landlordAuth?.user?.email;
        if (landlordEmail) {
          const { notifyLandlordWorkOrderUpdate } = await import('@/app/actions/email');
          await notifyLandlordWorkOrderUpdate({
            landlordEmail,
            workOrderTitle: wo.title,
            propertyName: prop ?? null,
            newStatus,
            contractorName: (contractorProfile as any)?.full_name ?? null,
          });
        }
      }
    } catch { /* non-fatal */ }
  }

  return { newStatus };
}
