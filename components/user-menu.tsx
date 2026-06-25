'use client';

import { Menu } from '@base-ui/react/menu';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { useTransition } from 'react';
import Link from 'next/link';

interface UserMenuProps {
  name: string;
  email: string;
  role: string;
  initials: string;
  avatarUrl?: string | null;
}

export function UserMenu({ name, email, role, initials, avatarUrl }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();

  const roleLabel =
    role === 'landlord' ? 'Landlord' :
    role === 'tenant'   ? 'Tenant' :
    role === 'contractor' ? 'Contractor' : 'Member';

  return (
    <Menu.Root>
      <Menu.Trigger
        className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md py-1 pr-1.5 pl-1 transition-colors outline-none"
        aria-label="User menu"
      >
        <Avatar initials={initials} avatarUrl={avatarUrl} />
        <div className="hidden text-left leading-tight md:block">
          <div className="text-sm font-medium tracking-tight">{name}</div>
          <div className="text-muted-foreground -mt-0.5 text-[10px] font-medium uppercase tracking-wide">
            {roleLabel}
          </div>
        </div>
        <ChevronDown className="text-muted-foreground ml-0.5 hidden h-3.5 w-3.5 md:block" aria-hidden />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-50"
        >
          <Menu.Popup className="bg-popover text-popover-foreground border-border min-w-[220px] overflow-hidden rounded-lg border shadow-lg outline-none data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 transition-[opacity,transform] duration-100 origin-top-right">
            {/* Identity header */}
            <div className="border-border flex items-center gap-3 border-b px-3 py-3">
              <Avatar initials={initials} avatarUrl={avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="text-muted-foreground truncate text-xs">{email}</p>
                <span className="bg-primary/10 text-primary mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1">
              <Menu.Item
                className="hover:bg-accent focus:bg-accent flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none transition-colors"
                render={<Link href="/settings" />}
              >
                <Settings className="text-muted-foreground h-4 w-4" />
                Settings
              </Menu.Item>

              <Menu.Separator className="bg-border my-1 h-px" />

              <Menu.Item
                className="hover:bg-destructive/10 focus:bg-destructive/10 text-destructive flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={() => startTransition(() => signOut())}
              >
                <LogOut className="h-4 w-4" />
                {isPending ? 'Signing out…' : 'Sign out'}
              </Menu.Item>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Avatar({
  initials,
  avatarUrl,
  size = 'sm',
}: {
  initials: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs';

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${dim} rounded-full object-cover ring-2 ring-background`}
      />
    );
  }

  return (
    <div
      className={`${dim} bg-teal-600 text-white flex shrink-0 items-center justify-center rounded-full font-semibold`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
