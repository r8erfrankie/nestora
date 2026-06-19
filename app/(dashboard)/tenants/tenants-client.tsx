'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  QrCode,
  Wrench,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { approveTenantRequest, inviteTenantByEmail, rejectTenantRequest } from './actions';

export type PropertySummary = {
  id: string;
  name: string;
  address: string | null;
};

export type TenantLink = {
  id: string;
  tenant_id: string | null;
  tenant_email: string;
  tenant_name: string | null;
  status: string;
  unit: string | null;
  initiated_by: string;
  created_at: string;
  property_id: string;
  property: PropertySummary | null;
};

export type PropertyWithCode = {
  id: string;
  name: string;
  address: string | null;
  join_code: string | null;
};

export type MaintenanceRequest = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  tenant_email: string;
  tenant_name: string | null;
  unit: string | null;
  created_at: string;
  property: PropertySummary | null;
};

const PRIORITY_STYLES: Record<string, string> = {
  Low:    'bg-secondary text-secondary-foreground',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  High:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Urgent: 'bg-destructive/10 text-destructive',
};

const STATUS_STYLES: Record<string, string> = {
  Submitted:    'bg-secondary text-secondary-foreground',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Resolved:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Declined:     'bg-destructive/10 text-destructive',
};

interface TenantsClientProps {
  pendingLinks: TenantLink[];
  approvedLinks: TenantLink[];
  properties: PropertyWithCode[];
  maintenanceRequests: MaintenanceRequest[];
}

export function TenantsClient({ pendingLinks, approvedLinks, properties, maintenanceRequests }: TenantsClientProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  // Group approved links by property for the summary section.
  const approvedByProperty = approvedLinks.reduce<
    Record<string, { property: PropertySummary | null; tenants: { email: string; name: string | null; unit: string | null }[] }>
  >((acc, link) => {
    const key = link.property_id;
    if (!acc[key]) acc[key] = { property: link.property, tenants: [] };
    acc[key].tenants.push({ email: link.tenant_email, name: link.tenant_name, unit: link.unit });
    return acc;
  }, {});

  const propertiesWithCode = properties.filter((p) => p.join_code);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage tenant access requests for your properties.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)} className="shrink-0 gap-1.5">
          <UserPlus className="h-4 w-4" />
          Invite Tenant
        </Button>
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
            {Object.entries(approvedByProperty).map(([propertyId, { property, tenants }]) => (
              <div key={propertyId} className="rounded-lg border">
                {/* Property header */}
                <div className="flex items-center gap-3 border-b px-4 py-2.5">
                  <Building2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{property?.name ?? 'Property'}</span>
                    {property?.address && (
                      <span className="text-muted-foreground ml-2 text-xs">{property.address}</span>
                    )}
                  </div>
                </div>
                {/* Tenant rows */}
                <div className="divide-y">
                  {tenants.map(({ email, name, unit }) => (
                    <div key={email} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      {unit && (
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">
                          Unit {unit}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{name ?? email}</p>
                        {name && (
                          <p className="text-muted-foreground truncate text-xs">{email}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Maintenance requests ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Maintenance Requests</h2>
          {maintenanceRequests.length > 0 && (
            <Badge variant="secondary">{maintenanceRequests.length}</Badge>
          )}
        </div>
        <Separator />

        {maintenanceRequests.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Wrench className="h-8 w-8 opacity-40" />
            <p className="text-sm">No maintenance requests yet.</p>
            <p className="text-xs opacity-70">
              Tenants can submit requests from their dashboard.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {maintenanceRequests.map((req) => (
              <RequestRow key={req.id} request={req} />
            ))}
          </div>
        )}
      </section>

      {/* ── Property join codes ───────────────────────────────────────────────── */}
      {propertiesWithCode.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Join Codes</h2>
            <QrCode className="text-muted-foreground h-3.5 w-3.5" />
          </div>
          <Separator />
          <p className="text-muted-foreground text-xs">
            Share a code or link with your tenant. They enter it at{' '}
            <span className="font-mono">gonestora.app/join/&lt;CODE&gt;</span> or scan a QR code.
          </p>
          <div className="space-y-2">
            {propertiesWithCode.map((p) => (
              <JoinCodeRow key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}

      <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} properties={properties} />
    </div>
  );
}

// ── Maintenance request row ───────────────────────────────────────────────────

function RequestRow({ request }: { request: MaintenanceRequest }) {
  const priorityStyle = PRIORITY_STYLES[request.priority] ?? PRIORITY_STYLES['Medium'];
  const statusStyle   = STATUS_STYLES[request.status]    ?? STATUS_STYLES['Submitted'];
  const ago = request.created_at ? timeAgo(request.created_at) : null;
  const tenantLabel = request.tenant_name ?? request.tenant_email;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
        {/* Left: title + meta */}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{request.title}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {request.property?.name ?? 'Property'}
            </span>
            {request.unit && (
              <>
                <span>·</span>
                <span>Unit {request.unit}</span>
              </>
            )}
            <span>·</span>
            <span title={request.tenant_name ? request.tenant_email : undefined}>
              {tenantLabel}
            </span>
            {ago && (
              <>
                <span>·</span>
                <span>{ago}</span>
              </>
            )}
          </div>
        </div>
        {/* Right: badges */}
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyle}`}>
            {request.priority}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
            {request.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Join code row ─────────────────────────────────────────────────────────────

function JoinCodeRow({ property }: { property: PropertyWithCode }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${property.join_code}`
      : `https://gonestora.app/join/${property.join_code}`;

  const copy = async (text: string, type: 'code' | 'link') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{property.name}</p>
          <p className="text-muted-foreground font-mono text-xs tracking-widest">
            {property.join_code}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => copy(property.join_code!, 'code')}
          >
            {copied === 'code' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => copy(joinUrl, 'link')}
          >
            {copied === 'link' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Pending row ────────────────────────────────────────────────────────────────

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
    <div
      className={`px-4 py-3 transition-opacity ${isPending ? 'pointer-events-none opacity-50' : ''}`}
    >
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

// ── Invite modal ───────────────────────────────────────────────────────────────

function InviteModal({
  open,
  onOpenChange,
  properties,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  properties: PropertyWithCode[];
}) {
  const [email, setEmail] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setEmail('');
    setPropertyId('');
    setError('');
    setSuccess(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !propertyId) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        await inviteTenantByEmail(email.trim(), propertyId);
        setSuccess(true);
        setTimeout(() => handleOpenChange(false), 1600);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to send invite.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Tenant</DialogTitle>
          <DialogDescription>
            Grant a tenant immediate access to one of your properties. They&apos;ll receive an
            email with a link to log in.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium">Invite sent</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {email} now has access and has been notified by email.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant email</label>
              <Input
                type="email"
                placeholder="tenant@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                disabled={isPending}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Property</label>
              {properties.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  You don&apos;t have any properties yet.
                </p>
              ) : (
                <Select
                  value={propertyId}
                  onValueChange={(v) => {
                    setPropertyId(v || '');
                    setError('');
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex flex-col">
                          <span>{p.name}</span>
                          {p.address && (
                            <span className="text-muted-foreground text-xs">{p.address}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || properties.length === 0}
                className="gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {isPending ? 'Sending…' : 'Send Invite'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
