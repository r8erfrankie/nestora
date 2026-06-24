-- Notification preferences: one row per user, all channels as boolean columns.
-- Add new notification types by adding columns with DEFAULT true.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled        boolean     NOT NULL DEFAULT true,
  work_updates        boolean     NOT NULL DEFAULT true,
  new_messages        boolean     NOT NULL DEFAULT true,
  status_changes      boolean     NOT NULL DEFAULT true,
  due_date_reminders  boolean     NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
