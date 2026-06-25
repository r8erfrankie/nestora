'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { formatPhone } from '@/lib/phone';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  Trash2,
  UserX,
  Wrench,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { cn, timeAgo } from '@/lib/utils';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { addManualTenant, approveTenantRequest, convertToWorkOrder, deleteMaintenanceRequest, inviteTenantByEmail, rejectTenantRequest, removeTenant, resendTenantInvite, updateTenantNotes } from './actions';
import { LeaseSection } from './lease-section';
import { type LeaseData } from './lease-actions';
import { LeaseDocuments } from './lease-documents';
import { formatUnit, getLabelWord } from '@/lib/unit-label';
import { MaintenanceRequestNotes } from '@/app/components/maintenance-request-notes';

export type PropertySummary = {
  id: string;
  name: string;
  address: string | null;
  unit_label_type?: string | null;
};

export type TenantLink = {
  id: string;
  tenant_id: string | null;
  tenant_email: string | null;
  tenant_name: string | null;
  status: string;
  unit: string | null;
  unit_label_type: string | null;
  initiated_by: string;
  created_at: string;
  property_id: string;
  property: PropertySummary | null;
  profileMissing?: boolean;
  phone: string | null;
  ec_name: string | null;
  ec_phone: string | null;
  notes: string | null;
  lease: LeaseData | null;
  documents: { id: string; link_id: string; name: string; url: string; size: number | null; created_at: string }[];
};

export type PropertyWithCode = {
  id: string;
  name: string;
  address: string | null;
  join_code: string | null;
  unit_label_type?: string | null;
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
  phone: string | null;
  unit: string | null;
  converted_to_work_order_id: string | null;
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
  Withdrawn:    'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-500',
};

interface TenantsClientProps {
  pendingLinks: TenantLink[];
  approvedLinks: TenantLink[];
  properties: PropertyWithCode[];
  maintenanceRequests: MaintenanceRequest[];
  expandRequest?: string | null;
}

type RemoveTarget = {
  linkId: string;
  tenantEmail: string | null;
  tenantName: string | null;
  propertyName: string;
};

function useLocalStorageToggle(key: string, defaultOpen = false): [boolean, () => void] {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setIsOpen(stored === 'true');
    } catch {}
  }, [key]);
  const toggle = () =>
    setIsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(key, String(next)); } catch {}
      return next;
    });
  return [isOpen, toggle];
}

export function TenantsClient({ pendingLinks, approvedLinks, properties, maintenanceRequests, expandRequest }: TenantsClientProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>(maintenanceRequests);

  // Pre-expand the target request when arriving via deep link; verify it exists first.
  const validExpandId =
    expandRequest && requests.some((r) => r.id === expandRequest)
      ? expandRequest
      : null;
  const [expandedId, setExpandedId] = useState<string | null>(validExpandId);

  // On deep-link arrival: scroll the target row into view and clean the URL.
  useEffect(() => {
    if (!validExpandId) return;
    const el = document.getElementById(`request-${validExpandId}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    }
    router.replace('/tenants', { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group approved links by property for the summary section.
  const approvedByProperty = approvedLinks.reduce<
    Record<string, { property: PropertySummary | null; tenants: TenantLink[] }>
  >((acc, link) => {
    const key = link.property_id;
    if (!acc[key]) acc[key] = { property: link.property, tenants: [] };
    acc[key].tenants.push(link);
    return acc;
  }, {});

  const propertiesWithCode = properties.filter((p) => p.join_code);

  return (
    <div className="space-y-5 sm:space-y-8">
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
      <CollapsibleSection
        title="Pending Requests"
        badge={pendingLinks.length > 0 ? <Badge variant="secondary">{pendingLinks.length}</Badge> : undefined}
        storageKey="tenants-section-pending"
      >
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
      </CollapsibleSection>

      {/* ── Approved tenants ─────────────────────────────────────────────────── */}
      {approvedLinks.length > 0 && (
        <CollapsibleSection
          title="Approved Tenants"
          badge={<Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 text-xs font-semibold">{approvedLinks.length}</Badge>}
          storageKey="tenants-section-approved"
        >
          <div className="space-y-3">
            {Object.entries(approvedByProperty).map(([propertyId, { property, tenants }]) => (
              <PropertyGroup
                key={propertyId}
                propertyId={propertyId}
                property={property}
                tenants={tenants}
                onRemove={setRemoveTarget}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Maintenance requests ─────────────────────────────────────────────── */}
      <CollapsibleSection
        title="Maintenance Requests"
        badge={requests.length > 0 ? <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 text-xs font-semibold">{requests.length}</Badge> : undefined}
        storageKey="tenants-section-maintenance"
      >
        {requests.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Wrench className="h-8 w-8 opacity-40" />
            <p className="text-sm">No maintenance requests yet.</p>
            <p className="text-xs opacity-70">
              Tenants can submit requests from their dashboard.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {requests.map((req) => (
              <div key={req.id} id={`request-${req.id}`}>
                <RequestRow
                  request={req}
                  isExpanded={expandedId === req.id}
                  onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  onDeleted={(id) => {
                    setRequests((prev) => prev.filter((r) => r.id !== id));
                    setExpandedId((prev) => (prev === id ? null : prev));
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Property join codes ───────────────────────────────────────────────── */}
      {propertiesWithCode.length > 0 && (
        <CollapsibleSection
          title="Join Codes"
          trailing={<QrCode className="text-muted-foreground h-3.5 w-3.5" />}
          storageKey="tenants-section-joincodes"
        >
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
              Share a code or link with your tenant. They enter it at{' '}
              <span className="font-mono">gonestora.app/join/&lt;CODE&gt;</span> or scan a QR code.
            </p>
            <div className="space-y-2">
              {propertiesWithCode.map((p) => (
                <JoinCodeRow key={p.id} property={p} />
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} properties={properties} />
      <RemoveTenantDialog target={removeTarget} onClose={() => setRemoveTarget(null)} />
    </div>
  );
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

function CollapsibleSection({
  title,
  badge,
  trailing,
  storageKey,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  storageKey: string;
  children: React.ReactNode;
}) {
  const [isOpen, toggle] = useLocalStorageToggle(storageKey);
  return (
    <section>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          '-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
          isOpen
            ? 'bg-primary/8 hover:bg-primary/12 active:bg-primary/15'
            : 'hover:bg-muted/40 active:bg-muted/60',
        )}
      >
        <span className={cn('h-4 w-1 shrink-0 rounded-full transition-colors', isOpen ? 'bg-primary' : 'bg-muted-foreground/25')} />
        <h2 className={cn('text-sm font-semibold tracking-tight transition-colors', isOpen ? 'text-primary' : 'text-foreground')}>{title}</h2>
        {badge}
        {trailing}
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 transition-transform duration-200', isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground')}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

// ── Per-property group inside Approved Tenants (collapsible) ──────────────────

function PropertyGroup({
  propertyId,
  property,
  tenants,
  onRemove,
}: {
  propertyId: string;
  property: PropertySummary | null;
  tenants: TenantLink[];
  onRemove: (target: RemoveTarget) => void;
}) {
  const [isOpen, toggle] = useLocalStorageToggle(`tenants-property-${propertyId}`, false);
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
          isOpen
            ? 'border-b bg-primary/5 hover:bg-primary/8 active:bg-primary/10'
            : 'hover:bg-muted/30 active:bg-muted/50',
        )}
      >
        <Building2 className={cn('h-3.5 w-3.5 shrink-0 transition-colors', isOpen ? 'text-primary' : 'text-muted-foreground')} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-baseline gap-1.5 overflow-hidden">
            <span className="shrink-0 text-sm font-medium">{property?.name ?? 'Property'}</span>
            {property?.address && (
              <span className="text-muted-foreground truncate text-xs">{property.address}</span>
            )}
          </div>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {tenants.length} {tenants.length === 1 ? 'tenant' : 'tenants'}
        </span>
        <ChevronDown
          className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="divide-y">
            {tenants.map((link) => (
              <TenantRow
                key={link.id}
                link={link}
                onRemove={() =>
                  onRemove({
                    linkId: link.id,
                    tenantEmail: link.tenant_email,
                    tenantName: link.tenant_name,
                    propertyName: link.property?.name ?? 'Property',
                  })
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Maintenance request row ───────────────────────────────────────────────────

type Photo = { id: string; url: string; name: string | null };

function RequestRow({
  request,
  isExpanded,
  onToggle,
  onDeleted,
}: {
  request: MaintenanceRequest;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleted: (id: string) => void;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Conversion state — initialized from the prop so already-converted rows show correctly.
  const [convertedWoId, setConvertedWoId] = useState<string | null>(
    request.converted_to_work_order_id
  );
  const [converting, startConverting] = useTransition();
  const [convertError, setConvertError] = useState('');
  const [convertWarning, setConvertWarning] = useState('');

  // Delete state.
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [deleteError, setDeleteError] = useState('');
  const [, startDelete] = useTransition();

  const handleDelete = () => {
    setDeleteError('');
    setDeleteState('deleting');
    startDelete(async () => {
      try {
        await deleteMaintenanceRequest(request.id);
        onDeleted(request.id);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Delete failed.');
        setDeleteState('idle');
      }
    });
  };

  // Lazy-load photos the first time the row is expanded.
  useEffect(() => {
    if (!isExpanded || photos !== null) return;
    setLoadingPhotos(true);
    createClient()
      .from('maintenance_request_photos')
      .select('id, url, name')
      .eq('request_id', request.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setPhotos(data ?? []);
        setLoadingPhotos(false);
      });
  }, [isExpanded, request.id, photos]);

  const priorityStyle = PRIORITY_STYLES[request.priority] ?? PRIORITY_STYLES['Medium'];
  const statusStyle   = STATUS_STYLES[request.status]    ?? STATUS_STYLES['Submitted'];
  const ago = request.created_at ? timeAgo(request.created_at) : null;
  const tenantLabel = request.tenant_name ?? request.tenant_email;
  const formattedDate = new Date(request.created_at).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <div>
      {/* ── Collapsed header (always visible) ─────────────────────────────── */}
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 text-left transition-colors ${
          isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30 active:bg-muted/40'
        }`}
      >
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
                  <span>{formatUnit(request.unit, request.property?.unit_label_type)}</span>
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
          {/* Right: badges + chevron */}
          <div className="flex shrink-0 items-center flex-wrap gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyle}`}>
              {request.priority}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
              {request.status}
            </span>
            <ChevronDown
              className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {/* ── Expanded detail area ───────────────────────────────────────────── */}
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t bg-muted/30 px-4 py-4 space-y-4">
            {/* Description */}
            {request.description ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Description
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {request.description}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">No description provided.</p>
            )}

            {/* Metadata grid */}
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {request.property && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Property
                  </p>
                  <p className="mt-0.5">
                    {request.property.name}
                    {request.unit && (
                      <span className="text-muted-foreground"> • {formatUnit(request.unit, request.property?.unit_label_type)}</span>
                    )}
                  </p>
                </div>
              )}
              {request.phone && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Phone
                  </p>
                  <p className="mt-0.5">{formatPhone(request.phone) ?? request.phone}</p>
                </div>
              )}
              {request.category && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Category
                  </p>
                  <p className="mt-0.5">{request.category}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Submitted
                </p>
                <p className="mt-0.5">{formattedDate}</p>
              </div>
            </div>

            {/* Photos */}
            {loadingPhotos && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading photos…
              </div>
            )}
            {photos && photos.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Photos
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {photos.map((photo, idx) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => {
                        setLightboxIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className="group relative aspect-square overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.name ?? 'Photo'}
                        className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                      />
                    </button>
                  ))}
                </div>
                <PhotoLightbox
                  images={photos.map((p) => p.url)}
                  startIndex={lightboxIndex}
                  open={lightboxOpen}
                  onClose={() => setLightboxOpen(false)}
                />
              </div>
            )}

            {/* ── Notes to tenant ───────────────────────────────────────────── */}
            {isExpanded && <MaintenanceRequestNotes requestId={request.id} />}

            {/* ── Actions: Convert to Work Order + Delete ───────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-t pt-4">
              {/* Convert zone */}
              <div>
                {convertedWoId ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Converted to a work order</span>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Link href="/work-orders">
                        View Work Orders
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        size="sm"
                        disabled={converting}
                        onClick={() => {
                          setConvertError('');
                          setConvertWarning('');
                          startConverting(async () => {
                            try {
                              const { workOrderId, photoWarning } = await convertToWorkOrder(
                                request.id
                              );
                              setConvertedWoId(workOrderId);
                              if (photoWarning) setConvertWarning(photoWarning);
                            } catch (err: unknown) {
                              setConvertError(
                                err instanceof Error ? err.message : 'Conversion failed.'
                              );
                            }
                          });
                        }}
                        className="gap-1.5"
                      >
                        {converting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                        {converting ? 'Converting…' : 'Convert to Work Order'}
                      </Button>
                      {convertError && (
                        <p className="text-destructive text-xs">{convertError}</p>
                      )}
                    </div>
                    {convertWarning && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        ⚠ {convertWarning}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Delete zone */}
              <div className="flex items-center gap-2">
                {deleteState === 'idle' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive gap-1 h-8"
                    onClick={() => setDeleteState('confirm')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
                {deleteState === 'confirm' && (
                  <>
                    <span className="text-destructive text-xs font-medium">Delete permanently?</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDeleteState('idle')}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      onClick={handleDelete}
                    >
                      Delete
                    </Button>
                  </>
                )}
                {deleteState === 'deleting' && (
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting…
                  </span>
                )}
                {deleteError && <p className="text-destructive text-xs">{deleteError}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Remove tenant dialog ──────────────────────────────────────────────────────

function RemoveTenantDialog({
  target,
  onClose,
}: {
  target: RemoveTarget | null;
  onClose: () => void;
}) {
  const [closeRequests, setCloseRequests] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Reset options whenever a new target is set.
  useEffect(() => {
    setCloseRequests(false);
    setError('');
  }, [target]);

  const handleRemove = () => {
    if (!target) return;
    startTransition(async () => {
      try {
        await removeTenant(target.linkId, closeRequests);
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to remove tenant.');
      }
    });
  };

  const tenantLabel = target?.tenantName ?? target?.tenantEmail ?? '';

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Tenant?</DialogTitle>
          <DialogDescription>
            <strong>{tenantLabel}</strong> will lose access to{' '}
            <strong>{target?.propertyName}</strong>. You can re-invite them at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {(
            [
              {
                value: false,
                label: 'Keep maintenance history',
                description: 'Their past requests remain visible in your maintenance log.',
              },
              {
                value: true,
                label: 'Close open requests',
                description: 'Active requests (Submitted / In Progress) will be marked as Resolved.',
              },
            ] as const
          ).map(({ value, label, description }) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setCloseRequests(value)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                closeRequests === value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    closeRequests === value ? 'border-primary' : 'border-muted-foreground/40'
                  }`}
                >
                  {closeRequests === value && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-sm font-medium">{label}</p>
                {value === false && (
                  <span className="ml-auto text-xs text-muted-foreground">(default)</span>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 pl-6 text-xs">{description}</p>
            </button>
          ))}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRemove}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Remove Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// ── Approved tenant row (expandable — contact info + landlord notes) ──────────

function TenantRow({
  link,
  onRemove,
}: {
  link: TenantLink;
  onRemove: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(link.notes ?? '');
  const [savedNotes, setSavedNotes] = useState(link.notes ?? '');
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const isDirty = notes !== savedNotes;
  const isManual = !link.tenant_email;
  const isInviteSent = !isManual && (link.profileMissing ?? false) && link.tenant_id === null;
  const isDeleted = !isManual && (link.profileMissing ?? false) && link.tenant_id !== null;
  const [resending, startResend] = useTransition();
  const [resendError, setResendError] = useState('');
  const [resendDone, setResendDone] = useState(false);
  const unitLabel = formatUnit(link.unit, link.unit_label_type ?? link.property?.unit_label_type);

  const handleSaveNotes = () => {
    setSaveError('');
    setSaved(false);
    startSaving(async () => {
      try {
        await updateTenantNotes(link.id, notes);
        setSavedNotes(notes);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save notes.');
      }
    });
  };

  return (
    <div>
      <div className={`flex items-center gap-2 px-4 py-2.5 text-sm${link.profileMissing ? ' opacity-70' : ''}`}>
        <div className="min-w-0 flex-1">
          {link.profileMissing ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-muted-foreground truncate">{link.tenant_email ?? link.tenant_name}</p>
              {isInviteSent && (
                <>
                  <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium">
                    Invite sent
                  </span>
                  <button
                    type="button"
                    disabled={resending || resendDone}
                    onClick={() => {
                      setResendError('');
                      setResendDone(false);
                      startResend(async () => {
                        try {
                          await resendTenantInvite(link.id);
                          setResendDone(true);
                          setTimeout(() => setResendDone(false), 3000);
                        } catch (err: unknown) {
                          setResendError(err instanceof Error ? err.message : 'Failed to resend.');
                        }
                      });
                    }}
                    className="text-primary shrink-0 text-xs underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Sending…' : resendDone ? 'Sent ✓' : 'Resend invite'}
                  </button>
                </>
              )}
              {isDeleted && (
                <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium">
                  Account deleted
                </span>
              )}
              {resendError && (
                <p className="text-destructive w-full text-xs">{resendError}</p>
              )}
            </div>
          ) : (
            <p className="truncate" title={link.tenant_name && link.tenant_email ? link.tenant_email : undefined}>
              {link.tenant_name ?? link.tenant_email ?? '—'}
            </p>
          )}
          {unitLabel && (
            <p className="text-muted-foreground truncate text-xs">{unitLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded p-0 transition-colors hover:bg-muted/60 active:bg-muted"
          title={isExpanded ? 'Collapse' : 'Details & notes'}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        {isDeleted ? (
          <CleanupButton linkId={link.id} />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 shrink-0 p-0 hover:text-destructive"
            title={isInviteSent ? 'Revoke invite' : 'Remove tenant'}
            onClick={onRemove}
          >
            <UserX className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Expanded detail panel */}
      <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 border-t bg-muted/20 px-4 py-4">
            {isManual && (
              <p className="text-muted-foreground/60 flex items-center gap-1.5 text-xs">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                No Nestora account — added manually
              </p>
            )}
            {/* Contact info grid */}
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Email</p>
                {link.tenant_email ? (
                  <p className="mt-0.5 text-xs">{link.tenant_email}</p>
                ) : (
                  <p className="text-muted-foreground/50 mt-0.5 text-xs italic">None</p>
                )}
              </div>
              {link.phone && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Phone</p>
                  <p className="mt-0.5 text-xs">{formatPhone(link.phone) ?? link.phone}</p>
                </div>
              )}
              {link.ec_name && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Emergency Contact</p>
                  <p className="mt-0.5 text-xs">{link.ec_name}</p>
                </div>
              )}
              {link.ec_phone && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Emergency Phone</p>
                  <p className="mt-0.5 text-xs">{formatPhone(link.ec_phone) ?? link.ec_phone}</p>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                <Link
                  href={`/work-orders?create=1&prefill_property=${encodeURIComponent(link.property_id)}${link.unit ? `&prefill_unit=${encodeURIComponent(link.unit)}` : ''}`}
                >
                  <Wrench className="h-3 w-3" />
                  Create work order
                </Link>
              </Button>
            </div>

            {/* Landlord notes */}
            <div className="space-y-2 border-t pt-3">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Notes <span className="font-normal normal-case">(private)</span>
              </p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add private notes about this tenant…"
                className="min-h-[72px] resize-none text-sm"
                disabled={saving}
              />
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button size="sm" onClick={handleSaveNotes} disabled={saving} className="gap-1.5">
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                )}
                {saved && !isDirty && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Saved
                  </span>
                )}
                {saveError && <p className="text-destructive text-xs">{saveError}</p>}
              </div>
            </div>

            {/* Lease information */}
            <LeaseSection linkId={link.id} initialLease={link.lease} />

            {/* Lease documents */}
            <LeaseDocuments linkId={link.id} initialDocs={link.documents} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cleanup button (orphaned link — account deleted) ───────────────────────────

function CleanupButton({ linkId }: { linkId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 shrink-0 gap-1.5 px-2 text-xs hover:text-destructive"
        title="Remove orphaned link"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await removeTenant(linkId, false);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to remove');
            }
          });
        }}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        Remove
      </Button>
      {error && <p className="text-destructive mt-0.5 text-xs">{error}</p>}
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
            <p
              className="truncate text-sm font-medium"
              title={link.tenant_name && link.tenant_email ? link.tenant_email : undefined}
            >
              {link.tenant_name ?? link.tenant_email ?? '—'}
            </p>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {link.property?.name ?? 'Unknown property'}
              </span>
              {link.unit && <span>· {formatUnit(link.unit, link.unit_label_type ?? link.property?.unit_label_type)}</span>}
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
  const [mode, setMode] = useState<'email' | 'manual'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [unit, setUnit] = useState('');
  const [unitLabelType, setUnitLabelType] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // When property changes, default the label type dropdown to that property's setting.
  const selectedProperty = properties.find((p) => p.id === propertyId) ?? null;
  const effectiveLabelType = unitLabelType || selectedProperty?.unit_label_type || 'unit';

  const reset = () => {
    setEmail('');
    setName('');
    setPropertyId('');
    setUnit('');
    setUnitLabelType('');
    setError('');
    setSuccess(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'manual') {
      if (!name.trim() || !propertyId) {
        setError('Please enter a name and select a property.');
        return;
      }
      startTransition(async () => {
        try {
          await addManualTenant(name.trim(), propertyId, unit, effectiveLabelType);
          setSuccess(true);
          setTimeout(() => handleOpenChange(false), 1600);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to add tenant.');
        }
      });
      return;
    }

    if (!email.trim() || !propertyId) {
      setError('Please fill in all fields.');
      return;
    }
    startTransition(async () => {
      try {
        await inviteTenantByEmail(email.trim(), propertyId, unit, effectiveLabelType);
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
          <DialogTitle>{mode === 'email' ? 'Invite Tenant' : 'Add Tenant'}</DialogTitle>
          <DialogDescription>
            {mode === 'email'
              ? "Grant a tenant immediate access to one of your properties. They'll receive an email with a link to log in."
              : 'Add a tenant for record-keeping only. No email or Nestora account required.'}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium">{mode === 'email' ? 'Invite sent' : 'Tenant added'}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {mode === 'email'
                  ? `${email} now has access and has been notified by email.`
                  : `${name} has been added to the property.`}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-lg border p-1 gap-1">
              <button
                type="button"
                onClick={() => { setMode('email'); setError(''); }}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                  mode === 'email'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Send invite
              </button>
              <button
                type="button"
                onClick={() => { setMode('manual'); setError(''); }}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                  mode === 'manual'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                No email
              </button>
            </div>

            {mode === 'email' ? (
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
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tenant name</label>
                <Input
                  type="text"
                  placeholder="e.g. Jane Smith"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  disabled={isPending}
                  autoFocus
                  required
                />
              </div>
            )}

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
                  <SelectTrigger className="w-full">
                    {/* Base UI extracts label from nested JSX unreliably — derive from state instead */}
                    <span className="flex flex-1 items-center text-left text-sm">
                      {propertyId
                        ? (properties.find((p) => p.id === propertyId)?.name ?? 'Select a property')
                        : <span className="text-muted-foreground">Select a property</span>}
                    </span>
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

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Unit{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <div className="flex gap-2">
                <Select
                  value={effectiveLabelType}
                  onValueChange={(v) => setUnitLabelType(v ?? '')}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-32 shrink-0">
                    <span className="text-sm">{getLabelWord(effectiveLabelType)}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="apt">Apt</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="e.g. 12, B, 3A"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={isPending}
                />
              </div>
              {unit && (
                <p className="text-muted-foreground text-xs">
                  Will display as: <span className="font-medium text-foreground">{getLabelWord(effectiveLabelType)} {unit}</span>
                </p>
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
                {isPending
                  ? (mode === 'email' ? 'Sending…' : 'Adding…')
                  : (mode === 'email' ? 'Send Invite' : 'Add Tenant')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
