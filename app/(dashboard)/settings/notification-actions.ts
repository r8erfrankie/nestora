'use server';

import { createClient } from '@/lib/supabase/server';

export interface NotificationPrefs {
  push_enabled: boolean;
  work_updates: boolean;
  new_messages: boolean;
  status_changes: boolean;
  due_date_reminders: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  work_updates: true,
  new_messages: true,
  status_changes: true,
  due_date_reminders: true,
};

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...DEFAULT_PREFS };

  const { data } = await supabase
    .from('notification_preferences')
    .select('push_enabled, work_updates, new_messages, status_changes, due_date_reminders')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return { ...DEFAULT_PREFS };

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
