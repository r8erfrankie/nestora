'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
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
        title: 'New Note',
        message: `"${request.title}"${propName ? ` at ${propName}` : ''} — your landlord left a note`,
        link: `/tenant/requests/${requestId}`,
      });

      // Also email the tenant so they're notified even when not in the app.
      const admin = createAdminClient();
      const { data: tenantAuth } = await admin.auth.admin.getUserById(request.tenant_id as string);
      const tenantEmail = tenantAuth?.user?.email;
      if (tenantEmail) {
        const { notifyTenantNewNote } = await import('@/app/actions/email');
        await notifyTenantNewNote({
          tenantEmail,
          requestTitle: request.title as string,
          propertyName: propName ?? null,
          noteContent: trimmed,
          requestId,
        });
      }
    } catch { /* non-fatal */ }
  }

  return data as MaintenanceNote;
}

export async function addTenantMaintenanceNote(
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

  // RLS "Tenant views own requests" enforces tenant_id = auth.uid() — fetch also
  // gives us the title and property_id to notify the landlord.
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('id, title, property_id')
    .eq('id', requestId)
    .single();

  if (!request) throw new Error('Request not found');

  const { data, error } = await supabase
    .from('maintenance_request_notes')
    .insert({
      request_id: requestId,
      author_email: user.email.toLowerCase(),
      author_role: 'tenant',
      note_type: 'manual',
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Notify the landlord (non-fatal — note is already saved)
  try {
    const admin = createAdminClient();
    const { data: property } = await admin
      .from('properties')
      .select('user_id, name')
      .eq('id', request.property_id)
      .single();
    if (property?.user_id) {
      const propName = property.name as string | null;
      await insertNotification({
        userId: property.user_id as string,
        type: 'request_note',
        title: 'Tenant Reply',
        message: `"${request.title}"${propName ? ` at ${propName}` : ''}`,
        link: '/tenants',
      });
    }
  } catch { /* non-fatal */ }

  return data as MaintenanceNote;
}
