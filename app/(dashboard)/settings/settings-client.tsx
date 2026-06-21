'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { isValidPhoneNumber } from 'libphonenumber-js';
import type { Value } from 'react-phone-number-input';
import { PhoneInput } from '@/components/ui/phone-input';
import { updateProfile } from './actions';
import { DeleteAccountButton } from './delete-account-button';

const CONTRACTOR_TRADES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Roofing',
  'General Handyman',
  'Painting',
  'Flooring',
  'Other',
] as const;

interface SettingsClientProps {
  email: string;
  role: string | null;
  fullName: string | null;
  phone: string | null;
  ecName: string | null;
  ecPhone: string | null;
  companyName: string | null;
  trade: string | null;
}

export function SettingsClient({
  email,
  role,
  fullName,
  phone: initialPhone,
  ecName: initialEcName,
  ecPhone: initialEcPhone,
  companyName: initialCompanyName,
  trade: initialTrade,
}: SettingsClientProps) {
  const [name, setName] = useState(fullName ?? '');
  const [phone, setPhone] = useState<Value | undefined>(
    initialPhone ? (initialPhone as Value) : undefined
  );
  const [ecName, setEcName] = useState(initialEcName ?? '');
  const [ecPhone, setEcPhone] = useState<Value | undefined>(
    initialEcPhone ? (initialEcPhone as Value) : undefined
  );
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [trade, setTrade] = useState<string | null>(initialTrade ?? null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const router = useRouter();
  const isTenant = role === 'tenant';
  const isContractor = role === 'contractor';

  const isDirty =
    name !== (fullName ?? '') ||
    (isTenant && (
      (phone ?? '') !== (initialPhone ?? '') ||
      ecName !== (initialEcName ?? '') ||
      (ecPhone ?? '') !== (initialEcPhone ?? '')
    )) ||
    (isContractor && (
      (phone ?? '') !== (initialPhone ?? '') ||
      companyName !== (initialCompanyName ?? '') ||
      trade !== (initialTrade ?? null)
    ));

  const handleSave = async () => {
    setPhoneError('');
    if (isTenant) {
      if (phone && !isValidPhoneNumber(phone)) {
        setPhoneError('Please enter a valid phone number.');
        return;
      }
      if (ecPhone && !isValidPhoneNumber(ecPhone)) {
        setPhoneError('Please enter a valid emergency contact phone number.');
        return;
      }
    }
    if (isContractor && phone && !isValidPhoneNumber(phone)) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }

    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateProfile({
        full_name: name,
        ...(isTenant && {
          phone: phone ?? null,
          emergency_contact_name: ecName.trim() || null,
          emergency_contact_phone: ecPhone ?? null,
        }),
        ...(isContractor && {
          phone: phone ?? null,
          company_name: companyName.trim() || null,
          trade: trade || null,
        }),
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account and preferences.</p>
      </div>

      <div className="divide-y rounded-none border-y">

        {/* Name row */}
        <div className="flex items-center gap-6 py-4">
          <p className="text-muted-foreground w-28 shrink-0 text-sm">Full name</p>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            placeholder="Your name"
            disabled={saving}
            className="max-w-xs"
          />
        </div>

        {/* Contact Information section header */}
        <div className="py-3">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
            Contact Information
          </p>
        </div>

        {/* Email row */}
        <div className="flex items-start gap-6 py-4">
          <p className="text-muted-foreground w-28 shrink-0 pt-0.5 text-sm">Email</p>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{email}</span>
              <Badge variant="secondary" className="text-xs">verified</Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Managed by magic link — cannot be changed here.
            </p>
          </div>
        </div>

        {/* Phone row — tenants and contractors */}
        {(isTenant || isContractor) && (
          <div className="flex items-center gap-6 py-4">
            <p className="text-muted-foreground w-28 shrink-0 text-sm">Phone</p>
            <div className="max-w-xs flex-1">
              <PhoneInput
                value={phone}
                onChange={(v) => { setPhone(v); setSaved(false); setPhoneError(''); }}
                disabled={saving}
              />
            </div>
          </div>
        )}

        {/* Emergency Contact — tenants only */}
        {isTenant && (
          <>
            <div className="py-3">
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
                Emergency Contact
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Shared with your landlord if needed. Optional.
              </p>
            </div>

            <div className="flex items-center gap-6 py-4">
              <p className="text-muted-foreground w-28 shrink-0 text-sm">Name</p>
              <Input
                value={ecName}
                onChange={(e) => { setEcName(e.target.value); setSaved(false); }}
                placeholder="Contact name"
                disabled={saving}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-6 py-4">
              <p className="text-muted-foreground w-28 shrink-0 text-sm">Phone</p>
              <div className="max-w-xs flex-1">
                <PhoneInput
                  value={ecPhone}
                  onChange={(v) => { setEcPhone(v); setSaved(false); setPhoneError(''); }}
                  disabled={saving}
                />
              </div>
            </div>

            {phoneError && (
              <div className="py-3">
                <p className="text-destructive text-xs">{phoneError}</p>
              </div>
            )}
          </>
        )}

        {/* Professional details — contractors only */}
        {isContractor && (
          <>
            <div className="py-3">
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
                Professional Details
              </p>
            </div>

            <div className="flex items-center gap-6 py-4">
              <p className="text-muted-foreground w-28 shrink-0 text-sm">Company</p>
              <Input
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setSaved(false); }}
                placeholder="Company name (optional)"
                disabled={saving}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-6 py-4">
              <p className="text-muted-foreground w-28 shrink-0 text-sm">Trade</p>
              <Select
                value={trade ?? ''}
                onValueChange={(v) => { setTrade(v); setSaved(false); }}
                disabled={saving}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select trade…" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACTOR_TRADES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {phoneError && (
              <div className="py-3">
                <p className="text-destructive text-xs">{phoneError}</p>
              </div>
            )}
          </>
        )}

      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <span className="text-sm text-emerald-600">Saved successfully.</span>}
        {error && <span className="text-destructive text-sm">{error}</span>}
      </div>

      {/* Danger zone */}
      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Permanent actions that cannot be undone.
          </p>
        </div>
        <Separator />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-muted-foreground text-sm">
              Remove your account permanently. This action cannot be undone.
            </p>
          </div>
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  );
}
