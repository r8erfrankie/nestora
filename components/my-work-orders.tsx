'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Loader2, X, Camera } from 'lucide-react';

export interface MyWorkOrder {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  notes: string | null;
  updated_at: string;
  assigned_contractor_email: string | null;
  properties: { id: string; name: string } | null;
}

interface Photo {
  id: string;
  url: string;
  name: string | null;
}

const STATUSES = ['Open', 'In Progress', 'Completed'] as const;

export function MyWorkOrders({ initialWorkOrders }: { initialWorkOrders: MyWorkOrder[] }) {
  const [workOrders, setWorkOrders] = useState<MyWorkOrder[]>(initialWorkOrders);
  const [selected, setSelected] = useState<MyWorkOrder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<Photo | null>(null);

  function openDetail(wo: MyWorkOrder) {
    setSelected(wo);
    setNewStatus(wo.status);
    setNewComment(wo.notes || '');
    setPendingFiles([]);
    setPreviews([]);
    loadPhotos(wo.id);
  }

  async function loadPhotos(workOrderId: string) {
    setLoadingPhotos(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('work_order_photos')
        .select('id, url, name')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });
      setPhotos(data || []);
    } catch (e) {
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPendingFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  }

  function removePending(index: number) {
    const url = previews[index];
    if (url) URL.revokeObjectURL(url);

    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpdate() {
    if (!selected) return;

    const hasChange =
      newStatus !== selected.status ||
      (newComment.trim() || null) !== (selected.notes || null) ||
      pendingFiles.length > 0;

    if (!hasChange) {
      setSelected(null);
      return;
    }

    setUpdating(true);

    const supabase = createClient();

    try {
      // 1. Update work order status + notes
      const sanitizedComment = newComment.trim().slice(0, 2000) || null; // basic sanitization + length limit
      const { error: updateErr } = await supabase
        .from('work_orders')
        .update({
          status: newStatus,
          notes: sanitizedComment,
        })
        .eq('id', selected.id);

      if (updateErr) throw updateErr;

      // 2. Upload any new photos (simple, no fancy naming for contractor flow)
      for (const file of pendingFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        // eslint-disable-next-line react-hooks/purity -- timestamp for unique storage path, not for render
        const path = `${selected.id}/${Date.now()}-${safeName}`;

        const { error: storageErr } = await supabase.storage
          .from('work-order-photos')
          .upload(path, file, { upsert: false });

        if (storageErr) {
          continue;
        }

        const { data: pub } = supabase.storage.from('work-order-photos').getPublicUrl(path);

        await supabase.from('work_order_photos').insert({
          work_order_id: selected.id,
          url: pub.publicUrl,
          name: file.name,
        });
      }

      // 3. Optimistic update local list + selected
      const updated: MyWorkOrder = {
        ...selected,
        status: newStatus,
        notes: newComment.trim() || null,
        updated_at: new Date().toISOString(),
      };

      setWorkOrders((prev) => prev.map((wo) => (wo.id === selected.id ? updated : wo)));
      setSelected(updated);

      // 4. Refresh photos in the dialog
      await loadPhotos(selected.id);

      // Clear pending
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPendingFiles([]);
      setPreviews([]);

      // Close dialog after short delay so user sees success state
      setTimeout(() => {
        setSelected(null);
      }, 600);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      alert('Failed to update. ' + message);
    } finally {
      setUpdating(false);
    }
  }

  function closeDialog() {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPendingFiles([]);
    setPreviews([]);
    setSelected(null);
  }

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            My Work Orders
          </CardTitle>
          <CardDescription>
            Jobs assigned to you. Tap a card to update status, add notes or photos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="text-muted-foreground py-6 text-center text-sm">
              No work orders assigned to your email yet.
              <br />
              New jobs will appear here automatically after the owner assigns them.
            </div>
          ) : (
            <div className="space-y-3">
              {workOrders.map((wo) => {
                const isOverdue =
                  wo.due_date && new Date(wo.due_date) < new Date() && wo.status !== 'Completed';
                return (
                  <div
                    key={wo.id}
                    onClick={() => openDetail(wo)}
                    className="group bg-card active:bg-accent/60 cursor-pointer touch-manipulation rounded-xl border p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 leading-tight font-medium">{wo.title}</div>
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          {wo.properties?.name || 'Unknown property'}
                        </div>
                      </div>
                      <Badge
                        variant={
                          wo.status === 'Completed'
                            ? 'default'
                            : wo.status === 'In Progress'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="shrink-0"
                      >
                        {wo.status}
                      </Badge>
                    </div>

                    <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                      <span>
                        Due: {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : 'No date'}
                      </span>
                      <span>•</span>
                      <span>{wo.priority}</span>
                      {isOverdue && <span className="text-destructive font-medium">• Overdue</span>}
                    </div>

                    {wo.notes && (
                      <div className="text-muted-foreground mt-2 line-clamp-1 border-l-2 pl-2 text-xs italic">
                        {wo.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Dialog - mobile friendly */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg gap-0 p-0 sm:rounded-2xl">
          {selected && (
            <>
              <DialogHeader className="p-6 pb-4">
                <DialogTitle className="text-xl">{selected.title}</DialogTitle>
                <DialogDescription>
                  {selected.properties?.name} • Priority: {selected.priority}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 px-6 pb-6">
                {/* Current info */}
                <div>
                  <div className="text-muted-foreground mb-1 text-xs tracking-widest uppercase">
                    Current status
                  </div>
                  <Badge className="text-sm" variant="outline">
                    {selected.status}
                  </Badge>
                  {selected.due_date && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      Due {new Date(selected.due_date).toLocaleDateString()}
                    </div>
                  )}
                  {selected.description && (
                    <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                      {selected.description}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <div className="text-sm font-medium">Update status</div>
                  <Select value={newStatus} onValueChange={(val) => val && setNewStatus(val)}>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-base">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Comment */}
                <div className="space-y-1.5">
                  <div className="text-sm font-medium">Add comment / notes</div>
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="e.g. Fixed the leaking pipe. Materials used: new washer + sealant."
                    className="min-h-[88px] text-base"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-muted-foreground text-[10px]">
                    This will be visible to the property owner.
                  </p>
                </div>

                {/* Current photos */}
                <div>
                  <div className="mb-2 text-sm font-medium">Photos on this job</div>
                  {loadingPhotos ? (
                    <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading photos...
                    </div>
                  ) : photos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.url}
                          alt={photo.name || 'Work photo'}
                          className="aspect-square w-full cursor-pointer rounded-lg border object-cover active:opacity-80"
                          onClick={() => setFullScreenPhoto(photo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">No photos yet.</p>
                  )}
                </div>

                {/* Add photos - very mobile friendly */}
                <div>
                  <div className="mb-2 text-sm font-medium">
                    Add photos from this visit (optional)
                  </div>
                  <label className="active:bg-muted inline-flex w-full cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium">
                    <Camera className="h-4 w-4" />
                    <span>Take photo or choose from gallery</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                    />
                  </label>

                  {previews.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {previews.map((src, index) => (
                        <div key={index} className="relative aspect-square">
                          <img
                            src={src}
                            className="h-full w-full rounded-lg border object-cover"
                            alt="Preview"
                          />
                          <button
                            type="button"
                            onClick={() => removePending(index)}
                            className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-1.5 rounded-full p-1 shadow"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="border-t p-6 pt-0">
                <Button
                  onClick={handleUpdate}
                  disabled={
                    updating ||
                    (newStatus === selected.status &&
                      (newComment.trim() || null) === (selected.notes || null) &&
                      pendingFiles.length === 0)
                  }
                  className="h-11 w-full text-base"
                >
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {updating ? 'Saving update...' : 'Save Update'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Very simple full-screen photo viewer */}
      {fullScreenPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setFullScreenPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
            onClick={() => setFullScreenPhoto(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={fullScreenPhoto.url}
            alt={fullScreenPhoto.name || ''}
            className="max-h-[88vh] max-w-[96vw] rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
