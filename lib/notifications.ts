import { createAdminClient } from '@/lib/supabase/server';

export async function insertNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
    });
    if (error) console.error('[insertNotification]', error.message);
  } catch (err) {
    console.error('[insertNotification] unexpected error:', err);
  }
}
