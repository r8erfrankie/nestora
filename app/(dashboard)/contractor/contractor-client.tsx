'use client';

import { useOptimistic, useTransition, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Calendar,
  Building2,
  Wrench,
  ChevronRight,
  PlayCircle,
  Archive,
  ArchiveRestore,
  RefreshCw,
} from 'lucide-react';
import { acceptOrCompleteWorkOrder } from './contractor-actions';
import { archiveWorkOrderForUser, unarchiveWorkOrderForUser } from '@/app/actions/archive-actions';
import { formatUnit } from '@/lib/unit-label';

export interface ContractorWorkOrder {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  unit: string | null;
  trade: string | null;
  notes: string | null;
  cost: number | null;
  contractor_quote: number | null;
  created_at: string;
  updated_at: string;
  properties: { id: string; name: string; address: string | null; unit_label_type?: string | null } | null;
}

const STATUS_BADGE: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'On Hold': 'bg-orange-100 text-orange-800',
  'Needs Materials': 'bg-purple-100 text-purple-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Archived: 'bg-muted text-muted-foreground',
};

const PRIORITY_BADGE: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-muted text-muted-foreground',
};

const STATUS_ORDER: Record<string, number> = {
  Open: 0,
  'In Progress': 1,
  'On Hold': 2,
  'Needs Materials': 3,
  Completed: 4,
  Archived: 5,
};

function formatDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

export function ContractorClient({
  workOrders: initialOrders,
  greeting,
  firstName,
  archivedWorkOrderIds,
  currentUserId = '',
}: {
  workOrders: ContractorWorkOrder[];
  greeting: string;
  firstName: string | null;
  archivedWorkOrderIds: string[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  }, [router]);

  const [isPending, startTransition] = useTransition();
  const [orders, setOrders] = useState(initialOrders);
  const [optimisticOrders, applyOptimistic] = useOptimistic(
    orders,
    (
      state: ContractorWorkOrder[],
      update: { id: string; changes: Partial<ContractorWorkOrder> }
    ) => state.map((w) => (w.id === update.id ? { ...w, ...update.changes } : w))
  );

  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set(archivedWorkOrderIds));
  const [showArchived, setShowArchived] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeOrders = optimisticOrders.filter((w) => !archivedIds.has(w.id));
  const archivedList = orders.filter((w) => archivedIds.has(w.id));

  const sorted = [...activeOrders].sort((a, b) => {
    const sd = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (sd !== 0) return sd;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const openCount = activeOrders.filter((w) => w.status === 'Open').length;
  const inProgressCount = activeOrders.filter((w) => w.status === 'In Progress').length;
  const holdCount = activeOrders.filter((w) => w.status === 'On Hold' || w.status === 'Needs Materials').length;
  const completedCount = activeOrders.filter((w) => w.status === 'Completed').length;

  function handleAcceptJob(wo: ContractorWorkOrder) {
    setActionError(null);
    startTransition(async () => {
      applyOptimistic({ id: wo.id, changes: { status: 'In Progress' } });
      try {
        const result = await acceptOrCompleteWorkOrder(wo.id);
        setOrders((prev) =>
          prev.map((w) => (w.id === wo.id ? { ...w, status: result.newStatus } : w))
        );
      } catch (err: any) {
        setActionError(err?.message ?? 'Failed to accept job');
      }
    });
  }

  async function handleArchive(wo: ContractorWorkOrder) {
    setArchivedIds((prev) => new Set([...prev, wo.id]));
    try {
      await archiveWorkOrderForUser(wo.id);
    } catch {
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(wo.id);
        return next;
      });
      setActionError('Failed to archive work order.');
    }
  }

  async function handleUnarchive(wo: ContractorWorkOrder) {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.delete(wo.id);
      return next;
    });
    try {
      await unarchiveWorkOrderForUser(wo.id);
    } catch {
      setArchivedIds((prev) => new Set([...prev, wo.id]));
      setActionError('Failed to unarchive work order.');
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {activeOrders.length === 0 && archivedList.length === 0
              ? 'No work orders assigned to you yet.'
              : activeOrders.length === 0
                ? 'All your work orders are archived.'
                : `You have ${activeOrders.length} active work order${activeOrders.length !== 1 ? 's' : ''}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh work orders"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {activeOrders.length > 0 && (
        <div className="flex gap-3">
          {openCount > 0 && (
            <div className="flex-1 rounded-lg bg-amber-50 px-3 py-2 text-center">
              <div className="text-xl font-semibold tabular-nums text-amber-700">{openCount}</div>
              <div className="mt-0.5 text-xs text-amber-600">Open</div>
            </div>
          )}
          {inProgressCount > 0 && (
            <div className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-center">
              <div className="text-xl font-semibold tabular-nums text-blue-700">{inProgressCount}</div>
              <div className="mt-0.5 text-xs text-blue-600">In Progress</div>
            </div>
          )}
          {holdCount > 0 && (
            <div className="flex-1 rounded-lg bg-orange-50 px-3 py-2 text-center">
              <div className="text-xl font-semibold tabular-nums text-orange-700">{holdCount}</div>
              <div className="mt-0.5 text-xs text-orange-600">Paused</div>
            </div>
          )}
          {completedCount > 0 && (
            <div className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center">
              <div className="text-xl font-semibold tabular-nums text-emerald-700">{completedCount}</div>
              <div className="mt-0.5 text-xs text-emerald-600">Done</div>
            </div>
          )}
        </div>
      )}

      {actionError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}

      {/* Work order list */}
      {activeOrders.length === 0 && archivedList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center sm:py-16">
            <div className="bg-muted text-muted-foreground mb-3 rounded-full p-4 sm:mb-4">
              <ClipboardList className="h-8 w-8" />
            </div>
            <h3 className="mb-1 text-base font-semibold">No jobs yet</h3>
            <p className="text-muted-foreground max-w-xs text-sm">
              Work orders assigned to your email will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((wo) => {
            const overdue = isOverdue(wo.due_date, wo.status);
            const dueSoon = isDueSoon(wo.due_date);

            return (
              <div
                key={wo.id}
                className="rounded-xl border bg-card transition-shadow hover:shadow-sm"
              >
                {/* Tappable card body navigates to detail page */}
                <button
                  type="button"
                  onClick={() => router.push(`/contractor/work-orders/${wo.id}`)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {wo.properties && (
                        <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{wo.properties.name}</span>
                          {wo.unit && (
                            <span className="font-medium text-foreground/70">
                              {' · '}{formatUnit(wo.unit, wo.properties?.unit_label_type)}
                            </span>
                          )}
                          {wo.properties.address && (
                            <span className="truncate text-muted-foreground/70">
                              {' · '}{wo.properties.address}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="truncate font-semibold leading-snug">{wo.title}</div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[wo.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {wo.status}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_BADGE[wo.priority] ?? 'bg-muted text-muted-foreground'}`}>
                          {wo.priority}
                        </span>
                        {wo.trade && (
                          <span className="bg-muted text-muted-foreground flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium">
                            <Wrench className="h-2.5 w-2.5" />
                            {wo.trade}
                          </span>
                        )}
                        {wo.contractor_quote != null && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                            {formatCurrency(wo.contractor_quote)}
                          </span>
                        )}
                        {wo.due_date && (
                          <span className={`flex items-center gap-0.5 text-[11px] ${overdue ? 'font-semibold text-red-600' : dueSoon ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>
                            <Calendar className="h-3 w-3 shrink-0" />
                            {overdue ? 'Overdue · ' : dueSoon ? 'Due soon · ' : ''}
                            {formatDate(wo.due_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      {/* Archive shortcut for completed cards */}
                      {wo.status === 'Completed' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleArchive(wo); }}
                          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      )}
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                    </div>
                  </div>
                </button>

                {/* Accept Job quick-action — only for Open status */}
                {wo.status === 'Open' && (
                  <div className="border-t px-4 pb-3 pt-2.5">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isPending}
                      onClick={(e) => { e.stopPropagation(); handleAcceptJob(wo); }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Accept Job
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Archived section */}
          {archivedList.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Archive className="h-3.5 w-3.5" />
                {showArchived ? 'Hide archived' : `Show archived (${archivedList.length})`}
              </button>

              {showArchived && (
                <div className="mt-2.5 space-y-2.5">
                  {archivedList.map((wo) => {
                    const overdue = isOverdue(wo.due_date, wo.status);
                    const dueSoon = isDueSoon(wo.due_date);
                    return (
                      <div
                        key={wo.id}
                        className="rounded-xl border bg-card opacity-60 transition-shadow hover:opacity-80"
                      >
                        <button
                          type="button"
                          onClick={() => router.push(`/contractor/work-orders/${wo.id}`)}
                          className="w-full p-4 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {wo.properties && (
                                <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{wo.properties.name}</span>
                                  {wo.unit && (
                                    <span className="font-medium text-foreground/70">
                                      {' · '}{formatUnit(wo.unit, wo.properties?.unit_label_type)}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="truncate font-semibold leading-snug">{wo.title}</div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[wo.status] ?? 'bg-muted text-muted-foreground'}`}>
                                  {wo.status}
                                </span>
                                {wo.due_date && (
                                  <span className={`flex items-center gap-0.5 text-[11px] ${overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                    <Calendar className="h-3 w-3 shrink-0" />
                                    {formatDate(wo.due_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                          </div>
                        </button>
                        <div className="border-t px-4 pb-3 pt-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnarchive(wo)}
                            className="h-8 gap-1.5 text-xs text-muted-foreground"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            Unarchive
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
