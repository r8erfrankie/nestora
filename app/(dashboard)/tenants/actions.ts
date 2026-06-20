'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTenantAccessGrantedEmail } from '@/lib/email';

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
      maintenance_request_id: requestId,
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

export async function rejectTenantRequest(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Delete the row so the tenant can re-request if needed.
  // 'rejected' is not in the status CHECK constraint, so we don't set it.
  const { error } = await supabase
    .from('tenant_property_links')
    .delete()
    .eq('id', linkId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}

export async function inviteTenantByEmail(email: string, propertyId: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !propertyId) throw new Error('Email and property are required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Confirm the landlord owns this property (RLS enforces it, but we need the name).
  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single();

  if (!property) throw new Error('Property not found');

  // Check for an existing non-removed link for this (property, email) pair.
  const { data: existing } = await supabase
    .from('tenant_property_links')
    .select('id, status')
    .eq('property_id', propertyId)
    .eq('tenant_email', normalizedEmail)
    .neq('status', 'removed')
    .maybeSingle();

  if (existing?.status === 'approved') {
    throw new Error('This tenant already has access to this property.');
  }

  if (existing?.status === 'pending') {
    // Promote the pending request to approved instead of creating a duplicate.
    const { error } = await supabase
      .from('tenant_property_links')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    // No existing link — create a new approved one.
    // tenant_id is null because the tenant may not have a Nestora account yet;
    // the email-based RLS policy handles their read access once they sign up.
    const { error } = await supabase.from('tenant_property_links').insert({
      landlord_id: user.id,
      property_id: propertyId,
      tenant_email: normalizedEmail,
      status: 'approved',
      initiated_by: 'landlord',
      approved_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  // Non-blocking email.
  sendTenantAccessGrantedEmail({ to: normalizedEmail, propertyName: property.name }).catch(
    (err) => {
      console.error('Invite email failed:', err);
    }
  );

  revalidatePath('/tenants');
}
