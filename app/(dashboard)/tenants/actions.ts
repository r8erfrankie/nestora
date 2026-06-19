'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTenantAccessGrantedEmail } from '@/lib/email';

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
