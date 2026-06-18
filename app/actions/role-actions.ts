'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type RoleActionState = { error: string } | null;

// FormData-based action compatible with useActionState.
// redirect() is safe here because it's invoked via form submission,
// not a bare event handler, so Next.js handles the redirect response
// before it can surface as a NEXT_REDIRECT error on the client.
export async function setUserRoleAction(
  _prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const role = formData.get('role');

  if (role !== 'landlord' && role !== 'contractor') {
    return { error: 'Invalid role selected.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated. Please try logging in again.' };

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', user.id);

  if (error) return { error: error.message };

  redirect(role === 'contractor' ? '/contractor-onboarding' : '/landlord-onboarding');
}
