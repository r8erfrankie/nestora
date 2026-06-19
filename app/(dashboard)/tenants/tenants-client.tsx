'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Check, Clock, Loader2, UserCheck, X } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { approveTenantRequest, rejectTenantRequest } from './actions';

export type PropertySummary = {
  id: string;
  name: string;
  address: string | null;
};

export type TenantLink = {
  id: string;
  tenant_email: string;
  status: string;
  unit: string | null;
  initiated_by: string;
  created_at: string;
  property_id: string;
  property: PropertySummary | null;
};

interface TenantsClientProps {
  pendingLinks: TenantLink[];
  approvedLinks: TenantLink[];
}

export function TenantsClient({ pendingLinks, approvedLinks }: TenantsClientProps) {
  // Group approved links by property for the summary section.
  const approvedByProperty = approvedLinks.reduce<Record<string, { property: PropertySummary | null; emails: string[] }>>(
    (acc, link) => {
      const key = link.property_id;
      if (!acc[key]) acc[key] = { property: link.property, emails: [] };
      acc[key].emails.push(link.tenant_email);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage tenant access requests for your properties.
          </p>
        </div>
        {/* Placeholder for future "Invite tenant" button */}
      </div>

      {/* ── Pending requests ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Pending Requests</h2>
          {pendingLinks.length > 0 && (
            <Badge variant="secondary">{pendingLinks.length}</Badge>
          )}
        </div>
        <Separator />

        {pendingLinks.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Clock className="h-8 w-8 opacity-40" />
            <p className="text-sm">No pending requests</p>
            <p className="text-xs opacity-70">
              Tenants who scan your property QR code will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {pendingLinks.map((link) => (
              <PendingRow key={link.id} link={link} />
            ))}
          </div>
        )}
      </section>

      {/* ── Approved tenants ─────────────────────────────────────────────────── */}
      {approvedLinks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Approved Tenants</h2>
          <Separator />
          <div className="space-y-3">
            {Object.entries(approvedByProperty).map(([propertyId, { property, emails }]) => (
              <div key={propertyId} className="rounded-lg border px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                    <Building2 className="text-primary h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{property?.name ?? 'Property'}</p>
                    {property?.address && (
                      <p className="text-muted-foreground truncate text-xs">{property.address}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {emails.map((email) => (
                        <span
                          key={email}
                          className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs"
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PendingRow({ link }: { link: TenantLink }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const runAction = (action: () => Promise<void>) => {
    setError('');
    startTransition(async () => {
      try {
        await action();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Action failed.');
      }
    });
  };

  const ago = link.created_at ? timeAgo(link.created_at) : null;

  return (
    <div className={`px-4 py-3 transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Tenant + property info */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="bg-muted mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <UserCheck className="text-muted-foreground h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{link.tenant_email}</p>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {link.property?.name ?? 'Unknown property'}
              </span>
              {link.unit && <span>· Unit {link.unit}</span>}
              {ago && <span>· {ago}</span>}
            </div>
            {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <Button
            size="sm"
            onClick={() => runAction(() => approveTenantRequest(link.id))}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => runAction(() => rejectTenantRequest(link.id))}
            disabled={isPending}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
