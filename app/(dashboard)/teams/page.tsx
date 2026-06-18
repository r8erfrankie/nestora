import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/supabase/server';
import { TeamsClient, type Contractor } from './teams-client';
import { Users } from 'lucide-react';

export default async function TeamsPage() {
  const supabase = await createClient();
  const role = await getCurrentUserRole();

  if (role === 'contractor') {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="flex items-center gap-3 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            <Users className="h-5 w-5 sm:h-6 sm:w-6" /> Teams
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Contractor team management is for landlords.</p>
        </div>
      </div>
    );
  }

  const { data: contractors, error: contractorsError } = await supabase
    .from('contractors')
    .select('id, name, email, phone, trade, notes')
    .order('name');

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div>
        <h1 className="flex items-center gap-3 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
          <Users className="h-5 w-5 sm:h-6 sm:w-6" /> Teams
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your contractor directory.
          {(contractors?.length ?? 0) > 0 && (
            <span> {contractors!.length} contractor{contractors!.length !== 1 ? 's' : ''}.</span>
          )}
        </p>
      </div>

      {contractorsError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Setup required:</strong> Run{' '}
          <code className="font-mono">supabase/contractors.sql</code> in your Supabase SQL editor to
          enable the Teams feature.
        </div>
      ) : (
        <TeamsClient initialContractors={(contractors as Contractor[]) || []} />
      )}
    </div>
  );
}
