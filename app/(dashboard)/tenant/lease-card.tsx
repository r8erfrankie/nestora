import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LeaseInfo = {
  lease_type: string | null;
  lease_start: string | null;
  lease_end: string | null;
  security_deposit: number | null;
  notes: string | null;
  propertyName?: string;
  showPropertyName?: boolean;
};

function formatDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function LeaseDetail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

export function LeaseCard({ leases }: { leases: LeaseInfo[] }) {
  const anyData = leases.some(
    (l) => l.lease_type || l.lease_start || l.lease_end || l.security_deposit != null || l.notes
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="text-muted-foreground h-4 w-4" />
          Lease Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!anyData ? (
          <p className="text-muted-foreground text-sm">
            Lease details have not been added yet.
          </p>
        ) : (
          <div className="space-y-4">
            {leases.map((lease, i) => {
              const hasData =
                lease.lease_type ||
                lease.lease_start ||
                lease.lease_end ||
                lease.security_deposit != null ||
                lease.notes;
              if (!hasData) return null;

              return (
                <div key={i} className="space-y-3">
                  {lease.showPropertyName && lease.propertyName && (
                    <p className="text-muted-foreground text-xs font-medium">{lease.propertyName}</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    {lease.lease_type && (
                      <LeaseDetail
                        label="Type"
                        value={lease.lease_type === 'month_to_month' ? 'Month-to-month' : 'Fixed term'}
                      />
                    )}
                    {lease.security_deposit != null && (
                      <LeaseDetail
                        label="Security deposit"
                        value={formatCurrency(lease.security_deposit)}
                      />
                    )}
                    {lease.lease_start && (
                      <LeaseDetail label="Start date" value={formatDate(lease.lease_start)} />
                    )}
                    {lease.lease_end && (
                      <LeaseDetail label="End date" value={formatDate(lease.lease_end)} />
                    )}
                    {lease.lease_type === 'month_to_month' && !lease.lease_end && (
                      <LeaseDetail label="End date" value="Ongoing" />
                    )}
                  </div>
                  {lease.notes && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Notes
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                        {lease.notes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
