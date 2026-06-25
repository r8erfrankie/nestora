'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { timeAgo, cn } from '@/lib/utils';
import { EyeOff, RotateCcw } from 'lucide-react';
import { archiveTenantRequest, unarchiveTenantRequest } from './tenant-actions';

type Request = {
  id: string;
  property_id: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
};

type PropertyInfo = {
  id: string;
  name: string;
  address: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  Submitted:     'bg-secondary text-secondary-foreground',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Resolved:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Declined:      'bg-destructive/10 text-destructive',
  Withdrawn:     'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-500',
};

const PRIORITY_STYLES: Record<string, string> = {
  Low:    'text-muted-foreground',
  Medium: 'text-yellow-600',
  High:   'text-orange-600',
  Urgent: 'text-destructive font-medium',
};

export function TenantRequestsList({
  requests,
  initialArchivedIds,
  propertyMap,
}: {
  requests: Request[];
  initialArchivedIds: string[];
  propertyMap: Record<string, PropertyInfo>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [archivedIds, setArchivedIds] = useState<Set<string>>(
    new Set(initialArchivedIds)
  );
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const active   = requests.filter((r) => !archivedIds.has(r.id));
  const archived = requests.filter((r) =>  archivedIds.has(r.id));

  const hide = (id: string) => {
    setArchivedIds((prev) => new Set([...prev, id]));
    startTransition(() => { archiveTenantRequest(id); });
  };

  const unhide = (id: string) => {
    setArchivedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    startTransition(() => { unarchiveTenantRequest(id); });
  };

  const archivedCount = archived.length;

  return (
    <div className="space-y-3">
      {/* Section header + tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          My Requests
        </h2>
        {archivedCount > 0 && (
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={cn(
                'font-medium transition-colors',
                tab === 'active'
                  ? 'text-foreground underline underline-offset-4'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setTab('archived')}
              className={cn(
                'font-medium transition-colors',
                tab === 'archived'
                  ? 'text-foreground underline underline-offset-4'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Hidden ({archivedCount})
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Active tab */}
      {tab === 'active' && (
        <>
          {active.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No active requests.{archivedCount > 0 && (
                <> <button type="button" onClick={() => setTab('archived')} className="underline underline-offset-2 hover:text-foreground">View hidden ({archivedCount})</button>.</>
              )}
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {active.map((req) => {
                const prop = propertyMap[req.property_id];
                const statusStyle = STATUS_STYLES[req.status] ?? STATUS_STYLES['Submitted'];
                const priorityStyle = PRIORITY_STYLES[req.priority] ?? '';
                const isResolved = req.status === 'Resolved';

                return (
                  <div
                    key={req.id}
                    className="hover:bg-muted/40 flex cursor-pointer items-start gap-4 px-4 py-3 transition-colors"
                    onClick={() => router.push(`/tenant/requests/${req.id}`)}
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
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                        {req.status}
                      </span>
                      {isResolved ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); hide(req.id); }}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                          title="Hide this request"
                        >
                          <EyeOff className="h-3 w-3" />
                          Hide
                        </button>
                      ) : (
                        <span className={`text-xs ${priorityStyle}`}>{req.priority}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Archived tab */}
      {tab === 'archived' && (
        <>
          {archived.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No hidden requests.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {archived.map((req) => {
                const prop = propertyMap[req.property_id];
                const statusStyle = STATUS_STYLES[req.status] ?? STATUS_STYLES['Submitted'];

                return (
                  <div
                    key={req.id}
                    className="hover:bg-muted/40 flex cursor-pointer items-start gap-4 px-4 py-3 opacity-60 transition-all hover:opacity-100"
                    onClick={() => router.push(`/tenant/requests/${req.id}`)}
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
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                        {req.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); unhide(req.id); }}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                        title="Restore this request"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Unhide
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
