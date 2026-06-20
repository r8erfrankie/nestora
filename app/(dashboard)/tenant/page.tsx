import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getGreeting, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Building2, Clock, Home, Plus } from 'lucide-react';

export const metadata = { title: 'My Properties' };

type PropertyLink = {
  id: string;
  property_id: string;
  status: string;
  initiated_by: string | null;
  unit: string | null;
  created_at: string;
};

type PropertyInfo = {
  id: string;
  name: string;
  address: string | null;
};

type MaintenanceRequest = {
  id: string;
  property_id: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  Submitted:     'bg-secondary text-secondary-foreground',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Resolved:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Declined:      'bg-destructive/10 text-destructive',
};

const PRIORITY_STYLES: Record<string, string> = {
  Low:    'text-muted-foreground',
  Medium: 'text-yellow-600',
  High:   'text-orange-600',
  Urgent: 'text-destructive font-medium',
};

export default async function TenantDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | null;

  // landlord/contractor always go to their own dashboard.
  if (role !== 'tenant' && role !== null) redirect('/');

  // null-role users are allowed through only when they have an approved
  // landlord-initiated link — handles lost safeNext after magic-link auth.
  if (role === null) {
    const { data: approvedInvite } = await supabase
      .from('tenant_property_links')
      .select('id')
      .eq('status', 'approved')
      .eq('initiated_by', 'landlord')
      .limit(1)
      .maybeSingle();
    if (!approvedInvite) redirect('/');
    // Non-destructive sync — only writes when role is still null.
    await supabase.from('profiles').update({ role: 'tenant' }).eq('id', user.id).is('role', null);
  }

  // Invited tenants who just authenticated land here before completing their profile.
  if (!profile?.full_name) redirect('/tenant-onboarding');

  const fullName = profile?.full_name as string | null;
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : null;
  const greeting = getGreeting();

  // Parallel fetch — links and maintenance requests (both scoped by RLS to this tenant).
  const [{ data: rawLinks }, { data: rawRequests }] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select('id, property_id, status, initiated_by, unit, created_at')
      .neq('status', 'removed')
      .order('created_at', { ascending: false }),
    supabase
      .from('maintenance_requests')
      .select('id, property_id, title, priority, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const allLinks = (rawLinks ?? []) as PropertyLink[];
  const approvedLinks = allLinks.filter((l) => l.status === 'approved');
  const pendingLinks = allLinks.filter((l) => l.status === 'pending');
  const requests = (rawRequests ?? []) as MaintenanceRequest[];

  // If there are any pending landlord-initiated invites, route through onboarding
  // so the auto-approval logic can accept them and link the tenant's account.
  const hasPendingLandlordInvite = pendingLinks.some((l) => l.initiated_by === 'landlord');
  if (hasPendingLandlordInvite) redirect('/tenant-onboarding');

  // Gate: only show the dashboard to tenants with at least one approved property.
  // Pending / declined tenants are sent to the onboarding flow instead.
  if (approvedLinks.length === 0) redirect('/tenant-onboarding');

  // Build a single property ID set covering both links and requests.
  const allPropertyIds = [
    ...new Set([
      ...allLinks.map((l) => l.property_id),
      ...requests.map((r) => r.property_id),
    ]),
  ];

  // Tenant RLS blocks reading other users' properties — one admin call covers both sections.
  let propertyMap: Record<string, PropertyInfo> = {};
  if (allPropertyIds.length > 0) {
    const admin = createAdminClient();
    const { data: props } = await admin
      .from('properties')
      .select('id, name, address')
      .in('id', allPropertyIds);
    propertyMap = Object.fromEntries((props ?? []).map((p) => [p.id, p as PropertyInfo]));
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Page header */}
      <div>
        <p className="text-muted-foreground text-sm">{greeting}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {firstName ? `${firstName}'s Dashboard` : 'My Dashboard'}
        </h1>
      </div>

      {/* ── Approved properties ──────────────────────────────────────────────── */}
      {approvedLinks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Home
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {approvedLinks.map((link) => {
              const prop = propertyMap[link.property_id];
              return (
                <Card key={link.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                        <Building2 className="text-primary h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base leading-snug">
                          {prop?.name ?? 'Property'}
                        </CardTitle>
                        {prop?.address && (
                          <CardDescription className="mt-0.5 truncate">
                            {prop.address}
                          </CardDescription>
                        )}
                        {link.unit && (
                          <p className="text-muted-foreground mt-0.5 text-xs">Unit {link.unit}</p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/tenant/new-request?property=${link.property_id}`}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Maintenance Request
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        /* ── Empty state (no approved properties) ───────────────────────────── */
        <section className="rounded-xl border border-dashed p-8 text-center">
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <Home className="text-muted-foreground h-6 w-6" />
              </div>
            </div>
            <div>
              <p className="font-medium">No approved properties yet</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {pendingLinks.length > 0
                  ? 'Your request is pending landlord approval.'
                  : 'Connect to your rental property to get started.'}
              </p>
            </div>
            {pendingLinks.length === 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/tenant-onboarding">Request access</Link>
              </Button>
            )}
          </div>
        </section>
      )}

      {/* ── Pending property access requests ─────────────────────────────────── */}
      {pendingLinks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Pending Approval
          </h2>
          <div className="space-y-2">
            {pendingLinks.map((link) => {
              const prop = propertyMap[link.property_id];
              return (
                <div
                  key={link.id}
                  className="bg-card flex items-center gap-3 rounded-lg border px-4 py-3"
                >
                  <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {prop?.name ?? 'Property'}
                      {link.unit && (
                        <span className="text-muted-foreground font-normal">
                          {' '}· Unit {link.unit}
                        </span>
                      )}
                    </p>
                    {prop?.address && (
                      <p className="text-muted-foreground truncate text-xs">{prop.address}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 whitespace-nowrap text-xs">
                    Awaiting approval
                  </span>
                </div>
              );
            })}
          </div>
          <div className="pt-1 text-center">
            <Button asChild variant="ghost" size="sm">
              <Link href="/tenant-onboarding">+ Add another property</Link>
            </Button>
          </div>
        </section>
      )}

      {/* ── My Requests ──────────────────────────────────────────────────────── */}
      {(requests.length > 0 || approvedLinks.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            My Requests
          </h2>
          <Separator />
          {requests.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No requests yet.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {requests.map((req) => {
                const prop = propertyMap[req.property_id];
                const statusStyle = STATUS_STYLES[req.status] ?? STATUS_STYLES['Submitted'];
                const priorityStyle = PRIORITY_STYLES[req.priority] ?? '';
                return (
                  <Link
                    key={req.id}
                    href={`/tenant/requests/${req.id}`}
                    className="hover:bg-muted/40 flex items-start gap-4 px-4 py-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{req.title}</p>
                      <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {prop && <span>{prop.name}</span>}
                        <span>·</span>
                        <span>{timeAgo(req.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
                      >
                        {req.status}
                      </span>
                      <span className={`text-xs ${priorityStyle}`}>{req.priority}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
