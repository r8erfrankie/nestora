'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ClipboardList, CheckCircle, ArrowRight, SkipForward } from 'lucide-react';

const PROPERTY_TYPES = [
  'Apartment',
  'House',
  'Townhouse',
  'Condo',
  'Commercial',
  'Land',
  'Other',
] as const;

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;

interface OnboardingProps {
  greetingName: string;
}

export function Onboarding({ greetingName }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'property' | 'workorder' | 'complete'>('welcome');
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [propertyNotes, setPropertyNotes] = useState('');

  const [workOrderTitle, setWorkOrderTitle] = useState('');
  const [workOrderDescription, setWorkOrderDescription] = useState('');
  const [workOrderPriority, setWorkOrderPriority] = useState('Medium');
  const [workOrderDueDate, setWorkOrderDueDate] = useState('');
  const [workOrderContractorEmail, setWorkOrderContractorEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [createdPropertyName, setCreatedPropertyName] = useState('');

  const router = useRouter();
  const supabase = createClient();

  const markOnboarded = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
      }
      document.cookie = 'dev_force_onboarding=; path=/; max-age=0; samesite=lax';
    } catch (err) {
      // ignore, proceed with refresh
    }
    router.refresh();
  };

  const handleSkip = async () => {
    await markOnboarded();
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName.trim()) return;

    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data: newProperty, error } = await supabase
        .from('properties')
        .insert({
          name: propertyName.trim(),
          address: propertyAddress.trim() || null,
          type: propertyType || null,
          notes: propertyNotes.trim() || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (newProperty) {
        setCreatedPropertyId(newProperty.id);
        setCreatedPropertyName(newProperty.name);
        setStep('workorder');
        setWorkOrderTitle('Initial inspection or repair needed');
      }
    } catch (err: any) {
      alert('Failed to add property. Please try again or go to the Properties page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workOrderTitle.trim() || !createdPropertyId) return;

    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { error } = await supabase.from('work_orders').insert({
        title: workOrderTitle.trim(),
        description: workOrderDescription.trim() || null,
        priority: workOrderPriority,
        due_date: workOrderDueDate || null,
        property_id: createdPropertyId,
        assigned_contractor_email: workOrderContractorEmail.trim() || null,
        user_id: user.id,
        status: 'Open',
      });

      if (error) throw error;

      await markOnboarded();
      setStep('complete');
    } catch (err: any) {
      alert('Failed to create work order. You can create one from the Work Orders page.');
      await markOnboarded(); // Still mark as done so they don't see onboarding again
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'complete') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">You're all set, {greetingName}!</CardTitle>
            <CardDescription>
              Your first property and work order are ready. Nestora will help you stay on top of
              maintenance from now on.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => router.push('/')} className="flex-1">
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/properties')}
                className="flex-1"
              >
                View Properties
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/work-orders')}
                className="flex-1"
              >
                View Work Orders
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              You can always add more properties and work orders from the sidebar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Welcome to Nestora, {greetingName}!
          </h1>
          <p className="text-muted-foreground mt-1 max-w-prose">
            We're glad you're here. Let's get you set up with your first property and work order in
            just two quick steps. You'll be managing maintenance in no time.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
          <SkipForward className="mr-1 h-4 w-4" />
          Skip for now
        </Button>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4 text-sm">
        <div
          className={`flex items-center gap-2 ${step === 'welcome' || step === 'property' ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 'welcome' || step === 'property' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            1
          </div>
          <span>Add Property</span>
        </div>
        <div className="bg-border h-px flex-1" />
        <div
          className={`flex items-center gap-2 ${(['workorder', 'complete'] as const).includes(step as any) ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${(['workorder', 'complete'] as const).includes(step as any) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            2
          </div>
          <span>Create Work Order</span>
        </div>
      </div>

      {/* Step 1: Add Property */}
      {step === 'welcome' || step === 'property' ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Step 1: Add your first property</CardTitle>
                <CardDescription>
                  Properties are the foundation of Nestora. Add one now to start tracking
                  maintenance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProperty} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Property Name *</label>
                  <Input
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder="e.g. Oak Street Apartments"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <Input
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    placeholder="123 Oak St, City"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={propertyType} onValueChange={(val) => val && setPropertyType(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type (optional)" />
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
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={propertyNotes}
                  onChange={(e) => setPropertyNotes(e.target.value)}
                  placeholder="Any special details about this property..."
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !propertyName.trim()}
                className="w-full sm:w-auto"
              >
                {isLoading ? 'Adding property...' : 'Add Property & Continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 2: Create Work Order */}
      {step === 'workorder' && createdPropertyId && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Step 2: Create your first work order</CardTitle>
                <CardDescription>
                  Great! "{createdPropertyName}" has been added. Now create a work order to track a
                  task for it.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddWorkOrder} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Work Order Title *</label>
                <Input
                  value={workOrderTitle}
                  onChange={(e) => setWorkOrderTitle(e.target.value)}
                  placeholder="e.g. Fix leaking roof in unit 2B"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  value={workOrderDescription}
                  onChange={(e) => setWorkOrderDescription(e.target.value)}
                  placeholder="Details about what needs to be done..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={workOrderPriority} onValueChange={(val) => val && setWorkOrderPriority(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Due Date (optional)</label>
                  <Input
                    type="date"
                    value={workOrderDueDate}
                    onChange={(e) => setWorkOrderDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to contractor email (optional)</label>
                <Input
                  type="email"
                  value={workOrderContractorEmail}
                  onChange={(e) => setWorkOrderContractorEmail(e.target.value)}
                  placeholder="contractor@example.com"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="submit"
                  disabled={isLoading || !workOrderTitle.trim()}
                  className="flex-1 sm:flex-none"
                >
                  {isLoading ? 'Creating work order...' : 'Create Work Order & Finish'}
                </Button>
                <Button type="button" variant="outline" onClick={handleSkip} disabled={isLoading}>
                  Skip this step
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <div className="text-muted-foreground text-center text-xs">
        You can always add more properties and work orders later using the sidebar.
      </div>
    </div>
  );
}
