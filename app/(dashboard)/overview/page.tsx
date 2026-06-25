import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Plus,
  Wrench,
  User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Onboarding } from '@/components/onboarding';
import { timeAgo, getGreeting } from '@/lib/utils';
import { cookies } from 'next/headers';
import { cn } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarded, full_name')
    .eq('id', user?.id || '')
    .single();

  if (profile?.role !== 'landlord') redirect('/contractor');

  const fullName = (profile as any)?.full_name as string | null | undefined;
  const greetingName = fullName ? fullName.trim().split(/\s+/)[0] : null;
  const greeting = getGreeting();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Exclude personally archived work orders from all counts.
  const { data: archivedEntries } = await supabase
    .from('work_order_user_archives')
    .select('work_order_id');
  const archivedIds = (archivedEntries ?? []).map((e) => e.work_order_id as string);
  const noArchived = (q: any) =>
    archivedIds.length > 0 ? q.not('id', 'in', `(${archivedIds.join(',')})`) : q;

  const [
    { count: openCount },
    { count: inProgressCount },
    { count: requestCount },
    { data: attentionWOs },
    { data: unhandledRequests },
    { data: recentCompletions },
    { count: totalProperties },
  ] = await Promise.all([
    // Open work orders
    noArchived(
      supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'Open')
    ),
    // Active work orders (all non-terminal, non-open statuses)
    noArchived(
      supabase.from('work_orders').select('*', { count: 'exact', head: true })
        .in('status', ['In Progress', 'On Hold', 'Needs Materials'])
    ),
    // Unhandled maintenance requests (submitted, not yet converted)
    supabase.from('maintenance_requests').select('*', { count: 'exact', head: true })
      .eq('status', 'Submitted')
      .is('converted_to_work_order_id', null),
    // Work orders needing attention: overdue or unassigned (open, no contractor)
    noArchived(
      supabase.from('work_orders')
        .select('id, title, status, priority, due_date, assigned_contractor_email, created_at, properties(name)')
        .in('status', ['Open', 'In Progress', 'On Hold', 'Needs Materials'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20)
    ),
    // Unhandled maintenance requests detail
    supabase.from('maintenance_requests')
      .select('id, title, priority, created_at, tenant_email, property:property_id(name)')
      .eq('status', 'Submitted')
      .is('converted_to_work_order_id', null)
      .order('created_at', { ascending: true })
      .limit(10),
    // Recently completed work orders (last 14 days)
    noArchived(
      supabase.from('work_orders')
        .select('id, title, updated_at, properties(name)')
        .eq('status', 'Completed')
        .gte('updated_at', fourteenDaysAgo)
        .order('updated_at', { ascending: false })
        .limit(3)
    ),
    supabase.from('properties').select('*', { count: 'exact', head: true }),
  ]);

  const hasProperties = (totalProperties || 0) > 0;
  const isOnboarded = profile?.onboarded ?? false;
  let showOnboarding = !hasProperties && !isOnboarded;

  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    if (cookieStore.get('dev_force_onboarding')?.value === 'true') showOnboarding = true;
  }

  if (showOnboarding) return <Onboarding greetingName={greetingName ?? 'there'} />;

  // Build prioritized "needs attention" items.
  type AttentionItem =
    | { kind: 'request'; id: string; title: string; property: string | null; age: string; priority: string }
    | { kind: 'unassigned'; id: string; title: string; property: string | null; age: string }
    | { kind: 'overdue'; id: string; title: string; property: string | null; due: string; status: string };

  const attentionItems: AttentionItem[] = [];

  // 1. Unhandled tenant requests (highest priority — landlord hasn't acted yet)
  for (const r of unhandledRequests ?? []) {
    attentionItems.push({
      kind: 'request',
      id: r.id,
      title: r.title,
      property: (r as any).property?.name ?? null,
      age: timeAgo(r.created_at),
      priority: r.priority ?? 'Medium',
    });
  }

  // 2. Open WOs with no contractor assigned
  for (const wo of attentionWOs ?? []) {
    if (wo.status === 'Open' && !wo.assigned_contractor_email) {
      attentionItems.push({
        kind: 'unassigned',
        id: wo.id,
        title: wo.title,
        property: (wo as any).properties?.name ?? null,
        age: timeAgo(wo.created_at),
      });
    }
  }

  // 3. Overdue active work orders
  for (const wo of attentionWOs ?? []) {
    if (wo.due_date && wo.due_date < today && wo.status !== 'Open') {
      attentionItems.push({
        kind: 'overdue',
        id: wo.id,
        title: wo.title,
        property: (wo as any).properties?.name ?? null,
        due: wo.due_date,
        status: wo.status,
      });
    }
  }

  const topItems = attentionItems.slice(0, 8);
  const allClear = topItems.length === 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            {greeting}{greetingName ? `, ${greetingName}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {allClear
              ? "Everything's under control."
              : `${topItems.length} item${topItems.length !== 1 ? 's' : ''} need${topItems.length === 1 ? 's' : ''} your attention.`}
          </p>
        </div>
        <Link
          href="/work-orders"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Work Order
        </Link>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/work-orders" className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Open</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-amber-600">
            {openCount ?? 0}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Work orders</p>
        </Link>

        <Link href="/work-orders" className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Active</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-blue-600">
            {inProgressCount ?? 0}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">In progress</p>
        </Link>

        <Link href="/tenants" className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Requests</p>
          <p className={cn('mt-2 text-3xl font-bold tabular-nums tracking-tight', (requestCount ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {requestCount ?? 0}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Unhandled</p>
        </Link>
      </div>

      {/* Needs attention */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          {!allClear && (
            <Link href="/work-orders" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          )}
        </div>

        {allClear ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">No open requests or overdue work orders.</p>
          </div>
        ) : (
          <div className="divide-y">
            {topItems.map((item, i) => {
              if (item.kind === 'request') {
                return (
                  <Link
                    key={`req-${item.id}`}
                    href="/tenants"
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                      <MessageSquare className="h-3 w-3 text-red-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.property ? `${item.property} · ` : ''}Tenant request · {item.age}
                      </p>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-400">
                      New
                    </span>
                  </Link>
                );
              }

              if (item.kind === 'unassigned') {
                return (
                  <Link
                    key={`unassigned-${item.id}`}
                    href="/work-orders"
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
                      <User className="h-3 w-3 text-amber-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.property ? `${item.property} · ` : ''}No contractor assigned · {item.age}
                      </p>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      Open
                    </span>
                  </Link>
                );
              }

              // overdue
              return (
                <Link
                  key={`overdue-${item.id}`}
                  href="/work-orders"
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.property ? `${item.property} · ` : ''}{item.status} · Due {new Date(item.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="mt-0.5 shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                    Overdue
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent completions */}
      {(recentCompletions ?? []).length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Recently completed</h2>
            <Link href="/work-orders" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="divide-y">
            {(recentCompletions ?? []).map((wo: any) => (
              <div key={wo.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{wo.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {wo.properties?.name ? `${wo.properties.name} · ` : ''}{timeAgo(wo.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
