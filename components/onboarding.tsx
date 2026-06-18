'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createOnboardingProperty,
  saveOnboardingProfile,
  markUserOnboarded,
} from '@/app/actions/onboarding-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CheckCircle, ArrowRight, User } from 'lucide-react';

const PROPERTY_TYPES = [
  'Apartment',
  'House',
  'Townhouse',
  'Condo',
  'Commercial',
  'Land',
  'Other',
] as const;

type Step = 'welcome' | 'profile' | 'property' | 'complete';

interface OnboardingProps {
  greetingName: string;
}

export function Onboarding({ greetingName }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');

  // Profile step
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');

  // Property step
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await saveOnboardingProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        company_name: company.trim() || null,
      });
      setStep('property');
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName.trim() || !propertyAddress.trim()) return;
    setLoading(true);
    setError('');
    try {
      await createOnboardingProperty({
        name: propertyName.trim(),
        address: propertyAddress.trim(),
        type: propertyType || null,
      });
      await markUserOnboarded();
      // Clear dev override so the dashboard does not re-show onboarding
      document.cookie = 'dev_force_onboarding=; path=/; max-age=0; samesite=lax';
      setStep('complete');
    } catch (err: any) {
      setError(err?.message || 'Failed to add property. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'welcome') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome to Nestora, {greetingName}!
            </h1>
            <p className="text-muted-foreground">
              Let&apos;s get you set up in two quick steps so you can start tracking maintenance
              across your properties.
            </p>
          </div>
          <Button size="lg" onClick={() => setStep('profile')} className="w-full sm:w-auto">
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">You&apos;re all set, {greetingName}!</CardTitle>
            <CardDescription>
              Your property is ready. Create your first work order to start tracking maintenance
              tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => router.push('/work-orders?create=1')} className="w-full">
              Create first work order
            </Button>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 p-6">
      {/* Step progress */}
      <div className="flex items-center gap-3 text-sm">
        <div
          className={`flex items-center gap-2 ${step === 'profile' || step === 'property' ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${step === 'profile' || step === 'property' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            1
          </div>
          <span>Profile</span>
        </div>
        <div className="bg-border h-px flex-1" />
        <div
          className={`flex items-center gap-2 ${step === 'property' ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${step === 'property' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            2
          </div>
          <span>Property</span>
        </div>
      </div>

      {/* Step 1: Profile */}
      {step === 'profile' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Step 1: Your profile</CardTitle>
                <CardDescription>Tell us a bit about yourself.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name *</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone (optional)</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company name (optional)</label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Smith Properties LLC"
                  disabled={loading}
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button
                type="submit"
                disabled={loading || !fullName.trim()}
                className="w-full sm:w-auto"
              >
                {loading ? 'Saving…' : 'Continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Property */}
      {step === 'property' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Step 2: Add your first property</CardTitle>
                <CardDescription>
                  Properties are the foundation of Nestora. Add one to start tracking maintenance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProperty} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Property name / nickname *</label>
                <Input
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="e.g. Oak Street Apartments"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address *</label>
                <Input
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="123 Oak St, City, State"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Property type (optional)</label>
                <Select
                  value={propertyType}
                  onValueChange={(val) => val && setPropertyType(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button
                type="submit"
                disabled={loading || !propertyName.trim() || !propertyAddress.trim()}
                className="w-full sm:w-auto"
              >
                {loading ? 'Adding property…' : 'Add Property & Finish'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-muted-foreground text-center text-xs">
        You can update all of this later in Settings.
      </p>
    </div>
  );
}
