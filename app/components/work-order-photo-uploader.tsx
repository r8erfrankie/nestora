'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { ensureJpeg } from '@/lib/convert-heic';

// ── Limits ────────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 10;
const MAX_FILE_MB = 10;
const TARGET_COMPRESS_MB = 1.5;
const MAX_COMPRESS_DIM = 2048;
const CONCURRENCY = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

type PhotoStatus = 'pending' | 'uploading' | 'done' | 'error';

interface PendingPhoto {
  key: string;
  file: File;
  preview: string;
  status: PhotoStatus;
  error?: string;
}

export interface UploadedPhoto {
  id: string;
  url: string;
  name: string | null;
  created_at: string;
  uploaded_by_role: string | null;
  uploaded_by: string | null;
}

interface Props {
  workOrderId: string;
  existingPhotoCount: number;
  currentUserId: string;
  onUploaded: (photos: UploadedPhoto[]) => void;
  disabled?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dupKey(f: File) {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

// Canvas-based compression: scales down to MAX_COMPRESS_DIM then iteratively
// reduces JPEG quality until under TARGET_COMPRESS_MB. Falls back to original
// on any failure so the upload always proceeds.
async function compressImage(file: File): Promise<File> {
  const limitBytes = TARGET_COMPRESS_MB * 1024 * 1024;
  if (file.size <= limitBytes) return file;
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) return file;

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_COMPRESS_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);

      const name = file.name.replace(/\.[^.]+$/, '.jpg');
      let quality = 0.85;

      const attempt = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= limitBytes || quality <= 0.5) {
            resolve(new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified }));
          } else {
            quality = +(quality - 0.1).toFixed(2);
            attempt();
          }
        }, 'image/jpeg', quality);
      };
      attempt();
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkOrderPhotoUploader({
  workOrderId,
  existingPhotoCount,
  currentUserId,
  onUploaded,
  disabled = false,
}: Props) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef(new Set<string>());

  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectionErrors, setSelectionErrors] = useState<string[]>([]);

  // Revoke all preview URLs when the component unmounts (e.g. dialog closes mid-upload)
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      items.forEach((it) => URL.revokeObjectURL(it.preview));
    };
  }, []); // intentionally empty — only runs on unmount

  // Derived counts
  const nonFailedItems = items.filter((it) => it.status !== 'error');
  const pendingItems = items.filter((it) => it.status === 'pending');
  const errorItems = items.filter((it) => it.status === 'error');
  const remaining = Math.max(0, MAX_PHOTOS - existingPhotoCount - nonFailedItems.length);
  const canAdd = remaining > 0 && !isUploading && !disabled;

  // Files that will be sent on next upload click (pending + retrying errors)
  const toUploadCount = pendingItems.length + errorItems.length;

  // ── File selection ──────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectionErrors([]);
    const raw = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (raw.length === 0) return;

    const errs: string[] = [];
    const accepted: File[] = [];

    for (const f of raw) {
      const isImage = f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name);
      if (!isImage) { errs.push(`"${f.name}" is not an image`); continue; }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { errs.push(`"${f.name}" exceeds ${MAX_FILE_MB} MB`); continue; }
      if (seenRef.current.has(dupKey(f))) { errs.push(`"${f.name}" already added`); continue; }
      accepted.push(f);
    }

    const slotted = accepted.slice(0, remaining);
    if (accepted.length > remaining) {
      errs.push(
        remaining === 0
          ? `Photo limit reached (${MAX_PHOTOS} max per work order)`
          : `Only ${remaining} slot${remaining !== 1 ? 's' : ''} left — ${accepted.length - remaining} photo${accepted.length - remaining !== 1 ? 's' : ''} skipped`
      );
    }

    if (errs.length) setSelectionErrors(errs);
    if (slotted.length === 0) return;

    // Pipeline: HEIC → compress → preview
    const processed = await Promise.all(
      slotted.map(async (f) => {
        try {
          const jpeg = await ensureJpeg(f);
          const compressed = await compressImage(jpeg);
          seenRef.current.add(dupKey(f));
          return {
            key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file: compressed,
            preview: URL.createObjectURL(compressed),
            status: 'pending' as const,
          };
        } catch {
          seenRef.current.add(dupKey(f));
          return {
            key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file: f,
            preview: URL.createObjectURL(f),
            status: 'pending' as const,
          };
        }
      })
    );

    setItems((prev) => [...prev, ...processed]);
  };

  // ── Remove pending ──────────────────────────────────────────────────────────

  const removeItem = (key: string) => {
    setItems((prev) => {
      const item = prev.find((it) => it.key === key);
      if (item) {
        URL.revokeObjectURL(item.preview);
        seenRef.current.delete(dupKey(item.file));
      }
      return prev.filter((it) => it.key !== key);
    });
  };

  const clearErrors = () => {
    setItems((prev) => {
      prev.filter((it) => it.status === 'error').forEach((it) => {
        URL.revokeObjectURL(it.preview);
        seenRef.current.delete(dupKey(it.file));
      });
      return prev.filter((it) => it.status !== 'error');
    });
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const uploadOne = async (item: PendingPhoto): Promise<UploadedPhoto> => {
    const ext = item.file.name.split('.').pop() ?? 'jpg';
    const filePath = `${workOrderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from('work-order-photos')
      .upload(filePath, item.file, { upsert: false });
    if (storageErr) throw new Error(storageErr.message);

    const { data: urlData } = supabase.storage.from('work-order-photos').getPublicUrl(filePath);

    const { data: record, error: dbErr } = await supabase
      .from('work_order_photos')
      .insert({
        work_order_id: workOrderId,
        url: urlData.publicUrl,
        uploaded_by_role: 'contractor',
        uploaded_by: currentUserId || null,
      })
      .select()
      .single();

    if (dbErr) throw new Error(dbErr.message);
    return record as UploadedPhoto;
  };

  const handleUpload = async () => {
    const batch = items.filter((it) => it.status === 'pending' || it.status === 'error');
    if (batch.length === 0 || !workOrderId) return;

    setIsUploading(true);
    setProgress({ done: 0, total: batch.length });

    // Mark all as uploading up-front
    setItems((prev) =>
      prev.map((it) =>
        batch.some((b) => b.key === it.key) ? { ...it, status: 'uploading', error: undefined } : it
      )
    );

    const uploaded: UploadedPhoto[] = [];

    // Process in batches of CONCURRENCY
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map((item) => uploadOne(item)));

      results.forEach((result, idx) => {
        const { key } = chunk[idx];
        if (result.status === 'fulfilled') {
          uploaded.push(result.value);
          setItems((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'done' } : it)));
        } else {
          const msg = result.reason instanceof Error ? result.reason.message : 'Upload failed';
          setItems((prev) =>
            prev.map((it) => (it.key === key ? { ...it, status: 'error', error: msg } : it))
          );
        }
      });

      setProgress((prev) => prev && { ...prev, done: Math.min(prev.total, prev.done + chunk.length) });
    }

    // Brief success flash, then clear done items
    setTimeout(() => {
      setItems((prev) => {
        prev.filter((it) => it.status === 'done').forEach((it) => URL.revokeObjectURL(it.preview));
        return prev.filter((it) => it.status !== 'done');
      });
    }, 800);

    if (uploaded.length > 0) onUploaded(uploaded);
    setProgress(null);
    setIsUploading(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="space-y-1.5">
        {canAdd && (
          <label className="cursor-pointer">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'cursor-pointer gap-1.5')}>
              <Upload className="h-3.5 w-3.5" />
              Add Photos
            </span>
          </label>
        )}
        {selectionErrors.map((err, i) => (
          <p key={i} className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        ))}
      </div>
    );
  }

  const totalSelected = existingPhotoCount + nonFailedItems.length;

  return (
    <div className="space-y-3">
      {/* Sub-header: count + add-more button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isUploading && progress
            ? `Uploading ${progress.done} of ${progress.total}…`
            : `${totalSelected} / ${MAX_PHOTOS} photos selected`}
        </span>
        {canAdd && (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <span
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-7 cursor-pointer gap-1 text-xs'
              )}
            >
              <Upload className="h-3 w-3" />
              Add more
            </span>
          </label>
        )}
      </div>

      {/* Selection errors */}
      {selectionErrors.length > 0 && (
        <div className="space-y-0.5">
          {selectionErrors.map((err, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {err}
            </p>
          ))}
        </div>
      )}

      {/* Pending photo grid */}
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            <img src={item.preview} alt="" className="h-full w-full object-cover" />

            {/* Status overlays */}
            {item.status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
            {item.status === 'done' && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/50">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            )}
            {item.status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/65 p-1.5 text-center">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="line-clamp-2 text-[9px] leading-tight text-red-300">
                  {item.error ?? 'Failed'}
                </p>
              </div>
            )}

            {/* Remove button — available while not actively uploading */}
            {item.status !== 'uploading' && item.status !== 'done' && !isUploading && (
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-black active:opacity-70"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action row */}
      <div className="flex gap-2">
        {/* Primary: upload pending / retry errors */}
        {toUploadCount > 0 && (
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleUpload}
            disabled={isUploading || disabled}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progress
                  ? `Uploading ${progress.done} of ${progress.total}…`
                  : 'Uploading…'}
              </>
            ) : errorItems.length > 0 && pendingItems.length === 0 ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry {errorItems.length} failed
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload {toUploadCount} photo{toUploadCount !== 1 ? 's' : ''}
                {errorItems.length > 0 && pendingItems.length > 0 && ' (+ retry failed)'}
              </>
            )}
          </Button>
        )}

        {/* Secondary: clear failed (only when mixed pending + errors) */}
        {errorItems.length > 0 && pendingItems.length > 0 && !isUploading && (
          <Button size="sm" variant="outline" onClick={clearErrors} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Clear failed
          </Button>
        )}
      </div>
    </div>
  );
}
