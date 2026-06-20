'use server';

import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(data: {
  full_name: string;
  phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const updates: Record<string, string | null> = {
    full_name: data.full_name.trim() || null,
  };
  if ('phone' in data) updates.phone = data.phone?.trim() || null;
  if ('emergency_contact_name' in data) updates.emergency_contact_name = data.emergency_contact_name?.trim() || null;
  if ('emergency_contact_phone' in data) updates.emergency_contact_phone = data.emergency_contact_phone?.trim() || null;

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) throw error;

  revalidatePath('/settings');
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const admin = createAdminClient();

  // Delete profile first to avoid FK constraint issues before removing the auth record
  await admin.from('profiles').delete().eq('id', user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('Failed to delete auth user:', error);
    throw new Error('Failed to delete account');
  }

  // Clear session cookies; may fail since the user record is already gone
  try {
    await supabase.auth.signOut();
  } catch { /* non-fatal */ }

  redirect('/login?deleted=true');
}
