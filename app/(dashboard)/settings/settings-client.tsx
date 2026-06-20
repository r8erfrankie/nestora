'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Mail } from 'lucide-react';
import { isValidPhoneNumber } from 'libphonenumber-js';
import type { Value } from 'react-phone-number-input';
import { PhoneInput } from '@/components/ui/phone-input';
import { updateProfile } from './actions';
import { DeleteAccountButton } from './delete-account-button';

interface SettingsClientProps {
  email: string;
  role: string | null;
  fullName: string | null;
  phone: string | null;
  ecName: string | null;
  ecPhone: string | null;
}

export function SettingsClient({ email, role, fullName, phone: initialPhone, ecName: initialEcName, ecPhone: initialEcPhone }: SettingsClientProps) {
  const [name, setName] = useState(fullName ?? '');
  const [phone, setPhone] = useState<Value | undefined>(
    initialPhone ? (initialPhone as Value) : undefined
  );
  const [ecName, setEcName] = useState(initialEcName ?? '');
  const [ecPhone, setEcPhone] = useState<Value | undefined>(
    initialEcPhone ? (initialEcPhone as Value) : undefined
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const router = useRouter();
  const isTenant = role === 'tenant';

  const isDirty =
    name !== (fullName ?? '') ||
    (isTenant && (
      (phone ?? '') !== (initialPhone ?? '') ||
      ecName !== (initialEcName ?? '') ||
      (ecPhone ?? '') !== (initialEcPhone ?? '')
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
          <CardDescription>
            {isTenant ? 'Your name, contact, and emergency information.' : 'Your name and display information.'}
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full name</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder="Your name"
              disabled={saving}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <div className="flex items-center gap-2">
              <Mail className="text-muted-foreground h-4 w-4" />
              <span className="text-sm">{email}</span>
              <Badge variant="secondary" className="text-xs">verified</Badge>
            </div>
            <p className="text-muted-foreground text-xs">Email is managed by your magic link login and cannot be changed here.</p>
          </div>

          {isTenant && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Contact info
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Phone <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="max-w-sm">
                  <PhoneInput
                    value={phone}
                    onChange={(v) => {
                      setPhone(v);
                      setSaved(false);
                      setPhoneError('');
                    }}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t pt-3">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Emergency contact <span className="font-normal normal-case">(optional)</span>
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={ecName}
                    onChange={(e) => {
                      setEcName(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="Contact name"
                    disabled={saving}
                    className="max-w-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone</label>
                  <div className="max-w-sm">
                    <PhoneInput
                      value={ecPhone}
                      onChange={(v) => {
                        setEcPhone(v);
                        setSaved(false);
                        setPhoneError('');
                      }}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              {phoneError && (
                <p className="text-destructive text-xs">{phoneError}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              Remove your account permanently. Useful for testing — you can re-register with the
              same email immediately.
            </p>
          </div>
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  );
}
