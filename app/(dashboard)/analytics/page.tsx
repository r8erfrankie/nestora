import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, CheckCircle2, Clock, Archive } from 'lucide-react';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(num: number, denom: number) {
  if (!denom) return '—';
  return `${Math.round((num / denom) * 100)}%`;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [{ data: workOrders }, { data: properties }] = await Promise.all([
    supabase.from('work_orders').select('id, status, priority, cost, created_at, updated_at, property_id, properties(id, name)'),
    supabase.from('properties').select('id, name'),
  ]);

  const wos = workOrders ?? [];
  const props = properties ?? [];

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  for (const wo of wos) {
    statusCounts[wo.status] = (statusCounts[wo.status] ?? 0) + 1;
  }
  const STATUS_ORDER = ['Open', 'In Progress', 'Completed', 'Archived'];

  // ── Priority breakdown ─────────────────────────────────────────────────────
  const priorityCounts: Record<string, number> = {};
  for (const wo of wos) {
    priorityCounts[wo.priority] = (priorityCounts[wo.priority] ?? 0) + 1;
  }
  const PRIORITY_ORDER = ['Urgent', 'High', 'Medium', 'Low'];

  // ── Monthly activity (last 6 months) ──────────────────────────────────────
  const now = new Date();
  const months: { label: string; year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }

  const monthlyStats = months.map(({ label, year, month }) => {
    const created = wos.filter((wo) => {
      const d = new Date(wo.created_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const completed = wos.filter((wo) => {
      const d = new Date(wo.updated_at);
      return wo.status === 'Completed' && d.getFullYear() === year && d.getMonth() === month;
    });
    const cost = created.reduce((s, wo) => s + (Number(wo.cost) || 0), 0);
    return { label, created: created.length, completed: completed.length, cost };
  });

  // ── Per-property breakdown ─────────────────────────────────────────────────
  const propMap: Record<string, { name: string; total: number; completed: number; open: number; cost: number }> = {};
  for (const p of props) {
    propMap[p.id] = { name: p.name, total: 0, completed: 0, open: 0, cost: 0 };
  }
  for (const wo of wos) {
    const pid = wo.property_id;
    if (!propMap[pid]) continue;
    propMap[pid].total += 1;
    propMap[pid].cost += Number(wo.cost) || 0;
    if (wo.status === 'Completed') propMap[pid].completed += 1;
    if (wo.status === 'Open' || wo.status === 'In Progress') propMap[pid].open += 1;
  }
  const propRows = Object.values(propMap).sort((a, b) => b.total - a.total);

  const statusIcon: Record<string, React.ReactNode> = {
    Open: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    'In Progress': <TrendingUp className="h-3.5 w-3.5 text-blue-500" />,
    Completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    Archived: <Archive className="h-3.5 w-3.5 text-muted-foreground" />,
  };

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.02em]">
          <BarChart3 className="h-6 w-6" /> Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          Performance metrics, trends, and breakdowns across your portfolio.
        </p>
      </div>

      {/* Status + Priority side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Work Order Status</CardTitle>
            <CardDescription>Breakdown of all work orders by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {wos.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">No work orders yet.</p>
            ) : (
              <div className="space-y-2">
                {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => {
                  const count = statusCounts[s] ?? 0;
                  const barPct = Math.round((count / wos.length) * 100);
                  return (
                    <div key={s} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          {statusIcon[s]}
                          {s}
                        </span>
                        <span className="tabular-nums font-medium">
                          {count} <span className="text-muted-foreground font-normal">({barPct}%)</span>
                        </span>
                      </div>
                      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="h-2 rounded-full bg-primary/60 transition-all"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Priority Distribution</CardTitle>
            <CardDescription>How work orders are distributed by urgency</CardDescription>
          </CardHeader>
          <CardContent>
            {wos.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">No work orders yet.</p>
            ) : (
              <div className="space-y-2">
                {PRIORITY_ORDER.filter((p) => priorityCounts[p]).map((p) => {
                  const count = priorityCounts[p] ?? 0;
                  const barPct = Math.round((count / wos.length) * 100);
                  const color =
                    p === 'Urgent' ? 'bg-red-500' :
                    p === 'High'   ? 'bg-orange-400' :
                    p === 'Medium' ? 'bg-yellow-400' :
                                     'bg-muted-foreground/40';
                  return (
                    <div key={p} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{p}</span>
                        <span className="tabular-nums font-medium">
                          {count} <span className="text-muted-foreground font-normal">({barPct}%)</span>
                        </span>
                      </div>
                      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly activity table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly Activity</CardTitle>
          <CardDescription>Work orders created and completed over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4 text-left font-medium">Month</th>
                <th className="pb-2 pr-4 text-right font-medium">Created</th>
                <th className="pb-2 pr-4 text-right font-medium">Completed</th>
                <th className="pb-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthlyStats.map((row) => (
                <tr key={row.label} className="hover:bg-muted/40">
                  <td className="py-2.5 pr-4 font-medium">{row.label}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{row.created}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    <span className={row.completed > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                      {row.completed}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {row.cost > 0 ? formatCurrency(row.cost) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Per-property breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Property Breakdown</CardTitle>
          <CardDescription>Work order volume and maintenance spend per property</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {propRows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No properties with work orders yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs uppercase tracking-wide">
                  <th className="pb-2 pr-4 text-left font-medium">Property</th>
                  <th className="pb-2 pr-4 text-right font-medium">Total</th>
                  <th className="pb-2 pr-4 text-right font-medium">Open</th>
                  <th className="pb-2 pr-4 text-right font-medium">Completed</th>
                  <th className="pb-2 pr-4 text-right font-medium">Rate</th>
                  <th className="pb-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {propRows.map((p) => (
                  <tr key={p.name} className="hover:bg-muted/40">
                    <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{p.total}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span className={p.open > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                        {p.open}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span className={p.completed > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                        {p.completed}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                      {pct(p.completed, p.total)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {p.cost > 0 ? formatCurrency(p.cost) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
