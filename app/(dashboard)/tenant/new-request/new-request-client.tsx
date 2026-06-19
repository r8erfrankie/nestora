'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { ArrowLeft, CheckCircle2, Loader2, X } from 'lucide-react';
import { submitMaintenanceRequest } from './actions';

type Property = {
  id: string;
  name: string;
  address: string | null;
  unit: string | null;
};

const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Appliance',
  'Structural',
  'Pest Control',
  'Other',
];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export function NewRequestClient({
  properties,
  defaultPropertyId,
}: {
  properties: Property[];
  defaultPropertyId: string | null;
}) {
  const router = useRouter();

  const initialId = defaultPropertyId ?? (properties.length === 1 ? properties[0].id : '');

  const [propertyId, setPropertyId] = useState(initialId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotoFiles((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) { setError('Please select a property.'); return; }
    if (!title.trim()) { setError('Please enter a title.'); return; }

    setError('');
    setSubmitting(true);

    try {
      const { id } = await submitMaintenanceRequest({
        propertyId,
        title,
        description: description.trim() || undefined,
        category: category || undefined,
        priority,
      });

      // Upload photos client-side after the request row is created.
      // Non-fatal: the request already exists even if individual uploads fail.
      if (photoFiles.length > 0) {
        const supabase = createClient();
        for (let i = 0; i < photoFiles.length; i++) {
          const file = photoFiles[i];
          const filePath = `${id}/${i}-${file.name.replace(/\s+/g, '_')}`;
          try {
            const { error: uploadError } = await supabase.storage
              .from('maintenance-request-photos')
              .upload(filePath, file);
            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('maintenance-request-photos')
                .getPublicUrl(filePath);
              await supabase.from('maintenance_request_photos').insert({
                request_id: id,
                url: urlData.publicUrl,
                name: file.name,
              });
            }
          } catch {
            // Photo failure is non-fatal — request is already saved.
          }
        }
        photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      }

      setSuccess(true);
      setTimeout(() => router.push('/tenant'), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit request. Please try again.');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div>
          <p className="text-lg font-semibold">Request submitted</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Your landlord has been notified. Redirecting to dashboard…
          </p>
        </div>
      </div>
    );
  }

  const selectedProperty = properties.find((p) => p.id === propertyId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tenant"
          className="text-muted-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Submit Maintenance Request</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Describe the issue and your landlord will be notified.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Property */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Property</label>
          {properties.length === 1 ? (
            <p className="text-sm">
              {properties[0].name}
              {properties[0].unit && (
                <span className="text-muted-foreground"> · Unit {properties[0].unit}</span>
              )}
            </p>
          ) : (
            <Select
              value={propertyId}
              onValueChange={(v) => {
                setPropertyId(v || '');
                setError('');
              }}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.unit ? ` · Unit ${p.unit}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedProperty?.address && (
            <p className="text-muted-foreground text-xs">{selectedProperty.address}</p>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError('');
            }}
            placeholder="e.g. Leaking kitchen faucet"
            maxLength={100}
            disabled={submitting}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Description{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in more detail — when it started, how bad it is, etc."
            rows={4}
            disabled={submitting}
            className="resize-none"
          />
        </div>

        {/* Category + Priority */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Category{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v || '')}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Priority</label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v || 'Medium')}
              disabled={submitting}
            >
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
        </div>

        {/* Photos */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Photos{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            type="file"
            multiple
            accept="image/*"
            onChange={handlePhotoFiles}
            disabled={submitting}
            className="!h-11 sm:!h-8"
          />
          {photoPreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {photoPreviews.map((preview, idx) => (
                <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-0 right-0 rounded-bl bg-black/60 p-0.5 text-white"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
          <Button type="button" variant="ghost" asChild disabled={submitting}>
            <Link href="/tenant">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
