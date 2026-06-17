import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/supabase/server';
import { TeamsClient, type ContractorStat } from './teams-client';
import { Users } from 'lucide-react';

export default async function TeamsPage() {
  const supabase = await createClient();
  const role = await getCurrentUserRole();

  if (role === 'contractor') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.02em]">
            <Users className="h-6 w-6" /> Teams
          </h1>
          <p className="text-muted-foreground mt-1">Contractor team management is for landlords.</p>
        </div>
      </div>
    );
  }

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('id, title, status, priority, due_date, updated_at, assigned_contractor_email, properties(name)')
    .not('assigned_contractor_email', 'is', null)
    .order('updated_at', { ascending: false });

  // Group by contractor email
  const contractorMap: Record<string, ContractorStat> = {};

  for (const wo of workOrders ?? []) {
    const email = wo.assigned_contractor_email as string;
    if (!contractorMap[email]) {
      contractorMap[email] = { email, total: 0, open: 0, completed: 0, lastActivity: null, workOrders: [] };
    }
    const c = contractorMap[email];
    c.total += 1;
    if (wo.status === 'Open' || wo.status === 'In Progress') c.open += 1;
    if (wo.status === 'Completed') c.completed += 1;
    if (!c.lastActivity || wo.updated_at > c.lastActivity) c.lastActivity = wo.updated_at;
    c.workOrders.push({
      id: wo.id,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      due_date: wo.due_date ?? null,
      propertyName: (wo.properties as any)?.name ?? null,
    });
  }

  const contractors = Object.values(contractorMap).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.02em]">
            <Users className="h-6 w-6" /> Teams
          </h1>
          <p className="text-muted-foreground mt-1">
            Contractors assigned to your work orders.{' '}
            {contractors.length > 0 && (
              <span>{contractors.length} contractor{contractors.length !== 1 ? 's' : ''} active.</span>
            )}
          </p>
        </div>
      </div>

      <TeamsClient contractors={contractors} />
    </div>
  );
}
