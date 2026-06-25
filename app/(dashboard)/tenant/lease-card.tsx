import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type LeaseSummary = {
  lease_type: string | null;
  lease_start: string | null;
  lease_end: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  notes: string | null;
};

function formatDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}

export function LeaseSummaryPanel({ lease }: { lease: LeaseSummary | undefined }) {
  const hasData =
    lease &&
    (lease.monthly_rent != null ||
      lease.lease_type ||
      lease.lease_start ||
      lease.security_deposit != null ||
      lease.notes);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <FileText className="h-3.5 w-3.5" />
          Lease
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-center pb-4 pt-0">
        {!hasData ? (
          <p className="text-muted-foreground/60 text-sm">No lease details yet.</p>
        ) : (
          <div className="space-y-3">
            {/* Monthly rent — headline figure */}
            {lease.monthly_rent != null && (
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {formatCurrency(lease.monthly_rent)}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">/mo</span>
                </p>
              </div>
            )}

            {/* Details grid */}
            <div className="space-y-1.5">
              {lease.lease_type && (
                <Row
                  label="Type"
                  value={lease.lease_type === 'month_to_month' ? 'Month-to-month' : 'Fixed term'}
                />
              )}
              {lease.lease_start && (
                <Row label="Start" value={formatDate(lease.lease_start)} />
              )}
              {lease.lease_end ? (
                <Row label="End" value={formatDate(lease.lease_end)} />
              ) : lease.lease_type === 'month_to_month' ? (
                <Row label="End" value="Ongoing" />
              ) : null}
              {lease.security_deposit != null && (
                <Row label="Deposit" value={formatCurrency(lease.security_deposit)} />
              )}
            </div>

            {/* Notes */}
            {lease.notes && (
              <p className="text-muted-foreground border-t pt-2 text-xs leading-relaxed">
                {lease.notes}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
