'use server';

import { createClient } from '@/lib/supabase/server';
import { type NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '@/lib/notification-types';

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...DEFAULT_NOTIFICATION_PREFS };

  const { data } = await supabase
    .from('notification_preferences')
    .select('push_enabled, work_updates, new_messages, status_changes, due_date_reminders')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return { ...DEFAULT_NOTIFICATION_PREFS };

  return {
    push_enabled: data.push_enabled as boolean,
    work_updates: data.work_updates as boolean,
    new_messages: data.new_messages as boolean,
    status_changes: data.status_changes as boolean,
    due_date_reminders: data.due_date_reminders as boolean,
  };
}

export async function saveNotificationPreferences(prefs: NotificationPrefs): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
}
