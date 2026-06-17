import { cookies } from 'next/headers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowUpRight, Clock, AlertTriangle, CheckCircle, Building2, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { MyWorkOrders, type MyWorkOrder } from '@/components/my-work-orders';
import { getCurrentUserRole } from '@/lib/supabase/server';
import { Onboarding } from '@/components/onboarding';
import { timeAgo, getGreeting } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const role = await getCurrentUserRole();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch onboarding status from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded')
    .eq('id', user?.id || '')
    .single();
  const greetingName = user?.email
    ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1)
    : 'there';
  const greeting = getGreeting();

  const isLandlord = role === 'landlord';

  if (!isLandlord) {
    // Contractor experience: clean, focused "My Work Orders" view
    // (fetch only assigned work orders for the section)
    const { data: myAssignedWorkOrdersData } = await supabase
      .from('work_orders')
      .select(
        `
        id,
        title,
        description,
        status,
        priority,
        due_date,
        notes,
        updated_at,
        assigned_contractor_email,
        properties (id, name)
      `
      )
      .eq('assigned_contractor_email', user?.email || 'no-match-for-contractor')
      .order('due_date', { ascending: true, nullsFirst: true })
      .limit(30);

    const myAssignedWorkOrders: MyWorkOrder[] = (myAssignedWorkOrdersData as any) || [];

    return (
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {greeting}, {greetingName}
          </h1>
          <p className="text-muted-foreground mt-1">Here are the work orders assigned to you.</p>
        </div>

        <MyWorkOrders initialWorkOrders={myAssignedWorkOrders} />

        <div className="text-muted-foreground border-border/60 border-t pt-4 text-center text-xs">
          Tip: Tap any job card to quickly update status, add notes, or attach photos from your
          phone.
        </div>
      </div>
    );
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

  // Also fetch assigned for the "My Work Orders" section (useful for landlords who self-assign)
  const { data: myAssignedWorkOrdersData } = await supabase
    .from('work_orders')
    .select(
      `
      id,
      title,
      description,
      status,
      priority,
      due_date,
      notes,
      updated_at,
      assigned_contractor_email,
      properties (id, name)
    `
    )
    .eq('assigned_contractor_email', user?.email || 'no-match-for-contractor')
    .order('due_date', { ascending: true, nullsFirst: true })
    .limit(20);

  const myAssignedWorkOrders: MyWorkOrder[] = (myAssignedWorkOrdersData as any) || [];

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
    return <Onboarding greetingName={greetingName} />;
  }

  return (
    <div className="space-y-8 p-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {greeting}, {greetingName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s a clear overview of your properties and maintenance tasks.
          </p>
        </div>
        <a
          href="/work-orders"
          className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 py-1 text-xs font-medium shadow-sm transition-colors"
        >
          View work orders
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5" /> Open work orders
            </CardDescription>
            <CardTitle className="text-3xl tracking-tighter tabular-nums">
              {openWorkOrders || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">{dueSoon || 0} due within 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" /> Due soon
            </CardDescription>
            <CardTitle className="text-3xl tracking-tighter tabular-nums">{dueSoon || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">Work orders with upcoming deadlines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <CheckCircle className="h-3.5 w-3.5" /> Completed this month
            </CardDescription>
            <CardTitle className="text-3xl tracking-tighter tabular-nums">
              {completedThisMonth || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">Work orders marked complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Building2 className="h-3.5 w-3.5" /> Total properties
            </CardDescription>
            <CardTitle className="text-3xl tracking-tighter tabular-nums">
              {totalProperties || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">Properties under management</p>
          </CardContent>
        </Card>
      </div>

      {/* My Work Orders section (for self-assigned or testing) */}
      <MyWorkOrders initialWorkOrders={myAssignedWorkOrders} />

      {/* Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5" /> Recent Activity
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
            <div className="space-y-4 text-sm">
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
