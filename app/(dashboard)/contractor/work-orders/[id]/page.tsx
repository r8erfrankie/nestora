import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkOrderDetailClient } from './work-order-detail-client';

export default async function ContractorWorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const userEmail = (user.email ?? '').toLowerCase();

  const [{ data: wo }, { data: photos }, { data: archived }] = await Promise.all([
    supabase
      .from('work_orders')
      .select(`
        id, title, description, status, priority, due_date,
        unit, trade, notes, contractor_quote, created_at, updated_at,
        properties (id, name, address, unit_label_type)
      `)
      .eq('id', id)
      .eq('assigned_contractor_email', userEmail)
      .single(),

    supabase
      .from('work_order_photos')
      .select('id, url, name, created_at, uploaded_by_role, uploaded_by')
      .eq('work_order_id', id)
      .order('created_at', { ascending: true }),

    supabase
      .from('work_order_user_archives')
      .select('work_order_id')
      .eq('work_order_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  // If the contractor is not assigned to this work order, send them back.
  if (!wo) redirect('/contractor');

  return (
    <WorkOrderDetailClient
      workOrder={wo as any}
      initialPhotos={(photos ?? []) as any[]}
      isArchived={!!archived}
      currentUserId={user.id}
    />
  );
}
