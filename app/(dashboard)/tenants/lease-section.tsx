'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type LeaseData, type LeaseInput, upsertLease } from './lease-actions';

type LF = {
  leaseType: 'fixed' | 'month_to_month' | '';
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: string;
  deposit: string;
  notes: string;
};

function toForm(lease: LeaseData | null): LF {
  return {
    leaseType: lease?.lease_type ?? '',
    leaseStart: lease?.lease_start ?? '',
    leaseEnd: lease?.lease_end ?? '',
    monthlyRent: lease?.monthly_rent != null ? String(lease.monthly_rent) : '',
    deposit: lease?.security_deposit != null ? String(lease.security_deposit) : '',
    notes: lease?.notes ?? '',
  };
}

function eqForm(a: LF, b: LF) {
  return (
    a.leaseType === b.leaseType &&
    a.leaseStart === b.leaseStart &&
    a.leaseEnd === b.leaseEnd &&
    a.monthlyRent === b.monthlyRent &&
    a.deposit === b.deposit &&
    a.notes === b.notes
  );
}

export function LeaseSection({
  linkId,
  initialLease,
}: {
  linkId: string;
  initialLease: LeaseData | null;
}) {
  const [form, setForm] = useState<LF>(toForm(initialLease));
  const [savedForm, setSavedForm] = useState<LF>(toForm(initialLease));
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const isDirty = !eqForm(form, savedForm);
  const set = <K extends keyof LF>(key: K, value: LF[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    setSaved(false);
    setError('');
    const input: LeaseInput = {
      lease_type: form.leaseType || null,
      lease_start: form.leaseStart || null,
      lease_end: form.leaseType === 'month_to_month' ? null : (form.leaseEnd || null),
      monthly_rent: form.monthlyRent ? parseFloat(form.monthlyRent) : null,
      security_deposit: form.deposit ? parseFloat(form.deposit) : null,
      notes: form.notes.trim() || null,
    };
    const snapshot: LF = {
      ...form,
      leaseEnd: form.leaseType === 'month_to_month' ? '' : form.leaseEnd,
    };
    startSaving(async () => {
      try {
        await upsertLease(linkId, input);
        setSavedForm(snapshot);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save.');
      }
    });
  };

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Lease Information
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Lease type */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px]">Type</p>
          <Select
            value={form.leaseType}
            onValueChange={(v) => set('leaseType', v as LF['leaseType'])}
            disabled={saving}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed term</SelectItem>
              <SelectItem value="month_to_month">Month-to-month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Monthly rent */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px]">Monthly rent</p>
          <div className="relative">
            <span className="text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">
              $
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.monthlyRent}
              onChange={(e) => set('monthlyRent', e.target.value)}
              placeholder="0.00"
              disabled={saving}
              className="h-8 pl-5 text-sm"
            />
          </div>
        </div>

        {/* Security deposit */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px]">Security deposit</p>
          <div className="relative">
            <span className="text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">
              $
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.deposit}
              onChange={(e) => set('deposit', e.target.value)}
              placeholder="0.00"
              disabled={saving}
              className="h-8 pl-5 text-sm"
            />
          </div>
        </div>

        {/* Lease start */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px]">Start date</p>
          <Input
            type="date"
            value={form.leaseStart}
            onChange={(e) => set('leaseStart', e.target.value)}
            disabled={saving}
            className="h-8 text-sm"
          />
        </div>

        {/* Lease end — hidden for month-to-month */}
        {form.leaseType !== 'month_to_month' && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-[11px]">End date</p>
            <Input
              type="date"
              value={form.leaseEnd}
              onChange={(e) => set('leaseEnd', e.target.value)}
              disabled={saving}
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-[11px]">Notes</p>
        <Textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Renewal terms, special conditions…"
          className="min-h-[56px] resize-none text-sm"
          disabled={saving}
        />
      </div>

      <div className="flex items-center gap-2">
        {isDirty && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? 'Saving…' : 'Save lease info'}
          </Button>
        )}
        {saved && !isDirty && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </div>
  );
}
