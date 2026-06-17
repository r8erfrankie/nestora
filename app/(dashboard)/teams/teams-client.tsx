'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

export interface ContractorStat {
  email: string;
  total: number;
  open: number;
  completed: number;
  lastActivity: string | null;
  workOrders: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    propertyName: string | null;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Archived: 'bg-muted text-muted-foreground',
};

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-muted text-muted-foreground',
};

export function TeamsClient({ contractors }: { contractors: ContractorStat[] }) {
  const [selected, setSelected] = useState<ContractorStat | null>(null);

  if (contractors.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-muted text-muted-foreground mb-4 rounded-full p-4">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No contractors yet</h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            Contractors will appear here once you assign a work order to a contractor email. Go to
            Work Orders and assign one to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Contractor</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Open</th>
              <th className="px-4 py-3 text-right font-medium">Completed</th>
              <th className="px-4 py-3 text-right font-medium">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {contractors.map((c) => (
              <tr
                key={c.email}
                className="hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => setSelected(c)}
              >
                <td className="px-4 py-3 font-medium">{c.email}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.total}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={c.open > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                    {c.open}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={c.completed > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {c.completed}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3 text-right tabular-nums text-xs">
                  {formatDate(c.lastActivity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle className="break-all">{selected.email}</DialogTitle>
              <DialogDescription>
                {selected.total} work order{selected.total !== 1 ? 's' : ''} assigned · {selected.open} open · {selected.completed} completed
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              {selected.workOrders.map((wo) => (
                <div key={wo.id} className="bg-muted/40 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-snug">{wo.title}</span>
                    <div className="flex shrink-0 gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[wo.priority] ?? ''}`}>
                        {wo.priority}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[wo.status] ?? ''}`}>
                        {wo.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {wo.propertyName && <span>{wo.propertyName}</span>}
                    {wo.due_date && (
                      <span className={wo.propertyName ? ' · ' : ''}>
                        Due {new Date(wo.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
