import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getGreeting } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PushPrompt } from '@/app/components/push-prompt';
import { TenantRequestsList } from './tenant-requests-list';
import { Card } from '@/components/ui/card';
import { Building2, Clock, ExternalLink, FileText, Home, Plus } from 'lucide-react';
import { LeaseSummaryPanel, type LeaseSummary } from './lease-card';
import { formatUnit } from '@/lib/unit-label';

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
  unit_label_type?: string | null;
};

type MaintenanceRequest = {
  id: string;
  property_id: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
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

  // Parallel fetch — links, requests, archived IDs, and lease data.
  const [{ data: rawLinks }, { data: rawRequests }, { data: rawArchives }, { data: rawLeases }] = await Promise.all([
    supabase
      .from('tenant_property_links')
      .select('id, property_id, status, initiated_by, unit, created_at')
      .neq('status', 'removed')
      .order('created_at', { ascending: false }),
    supabase
      .from('maintenance_requests')
      .select('id, property_id, title, priority, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('tenant_request_archives')
      .select('request_id'),
    supabase
      .from('leases')
      .select('link_id, lease_type, lease_start, lease_end, monthly_rent, security_deposit, notes'),
  ]);

  const allLinks = (rawLinks ?? []) as PropertyLink[];
  const approvedLinks = allLinks.filter((l) => l.status === 'approved');
  const pendingLinks = allLinks.filter((l) => l.status === 'pending');
  const requests = (rawRequests ?? []) as MaintenanceRequest[];
  const archivedIds = (rawArchives ?? []).map((a) => a.request_id as string);

  // Fetch lease documents — wrapped in try/catch so a missing table (migration
  // not yet run) degrades gracefully rather than crashing the page.
  type TenantDoc = { id: string; link_id: string; name: string; url: string; size: number | null };
  const docsByLinkId = new Map<string, TenantDoc[]>();
  try {
    const approvedLinkIds = approvedLinks.map((l) => l.id);
    if (approvedLinkIds.length > 0) {
      const { data } = await supabase
        .from('lease_documents')
        .select('id, link_id, name, url, size')
        .in('link_id', approvedLinkIds)
        .order('created_at', { ascending: true });
      for (const d of (data ?? []) as TenantDoc[]) {
        const arr = docsByLinkId.get(d.link_id) ?? [];
        arr.push(d);
        docsByLinkId.set(d.link_id, arr);
      }
    }
  } catch { /* table not yet migrated — show no documents */ }

  const leaseByLinkId = new Map<string, LeaseSummary>();
  for (const l of (rawLeases ?? []) as unknown as (LeaseSummary & { link_id: string })[]) {
    leaseByLinkId.set(l.link_id, l);
  }

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
      .select('id, name, address, unit_label_type')
      .in('id', allPropertyIds);
    propertyMap = Object.fromEntries((props ?? []).map((p) => [p.id, p as PropertyInfo]));
  }

  return (
    <div className="max-w-3xl space-y-5 sm:space-y-8">
      <PushPrompt role="tenant" />
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
          <div className="space-y-3">
            {approvedLinks.map((link) => {
              const prop = propertyMap[link.property_id];
              const lease = leaseByLinkId.get(link.id);
              const docs = docsByLinkId.get(link.id) ?? [];
              return (
                <div key={link.id} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Property card */}
                  <Card className="p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="bg-primary/10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                        <Building2 className="text-primary h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {prop?.name ?? 'Property'}
                        </p>
                        {prop?.address && (
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {prop.address}
                          </p>
                        )}
                        {link.unit && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {formatUnit(link.unit, prop?.unit_label_type)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" className="mt-3 w-full">
                      <Link href={`/tenant/new-request?property=${link.property_id}`}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Maintenance Request
                      </Link>
                    </Button>
                  </Card>

                  {/* Lease panel — right of the property card */}
                  <LeaseSummaryPanel lease={lease} />
                </div>

                  {/* Lease documents */}
                  {docs.length > 0 && (
                    <div className="rounded-lg border bg-card p-4 space-y-2">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Documents</p>
                      <div className="space-y-1.5">
                        {docs.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted/40 transition-colors active:bg-muted/60"
                          >
                            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate font-medium">{doc.name}</span>
                            <ExternalLink className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* ── Empty state (no approved properties) ───────────────────────────── */
        <section className="rounded-xl border border-dashed p-5 text-center sm:p-8">
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
                          {' '}· {formatUnit(link.unit, prop?.unit_label_type)}
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
        <section>
          <TenantRequestsList
            requests={requests}
            initialArchivedIds={archivedIds}
            propertyMap={propertyMap}
          />
        </section>
      )}
    </div>
  );
}
