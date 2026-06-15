import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { getCurrentUserRole, UserRole } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role: UserRole = await getCurrentUserRole();
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar hidden on mobile for better UX; visible on lg+ */}
      <div className="hidden lg:block">
        <Sidebar role={role} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar role={role} isDevelopment={isDevelopment} />
        <main className="bg-background flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
