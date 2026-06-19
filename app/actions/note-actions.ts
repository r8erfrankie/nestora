'use server';

import { createClient } from '@/lib/supabase/server';

export interface WorkOrderNote {
  id: string;
  work_order_id: string;
  author_email: string;
  author_role: 'landlord' | 'contractor';
  note_type: 'manual' | 'system';
  content: string;
  created_at: string;
  updated_at: string;
}

export async function addManualNote(
  workOrderId: string,
  content: string
): Promise<WorkOrderNote> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Note cannot be empty');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data, error } = await supabase
    .from('work_order_notes')
    .insert({
      work_order_id: workOrderId,
      author_email: user.email.toLowerCase(),
      author_role: profile?.role === 'contractor' ? 'contractor' : 'landlord',
      note_type: 'manual',
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkOrderNote;
}

export async function updateManualNote(noteId: string, content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Note cannot be empty');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('work_order_notes')
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('note_type', 'manual')
    .eq('author_email', user.email.toLowerCase()); // defense-in-depth; RLS is primary

  if (error) throw error;
}
