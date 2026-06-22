import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowUpRight, Clock, AlertTriangle, CheckCircle, Building2, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Onboarding } from '@/components/onboarding';
import { timeAgo, getGreeting } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Single query for role + onboarding + name — replaces getCurrentUserRole() + separate profile fetch.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarded, full_name')
    .eq('id', user?.id || '')
    .single();

  const fullName = (profile as any)?.full_name as string | null | undefined;
  const greetingName = fullName ? fullName.trim().split(/\s+/)[0] : null;
  const greeting = getGreeting();

  // Defense-in-depth (proxy already routes by role, this is a belt-and-suspenders fallback).
  if (profile?.role !== 'landlord') {
    redirect('/contractor');
  }

  // Landlord / default experience
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch personally archived IDs first so we can exclude them from counts.
  const { data: archivedEntries } = await supabase
    .from('work_order_user_archives')
    .select('work_order_id');
  const archivedIds = (archivedEntries ?? []).map((e) => e.work_order_id as string);

  // Apply personal-archive exclusion to any work_orders count query.
  const noArchived = (q: any) =>
    archivedIds.length > 0 ? q.not('id', 'in', `(${archivedIds.join(',')})`) : q;

  const [
    { count: openWorkOrders },
    { count: dueSoon },
    { count: completedThisMonth },
    { count: totalProperties },
    { data: recentActivities },
  ] = await Promise.all([
    noArchived(
      supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'Open')
    ),
    noArchived(
      supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Completed')
        .gte('due_date', today)
        .lte('due_date', sevenDaysLater)
    ),
    noArchived(
      supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Completed')
        .gte('updated_at', startOfMonth)
    ),
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
    <div className="space-y-6 p-4 sm:p-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-gray-900 sm:text-3xl">
            {greeting}{greetingName ? `, ${greetingName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s what&apos;s happening across your properties today.
          </p>
        </div>
        <a
          href="/work-orders"
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 sm:self-auto"
        >
          View work orders
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* ── Stat cards — 2-col on mobile, 4-col on desktop ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        {/* Open work orders */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Open</p>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50">
              <Clock className="h-3.5 w-3.5 text-teal-700" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-teal-700 sm:text-4xl">
            {openWorkOrders ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">Work orders</p>
          {(dueSoon ?? 0) > 0 ? (
            <p className="mt-3 flex items-center gap-1 text-[10px] font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {dueSoon} due this week
            </p>
          ) : (
            <p className="mt-3 text-[10px] text-gray-400">None due this week</p>
          )}
        </div>

        {/* Due soon */}
        <div className="rounded-xl border border-amber-50 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Due soon</p>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-amber-600 sm:text-4xl">
            {dueSoon ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">Within 7 days</p>
          <p className="mt-3 text-[10px] text-gray-400">
            {(dueSoon ?? 0) > 0 ? 'Needs attention' : 'All on track'}
          </p>
        </div>

        {/* Completed this month */}
        <div className="rounded-xl border border-green-50 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Completed</p>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-green-600 sm:text-4xl">
            {completedThisMonth ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">This month</p>
          <p className="mt-3 text-[10px] text-gray-400">
            {(completedThisMonth ?? 0) > 0 ? 'Keep up the pace' : 'None closed yet'}
          </p>
        </div>

        {/* Properties */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Properties</p>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50">
              <Building2 className="h-3.5 w-3.5 text-teal-700" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-4xl">
            {totalProperties ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">Under management</p>
          <p className="mt-3 text-[10px] text-gray-400">
            {(totalProperties ?? 0) === 1 ? 'Active property' : 'Active properties'}
          </p>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <Activity className="h-4 w-4 text-teal-700 sm:h-5 sm:w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription className="mt-0.5">Latest updates across your properties</CardDescription>
            </div>
            <a
              href="/work-orders"
              className="text-xs font-medium text-teal-700 underline-offset-4 hover:underline"
            >
              View all
            </a>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-0">
          {recentActivities && recentActivities.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentActivities.map((activity: any) => {
                const status: string = activity.status;
                const pill =
                  status === 'Completed'   ? 'bg-green-50 text-green-700 border-green-100' :
                  status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  status === 'Open'        ? 'bg-teal-50 text-teal-700 border-teal-100'   :
                  'bg-gray-50 text-gray-600 border-gray-200';
                return (
                  <div key={activity.id} className="flex items-start gap-3 py-3.5">
                    <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pill}`}>
                      {status}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {activity.properties?.name ? `${activity.properties.name} · ` : ''}
                        {timeAgo(activity.updated_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <Activity className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No recent activity yet</p>
              <p className="text-xs text-gray-400">Create a work order to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
