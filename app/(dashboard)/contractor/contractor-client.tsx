'use client';

import { useOptimistic, useTransition, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
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
import { Greeting } from '@/components/greeting';

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
  Accepted: 'bg-teal-100 text-teal-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'On Hold': 'bg-orange-100 text-orange-800',
  'Needs Materials': 'bg-purple-100 text-purple-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Archived: 'bg-muted text-muted-foreground',
};

// Shown only when Urgent — all other priorities are noise on a list card.
const URGENT_BADGE = 'bg-red-100 text-red-700';

const STATUS_ORDER: Record<string, number> = {
  Open: 0,
  Accepted: 1,
  'In Progress': 2,
  'On Hold': 3,
  'Needs Materials': 4,
  Completed: 5,
  Archived: 5,
};

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
  firstName,
  archivedWorkOrderIds,
  currentUserId = '',
}: {
  workOrders: ContractorWorkOrder[];
  firstName: string | null;
  archivedWorkOrderIds: string[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

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

  // Non-archived orders — split into active (working) and completed.
  const nonArchived = optimisticOrders.filter((w) => !archivedIds.has(w.id));
  const activeTabOrders = nonArchived.filter(
    (w) => w.status !== 'Completed' && w.status !== 'Archived'
  );
  const completedTabOrders = nonArchived.filter((w) => w.status === 'Completed');
  const archivedList = orders.filter((w) => archivedIds.has(w.id));

  const sortedActive = [...activeTabOrders].sort((a, b) => {
    const sd = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (sd !== 0) return sd;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  // Completed: most recent first.
  const sortedCompleted = [...completedTabOrders].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );

  const displayList = tab === 'active' ? sortedActive : sortedCompleted;
  const totalNonArchived = nonArchived.length;

  function handleAcceptJob(wo: ContractorWorkOrder) {
    setActionError(null);
    startTransition(async () => {
      applyOptimistic({ id: wo.id, changes: { status: 'Accepted' } });
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
            <Greeting name={firstName} />
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {totalNonArchived === 0 && archivedList.length === 0
              ? 'No work orders assigned to you yet.'
              : totalNonArchived === 0
                ? 'All your work orders are archived.'
                : `${activeTabOrders.length} active · ${completedTabOrders.length} completed`}
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

      {actionError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}

      {totalNonArchived === 0 && archivedList.length === 0 ? (
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
        <div className="space-y-3">
          {/* Segmented control */}
          <div className="flex rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                tab === 'active'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Active
              {activeTabOrders.length > 0 && (
                <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold', tab === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                  {activeTabOrders.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                tab === 'completed'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Completed
              {completedTabOrders.length > 0 && (
                <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold', tab === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                  {completedTabOrders.length}
                </span>
              )}
            </button>
          </div>

          {/* Work order cards */}
          {displayList.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {tab === 'active' ? 'No active work orders.' : 'No completed work orders yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {displayList.map((wo) => {
                const overdue = isOverdue(wo.due_date, wo.status);
                const dueSoon = isDueSoon(wo.due_date);

                return (
                  <div
                    key={wo.id}
                    className="rounded-xl border bg-card transition-shadow hover:shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/contractor/work-orders/${wo.id}`)}
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Property + unit only — no address */}
                          {wo.properties && (
                            <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                              <Building2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{wo.properties.name}</span>
                              {wo.unit && (
                                <span className="text-muted-foreground/70">
                                  {' · '}{formatUnit(wo.unit, wo.properties?.unit_label_type)}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="truncate text-sm font-semibold leading-snug">
                            {wo.title}
                          </div>

                          {/* Badges — status, urgent only, trade, quote, due warnings */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_BADGE[wo.status] ?? 'bg-muted text-muted-foreground')}>
                              {wo.status}
                            </span>
                            {wo.priority === 'Urgent' && (
                              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', URGENT_BADGE)}>
                                Urgent
                              </span>
                            )}
                            {wo.trade && (
                              <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <Wrench className="h-2.5 w-2.5" />
                                {wo.trade}
                              </span>
                            )}
                            {wo.contractor_quote != null && (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                                {formatCurrency(wo.contractor_quote)}
                              </span>
                            )}
                            {overdue && (
                              <span className="text-[11px] font-semibold text-red-600">
                                · Overdue
                              </span>
                            )}
                            {!overdue && dueSoon && (
                              <span className="text-[11px] font-semibold text-amber-600">
                                · Due soon
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </button>

                    {/* Accept Job — Open status only */}
                    {wo.status === 'Open' && (
                      <div className="border-t px-4 pb-3 pt-2">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={(e) => { e.stopPropagation(); handleAcceptJob(wo); }}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          Accept Job
                        </Button>
                      </div>
                    )}

                    {/* Start Job — Accepted status only */}
                    {wo.status === 'Accepted' && (
                      <div className="border-t px-4 pb-3 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={(e) => { e.stopPropagation(); handleAcceptJob(wo); }}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          Start Job
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Archived section — below both tabs */}
          {archivedList.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Archive className="h-3.5 w-3.5" />
                {showArchived ? 'Hide archived' : `Show archived (${archivedList.length})`}
              </button>

              {showArchived && (
                <div className="mt-2 space-y-2">
                  {archivedList.map((wo) => (
                    <div
                      key={wo.id}
                      className="rounded-xl border bg-card opacity-60 transition-shadow hover:opacity-80"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/contractor/work-orders/${wo.id}`)}
                        className="w-full px-4 py-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {wo.properties && (
                              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                                <Building2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">{wo.properties.name}</span>
                                {wo.unit && (
                                  <span className="text-muted-foreground/70">
                                    {' · '}{formatUnit(wo.unit, wo.properties?.unit_label_type)}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="truncate text-sm font-semibold leading-snug">{wo.title}</div>
                            <div className="mt-1.5">
                              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_BADGE[wo.status] ?? 'bg-muted text-muted-foreground')}>
                                {wo.status}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                      </button>
                      <div className="border-t px-4 pb-3 pt-2">
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
