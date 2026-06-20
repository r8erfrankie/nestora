import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from './settings-client';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone, emergency_contact_name, emergency_contact_phone')
    .eq('id', user.id)
    .single();

  return (
    <div className="p-6 max-w-2xl">
      <SettingsClient
        email={user.email ?? ''}
        role={(profile?.role as string | null) ?? null}
        fullName={(profile?.full_name as string | null) ?? null}
        phone={(profile?.phone as string | null) ?? null}
        ecName={(profile?.emergency_contact_name as string | null) ?? null}
        ecPhone={(profile?.emergency_contact_phone as string | null) ?? null}
      />
    </div>
  );
}
