'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  MapPin,
  PauseCircle,
  Pencil,
  PlayCircle,
  ShoppingCart,
  Wrench,
  X,
} from 'lucide-react';
import { WorkOrderPhotoUploader, type UploadedPhoto } from '@/app/components/work-order-photo-uploader';
import { WorkOrderNotes } from '@/app/components/work-order-notes';
import {
  updateWorkOrderStatus,
  saveContractorQuote,
} from '../../contractor-actions';
import {
  archiveWorkOrderForUser,
  unarchiveWorkOrderForUser,
} from '@/app/actions/archive-actions';
import { formatUnit } from '@/lib/unit-label';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  unit: string | null;
  trade: string | null;
  notes: string | null;
  contractor_quote: number | null;
  created_at: string;
  updated_at: string;
  properties: {
    id: string;
    name: string;
    address: string | null;
    unit_label_type?: string | null;
  } | null;
}

interface Photo {
  id: string;
  url: string;
  name: string | null;
  created_at: string;
  uploaded_by_role?: string | null;
  uploaded_by?: string | null;
}

interface Props {
  workOrder: WorkOrder;
  initialPhotos: Photo[];
  isArchived: boolean;
  currentUserId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'On Hold': 'bg-orange-100 text-orange-800',
  'Needs Materials': 'bg-purple-100 text-purple-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Archived: 'bg-muted text-muted-foreground',
};

const PRIORITY_STYLES: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-muted text-muted-foreground',
};

// Status options available from each active state (excludes Completed — handled by sticky bar).
const STATUS_CHIPS: Record<string, { label: string; icon: React.ReactNode; style: string }[]> = {
  'In Progress': [
    { label: 'On Hold', icon: <PauseCircle className="h-3.5 w-3.5" />, style: 'bg-orange-100 text-orange-800 hover:bg-orange-200' },
    { label: 'Needs Materials', icon: <ShoppingCart className="h-3.5 w-3.5" />, style: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
  ],
  'On Hold': [
    { label: 'In Progress', icon: <PlayCircle className="h-3.5 w-3.5" />, style: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
    { label: 'Needs Materials', icon: <ShoppingCart className="h-3.5 w-3.5" />, style: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
  ],
  'Needs Materials': [
    { label: 'In Progress', icon: <PlayCircle className="h-3.5 w-3.5" />, style: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
    { label: 'On Hold', icon: <PauseCircle className="h-3.5 w-3.5" />, style: 'bg-orange-100 text-orange-800 hover:bg-orange-200' },
  ],
};

function formatDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isDueSoon(due: string | null) {
  if (!due) return false;
  const diff = new Date(due).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function isOverdue(due: string | null, status: string) {
  if (!due || status === 'Completed' || status === 'Archived') return false;
  return new Date(due).getTime() < Date.now();
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkOrderDetailClient({ workOrder, initialPhotos, isArchived: initialIsArchived, currentUserId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Work order status — optimistically updated.
  const [status, setStatus] = useState(workOrder.status);
  const [quote, setQuote] = useState(workOrder.contractor_quote);
  const [archived, setArchived] = useState(initialIsArchived);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);

  // Photo state
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Description expand
  const [descExpanded, setDescExpanded] = useState(false);

  // Quote editing
  const [quoteEditing, setQuoteEditing] = useState(quote == null);
  const [quoteInput, setQuoteInput] = useState(quote != null ? String(quote) : '');
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSaved, setQuoteSaved] = useState(false);

  // Completion flow
  const [completionMode, setCompletionMode] = useState(false);
  const [completionNote, setCompletionNote] = useState('');

  // General status update
  const [statusError, setStatusError] = useState('');
  const [isPending, startTransition] = useTransition();

  const isActionable = !['Completed', 'Archived'].includes(status);
  const chips = STATUS_CHIPS[status] ?? [];
  const overdue = isOverdue(workOrder.due_date, status);
  const dueSoon = isDueSoon(workOrder.due_date);
  const address = workOrder.properties?.address ?? null;
  const unitLabel = workOrder.unit
    ? formatUnit(workOrder.unit, workOrder.properties?.unit_label_type)
    : null;

  // ── Status change ──────────────────────────────────────────────────────────

  function handleStatusChange(newStatus: string) {
    setStatusError('');
    const prev = status;
    setStatus(newStatus);
    startTransition(async () => {
      try {
        const result = await updateWorkOrderStatus(workOrder.id, newStatus);
        setStatus(result.newStatus);
        setNotesRefreshKey((k) => k + 1);
      } catch (err) {
        setStatus(prev);
        setStatusError(err instanceof Error ? err.message : 'Failed to update status');
      }
    });
  }

  async function handleAccept() {
    setStatusError('');
    const prev = status;
    setStatus('In Progress');
    startTransition(async () => {
      try {
        const result = await updateWorkOrderStatus(workOrder.id, 'In Progress');
        setStatus(result.newStatus);
        setNotesRefreshKey((k) => k + 1);
      } catch (err) {
        setStatus(prev);
        setStatusError(err instanceof Error ? err.message : 'Failed to accept job');
      }
    });
  }

  async function handleComplete() {
    setStatusError('');
    const prev = status;
    setStatus('Completed');
    setCompletionMode(false);
    startTransition(async () => {
      try {
        const result = await updateWorkOrderStatus(workOrder.id, 'Completed', completionNote);
        setStatus(result.newStatus);
        setNotesRefreshKey((k) => k + 1);
        setCompletionNote('');
      } catch (err) {
        setStatus(prev);
        setCompletionMode(true);
        setStatusError(err instanceof Error ? err.message : 'Failed to mark as complete');
      }
    });
  }

  // ── Quote ──────────────────────────────────────────────────────────────────

  async function handleSaveQuote() {
    setQuoteError('');
    setQuoteSaving(true);
    setQuoteSaved(false);
    try {
      const result = await saveContractorQuote(workOrder.id, quoteInput);
      setQuote(result.quote);
      setQuoteEditing(false);
      setQuoteSaved(true);
      setTimeout(() => setQuoteSaved(false), 2000);
      setNotesRefreshKey((k) => k + 1);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Failed to save quote');
    } finally {
      setQuoteSaving(false);
    }
  }

  // ── Photos ─────────────────────────────────────────────────────────────────

  async function deleteSinglePhoto(photo: Photo) {
    if (!confirm('Delete this photo?')) return;
    try {
      const marker = '/work-order-photos/';
      const idx = photo.url.indexOf(marker);
      const path = idx !== -1 ? photo.url.substring(idx + marker.length).split('?')[0] : null;
      if (path) await supabase.storage.from('work-order-photos').remove([path]);
      const { error } = await supabase.from('work_order_photos').delete().eq('id', photo.id);
      if (error) throw error;
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setLightboxOpen(false);
    } catch {
      alert('Failed to delete photo.');
    }
  }

  // ── Archive ────────────────────────────────────────────────────────────────

  async function handleArchiveToggle() {
    const wasArchived = archived;
    setArchived(!wasArchived);
    try {
      if (wasArchived) {
        await unarchiveWorkOrderForUser(workOrder.id);
      } else {
        await archiveWorkOrderForUser(workOrder.id);
        router.push('/contractor');
      }
    } catch {
      setArchived(wasArchived);
    }
  }

  // ── Quote isDirty check ────────────────────────────────────────────────────

  const quoteIsDirty = quoteInput !== (quote != null ? String(quote) : '');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Scrollable content — pb accounts for sticky action bar + bottom nav */}
      <div className="pb-32 space-y-5">

        {/* Back link */}
        <Link
          href="/contractor"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          My Work
        </Link>

        {/* ── Title + Property + Due Date ── */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {workOrder.title}
            </h1>
            <span className={cn('mt-0.5 shrink-0 rounded-md px-2.5 py-1 text-sm font-medium', STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground')}>
              {status}
            </span>
          </div>

          {workOrder.properties && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-foreground">{workOrder.properties.name}</span>
                {unitLabel && <span className="text-muted-foreground">· {unitLabel}</span>}
              </div>
              {address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{address}</span>
                  <a
                    href={mapsUrl(address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                  >
                    Directions
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Due date */}
          {workOrder.due_date && (
            <div className={cn('flex items-center gap-1.5 text-sm font-medium', overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-muted-foreground')}>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {formatDate(workOrder.due_date)}
              {overdue && <span className="text-xs font-semibold"> · Overdue</span>}
              {dueSoon && !overdue && <span className="text-xs font-semibold"> · Due soon</span>}
            </div>
          )}

          {/* Priority + Trade badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className={cn('rounded px-2 py-0.5 text-xs font-medium', PRIORITY_STYLES[workOrder.priority] ?? 'bg-muted text-muted-foreground')}>
              {workOrder.priority} priority
            </span>
            {workOrder.trade && (
              <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Wrench className="h-3 w-3" />
                {workOrder.trade}
              </span>
            )}
          </div>
        </div>

        {/* ── Status chips (only for in-progress states) ── */}
        {chips.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Mark as
            </p>
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleStatusChange(chip.label)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                    chip.style
                  )}
                >
                  {chip.icon}
                  {chip.label}
                </button>
              ))}
            </div>
            {statusError && (
              <p className="mt-2 text-xs text-destructive">{statusError}</p>
            )}
          </div>
        )}

        {/* ── Quote ── */}
        {status !== 'Archived' && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your Quote
            </p>
            {!quoteEditing && quote != null ? (
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{formatCurrency(quote)}</span>
                {quoteSaved && <span className="text-xs text-emerald-600">Saved ✓</span>}
                <button
                  type="button"
                  onClick={() => { setQuoteEditing(true); setQuoteInput(String(quote)); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={quoteInput}
                    onChange={(e) => { setQuoteInput(e.target.value); setQuoteSaved(false); }}
                    className="pl-8"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={quoteSaving || !quoteIsDirty || !quoteInput.trim()}
                  onClick={handleSaveQuote}
                  className="shrink-0"
                >
                  {quoteSaving ? 'Saving…' : 'Save'}
                </Button>
                {quote != null && (
                  <Button size="sm" variant="ghost" onClick={() => setQuoteEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
            {quoteError && <p className="mt-1.5 text-xs text-destructive">{quoteError}</p>}
          </div>
        )}

        {/* ── Description ── */}
        {workOrder.description && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </p>
            <p className={cn('rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap', !descExpanded && 'line-clamp-3')}>
              {workOrder.description}
            </p>
            {workOrder.description.length > 160 && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {descExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Notes from landlord */}
        {workOrder.notes && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notes from owner
            </p>
            <p className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">
              {workOrder.notes}
            </p>
          </div>
        )}

        {/* ── Photos ── */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Photos ({photos.length} / 10)
          </p>

          <WorkOrderPhotoUploader
            workOrderId={workOrder.id}
            existingPhotoCount={photos.length}
            currentUserId={currentUserId}
            cameraEnabled
            onUploaded={(newPhotos: UploadedPhoto[]) =>
              setPhotos((prev) => [...prev, ...newPhotos])
            }
          />

          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-md border bg-muted"
                  onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                >
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {/* "Owner" badge for landlord photos */}
                  {photo.uploaded_by_role === 'landlord' && (
                    <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-0.5 text-[10px] leading-none text-white">
                      Owner
                    </div>
                  )}
                  {/* Delete only for photos this contractor uploaded */}
                  {photo.uploaded_by === currentUserId && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteSinglePhoto(photo); }}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                      aria-label="Delete photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {photos.length === 0 && (
            <p className="mt-3 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              No photos yet — use Camera or Gallery above to add evidence.
            </p>
          )}
        </div>

        {/* Lightbox */}
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={lightboxIndex}
          slides={photos.map((p) => ({ src: p.url, alt: p.name ?? '' }))}
          plugins={[Counter]}
        />

        {/* ── Activity ── */}
        <WorkOrderNotes
          workOrderId={workOrder.id}
          refreshKey={notesRefreshKey}
          hideBudgetNotes
        />

        {/* ── Footer ── */}
        <div className="border-t pt-4 text-xs text-muted-foreground">
          Created {formatDate(workOrder.created_at)}
          {workOrder.updated_at !== workOrder.created_at &&
            ` · Updated ${formatDate(workOrder.updated_at)}`}
        </div>

        {/* Archive / Unarchive */}
        <button
          type="button"
          onClick={handleArchiveToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {archived ? 'Unarchive this job' : 'Hide from my list'}
        </button>
      </div>

      {/* ── Sticky action bar ── */}
      {isActionable && (
        <div
          className="fixed bottom-16 left-0 right-0 z-40 border-t bg-background px-4 py-3 lg:bottom-0 lg:left-64"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {completionMode ? (
            <div className="space-y-2">
              <Textarea
                placeholder="What was done? (optional)"
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setCompletionMode(false); setCompletionNote(''); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  disabled={isPending}
                  onClick={handleComplete}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isPending ? 'Saving…' : 'Confirm Complete'}
                </Button>
              </div>
            </div>
          ) : status === 'Open' ? (
            <Button
              className="w-full gap-2"
              disabled={isPending}
              onClick={handleAccept}
            >
              <PlayCircle className="h-4 w-4" />
              {isPending ? 'Accepting…' : 'Accept Job — start work'}
            </Button>
          ) : (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={isPending}
              onClick={() => setCompletionMode(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Complete
            </Button>
          )}
          {statusError && !completionMode && (
            <p className="mt-1.5 text-center text-xs text-destructive">{statusError}</p>
          )}
        </div>
      )}
    </>
  );
}
