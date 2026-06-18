import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { BottomNav } from '@/components/bottom-nav';
import { getCurrentUserRole } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentUserRole();

  // New users who haven't chosen a role yet must go through role selection first.
  if (role === null) {
    redirect('/select-role');
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: desktop only */}
      <div className="hidden lg:block">
        <Sidebar role={role} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar role={role} isDevelopment={isDevelopment} />
        {/* pb-20 on mobile/tablet gives clearance above the bottom nav bar */}
        <main className="bg-background flex-1 overflow-auto p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>
      {/* Bottom nav: mobile and tablet only */}
      <BottomNav role={role} />
    </div>
  );
}
