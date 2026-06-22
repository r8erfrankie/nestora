import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { BottomNav } from '@/components/bottom-nav';
import { getNavData } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let navRole: import('@/lib/supabase/server').UserRole = 'landlord';
  let navBadges = { tenants: 0, workOrders: 0 };
  try {
    const { role, badges } = await getNavData();
    navRole = role;
    navBadges = badges;
  } catch {
    // Non-fatal — fall back to defaults
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: desktop only */}
      <div className="hidden lg:block">
        <Sidebar role={navRole} badges={navBadges} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar role={navRole} />
        {/* pb-20 on mobile/tablet gives clearance above the bottom nav bar */}
        <main className="bg-background flex-1 overflow-auto p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>
      {/* Bottom nav: mobile and tablet only */}
      <BottomNav role={navRole} badges={navBadges} />
    </div>
  );
}
