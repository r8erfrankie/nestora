'use server';

import { createClient } from '@/lib/supabase/server';

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
    .select('assigned_contractor_email, status')
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
    .select('assigned_contractor_email')
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

  return { quote };
}
