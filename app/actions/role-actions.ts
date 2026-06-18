'use server';

import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/roles';

// Returns null on success, or { error } on failure.
// Does NOT call redirect() — the client handles navigation so that
// NEXT_REDIRECT is never caught by a client-side try/catch.
export async function setUserRole(role: UserRole): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', user.id);

  if (error) return { error: error.message };
  return null;
}
