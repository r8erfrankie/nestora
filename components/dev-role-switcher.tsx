'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { UserRole } from '@/lib/supabase/server';

interface DevRoleSwitcherProps {
  isDevelopment: boolean;
  currentRole: UserRole;
}

export function DevRoleSwitcher({ isDevelopment, currentRole }: DevRoleSwitcherProps) {
  const router = useRouter();
  // Local state so the select updates immediately while the server re-renders
  const [role, setRole] = React.useState(currentRole);

  // Keep local state in sync if prop changes (e.g. after refresh)
  React.useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  if (!isDevelopment) {
    return null;
  }

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);

    // Set a cookie that server components read for the dev override.
    // This is the source of truth for getCurrentUserRole() in dev.
    document.cookie = `dev_role=${newRole}; path=/; max-age=31536000; samesite=lax`;

    // Trigger server re-render of the layout + page with the updated cookie.
    // router.refresh() is more reliable than full page reload for picking up
    // the cookie in RSC payloads during dev.
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-yellow-400 bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
      <span className="font-mono tracking-[1px] opacity-70">DEV</span>
      <select
        value={role}
        onChange={(e) => handleRoleChange(e.target.value as UserRole)}
        className="cursor-pointer appearance-none border-none bg-transparent p-0 text-[10px] font-semibold text-yellow-900 focus:ring-0 focus:outline-none dark:text-yellow-200"
        aria-label="Temporary dev role switcher (development only)"
      >
        <option value="landlord">Landlord</option>
        <option value="contractor">Contractor</option>
      </select>
    </div>
  );
}
