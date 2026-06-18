'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Contractors may only move status forward along this chain.
// Landlords control Open→Archived and have full edit access via crud-actions.ts.
const VALID_TRANSITIONS: Record<string, string> = {
  Open: 'In Progress',
  'In Progress': 'Completed',
};

export async function acceptOrCompleteWorkOrder(workOrderId: string, currentStatus: string) {
  const nextStatus = VALID_TRANSITIONS[currentStatus];
  if (!nextStatus) throw new Error('No valid transition from current status');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  // Verify the caller is the assigned contractor for this work order.
  // RLS enforces this at the DB level too; this check gives a clear error message.
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('assigned_contractor_email, status')
    .eq('id', workOrderId)
    .single();

  if (fetchErr || !wo) throw new Error('Work order not found');
  if (wo.assigned_contractor_email !== user.email) throw new Error('Not authorized');
  if (wo.status !== currentStatus) throw new Error('Status has changed — please refresh');

  const { error } = await supabase
    .from('work_orders')
    .update({ status: nextStatus })
    .eq('id', workOrderId)
    .eq('assigned_contractor_email', user.email);

  if (error) throw error;

  revalidatePath('/contractor');
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
  if (wo.assigned_contractor_email !== user.email) throw new Error('Not authorized');

  const { error } = await supabase
    .from('work_orders')
    .update({ contractor_quote: quote })
    .eq('id', workOrderId)
    .eq('assigned_contractor_email', user.email);

  if (error) throw error;

  revalidatePath('/contractor');
  return { quote };
}
