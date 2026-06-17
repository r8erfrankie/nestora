'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Shield, Mail } from 'lucide-react';
import { updateProfile } from './actions';

interface SettingsClientProps {
  email: string;
  fullName: string | null;
  role: 'landlord' | 'contractor';
}

export function SettingsClient({ email, fullName, role }: SettingsClientProps) {
  const [name, setName] = useState(fullName ?? '');
  const [selectedRole, setSelectedRole] = useState<'landlord' | 'contractor'>(role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  const isDirty = name !== (fullName ?? '') || selectedRole !== role;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateProfile({ full_name: name, role: selectedRole });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Please try again.');
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

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
          <CardDescription>Your name and display information.</CardDescription>
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
        </CardContent>
      </Card>

      {/* Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Role
          </CardTitle>
          <CardDescription>Your role determines what you see in the app.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(['landlord', 'contractor'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSelectedRole(r);
                  setSaved(false);
                }}
                disabled={saving}
                className={[
                  'rounded-lg border p-4 text-left transition-all',
                  selectedRole === r
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50',
                ].join(' ')}
              >
                <div className="font-medium capitalize">{r}</div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {r === 'landlord'
                    ? 'Manage properties, create work orders, assign contractors.'
                    : 'View and action work orders assigned to you.'}
                </div>
              </button>
            ))}
          </div>
          {selectedRole !== role && (
            <p className="text-muted-foreground text-xs">
              Changing your role will update the sidebar and available features after saving.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <span className="text-sm text-emerald-600">Saved successfully.</span>}
        {error && <span className="text-destructive text-sm">{error}</span>}
      </div>
    </div>
  );
}
