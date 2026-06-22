'use server';

import { createClient } from '@/lib/supabase/server';

export async function submitSupportTicket(data: {
  subject: string;
  message: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'You must be signed in to send a message.' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      user_email: user.email ?? '',
      user_role: profile?.role ?? null,
      subject: data.subject,
      message: data.message,
    });

    if (error) {
      console.error('[submitSupportTicket]', error);
      return { success: false, error: 'Failed to send your message. Please try again.' };
    }

    return { success: true };
  } catch (err) {
    console.error('[submitSupportTicket] unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
