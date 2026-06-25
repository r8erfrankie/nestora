'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Settings,
  Building2,
  ClipboardList,
} from 'lucide-react';
import { UserRole } from '@/lib/supabase/server';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const landlordNavItems: NavItem[] = [
  { href: '/overview', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/tenants', label: 'Tenants', icon: UserCheck },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const contractorNavItems: NavItem[] = [
  { href: '/contractor', label: 'My Work Orders', icon: ClipboardList },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const tenantNavItems: NavItem[] = [
  { href: '/tenant', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-teal-700 px-1.5 text-[10px] font-semibold leading-none text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function Sidebar({
  role = 'landlord',
  badges = { tenants: 0, workOrders: 0 },
}: {
  role?: UserRole;
  badges?: { tenants: number; workOrders: number };
}) {
  const pathname = usePathname();
  const navItems =
    role === 'contractor' ? contractorNavItems :
    role === 'tenant'     ? tenantNavItems     :
    landlordNavItems;

  const badgeFor = (href: string): number => {
    if (href === '/tenants')     return badges.tenants;
    if (href === '/work-orders') return badges.workOrders;
    return 0;
  };

  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full w-64 flex-shrink-0 flex-col border-r">
      {/* Logo */}
      <div className="border-sidebar-border flex h-14 items-center gap-2.5 border-b px-5">
        <Image src="/nestora-icon.svg" alt="Nestora" width={32} height={32} className="rounded-lg" />
        <div>
          <div className="text-base font-semibold tracking-[-0.015em]">Nestora</div>
          <div className="text-sidebar-foreground/60 -mt-0.5 text-[10px]">Workspace</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="text-sidebar-foreground/60 mb-2 px-3 text-xs font-medium tracking-widest uppercase">
          Menu
        </div>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const badge = badgeFor(item.href);
            // Suppress badge while the user is already viewing that section.
            const showBadge = badge > 0 && !isActive;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100" />
                <span>{item.label}</span>
                {showBadge && <NavBadge count={badge} />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar footer */}
      <div className="border-sidebar-border text-sidebar-foreground/60 border-t p-4 text-xs">
        <div className="flex items-center justify-between">
          <span>Free plan</span>
          <span className="font-mono text-[10px]">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
