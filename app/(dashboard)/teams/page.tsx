import { createClient, createAdminClient, getCurrentUserRole } from '@/lib/supabase/server';
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
    .select('id, name, email, phone, trade, notes, last_invited_at')
    .order('name');

  // Enrich with self-reported profile data (phone, company_name, trade) for contractors
  // who have registered accounts. Joined via email using the admin client.
  type ProfileData = { full_name: string | null; company_name: string | null; trade: string | null; phone: string | null };
  let profileByEmail: Record<string, ProfileData> = {};

  const contractorEmails = (contractors ?? [])
    .map((c) => (c.email as string | null)?.toLowerCase())
    .filter((e): e is string => Boolean(e));

  if (contractorEmails.length > 0) {
    const admin = createAdminClient();
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const matched = users.filter((u) => u.email && contractorEmails.includes(u.email.toLowerCase()));

    if (matched.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, company_name, trade, phone')
        .in('id', matched.map((u) => u.id));

      const idToEmail = new Map(matched.map((u) => [u.id, u.email!.toLowerCase()]));
      for (const p of profiles ?? []) {
        const email = idToEmail.get(p.id as string);
        if (email) {
          profileByEmail[email] = {
            full_name: (p.full_name as string | null) ?? null,
            company_name: (p.company_name as string | null) ?? null,
            trade: (p.trade as string | null) ?? null,
            phone: (p.phone as string | null) ?? null,
          };
        }
      }
    }
  }

  const enrichedContractors = (contractors ?? []).map((c) => {
    const prof = profileByEmail[(c.email as string | null)?.toLowerCase() ?? ''] ?? null;
    return {
      ...c,
      is_registered: prof !== null,
      profile_name: prof?.full_name ?? null,
      profile_phone: prof?.phone ?? null,
      profile_company_name: prof?.company_name ?? null,
      profile_trade: prof?.trade ?? null,
    };
  });

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
        <TeamsClient initialContractors={(enrichedContractors as Contractor[]) || []} />
      )}
    </div>
  );
}
