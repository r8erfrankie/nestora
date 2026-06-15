'use client';

import { useState, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { deleteWorkOrder, createWorkOrder, updateWorkOrderStatus } from './crud-actions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Eye, Upload, Loader2, ClipboardList, Archive, Trash2, X } from 'lucide-react';

interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  assigned_contractor: string | null;
  assigned_contractor_email: string | null;
  property_id: string;
  properties: { id: string; name: string } | null;
  notes?: string | null;
  cost?: number | null;
  created_at: string;
  updated_at: string;
}

interface Property {
  id: string;
  name: string;
}

interface Photo {
  id: string;
  url: string;
  name: string | null;
  created_at: string;
}

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
const STATUSES = ['Open', 'In Progress', 'Completed', 'Archived'] as const;

export function WorkOrdersClient({
  initialWorkOrders,
  properties,
  loadError,
}: {
  initialWorkOrders: WorkOrder[];
  properties: Property[];
  loadError?: { message?: string; details?: string; hint?: string; code?: string } | null;
}) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Multi-select for photos in detail view
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Full screen viewer
  const [fullScreenPhoto, setFullScreenPhoto] = useState<Photo | null>(null);

  // Pending photos for upload in the detail view (to allow naming before upload)
  const [pendingDetailPhotos, setPendingDetailPhotos] = useState<
    Array<{ file: File; name: string; preview: string }>
  >([]);

  // Form state for create
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    due_date: '',
    property_id: '',
    assigned_contractor: '',
    assigned_contractor_email: '',
    cost: '',
  });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sorting (by property name for multi-property owners/managers)
  const [sortColumn, setSortColumn] = useState<'property' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Photos selected during create (before we have a work_order_id)
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [pendingPhotoPreviews, setPendingPhotoPreviews] = useState<string[]>([]);

  // For quick photo upload from the list for already existing work orders
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quickUploadWorkOrderId, setQuickUploadWorkOrderId] = useState<string | null>(null);

  const supabase = createClient();

  const loadErrorMessage = loadError
    ? loadError.message ||
      loadError.details ||
      'Failed to load work orders. Make sure you have run supabase/work-orders.sql in your Supabase dashboard.'
    : null;

  // Computed sorted list (client-side for simplicity)
  const sortedWorkOrders = useMemo(() => {
    if (!sortColumn) return workOrders;

    return [...workOrders].sort((a, b) => {
      const aName =
        a.properties?.name || properties.find((p) => p.id === a.property_id)?.name || '';
      const bName =
        b.properties?.name || properties.find((p) => p.id === b.property_id)?.name || '';
      const comparison = aName.localeCompare(bName);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [workOrders, sortColumn, sortDirection, properties]);

  const toggleSort = (column: 'property') => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Open create dialog
  const openCreate = () => {
    setForm({
      title: '',
      description: '',
      priority: 'Medium',
      due_date: '',
      property_id: properties[0]?.id || '',
      assigned_contractor: '',
      assigned_contractor_email: '',
      cost: '',
    });
    setFormError('');
    // Reset any previously selected photos for create
    pendingPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingPhotoFiles([]);
    setPendingPhotoPreviews([]);
    setIsCreateOpen(true);
  };

  // Open detail dialog
  const openDetail = async (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setIsDetailOpen(true);
    setPhotos([]); // reset
    setSelectedPhotoIds(new Set());
    setLoadingPhotos(true);

    try {
      // Load existing photos
      const { data: photoData } = await supabase
        .from('work_order_photos')
        .select('*')
        .eq('work_order_id', workOrder.id)
        .order('created_at', { ascending: true });

      if (photoData) {
        setPhotos(photoData as Photo[]);
      }
    } finally {
      setLoadingPhotos(false);
    }
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedWorkOrder(null);
    setPhotos([]);
  };

  // --- New helpers for delete, archive, and create-time photos ---

  const requestDelete = (wo: WorkOrder) => {
    setDeleteTarget(wo);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWorkOrder(deleteTarget.id);
      setWorkOrders((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      if (selectedWorkOrder?.id === deleteTarget.id) {
        closeDetail();
      }
    } catch (err) {
      alert('Failed to delete work order.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const archiveWorkOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'Archived' })
        .eq('id', id);
      if (error) throw error;
      setWorkOrders((prev) =>
        prev.map((wo) => (wo.id === id ? { ...wo, status: 'Archived' } : wo))
      );
      if (selectedWorkOrder?.id === id) {
        setSelectedWorkOrder({ ...selectedWorkOrder, status: 'Archived' });
      }
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      const message =
        e?.message ||
        e?.details ||
        (e?.code ? `Database error (code: ${e.code})` : null) ||
        'Failed to archive work order. You may need to add "Archived" to your DB status constraint (see supabase/work-orders.sql).';
      alert(message);
    }
  };

  const handlePhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPendingPhotoFiles((prev) => [...prev, ...files]);
    setPendingPhotoPreviews((prev) => [...prev, ...newPreviews]);
    // reset input so same file can be selected again if needed
    e.target.value = '';
  };

  const removePendingPhoto = (index: number) => {
    URL.revokeObjectURL(pendingPhotoPreviews[index]);
    setPendingPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPendingPhotos = async (workOrderId: string) => {
    let hadError = false;
    let photoUploadErrorMessage = '';
    for (let i = 0; i < pendingPhotoFiles.length; i++) {
      const file = pendingPhotoFiles[i];
      const filePath = `${workOrderId}/${i}-${file.name.replace(/\s+/g, '_')}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('work-order-photos')
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('work-order-photos').getPublicUrl(filePath);
        await supabase.from('work_order_photos').insert({
          work_order_id: workOrderId,
          url: urlData.publicUrl,
        });
      } catch (err) {
        hadError = true;
        if (!photoUploadErrorMessage) {
          photoUploadErrorMessage = getStorageErrorMessage(err);
        }
      }
    }
    pendingPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingPhotoFiles([]);
    setPendingPhotoPreviews([]);

    if (hadError) {
      alert(
        photoUploadErrorMessage ||
          'Work order created, but some photos failed to upload. Please check your storage bucket and policies (see supabase/work-orders.sql).'
      );
    }
  };

  // --- Photo management for detail view (existing work orders) ---

  const handleDetailPhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPending = files.map((file) => {
      const defaultName = file.name.replace(/\.[^/.]+$/, ''); // strip extension
      return {
        file,
        name: defaultName,
        preview: URL.createObjectURL(file),
      };
    });

    setPendingDetailPhotos((prev) => [...prev, ...newPending]);
    e.target.value = '';
  };

  const updatePendingDetailName = (index: number, newName: string) => {
    setPendingDetailPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, name: newName } : p))
    );
  };

  const removePendingDetailPhoto = (index: number) => {
    setPendingDetailPhotos((prev) => {
      const toRemove = prev[index];
      if (toRemove) URL.revokeObjectURL(toRemove.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadPendingDetailPhotos = async () => {
    if (!selectedWorkOrder || pendingDetailPhotos.length === 0) return;

    setUploadingPhotos(true);

    try {
      const newPhotos: Photo[] = [];

      for (let idx = 0; idx < pendingDetailPhotos.length; idx++) {
        const pending = pendingDetailPhotos[idx];
        const filePath = `${selectedWorkOrder.id}/${idx}-${pending.file.name.replace(/\s+/g, '_')}`;

        const { error: uploadError } = await supabase.storage
          .from('work-order-photos')
          .upload(filePath, pending.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('work-order-photos').getPublicUrl(filePath);

        const { data: photoRecord, error: dbError } = await supabase
          .from('work_order_photos')
          .insert({
            work_order_id: selectedWorkOrder.id,
            url: urlData.publicUrl,
            name: pending.name || pending.file.name,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        if (photoRecord) newPhotos.push(photoRecord as Photo);
      }

      setPhotos((prev) => [...prev, ...newPhotos]);
      // cleanup
      pendingDetailPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPendingDetailPhotos([]);
    } catch (err) {
      alert(getStorageErrorMessage(err));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const selectAllPhotos = () => {
    const allIds = new Set(photos.map((p) => p.id));
    setSelectedPhotoIds(allIds);
  };

  const deselectAllPhotos = () => {
    setSelectedPhotoIds(new Set());
  };

  const deleteSelectedPhotos = async () => {
    if (selectedPhotoIds.size === 0) return;

    const idsToDelete = Array.from(selectedPhotoIds);
    const photosToDelete = photos.filter((p) => selectedPhotoIds.has(p.id));

    if (!confirm(`Delete ${idsToDelete.length} photo(s)? This cannot be undone.`)) {
      return;
    }

    try {
      // Delete from storage
      const paths = photosToDelete
        .map((p) => {
          const marker = '/work-order-photos/';
          const idx = p.url.indexOf(marker);
          return idx !== -1 ? p.url.substring(idx + marker.length).split('?')[0] : null;
        })
        .filter(Boolean) as string[];

      if (paths.length > 0) {
        await supabase.storage.from('work-order-photos').remove(paths);
      }

      // Delete from DB
      const { error } = await supabase.from('work_order_photos').delete().in('id', idsToDelete);

      if (error) throw error;

      setPhotos((prev) => prev.filter((p) => !selectedPhotoIds.has(p.id)));
      setSelectedPhotoIds(new Set());
    } catch (err) {
      alert('Failed to delete some photos. Please try again.');
    }
  };

  const deleteSinglePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo?')) return;

    try {
      const marker = '/work-order-photos/';
      const idx = photo.url.indexOf(marker);
      const path = idx !== -1 ? photo.url.substring(idx + marker.length).split('?')[0] : null;

      if (path) {
        await supabase.storage.from('work-order-photos').remove([path]);
      }

      const { error } = await supabase.from('work_order_photos').delete().eq('id', photo.id);

      if (error) throw error;

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
      if (fullScreenPhoto?.id === photo.id) {
        setFullScreenPhoto(null);
      }
    } catch (err) {
      alert('Failed to delete photo.');
    }
  };

  const updatePhotoName = async (photoId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      const { error } = await supabase
        .from('work_order_photos')
        .update({ name: trimmed })
        .eq('id', photoId);

      if (error) throw error;

      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, name: trimmed } : p)));

      if (fullScreenPhoto?.id === photoId) {
        setFullScreenPhoto({ ...fullScreenPhoto, name: trimmed });
      }
    } catch (err) {
      alert('Failed to rename photo.');
    }
  };

  const openFullScreen = (photo: Photo) => {
    setFullScreenPhoto(photo);
  };

  const closeFullScreen = () => {
    setFullScreenPhoto(null);
  };

  // Handle form field changes
  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  // Create work order -- delegated to Server Action so all email sending and logic stays on server only
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.property_id) {
      setFormError('Title and Property are required.');
      return;
    }

    if (
      form.assigned_contractor_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.assigned_contractor_email)
    ) {
      setFormError('Please provide a valid email for the contractor.');
      return;
    }

    setCreating(true);
    setFormError('');

    try {
      const prop = properties.find((p) => p.id === form.property_id);

      const inserted = await createWorkOrder({
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        property_id: form.property_id,
        assigned_contractor: form.assigned_contractor.trim() || null,
        assigned_contractor_email: form.assigned_contractor_email.trim() || null,
        cost: form.cost ? parseFloat(form.cost) : 0,
        propertyName: prop?.name || null,
      });

      if (inserted) {
        // Enrich with property name from local list to avoid join permission issues
        const newWO: WorkOrder = {
          ...inserted,
          properties: prop ? { id: prop.id, name: prop.name } : null,
        };
        setWorkOrders((prev) => [newWO, ...prev]);

        // Upload any photos selected during creation (this stays client-side as it's storage upload)
        if (pendingPhotoFiles.length > 0) {
          await uploadPendingPhotos(newWO.id);
        }
      }
      setIsCreateOpen(false);
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      const message =
        e?.message ||
        e?.details ||
        (e?.code ? `Database error (code: ${e.code})` : null) ||
        'Failed to create work order. Common causes: work_orders table not created (run supabase/work-orders.sql), RLS blocking the insert, or invalid property_id.';
      setFormError(message);
    } finally {
      setCreating(false);
    }
  };

  // Update status (used in detail view)
  const updateStatus = async (newStatus: string | null) => {
    if (!newStatus || !selectedWorkOrder) return;

    const previousStatus = selectedWorkOrder.status;

    // Optimistic update
    const updatedWO = { ...selectedWorkOrder, status: newStatus };
    setSelectedWorkOrder(updatedWO);
    setWorkOrders((prev) => prev.map((wo) => (wo.id === selectedWorkOrder.id ? updatedWO : wo)));
    setIsUpdatingStatus(true);

    try {
      await updateWorkOrderStatus(selectedWorkOrder.id, newStatus);
    } catch (err) {
      const reverted = { ...selectedWorkOrder, status: previousStatus };
      setSelectedWorkOrder(reverted);
      setWorkOrders((prev) => prev.map((wo) => (wo.id === selectedWorkOrder.id ? reverted : wo)));
      alert('Failed to update status. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // General photo upload function (used by both detail view and quick add from list)
  const getStorageErrorMessage = (err: unknown): string => {
    const e = err as { message?: string; error?: string };
    const msg = (e?.message || e?.error || '').toLowerCase();
    if (msg.includes('bucket not found')) {
      return 'Storage bucket "work-order-photos" does not exist. Please create it in your Supabase dashboard (Storage → New bucket → name it exactly "work-order-photos").';
    }
    if (msg.includes('row-level security') || msg.includes('violates row-level security policy')) {
      return 'Permission denied uploading photo. Please add the required storage policies for the "work-order-photos" bucket (see supabase/work-orders.sql for the recommended INSERT policy for authenticated users).';
    }
    return (
      'Failed to upload photo(s). ' +
      (e?.message || e?.error || 'Please check your Supabase storage setup.')
    );
  };

  const uploadPhotos = async (workOrderId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);

    const uploadPromises = Array.from(files).map(async (file) => {
      const filePath = `${workOrderId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('work-order-photos')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('work-order-photos').getPublicUrl(filePath);

      const { data: photoRecord, error: dbError } = await supabase
        .from('work_order_photos')
        .insert({
          work_order_id: workOrderId,
          url: urlData.publicUrl,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      return photoRecord as Photo;
    });

    try {
      const uploaded = await Promise.all(uploadPromises);

      // If this is the currently open detail work order, update its photos list
      if (selectedWorkOrder && selectedWorkOrder.id === workOrderId) {
        setPhotos((prev) => [...prev, ...uploaded]);
      }
    } catch (err) {
      alert(getStorageErrorMessage(err));
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Quick add photos from the list (for already existing work orders, without opening full details)
  const handleQuickPhotoAdd = (workOrderId: string) => {
    setQuickUploadWorkOrderId(workOrderId);
    fileInputRef.current?.click();
  };

  const handleQuickPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (quickUploadWorkOrderId && files) {
      await uploadPhotos(quickUploadWorkOrderId, files);
    }
    setQuickUploadWorkOrderId(null);
    e.target.value = '';
  };

  // Helper to get priority badge color
  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      Low: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
      Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
      High: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
      Urgent: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    };
    return variants[priority] || 'bg-muted';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      Open: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
      'In Progress': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
      Completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      Archived: 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300',
    };
    return variants[status] || 'bg-muted';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work Orders</h1>
          <p className="text-muted-foreground text-sm">
            Track maintenance and repair tasks across properties
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Work Order
        </Button>
      </div>

      {/* Load error banner */}
      {loadErrorMessage && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
          <strong>Could not load work orders:</strong> {loadErrorMessage}
          <div className="mt-2 text-xs">
            Run the SQL from <code>supabase/work-orders.sql</code> in your Supabase project&apos;s
            SQL Editor (and create the &quot;work-order-photos&quot; storage bucket), then refresh.
          </div>
        </div>
      )}

      {/* List */}
      {workOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted text-muted-foreground mb-4 rounded-full p-4">
              <ClipboardList className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No work orders yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              No work orders yet. Create one to start tracking maintenance and repairs across your
              properties.
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create work order
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead
                  className="hover:bg-muted/50 cursor-pointer select-none"
                  onClick={() => toggleSort('property')}
                >
                  Property {sortColumn === 'property' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWorkOrders.map((wo) => (
                <TableRow
                  key={wo.id}
                  onClick={() => openDetail(wo)}
                  className="hover:bg-muted/50 cursor-pointer"
                >
                  <TableCell className="max-w-[160px] truncate font-medium" title={wo.title}>
                    {wo.title}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate" title={wo.properties?.name || ''}>
                    {wo.properties?.name ||
                      properties.find((p) => p.id === wo.property_id)?.name ||
                      wo.property_id ||
                      '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityBadge(wo.priority)}>{wo.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadge(wo.status)}>{wo.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {wo.cost ? `$${Number(wo.cost).toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell>
                    {wo.assigned_contractor || '—'}
                    {wo.assigned_contractor_email && (
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        ({wo.assigned_contractor_email})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickPhotoAdd(wo.id);
                        }}
                        title="Add Photos"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(wo);
                        }}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveWorkOrder(wo.id);
                        }}
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(wo);
                        }}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Work Order Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create New Work Order</DialogTitle>
            <DialogDescription>
              Fill out the details below. All fields except description and due date are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="e.g. Fix leaking faucet in kitchen"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Additional details about the issue..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Property *</label>
              <Select
                value={form.property_id}
                onValueChange={(val) => updateForm('property_id', val || '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select property">
                    {properties.find((p) => p.id === form.property_id)?.name || 'Select property'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={form.priority} onValueChange={(val) => updateForm('priority', val || '')}>
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
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => updateForm('due_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Cost (optional)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => updateForm('cost', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to Contractor (name)</label>
              <Input
                value={form.assigned_contractor}
                onChange={(e) => updateForm('assigned_contractor', e.target.value)}
                placeholder="e.g. ACME Plumbing"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contractor Email (for notification)</label>
              <Input
                type="email"
                value={form.assigned_contractor_email}
                onChange={(e) => updateForm('assigned_contractor_email', e.target.value)}
                placeholder="contractor@example.com"
              />
            </div>

            {/* Photos upload at creation time */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Photos (optional)</label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoFiles}
                disabled={creating}
              />
              {pendingPhotoPreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {pendingPhotoPreviews.map((preview, idx) => (
                    <div key={idx} className="relative h-16 w-16 overflow-hidden rounded border">
                      <img src={preview} alt="preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePendingPhoto(idx)}
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

            {formError && <p className="text-destructive text-sm">{formError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // cleanup previews if user cancels create
                  pendingPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
                  setPendingPhotoFiles([]);
                  setPendingPhotoPreviews([]);
                  setIsCreateOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Work Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail / View Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
          {selectedWorkOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedWorkOrder.title}</DialogTitle>
                <DialogDescription>
                  {selectedWorkOrder.properties?.name} • Created{' '}
                  {new Date(selectedWorkOrder.created_at).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Quick Status Update */}
                <div>
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <Select
                    value={selectedWorkOrder.status}
                    onValueChange={updateStatus}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Key Details */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">PRIORITY</div>
                    <Badge className={getPriorityBadge(selectedWorkOrder.priority)}>
                      {selectedWorkOrder.priority}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">DUE DATE</div>
                    <div>
                      {selectedWorkOrder.due_date
                        ? new Date(selectedWorkOrder.due_date).toLocaleDateString()
                        : 'Not set'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">PROPERTY</div>
                    <div>{selectedWorkOrder.properties?.name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">COST</div>
                    <div className="font-mono">
                      {selectedWorkOrder.cost
                        ? `$${Number(selectedWorkOrder.cost).toFixed(2)}`
                        : 'Not set'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">ASSIGNED CONTRACTOR</div>
                    <div>
                      {selectedWorkOrder.assigned_contractor || 'Not assigned'}
                      {selectedWorkOrder.assigned_contractor_email && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({selectedWorkOrder.assigned_contractor_email})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedWorkOrder.description && (
                  <div>
                    <div className="text-muted-foreground mb-1.5 text-xs">DESCRIPTION</div>
                    <p className="bg-muted/40 rounded-md p-3 text-sm whitespace-pre-wrap">
                      {selectedWorkOrder.description}
                    </p>
                  </div>
                )}

                {/* Photos Section - enhanced for existing work orders */}
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">Photos</div>

                    {/* Add more photos - staged with naming support */}
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleDetailPhotoFiles}
                          disabled={uploadingPhotos}
                        />
                        <span
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'cursor-pointer',
                            uploadingPhotos && 'pointer-events-none opacity-50'
                          )}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Add Photos
                        </span>
                      </label>

                      {pendingDetailPhotos.length > 0 && (
                        <Button
                          size="sm"
                          onClick={uploadPendingDetailPhotos}
                          disabled={uploadingPhotos}
                        >
                          {uploadingPhotos ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Upload {pendingDetailPhotos.length}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Pending uploads with editable names (for new photos) */}
                  {pendingDetailPhotos.length > 0 && (
                    <div className="bg-muted/30 mb-4 rounded-md border p-3">
                      <div className="text-muted-foreground mb-2 text-xs font-medium">
                        Photos to upload (edit names before uploading):
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {pendingDetailPhotos.map((p, idx) => (
                          <div key={idx} className="relative flex flex-col gap-1">
                            <div className="relative aspect-video overflow-hidden rounded border bg-black/5">
                              <img
                                src={p.preview}
                                alt="preview"
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removePendingDetailPhoto(idx)}
                                className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-black"
                                aria-label="Remove"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <Input
                              value={p.name}
                              onChange={(e) => updatePendingDetailName(idx, e.target.value)}
                              placeholder="Photo name"
                              className="h-7 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Loading photos skeleton */}
                  {loadingPhotos && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="bg-muted aspect-video rounded-md" />
                          <div className="bg-muted mt-2 h-3 w-3/4 rounded" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Existing photos with multi-select, names, full screen, single delete */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-muted-foreground text-xs">
                      {photos.length} photo{photos.length !== 1 ? 's' : ''}
                    </div>
                    {photos.length > 0 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllPhotos}>
                          Select all
                        </Button>
                        <Button variant="outline" size="sm" onClick={deselectAllPhotos}>
                          Deselect
                        </Button>
                        {selectedPhotoIds.size > 0 && (
                          <Button variant="destructive" size="sm" onClick={deleteSelectedPhotos}>
                            Delete selected ({selectedPhotoIds.size})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {photos.map((photo) => {
                        const isSelected = selectedPhotoIds.has(photo.id);
                        const displayName =
                          photo.name || photo.url.split('/').pop()?.split('?')[0] || 'Untitled';

                        return (
                          <div
                            key={photo.id}
                            className={cn(
                              'group bg-muted relative overflow-hidden rounded-md border',
                              isSelected && 'ring-primary ring-2'
                            )}
                          >
                            {/* Checkbox for multi-select */}
                            <div className="absolute top-2 left-2 z-10">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePhotoSelection(photo.id)}
                                className="accent-primary h-4 w-4 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>

                            {/* X delete single */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSinglePhoto(photo);
                              }}
                              className="absolute top-2 right-2 z-10 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                              aria-label="Delete photo"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>

                            {/* Image - click for full screen */}
                            <div
                              className="aspect-video cursor-zoom-in overflow-hidden"
                              onClick={() => openFullScreen(photo)}
                            >
                              <img
                                src={photo.url}
                                alt={displayName}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            </div>

                            {/* Name - editable inline */}
                            <div className="p-2 text-xs">
                              <input
                                value={photo.name || ''}
                                onChange={(e) => {
                                  // live update local for responsiveness
                                  const newName = e.target.value;
                                  setPhotos((prev) =>
                                    prev.map((p) =>
                                      p.id === photo.id ? { ...p, name: newName } : p
                                    )
                                  );
                                }}
                                onBlur={(e) => updatePhotoName(photo.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                placeholder="Photo name"
                                className="focus:bg-background w-full rounded bg-transparent text-xs font-medium outline-none focus:px-1"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
                      No photos yet. Use “Add Photos” above to attach images.
                    </div>
                  )}
                </div>

                {/* Full screen photo viewer */}
                {fullScreenPhoto && (
                  <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
                    onClick={closeFullScreen}
                  >
                    <div
                      className="relative max-h-[92vh] max-w-[95vw]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Close X */}
                      <button
                        onClick={closeFullScreen}
                        className="absolute -top-3 -right-3 z-10 rounded-full bg-black/70 p-2 text-white hover:bg-black"
                        aria-label="Close full screen"
                      >
                        <X className="h-5 w-5" />
                      </button>

                      <img
                        src={fullScreenPhoto.url}
                        alt={fullScreenPhoto.name || 'Work order photo'}
                        className="max-h-[85vh] max-w-full rounded object-contain shadow-2xl"
                      />

                      <div className="mt-3 flex items-center justify-between text-sm text-white/90">
                        <input
                          value={fullScreenPhoto.name || ''}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setPhotos((prev) =>
                              prev.map((p) =>
                                p.id === fullScreenPhoto.id ? { ...p, name: newName } : p
                              )
                            );
                            setFullScreenPhoto({ ...fullScreenPhoto, name: newName });
                          }}
                          onBlur={(e) => updatePhotoName(fullScreenPhoto.id, e.target.value)}
                          className="rounded bg-black/40 px-2 py-1 text-white placeholder-white/60 focus:bg-black/60"
                          placeholder="Photo name"
                        />

                        <button
                          onClick={() => deleteSinglePhoto(fullScreenPhoto)}
                          className="flex items-center gap-1 rounded bg-red-600/80 px-3 py-1 text-sm hover:bg-red-600"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={closeDetail}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => archiveWorkOrder(selectedWorkOrder.id)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    closeDetail();
                    requestDelete(selectedWorkOrder);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this work order?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The work order and any attached photos will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden file input for quick "add photos" from the list row (for already created work orders) */}
      <input
        type="file"
        multiple
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleQuickPhotoSelect}
      />
    </div>
  );
}
