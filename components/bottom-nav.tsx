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
  BarChart3,
  FileBarChart,
  FolderOpen,
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
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/teams', label: 'Team', icon: Users },
] as const;

const landlordDrawerItems = [
  { href: '/overview', label: 'Home', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/tenants', label: 'Tenants', icon: UserCheck },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
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

export function BottomNav({ role = 'landlord' }: { role?: UserRole }) {
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Bottom navigation bar — hidden on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 supports-[backdrop-filter]:backdrop-blur-md">
        <div className="flex h-16 items-stretch">
          {bottomItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive(href)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="leading-none">{label}</span>
            </Link>
          ))}

          {/* Menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              menuOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" />
            <span className="leading-none">Menu</span>
          </button>
        </div>
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
              {drawerItems.map(({ href, label, icon: Icon }) => (
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
                  <Icon className="h-6 w-6 shrink-0" />
                  <span className="text-center leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
