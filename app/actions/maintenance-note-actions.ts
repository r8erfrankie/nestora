'use server';

import { createClient } from '@/lib/supabase/server';
import { insertNotification } from '@/lib/notifications';

export interface MaintenanceNote {
  id: string;
  request_id: string;
  author_email: string;
  author_role: string;
  note_type: string;
  content: string;
  created_at: string;
}

export async function addMaintenanceNote(
  requestId: string,
  content: string
): Promise<MaintenanceNote> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Note cannot be empty');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  // Fetch request to verify landlord ownership and get tenant_id + property name.
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('id, tenant_id, title, property:property_id(user_id, name)')
    .eq('id', requestId)
    .single();

  if (!request) throw new Error('Request not found');

  const property = request.property as unknown as { user_id: string; name: string } | null;
  if (property?.user_id !== user.id) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('maintenance_request_notes')
    .insert({
      request_id: requestId,
      author_email: user.email.toLowerCase(),
      author_role: 'landlord',
      note_type: 'manual',
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Notify the tenant (non-fatal — note is already saved)
  if (request.tenant_id) {
    try {
      const propName = property?.name;
      await insertNotification({
        userId: request.tenant_id as string,
        type: 'request_note',
        title: 'Nestora: Note on your request',
        message: `"${request.title}"${propName ? ` at ${propName}` : ''} — your landlord left a note.`,
        link: `/tenant/requests/${requestId}`,
      });
    } catch { /* non-fatal */ }
  }

  return data as MaintenanceNote;
}
