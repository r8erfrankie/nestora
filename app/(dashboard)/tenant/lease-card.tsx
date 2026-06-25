import { FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';

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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-xs font-medium leading-tight">{value}</p>
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

  const leaseTypeLabel =
    lease?.lease_type === 'month_to_month'
      ? 'Month-to-month'
      : lease?.lease_type === 'fixed'
        ? 'Fixed term'
        : null;

  const endLabel =
    lease?.lease_end
      ? formatDate(lease.lease_end)
      : lease?.lease_type === 'month_to_month'
        ? 'Ongoing'
        : null;

  const details: { label: string; value: string }[] = [
    ...(leaseTypeLabel ? [{ label: 'Type', value: leaseTypeLabel }] : []),
    ...(lease?.lease_start ? [{ label: 'Start', value: formatDate(lease.lease_start) }] : []),
    ...(lease?.security_deposit != null
      ? [{ label: 'Deposit', value: formatCurrency(lease.security_deposit) }]
      : []),
    ...(endLabel ? [{ label: 'End', value: endLabel }] : []),
  ];

  return (
    <Card className="p-4">
      {/* Header row: LEASE chip left, monthly rent right */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
          <FileText className="h-3 w-3" />
          Lease
        </span>
        {lease?.monthly_rent != null && (
          <span className="text-lg font-bold leading-none">
            {formatCurrency(lease.monthly_rent)}
            <span className="text-muted-foreground ml-1 text-xs font-normal">/mo</span>
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-muted-foreground/60 text-xs">No lease details yet.</p>
      ) : (
        <>
          {details.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {details.map((d) => (
                <Detail key={d.label} label={d.label} value={d.value} />
              ))}
            </div>
          )}
          {lease?.notes && (
            <p className="text-muted-foreground mt-2.5 border-t pt-2 text-xs leading-relaxed">
              {lease.notes}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
