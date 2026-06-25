export interface NotificationPrefs {
  push_enabled: boolean;
  work_updates: boolean;
  new_messages: boolean;
  status_changes: boolean;
  due_date_reminders: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  push_enabled: true,
  work_updates: true,
  new_messages: true,
  status_changes: true,
  due_date_reminders: true,
};
