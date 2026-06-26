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
    const [{ data: property }, { data: tenantProfile }] = await Promise.all([
      admin.from('properties').select('user_id, name').eq('id', propertyId).single(),
      admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ]);
    if (property?.user_id) {
      const propName = property.name as string | null;
      const landlordId = property.user_id as string;

      await insertNotification({
        userId: landlordId,
        type: 'new_request',
        title: 'Nestora: New Request',
        message: `"${title.trim()}" has been submitted`,
        link: '/tenants',
      });

      // Also send an email so the landlord is alerted even when not in the app.
      const { data: landlordAuth } = await admin.auth.admin.getUserById(landlordId);
      const landlordEmail = landlordAuth?.user?.email;
      if (landlordEmail) {
        const { notifyLandlordNewRequest } = await import('@/app/actions/email');
        await notifyLandlordNewRequest({
          landlordEmail,
          tenantEmail: (tenantProfile as any)?.full_name ?? user.email!,
          requestTitle: title.trim(),
          propertyName: propName,
          description: description?.trim() || null,
          priority,
        });
      }
    }
  } catch { /* non-fatal */ }

  return { id: data.id };
}
