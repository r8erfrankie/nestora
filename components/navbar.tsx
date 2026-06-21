import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, ChevronDown, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserRole } from '@/lib/supabase/server';

export async function Navbar({
  role = 'landlord',
}: {
  role?: UserRole;
}) {
  // Wrapped in try/catch so that if supabase.auth.getUser() throws during an
  // automatic RSC re-render (triggered by a session cookie rotation in a Server
  // Action), the Navbar renders in a degraded state instead of crashing the page.
  let email = '';
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data?.user?.email ?? '';
  } catch {
    // Non-fatal — render with empty email
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
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 z-40 flex h-14 items-center justify-between border-b px-6 backdrop-blur">
      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>

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

        {/* Logout button using server action */}
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
