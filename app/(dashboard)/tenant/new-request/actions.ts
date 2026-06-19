'use server';

import { createClient } from '@/lib/supabase/server';

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
  return { id: data.id };
}
