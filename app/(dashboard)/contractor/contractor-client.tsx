'use client';

import { useOptimistic, useTransition, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ClipboardList,
  Calendar,
  Building2,
  Wrench,
  ChevronRight,
  DollarSign,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';
import { acceptOrCompleteWorkOrder, saveContractorQuote } from './contractor-actions';

export interface ContractorWorkOrder {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  trade: string | null;
  notes: string | null;
  cost: number | null;
  contractor_quote: number | null;
  created_at: string;
  updated_at: string;
  properties: { id: string; name: string; address: string | null } | null;
}

const STATUS_BADGE: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Archived: 'bg-muted text-muted-foreground',
};

const PRIORITY_BADGE: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-muted text-muted-foreground',
};

// Work orders sorted: Open first, then In Progress, Completed last, within each by due date
const STATUS_ORDER: Record<string, number> = {
  Open: 0,
  'In Progress': 1,
  Completed: 2,
  Archived: 3,
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

// ── Quote input ──────────────────────────────────────────────────────────────

function QuoteSection({
  workOrderId,
  currentQuote,
  onSaved,
}: {
  workOrderId: string;
  currentQuote: number | null;
  onSaved: (quote: number) => void;
}) {
  const [value, setValue] = useState(currentQuote != null ? String(currentQuote) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reset when the dialog opens a different work order
  // (key prop on QuoteSection handles this)

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveContractorQuote(workOrderId, value);
      onSaved(result.quote);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  }

  const isDirty = value !== (currentQuote != null ? String(currentQuote) : '');

  return (
    <div>
      <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
        Your Quote
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <DollarSign className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className="pl-8"
          />
        </div>
        <Button
          size="sm"
          variant={saved ? 'outline' : 'default'}
          disabled={saving || !isDirty || !value.trim()}
          onClick={handleSave}
          className="shrink-0"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {currentQuote != null && !isDirty && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          Current quote: {formatCurrency(currentQuote)}
        </p>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ContractorClient({
  workOrders: initialOrders,
  greeting,
  firstName,
}: {
  workOrders: ContractorWorkOrder[];
  greeting: string;
  firstName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticOrders, applyOptimistic] = useOptimistic(
    initialOrders,
    (
      state: ContractorWorkOrder[],
      update: { id: string; changes: Partial<ContractorWorkOrder> }
    ) => state.map((w) => (w.id === update.id ? { ...w, ...update.changes } : w))
  );

  // Store only the selected ID; derive the full object from optimisticOrders
  // so status/quote updates flow into the open dialog automatically.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = selectedId ? (optimisticOrders.find((w) => w.id === selectedId) ?? null) : null;

  const sorted = [...optimisticOrders].sort((a, b) => {
    const sd = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
    if (sd !== 0) return sd;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const openCount = optimisticOrders.filter((w) => w.status === 'Open').length;
  const inProgressCount = optimisticOrders.filter((w) => w.status === 'In Progress').length;
  const completedCount = optimisticOrders.filter((w) => w.status === 'Completed').length;

  function handleStatusAction(wo: ContractorWorkOrder) {
    const nextStatus = wo.status === 'Open' ? 'In Progress' : 'Completed';
    setActionError(null);

    startTransition(async () => {
      // Optimistic update
      applyOptimistic({ id: wo.id, changes: { status: nextStatus } });
      try {
        await acceptOrCompleteWorkOrder(wo.id, wo.status);
      } catch (err: any) {
        setActionError(err?.message ?? 'Action failed');
        // Revert
        applyOptimistic({ id: wo.id, changes: { status: wo.status } });
      }
    });
  }

  function handleQuoteSaved(woId: string, quote: number) {
    applyOptimistic({ id: woId, changes: { contractor_quote: quote } });
  }

  const canAct = (status: string) => status === 'Open' || status === 'In Progress';

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {optimisticOrders.length === 0
            ? 'No work orders assigned to you yet.'
            : `You have ${optimisticOrders.length} assigned work order${optimisticOrders.length !== 1 ? 's' : ''}.`}
        </p>
      </div>

      {/* Stats */}
      {optimisticOrders.length > 0 && (
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
          {completedCount > 0 && (
            <div className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center">
              <div className="text-xl font-semibold tabular-nums text-emerald-700">{completedCount}</div>
              <div className="mt-0.5 text-xs text-emerald-600">Completed</div>
            </div>
          )}
        </div>
      )}

      {/* Global action error */}
      {actionError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}

      {/* Work order list */}
      {optimisticOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted text-muted-foreground mb-4 rounded-full p-4">
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
                {/* Tappable main area */}
                <button
                  type="button"
                  onClick={() => setSelectedId(wo.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {wo.properties && (
                        <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{wo.properties.name}</span>
                          {wo.properties.address && (
                            <span className="truncate text-muted-foreground/70">
                              {' · '}
                              {wo.properties.address}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="truncate font-semibold leading-snug">{wo.title}</div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[wo.status] ?? 'bg-muted text-muted-foreground'}`}
                        >
                          {wo.status}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_BADGE[wo.priority] ?? 'bg-muted text-muted-foreground'}`}
                        >
                          {wo.priority}
                        </span>
                        {wo.trade && (
                          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium">
                            {wo.trade}
                          </span>
                        )}
                        {wo.contractor_quote != null && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                            {formatCurrency(wo.contractor_quote)}
                          </span>
                        )}
                        {wo.due_date && (
                          <span
                            className={`flex items-center gap-0.5 text-[11px] ${
                              overdue
                                ? 'font-semibold text-red-600'
                                : dueSoon
                                  ? 'font-semibold text-amber-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            <Calendar className="h-3 w-3 shrink-0" />
                            {overdue ? 'Overdue · ' : dueSoon ? 'Due soon · ' : ''}
                            {formatDate(wo.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  </div>
                </button>

                {/* Quick-action strip — visible only for actionable statuses */}
                {canAct(wo.status) && (
                  <div className="border-t px-4 pb-3 pt-2.5">
                    <Button
                      size="sm"
                      variant={wo.status === 'Open' ? 'default' : 'outline'}
                      disabled={isPending}
                      onClick={() => handleStatusAction(wo)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      {wo.status === 'Open' ? (
                        <>
                          <PlayCircle className="h-3.5 w-3.5" />
                          Accept Job
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Complete
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail + action dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected && (
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-[520px]">
            <DialogHeader>
              <div className="flex items-start gap-3 pr-6">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl leading-snug">{selected.title}</DialogTitle>
                  {selected.properties && (
                    <DialogDescription className="mt-1 flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {selected.properties.name}
                      {selected.properties.address && ` · ${selected.properties.address}`}
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 pt-1">
              {/* Status + Priority + Trade badges */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-md px-2.5 py-1 text-sm font-medium ${STATUS_BADGE[selected.status] ?? 'bg-muted text-muted-foreground'}`}
                >
                  {selected.status}
                </span>
                <span
                  className={`rounded-md px-2.5 py-1 text-sm font-medium ${PRIORITY_BADGE[selected.priority] ?? 'bg-muted text-muted-foreground'}`}
                >
                  {selected.priority} priority
                </span>
                {selected.trade && (
                  <Badge variant="secondary" className="px-2.5 py-1 text-sm">
                    <Wrench className="mr-1.5 h-3.5 w-3.5" />
                    {selected.trade}
                  </Badge>
                )}
              </div>

              {/* Due date */}
              {selected.due_date && (
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
                    Due Date
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-sm font-medium ${
                      isOverdue(selected.due_date, selected.status)
                        ? 'text-red-600'
                        : isDueSoon(selected.due_date)
                          ? 'text-amber-600'
                          : ''
                    }`}
                  >
                    <Calendar className="h-4 w-4 shrink-0" />
                    {formatDate(selected.due_date)}
                    {isOverdue(selected.due_date, selected.status) && (
                      <span className="text-xs font-semibold text-red-600"> · Overdue</span>
                    )}
                    {isDueSoon(selected.due_date) && (
                      <span className="text-xs font-semibold text-amber-600"> · Due soon</span>
                    )}
                  </div>
                </div>
              )}

              {/* Status action */}
              {canAct(selected.status) && (
                <div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                    Update Status
                  </div>
                  <Button
                    variant={selected.status === 'Open' ? 'default' : 'outline'}
                    disabled={isPending}
                    onClick={() => handleStatusAction(selected)}
                    className="w-full gap-2"
                  >
                    {selected.status === 'Open' ? (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        Accept Job — move to In Progress
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Complete
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Quote — always available while not Archived */}
              {selected.status !== 'Archived' && (
                <QuoteSection
                  key={selected.id}
                  workOrderId={selected.id}
                  currentQuote={selected.contractor_quote}
                  onSaved={(quote) => handleQuoteSaved(selected.id, quote)}
                />
              )}

              {/* Description */}
              {selected.description && (
                <div>
                  <div className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wider">
                    Description
                  </div>
                  <p className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {selected.description}
                  </p>
                </div>
              )}

              {/* Notes from landlord */}
              {selected.notes && (
                <div>
                  <div className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wider">
                    Notes
                  </div>
                  <p className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {selected.notes}
                  </p>
                </div>
              )}

              {/* Footer meta */}
              <div className="border-border/60 border-t pt-3 text-xs text-muted-foreground">
                Created {formatDate(selected.created_at)}
                {selected.updated_at !== selected.created_at &&
                  ` · Updated ${formatDate(selected.updated_at)}`}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
