import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getGreeting } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Clock, Home, Plus } from 'lucide-react';

export const metadata = { title: 'My Properties' };

type Link_ = {
  id: string;
  property_id: string;
  status: string;
  unit: string | null;
  created_at: string;
};

type PropertyInfo = {
  id: string;
  name: string;
  address: string | null;
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

  // Defense-in-depth (proxy already enforces this).
  if (profile?.role !== 'tenant') redirect('/');

  const fullName = profile?.full_name as string | null;
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : null;
  const greeting = getGreeting();

  // RLS "Tenant reads own links" policy filters to the current user's email.
  const { data: rawLinks } = await supabase
    .from('tenant_property_links')
    .select('id, property_id, status, unit, created_at')
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  const allLinks = (rawLinks ?? []) as Link_[];
  const approvedLinks = allLinks.filter((l) => l.status === 'approved');
  const pendingLinks = allLinks.filter((l) => l.status === 'pending');

  // Tenant RLS blocks reading other users' properties — use admin client.
  let propertyMap: Record<string, PropertyInfo> = {};
  if (allLinks.length > 0) {
    const admin = createAdminClient();
    const { data: props } = await admin
      .from('properties')
      .select('id, name, address')
      .in(
        'id',
        allLinks.map((l) => l.property_id),
      );
    propertyMap = Object.fromEntries((props ?? []).map((p) => [p.id, p as PropertyInfo]));
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Page header */}
      <div>
        <p className="text-muted-foreground text-sm">{greeting}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {firstName ? `${firstName}'s Properties` : 'My Properties'}
        </h1>
      </div>

      {/* ── Approved properties ──────────────────────────────────────────────── */}
      {approvedLinks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            My Properties
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
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Unit {link.unit}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/tenant/new-request?property=${link.property_id}`}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Submit Request
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        /* ── Empty state (no approved properties) ─────────────────────────── */
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

      {/* ── Pending requests ─────────────────────────────────────────────────── */}
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
                          {' '}
                          · Unit {link.unit}
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
    </div>
  );
}
