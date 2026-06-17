'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  BarChart3,
  FileBarChart,
  Settings,
  Layers,
  Building2,
  ClipboardList,
  CheckSquare,
} from 'lucide-react';
import { UserRole } from '@/lib/supabase/server';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const landlordNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const contractorNavItems: NavItem[] = [
  { href: '/', label: 'My Work Orders', icon: ClipboardList },
  { href: '/work-orders', label: 'All Assigned', icon: CheckSquare },
];

export function Sidebar({ role = 'landlord' }: { role?: UserRole }) {
  const pathname = usePathname();
  const navItems = role === 'contractor' ? contractorNavItems : landlordNavItems;

  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full w-64 flex-shrink-0 flex-col border-r">
      {/* Logo */}
      <div className="border-sidebar-border flex h-14 items-center gap-2.5 border-b px-5">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
          <Layers className="h-4 w-4" />
        </div>
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
