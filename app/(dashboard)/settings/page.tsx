import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user?.id ?? '')
    .single();

  return (
    <div className="p-6 max-w-2xl">
      <SettingsClient
        email={user?.email ?? ''}
        fullName={profile?.full_name ?? null}
        role={(profile?.role as 'landlord' | 'contractor') ?? 'landlord'}
      />
    </div>
  );
}
