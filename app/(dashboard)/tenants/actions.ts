'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendTenantAccessGrantedEmail, sendTenantInviteEmail } from '@/lib/email';

export async function convertToWorkOrder(
  requestId: string
): Promise<{ workOrderId: string; photoWarning?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // RLS: "Landlord views requests on own properties" limits this to the landlord's own data.
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('id, property_id, title, description, category, priority, converted_to_work_order_id')
    .eq('id', requestId)
    .single();

  if (!request) throw new Error('Maintenance request not found');
  if (request.converted_to_work_order_id) throw new Error('Already converted to a work order');

  // Build description: prepend category when present so it's visible in the work order.
  const workOrderDescription =
    [request.category ? `Category: ${request.category}` : null, request.description]
      .filter(Boolean)
      .join('\n\n') || null;

  // ── Critical path: work order creation ───────────────────────────────────
  // RLS: "Users can insert their own work orders" (user_id = auth.uid()) handles auth.
  const { data: workOrder, error: insertError } = await supabase
    .from('work_orders')
    .insert({
      user_id: user.id,
      property_id: request.property_id,
      title: request.title,
      description: workOrderDescription,
      priority: request.priority,
      status: 'Open',
    })
    .select('id')
    .single();

  if (insertError || !workOrder) {
    throw new Error(insertError?.message ?? 'Failed to create work order');
  }

  // ── Critical path: link + status update on the maintenance request ────────
  // RLS: "Landlord updates requests on own properties" covers this UPDATE.
  const { error: updateError } = await supabase
    .from('maintenance_requests')
    .update({
      converted_to_work_order_id: workOrder.id,
      status: 'In Progress',
    })
    .eq('id', requestId);

  if (updateError) throw new Error(updateError.message);

  // ── Non-fatal path: carry photos over by copying DB rows, not files ───────
  // We reuse the same storage URLs — no re-upload, no storage duplication.
  // RLS: "Request participants view photos" (landlord owns the property) covers the SELECT.
  // RLS: "Users can insert photos for their work orders" (landlord just created it) covers INSERT.
  let photoWarning: string | undefined;
  try {
    const { data: requestPhotos, error: photoFetchError } = await supabase
      .from('maintenance_request_photos')
      .select('url, name')
      .eq('request_id', requestId);

    if (photoFetchError) throw photoFetchError;

    if (requestPhotos && requestPhotos.length > 0) {
      const { error: photoInsertError } = await supabase.from('work_order_photos').insert(
        requestPhotos.map((p) => ({
          work_order_id: workOrder.id,
          url: p.url as string,
          name: p.name as string | null,
        }))
      );
      if (photoInsertError) throw photoInsertError;
    }
  } catch (err) {
    console.error('[convertToWorkOrder] photo carry-over failed:', err);
    photoWarning = 'Photos could not be carried over automatically.';
  }

  revalidatePath('/tenants');
  revalidatePath('/work-orders');

  return { workOrderId: workOrder.id as string, photoWarning };
}

export async function approveTenantRequest(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch the link first so we have the email + property name for the notification.
  const { data: link } = await supabase
    .from('tenant_property_links')
    .select('tenant_email, property_id, property:property_id(name)')
    .eq('id', linkId)
    .eq('landlord_id', user.id)
    .single();

  if (!link) throw new Error('Request not found');

  const { error } = await supabase
    .from('tenant_property_links')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message);

  // Non-blocking email — approval succeeds even if Resend is down.
  const propertyName = (link.property as unknown as { name: string } | null)?.name ?? 'your property';
  sendTenantAccessGrantedEmail({ to: link.tenant_email, propertyName }).catch((err) => {
    console.error('Approval email failed:', err);
  });

  revalidatePath('/tenants');
}

export async function removeTenant(linkId: string, closeRequests: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch the link to get property_id + tenant_email for the optional request update.
  // .eq('landlord_id', user.id) is an explicit ownership guard on top of RLS.
  const { data: link } = await supabase
    .from('tenant_property_links')
    .select('id, property_id, tenant_email')
    .eq('id', linkId)
    .eq('landlord_id', user.id)
    .single();

  if (!link) throw new Error('Tenant link not found');

  const { error } = await supabase
    .from('tenant_property_links')
    .update({ status: 'removed' })
    .eq('id', linkId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message);

  if (closeRequests) {
    // updated_at is bumped automatically by the set_maintenance_requests_updated_at trigger.
    // .select('id') returns the IDs so we can attach a system note to each closed request.
    const { data: resolved } = await supabase
      .from('maintenance_requests')
      .update({ status: 'Resolved' })
      .eq('property_id', link.property_id)
      .eq('tenant_email', link.tenant_email)
      .in('status', ['Submitted', 'In Progress'])
      .select('id');

    if (resolved && resolved.length > 0 && user.email) {
      // Non-fatal: system note write failure should not roll back the removal.
      await supabase
        .from('maintenance_request_notes')
        .insert(
          resolved.map((r) => ({
            request_id: r.id,
            author_email: user.email!,
            author_role: 'landlord',
            note_type: 'system',
            content: 'Request closed — tenant removed from property.',
          }))
        )
        .then(() => null);
    }
  }

  revalidatePath('/tenants');
}

export async function rejectTenantRequest(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Set status to 'declined' rather than deleting the row. This preserves
  // history and lets the tenant see a clear "declined" state on their side,
  // with the option to re-request. The (property_id, tenant_email) UNIQUE
  // constraint means we can't INSERT a new row anyway — an UPDATE is correct.
  const { error } = await supabase
    .from('tenant_property_links')
    .update({ status: 'declined' })
    .eq('id', linkId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}

export async function inviteTenantByEmail(email: string, propertyId: string, unit?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !propertyId) throw new Error('Email and property are required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: property } = await supabase
    .from('properties')
    .select('id, name, join_code')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single();

  if (!property) throw new Error('Property not found');

  const joinCode = property.join_code as string | null;
  if (!joinCode) throw new Error('This property has no join code yet. Please try again.');

  const unitValue = unit?.trim() || null;

  const { data: existing } = await supabase
    .from('tenant_property_links')
    .select('id, status, unit')
    .eq('property_id', propertyId)
    .eq('tenant_email', normalizedEmail)
    .maybeSingle();

  if (existing?.status === 'approved') {
    throw new Error('This tenant already has access to this property.');
  }

  const admin = createAdminClient();

  if (existing) {
    // Update existing link (pending, removed, or declined) back to a pending landlord invite.
    // tenant_id is cleared so the tenant re-links their account when they accept.
    const { error } = await admin
      .from('tenant_property_links')
      .update({
        status: 'pending',
        initiated_by: 'landlord',
        unit: unitValue ?? (existing.unit as string | null),
        tenant_id: null,
      })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('tenant_property_links')
      .insert({
        landlord_id: user.id,
        property_id: propertyId,
        tenant_email: normalizedEmail,
        status: 'pending',
        initiated_by: 'landlord',
        unit: unitValue,
      });
    if (error) throw new Error(error.message);
  }

  sendTenantInviteEmail({
    to: normalizedEmail,
    propertyName: property.name as string,
    joinCode,
  }).catch((err) => { console.error('Invite email failed:', err); });

  revalidatePath('/tenants');
}
