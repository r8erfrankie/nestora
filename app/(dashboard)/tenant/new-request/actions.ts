'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { insertNotification } from '@/lib/notifications';

export async function submitMaintenanceRequest({
  propertyId,
  title,
  description,
  category,
  priority,
}: {
  propertyId: string;
  title: string;
  description?: string;
  category?: string;
  priority: string;
}): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');

  // RLS "Approved tenant can submit request" enforces that tenant_email matches
  // auth.jwt() ->> 'email' AND an approved tenant_property_link exists for this property.
  const { data, error } = await supabase
    .from('maintenance_requests')
    .insert({
      tenant_id: user.id,
      property_id: propertyId,
      tenant_email: user.email.toLowerCase(),
      title: title.trim(),
      description: description?.trim() || null,
      category: category || null,
      priority,
      status: 'Submitted',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  // Notify the landlord who owns the property (non-fatal)
  try {
    const admin = createAdminClient();
    const { data: property } = await admin
      .from('properties')
      .select('user_id')
      .eq('id', propertyId)
      .single();
    if (property?.user_id) {
      await insertNotification({
        userId: property.user_id as string,
        type: 'new_request',
        title: 'New maintenance request',
        message: `"${title.trim()}" was submitted for your property.`,
        link: '/tenants',
      });
    }
  } catch { /* non-fatal */ }

  return { id: data.id };
}
