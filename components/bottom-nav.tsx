'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Users,
  UserCheck,
  Settings,
  MoreHorizontal,
  Layers,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { UserRole } from '@/lib/roles';

const landlordBottomItems = [
  { href: '/overview', label: 'Home', icon: LayoutDashboard },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/tenants', label: 'Tenants', icon: UserCheck },
  { href: '/teams', label: 'Team', icon: Users },
] as const;

const landlordDrawerItems = [
  { href: '/overview', label: 'Home', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/tenants', label: 'Tenants', icon: UserCheck },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const contractorBottomItems = [
  { href: '/contractor', label: 'My Work', icon: ClipboardList },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const contractorDrawerItems = [
  { href: '/contractor', label: 'My Work Orders', icon: ClipboardList },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const tenantBottomItems = [
  { href: '/tenant', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const tenantDrawerItems = tenantBottomItems;

export function BottomNav({
  role = 'landlord',
  badges = { tenants: 0, workOrders: 0 },
}: {
  role?: UserRole;
  badges?: { tenants: number; workOrders: number };
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const bottomItems =
    role === 'contractor' ? contractorBottomItems :
    role === 'tenant'     ? tenantBottomItems     :
    landlordBottomItems;
  const drawerItems =
    role === 'contractor' ? contractorDrawerItems :
    role === 'tenant'     ? tenantDrawerItems     :
    landlordDrawerItems;

  const showMenu = role !== 'contractor';

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const badgeFor = (href: string): number => {
    if (href === '/tenants')     return badges.tenants;
    if (href === '/work-orders') return badges.workOrders;
    return 0;
  };

  return (
    <>
      {/* Bottom navigation bar — hidden on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-md shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="flex h-16 items-stretch">
          {bottomItems.map(({ href, label, icon: Icon }) => {
            const badge = badgeFor(href);
            const showBadge = badge > 0 && !isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:opacity-60',
                  isActive(href)
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground active:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 shrink-0" />
                  {showBadge && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-teal-700 px-0.5 text-[9px] font-bold leading-none text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className="leading-none">{label}</span>
              </Link>
            );
          })}

          {/* Menu button — hidden for roles whose drawer duplicates the bottom bar */}
          {showMenu && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:opacity-60',
                menuOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground active:text-foreground'
              )}
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="leading-none">Menu</span>
            </button>
          )}
        </div>
        {/* Cap safe area at 40px — prevents iOS Safari browser chrome from inflating this */}
        <div style={{ height: 'min(env(safe-area-inset-bottom, 0px), 40px)' }} />
      </nav>

      {/* Full nav drawer — slides up from bottom */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[75vh] overflow-hidden rounded-t-2xl px-0 pb-6"
        >
          <SheetHeader className="border-b border-border px-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                  <Layers className="h-4 w-4" />
                </div>
                <SheetTitle className="text-base font-semibold tracking-tight">
                  Nestora
                </SheetTitle>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </SheetHeader>

          <nav className="overflow-y-auto px-4 pt-3">
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
              {drawerItems.map(({ href, label, icon: Icon }) => {
                const badge = badgeFor(href);
                const showBadge = badge > 0 && !isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl px-2 py-4 text-xs font-medium transition-colors',
                      isActive(href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <div className="relative">
                      <Icon className="h-6 w-6 shrink-0" />
                      {showBadge && (
                        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-teal-700 px-0.5 text-[9px] font-bold leading-none text-white">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </div>
                    <span className="text-center leading-tight">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
