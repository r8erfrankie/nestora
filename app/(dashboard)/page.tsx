import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowUpRight, Clock, AlertTriangle, CheckCircle, Building2, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/supabase/server';
import { Onboarding } from '@/components/onboarding';
import { timeAgo, getGreeting } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const role = await getCurrentUserRole();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch onboarding status + name from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded, full_name')
    .eq('id', user?.id || '')
    .single();
  const fullName = (profile as any)?.full_name as string | null | undefined;
  const greetingName = fullName ? fullName.trim().split(/\s+/)[0] : null;
  const greeting = getGreeting();

  if (role === null) {
    redirect('/select-role');
  }

  if (role !== 'landlord') {
    redirect('/contractor');
  }

  // Landlord / default experience
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: openWorkOrders },
    { count: dueSoon },
    { count: completedThisMonth },
    { count: totalProperties },
    { data: recentActivities },
  ] = await Promise.all([
    supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
    supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Completed')
      .gte('due_date', today)
      .lte('due_date', sevenDaysLater),
    supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Completed')
      .gte('updated_at', startOfMonth),
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase
      .from('work_orders')
      .select(
        `
        id,
        title,
        status,
        updated_at,
        properties (name)
      `
      )
      .order('updated_at', { ascending: false })
      .limit(6),
  ]);

  const hasProperties = (totalProperties || 0) > 0;
  const isOnboarded = profile?.onboarded ?? false;
  let showOnboarding = !hasProperties && !isOnboarded;

  // In development, support forcing the onboarding view via cookie (for the "Replay Onboarding" button)
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    if (cookieStore.get('dev_force_onboarding')?.value === 'true') {
      showOnboarding = true;
    }
  }

  if (showOnboarding) {
    return <Onboarding greetingName={greetingName ?? 'there'} />;
  }

  return (
    <div className="space-y-5 p-4 sm:space-y-8 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            {greeting}{greetingName ? `, ${greetingName}` : ''}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Here&apos;s a clear overview of your properties and maintenance tasks.
          </p>
        </div>
        <a
          href="/work-orders"
          className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center gap-2 self-start rounded-md border px-3 py-1 text-xs font-medium shadow-sm transition-colors sm:self-auto"
        >
          View work orders
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Stats — 2-col on mobile so all 4 fit above the fold */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="[--card-spacing:0.75rem] sm:[--card-spacing:1rem]">
          <CardHeader className="pb-1 sm:pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Open work orders
            </CardDescription>
            <CardTitle className="text-2xl tracking-tighter tabular-nums sm:text-3xl">
              {openWorkOrders || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-[10px] sm:text-xs">{dueSoon || 0} due within 7 days</p>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:0.75rem] sm:[--card-spacing:1rem]">
          <CardHeader className="pb-1 sm:pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Due soon
            </CardDescription>
            <CardTitle className="text-2xl tracking-tighter tabular-nums sm:text-3xl">{dueSoon || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-[10px] sm:text-xs">Upcoming deadlines</p>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:0.75rem] sm:[--card-spacing:1rem]">
          <CardHeader className="pb-1 sm:pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Completed
            </CardDescription>
            <CardTitle className="text-2xl tracking-tighter tabular-nums sm:text-3xl">
              {completedThisMonth || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-[10px] sm:text-xs">This month</p>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:0.75rem] sm:[--card-spacing:1rem]">
          <CardHeader className="pb-1 sm:pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Properties
            </CardDescription>
            <CardTitle className="text-2xl tracking-tighter tabular-nums sm:text-3xl">
              {totalProperties || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-[10px] sm:text-xs">Under management</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" /> Recent Activity
              </CardTitle>
              <CardDescription>Latest updates across your properties</CardDescription>
            </div>
            <a
              href="/work-orders"
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              View all
            </a>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {recentActivities && recentActivities.length > 0 ? (
            <div className="space-y-3 text-sm sm:space-y-4">
              {recentActivities.map((activity: any) => {
                const propName = activity.properties?.name ? ` at ${activity.properties.name}` : '';
                const message = `Work order "${activity.title}"${propName} was marked as ${activity.status}`;
                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className="bg-muted mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
                    <div className="leading-snug">
                      <span className="text-foreground">{message}</span>
                      <div className="text-muted-foreground/70 mt-px text-[11px]">
                        {timeAgo(activity.updated_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center text-sm">
              No recent activity yet. Create a work order to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links / onboarding hint */}
      <div className="text-muted-foreground border-border/60 border-t pt-4 text-center text-xs">
        Pro tip: Use the sidebar to navigate between Properties and Work Orders for full management.
      </div>
    </div>
  );
}
