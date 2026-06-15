import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, DollarSign, ClipboardList, TrendingUp } from 'lucide-react';

export default async function ReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-6">Please log in to view reports.</div>;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Fetch work orders created this month for counts and costs
  const { data: monthWorkOrders, error: monthError } = await supabase
    .from('work_orders')
    .select(
      `
      id,
      cost,
      status,
      created_at,
      property_id,
      properties (id, name)
    `
    )
    .gte('created_at', startOfMonth);

  if (monthError) {
    // error logged at DB level; UI will show empty data
  }

  // Overall open vs completed (all time, visible to user via RLS)
  const [openCountRes, completedCountRes] = await Promise.all([
    supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
    supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Completed'),
  ]);

  const totalCreatedThisMonth = monthWorkOrders?.length || 0;
  const totalCostThisMonth =
    monthWorkOrders?.reduce((sum, wo) => sum + (Number(wo.cost) || 0), 0) || 0;

  const openWorkOrders = openCountRes.count || 0;
  const completedWorkOrders = completedCountRes.count || 0;

  // Most expensive properties (by total cost on work orders, all time)
  const { data: allCostWOs } = await supabase
    .from('work_orders')
    .select(
      `
      cost,
      properties (id, name)
    `
    )
    .gt('cost', 0);

  // Compute property totals in JS (simple, no complex SQL)
  const propertyCosts: Record<string, { name: string; total: number; count: number }> = {};

  (allCostWOs || []).forEach((wo: any) => {
    const prop = wo.properties;
    if (prop && prop.name) {
      if (!propertyCosts[prop.id]) {
        propertyCosts[prop.id] = { name: prop.name, total: 0, count: 0 };
      }
      propertyCosts[prop.id].total += Number(wo.cost) || 0;
      propertyCosts[prop.id].count += 1;
    }
  });

  const mostExpensiveProperties = Object.values(propertyCosts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5); // top 5

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatMonth = () => {
    return now.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.02em]">
          <BarChart3 className="h-6 w-6" /> Reports &amp; Insights
        </h1>
        <p className="text-muted-foreground mt-1">
          Quick overview of maintenance activity and spending for {formatMonth()}.
        </p>
      </div>

      {/* Key Metrics - mobile friendly grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Work Orders This Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> Work Orders Created
            </CardDescription>
            <CardTitle className="text-3xl tracking-tighter tabular-nums">
              {totalCreatedThisMonth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">This month ({formatMonth()})</p>
          </CardContent>
        </Card>

        {/* Total Costs This Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Maintenance Costs
            </CardDescription>
            <CardTitle className="text-3xl tracking-tighter tabular-nums">
              {formatCurrency(totalCostThisMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">From work orders created this month</p>
          </CardContent>
        </Card>

        {/* Open vs Completed */}
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Open vs Completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 text-center sm:flex-row sm:text-left">
              <div>
                <div className="text-3xl font-semibold tracking-tighter text-amber-600">
                  {openWorkOrders}
                </div>
                <div className="text-muted-foreground text-sm">Open</div>
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tighter text-green-600">
                  {completedWorkOrders}
                </div>
                <div className="text-muted-foreground text-sm">Completed</div>
              </div>
              <div className="text-muted-foreground self-center text-xs sm:ml-auto">
                All time (visible to you)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most Expensive Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Most Expensive Properties</CardTitle>
          <CardDescription>
            Properties with the highest total maintenance spend (all time)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mostExpensiveProperties.length > 0 ? (
            <div className="space-y-3">
              {mostExpensiveProperties.map((prop, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium">{prop.name}</span>
                    <span className="text-muted-foreground text-xs">({prop.count} orders)</span>
                  </div>
                  <div className="font-semibold tabular-nums">{formatCurrency(prop.total)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-4 text-center text-sm">
              No maintenance costs recorded yet. Add costs when creating work orders to see insights
              here.
            </div>
          )}
          <p className="text-muted-foreground mt-4 text-[10px]">
            Tip: Enter costs when creating work orders for accurate spending reports.
          </p>
        </CardContent>
      </Card>

      {/* Footer note */}
      <div className="text-muted-foreground border-t pt-4 text-center text-xs">
        Reports are based on data you can access. Costs are associated with individual work orders.
      </div>
    </div>
  );
}
