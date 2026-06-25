import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';

webpush.setVapidDetails(
  'mailto:support@gonestora.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToUser(
  userId: string,
  payload: { title: string; message: string; url?: string }
): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

  const admin = createAdminClient();

  // Guard: respect the user's push_enabled preference. This is defensive — disabling
  // push in settings removes the subscription, but stale subs can survive edge cases.
  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('push_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefs !== null && !prefs.push_enabled) return;

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs?.length) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        // 410 Gone = subscription expired/revoked — remove it
        if (err?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    })
  );
}
