'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendTenantAccessGrantedEmail, sendTenantInviteEmail } from '@/lib/email';
import { insertNotification } from '@/lib/notifications';

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
    .select('id, property_id, title, description, category, priority, converted_to_work_order_id, tenant_id, property:property_id(name)')
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
          // The landlord is performing the conversion, so attribute these photos to them.
          // They already have full delete rights as the work order owner, but setting
          // uploaded_by keeps the data clean and consistent with new uploads.
          uploaded_by: user.id,
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

  // Non-fatal: let the tenant know their request is being actioned.
  if (request.tenant_id) {
    const propName = (request.property as unknown as { name: string } | null)?.name;
    try {
      await insertNotification({
        userId: request.tenant_id as string,
        type: 'request_in_progress',
        title: 'Request in progress',
        message: `"${request.title}"${propName ? ` at ${propName}` : ''} is now being handled as a work order.`,
        link: `/tenant/requests/${requestId}`,
      });
    } catch (err) {
      console.error('[convertToWorkOrder] tenant notification failed:', err);
    }
  }

  return { workOrderId: workOrder.id as string, photoWarning };
}

export async function approveTenantRequest(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch the link + landlord profile in parallel.
  const [{ data: link }, { data: profile }] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select('tenant_email, property_id, property:property_id(name)')
      .eq('id', linkId)
      .eq('landlord_id', user.id)
      .single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);

  if (!link) throw new Error('Request not found');

  const { error } = await supabase
    .from('tenant_property_links')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message);

  // Non-blocking: generate a magic link then send the approval email.
  // If either step fails, the approval itself is unaffected.
  const propertyName = (link.property as unknown as { name: string } | null)?.name ?? 'your property';
  const landlordName = (profile?.full_name as string | null) ?? null;
  const tenantEmail = link.tenant_email as string;

  ;(async () => {
    let magicLink: string | null = null;
    let otpCode: string | null = null;

    try {
      const adminClient = createAdminClient();
      const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/tenant`;
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: tenantEmail,
        options: { redirectTo: callbackUrl },
      });
      if (linkError) {
        console.error('generateLink error:', linkError);
      } else {
        magicLink = linkData?.properties?.action_link ?? null;
        otpCode = linkData?.properties?.email_otp ?? null;
      }
    } catch (err) {
      console.error('Failed to generate magic link for approval email:', err);
    }

    try {
      await sendTenantAccessGrantedEmail({ to: tenantEmail, propertyName, landlordName, otpCode });
    } catch (err) {
      console.error('Approval email failed:', err);
    }

    // In-app + push notification to the tenant (requires their user_id from profiles).
    try {
      const adminClient = createAdminClient();
      const { data: tenantProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', tenantEmail.toLowerCase())
        .maybeSingle();
      if (tenantProfile?.id) {
        await insertNotification({
          userId: tenantProfile.id as string,
          type: 'access_granted',
          title: 'Access approved',
          message: `${propertyName} — your access request has been approved.`,
          link: '/tenant',
        });
      }
    } catch (err) {
      console.error('Tenant approval notification failed:', err);
    }
  })();

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

  // Fetch before declining so we have tenant_email + property name for the notification.
  const { data: link } = await supabase
    .from('tenant_property_links')
    .select('tenant_email, property:property_id(name)')
    .eq('id', linkId)
    .eq('landlord_id', user.id)
    .single();

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

  // Non-fatal: notify the tenant if they have an account.
  if (link?.tenant_email) {
    const propertyName = (link.property as unknown as { name: string } | null)?.name ?? 'the property';
    try {
      const admin = createAdminClient();
      const { data: tenantProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', (link.tenant_email as string).toLowerCase())
        .maybeSingle();
      if (tenantProfile?.id) {
        await insertNotification({
          userId: tenantProfile.id as string,
          type: 'access_declined',
          title: 'Access request declined',
          message: `${propertyName} — your access request was not approved.`,
          link: '/tenant-onboarding',
        });
      }
    } catch (err) {
      console.error('Tenant decline notification failed:', err);
    }
  }
}

export async function updateTenantNotes(linkId: string, notes: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tenant_property_links')
    .update({ notes: notes.trim() || null })
    .eq('id', linkId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/tenants');
}

export async function inviteTenantByEmail(email: string, propertyId: string, unit?: string, unitLabelType?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !propertyId) throw new Error('Email and property are required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [{ data: property }, { data: landlordProfile }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);

  if (!property) throw new Error('Property not found');

  const unitValue = unit?.trim() || null;
  const unitLabelValue = unitLabelType?.trim() || null;

  const { data: existing } = await supabase
    .from('tenant_property_links')
    .select('id, status, unit, unit_label_type')
    .eq('property_id', propertyId)
    .eq('tenant_email', normalizedEmail)
    .maybeSingle();

  if (existing?.status === 'approved') {
    throw new Error('This tenant already has access to this property.');
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (existing) {
    // Re-invite: reset the link to approved so the tenant can sign in immediately.
    // tenant_id is cleared so the profile-completion gate fires when they sign in.
    const { error } = await admin
      .from('tenant_property_links')
      .update({
        status: 'approved',
        approved_at: now,
        initiated_by: 'landlord',
        unit: unitValue ?? (existing.unit as string | null),
        unit_label_type: unitLabelValue ?? ((existing as any).unit_label_type as string | null),
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
        status: 'approved',
        approved_at: now,
        initiated_by: 'landlord',
        unit: unitValue,
        unit_label_type: unitLabelValue,
      });
    if (error) throw new Error(error.message);
  }

  const landlordName = (landlordProfile?.full_name as string | null) ?? null;

  // Generate a magic link so the invite email contains both a one-click button
  // and a 6-digit code — no second Supabase email needed.
  ;(async () => {
    let magicLink: string | null = null;
    let otpCode: string | null = null;
    try {
      const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/tenant-onboarding`;
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: { redirectTo: callbackUrl },
      });
      magicLink = linkData?.properties?.action_link ?? null;
      otpCode = linkData?.properties?.email_otp ?? null;
    } catch (err) {
      console.error('generateLink failed for invite:', err);
    }
    try {
      await sendTenantInviteEmail({
        to: normalizedEmail,
        propertyName: property.name as string,
        landlordName,
        otpCode,
      });
    } catch (err) {
      console.error('Invite email failed:', err);
    }
  })();

  revalidatePath('/tenants');
}

export async function deleteMaintenanceRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify the request belongs to a property the current landlord owns.
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('id, property_id')
    .eq('id', requestId)
    .single();

  if (!request) throw new Error('Request not found');

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', request.property_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!property) throw new Error('Not authorized to delete this request');

  // Fetch photos for storage cleanup before deleting rows.
  const { data: photos } = await supabase
    .from('maintenance_request_photos')
    .select('url')
    .eq('request_id', requestId);

  if (photos && photos.length > 0) {
    const paths = photos
      .map((p) => {
        try {
          const url = new URL(p.url as string);
          const marker = '/object/public/maintenance-request-photos/';
          const idx = url.pathname.indexOf(marker);
          return idx !== -1 ? decodeURIComponent(url.pathname.slice(idx + marker.length)) : null;
        } catch { return null; }
      })
      .filter(Boolean) as string[];

    if (paths.length > 0) {
      await supabase.storage.from('maintenance-request-photos').remove(paths).catch(() => null);
    }

    await supabase.from('maintenance_request_photos').delete().eq('request_id', requestId);
  }

  // Delete notes (no ON DELETE CASCADE assumed).
  await supabase.from('maintenance_request_notes').delete().eq('request_id', requestId);

  const { error } = await supabase.from('maintenance_requests').delete().eq('id', requestId);

  if (error) throw new Error(error.message);

  revalidatePath('/tenants');
}

export async function resendTenantInvite(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [{ data: link }, { data: profile }] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select('tenant_email, property_id, property:property_id(name)')
      .eq('id', linkId)
      .eq('landlord_id', user.id)
      .eq('status', 'approved')
      .is('tenant_id', null)
      .single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);

  if (!link) throw new Error('Invite not found or tenant has already signed in.');

  const tenantEmail = link.tenant_email as string;
  const propertyName = (link.property as unknown as { name: string } | null)?.name ?? 'your property';
  const landlordName = (profile?.full_name as string | null) ?? null;

  let magicLink: string | null = null;
  let otpCode: string | null = null;
  try {
    const admin = createAdminClient();
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/tenant-onboarding`;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: tenantEmail,
      options: { redirectTo: callbackUrl },
    });
    magicLink = linkData?.properties?.action_link ?? null;
    otpCode = linkData?.properties?.email_otp ?? null;
  } catch (err) {
    console.error('generateLink failed for resend:', err);
  }

  await sendTenantInviteEmail({ to: tenantEmail, propertyName, landlordName, otpCode });
}
