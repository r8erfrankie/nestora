import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Bell, Plus, Search, ChevronDown, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DevRoleSwitcher } from '@/components/dev-role-switcher';
import { DevOnboardingReset } from '@/components/dev-onboarding-reset';
import { UserRole } from '@/lib/supabase/server';

export async function Navbar({
  role = 'landlord',
  isDevelopment = false,
}: {
  role?: UserRole;
  isDevelopment?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? '';
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
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* "Nestora" on mobile (no sidebar branding); "Overview" on desktop */}
        <span className="text-foreground/90 text-sm font-semibold tracking-tight lg:hidden">Nestora</span>
        <span className="text-foreground/90 hidden text-sm font-medium lg:block">Overview</span>
        {/* Temporary dev-only role switcher for easy landlord/contractor testing */}
        <DevRoleSwitcher isDevelopment={isDevelopment} currentRole={role} />
        {/* Dev-only button to force the onboarding flow again (useful for testing) */}
        <DevOnboardingReset isDevelopment={isDevelopment} />
      </div>

      {/* Center: Global search */}
      <div className="mx-8 max-w-md flex-1">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search projects, teams, or files..."
            className="bg-muted/50 border-border/80 focus-visible:bg-background h-9 w-full pl-9"
            // Prevent password managers and autofill extensions from interfering
            // (causes "detectStore" and similar errors + hydration issues on Firefox)
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        <Button variant="default" size="sm" className="hidden h-8 gap-1.5 px-3.5 sm:flex">
          <Plus className="h-3.5 w-3.5" />
          New Project
        </Button>

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
