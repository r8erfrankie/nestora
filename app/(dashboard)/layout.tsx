import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { BottomNav } from '@/components/bottom-nav';
import { getNavData } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let navRole: import('@/lib/supabase/server').UserRole = 'landlord';
  let navBadges = { tenants: 0, workOrders: 0 };
  let navFullName: string | null = null;
  let navEmail = '';
  try {
    const { role, badges, fullName, email } = await getNavData();
    navRole = role;
    navBadges = badges;
    navFullName = fullName;
    navEmail = email;
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
        <Navbar role={navRole} fullName={navFullName} email={navEmail} />
        {/* pb accounts for the fixed bottom nav + iOS home indicator safe area */}
        <main className="bg-background flex-1 overflow-auto p-4 lg:p-6 lg:pb-6" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.75rem)' }}>
          {children}
        </main>
      </div>
      {/* Bottom nav: mobile and tablet only */}
      <BottomNav role={navRole} badges={navBadges} />
    </div>
  );
}
