'use client';

import { useState } from 'react';
import { HardHat, ArrowRight, CheckCircle } from 'lucide-react';
import { saveContractorOnboarding } from '@/app/actions/onboarding-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TRADES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Carpentry',
  'Painting',
  'Roofing',
  'Landscaping',
  'General Maintenance',
  'Other',
];

export function ContractorOnboardingClient() {
  const [fullName, setFullName] = useState('');
  const [trade, setTrade] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await saveContractorOnboarding({
        full_name: fullName,
        trade: trade || null,
        phone: phone || null,
        notes: notes || null,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <HardHat className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Set up your contractor profile</h1>
          <p className="text-muted-foreground text-sm">
            This helps landlords know who you are and what you do.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Your details</CardTitle>
            <CardDescription>You can update these anytime in Settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name *</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Trade / specialty</label>
                <Input
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  placeholder="e.g. Plumbing, Electrical, HVAC…"
                  disabled={loading}
                  list="trades-list"
                />
                <datalist id="trades-list">
                  {TRADES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone number</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else landlords should know about you…"
                  rows={3}
                  disabled={loading}
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={loading || !fullName.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  <>
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
