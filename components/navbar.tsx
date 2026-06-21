import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserRole } from '@/lib/supabase/server';
import { NotificationsBell, type AppNotification } from '@/components/notifications-bell';

export async function Navbar({
  role = 'landlord',
}: {
  role?: UserRole;
}) {
  let email = '';
  let userId = '';
  let initialNotifications: AppNotification[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data?.user?.email ?? '';
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

  const displayName = email.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase() || 'U';

  async function handleSignOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 z-40 flex h-14 items-center justify-end border-b px-6 backdrop-blur">
      <div className="flex items-center gap-1.5">

        <NotificationsBell userId={userId} initialNotifications={initialNotifications} />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User profile — links to settings */}
        <Link
          href="/settings"
          className="hover:bg-accent flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors"
        >
          <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
            {initials}
          </div>
          <div className="hidden text-left leading-tight md:block">
            <div className="text-sm font-medium tracking-tight">{displayName}</div>
            <div className="text-muted-foreground -mt-0.5 text-[10px]">Member</div>
          </div>
          <ChevronDown className="text-muted-foreground ml-0.5 hidden h-3.5 w-3.5 md:block" />
        </Link>

        {/* Logout */}
        <form action={handleSignOut}>
          <Button
            variant="ghost"
            size="icon"
            type="submit"
            className="text-muted-foreground hover:text-foreground h-8 w-8"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </form>

      </div>
    </header>
  );
}
