-- Push subscriptions for PWA web push notifications.
-- One row per device per user (a user may have multiple devices/browsers).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint  text        NOT NULL,
  p256dh    text        NOT NULL,
  auth      text        NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read and manage only their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
