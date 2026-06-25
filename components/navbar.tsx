import { Separator } from '@/components/ui/separator';
import { UserRole } from '@/lib/supabase/server';
import { NotificationsBell, type AppNotification } from '@/components/notifications-bell';
import { UserMenu } from '@/components/user-menu';
import { createClient } from '@/lib/supabase/server';
import { getInitials } from '@/lib/utils';

export async function Navbar({
  role = 'landlord',
  fullName,
  email,
}: {
  role?: UserRole;
  fullName?: string | null;
  email?: string;
}) {
  let userId = '';
  let initialNotifications: AppNotification[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? '';

    if (userId) {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id, type, title, message, link, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      initialNotifications = (notifs ?? []) as AppNotification[];
    }
  } catch {
    // Non-fatal — render with empty state
  }

  const resolvedEmail = email ?? '';
  const displayName = fullName?.trim() || resolvedEmail.split('@')[0] || 'User';
  const initials = getInitials(fullName, resolvedEmail);

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 z-40 flex h-14 items-center justify-end border-b px-6 backdrop-blur">
      <div className="flex items-center gap-1.5">

        <NotificationsBell userId={userId} initialNotifications={initialNotifications} />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <UserMenu
          name={displayName}
          email={resolvedEmail}
          role={role}
          initials={initials}
        />

      </div>
    </header>
  );
}
