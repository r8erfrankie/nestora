'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { formatUnit, getLabelWord } from '@/lib/unit-label';
import Link from 'next/link';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { deleteWorkOrder, createWorkOrder, updateWorkOrderStatus, updateContractorAssignment, updateWorkOrderBudget, toggleWorkOrderPaid, respondToContractorQuote } from './crud-actions';
import { createContractor } from '../teams/contractor-actions';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { formatPhone, isValidPhoneNumber } from '@/lib/phone';
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
import { Plus, Eye, Upload, Loader2, ClipboardList, Archive, ArchiveRestore, Trash2, X, Pencil, Phone, ChevronDown, CheckCircle2, Check, ThumbsDown } from 'lucide-react';
import { archiveWorkOrderForUser, unarchiveWorkOrderForUser } from '@/app/actions/archive-actions';
import { ensureJpeg } from '@/lib/convert-heic';
import { WorkOrderNotes } from '@/app/components/work-order-notes';

interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  unit: string | null;
  assigned_contractor: string | null;
  assigned_contractor_email: string | null;
  assigned_contractor_phone?: string | null;
  trade?: string | null;
  property_id: string;
  properties: { id: string; name: string; unit_label_type?: string | null } | null;
  notes?: string | null;
  cost?: number | null;
  contractor_quote?: number | null;
  quote_approved?: boolean | null;
  paid?: boolean | null;
  maintenance_request_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trade: string | null;
  // Populated for registered contractors (from profiles table via admin client)
  is_registered?: boolean;
  profile_name?: string | null;
  profile_phone?: string | null;
}

interface Property {
  id: string;
  name: string;
  unit_label_type?: string | null;
}

interface Photo {
  id: string;
  url: string;
  name: string | null;
  created_at: string;
  uploaded_by_role?: string | null;
  // Tracks the specific user who uploaded. NULL on old rows where the contractor
  // account was not yet linked at upload time (see add-photo-uploaded-by.sql).
  uploaded_by?: string | null;
}

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
const STATUSES = ['Open', 'Accepted', 'In Progress', 'Completed', 'Archived'] as const;
const TRADES = [
  'General',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Roofing',
  'Carpentry',
  'Painting',
  'Flooring',
  'Landscaping',
  'Appliance Repair',
  'Pest Control',
  'Cleaning',
  'Locksmith',
] as const;
const TRADES_SET = new Set<string>(TRADES as unknown as string[]);

const PRIORITY_ORDER = ['Urgent', 'High', 'Medium', 'Low'] as const;
type GroupBy = 'property' | 'priority' | 'contractor' | 'tenant' | 'none';

export function WorkOrdersClient({
  initialWorkOrders,
  properties,
  contractors,
  archivedWorkOrderIds,
  linkedWorkOrderMap = {} as Record<string, { requestId: string; unit: string | null }>,
  loadError,
  autoOpenCreate = false,
  prefillPropertyId,
  prefillUnit,
  currentUserId = '',
}: {
  initialWorkOrders: WorkOrder[];
  properties: Property[];
  contractors: Contractor[];
  archivedWorkOrderIds: string[];
  linkedWorkOrderMap?: Record<string, { requestId: string; unit: string | null }>;
  loadError?: { message?: string; details?: string; hint?: string; code?: string } | null;
  autoOpenCreate?: boolean;
  prefillPropertyId?: string;
  prefillUnit?: string;
  currentUserId?: string;
}) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set(archivedWorkOrderIds));
  const [isCreateOpen, setIsCreateOpen] = useState(autoOpenCreate);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Multi-select for photos in detail view
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Full-screen lightbox — YARL portals to document.body, bypassing Dialog stacking context
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Pending photos for upload in the detail view (to allow naming before upload)
  const [pendingDetailPhotos, setPendingDetailPhotos] = useState<
    Array<{ file: File; name: string; preview: string }>
  >([]);

  // Contractors from Teams directory (kept in local state so quick-add updates the list)
  const [localContractors, setLocalContractors] = useState<Contractor[]>(contractors);

  // Quick-add contractor mini-dialog (inline within create/edit forms)
  const [addContractorOpen, setAddContractorOpen] = useState(false);
  const [addContractorForm, setAddContractorForm] = useState({
    name: '',
    email: '',
    phone: '',
    trade: '',
    customTrade: '',
  });
  const [addingContractor, setAddingContractor] = useState(false);

  // Form state for create
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    due_date: '',
    property_id: autoOpenCreate && prefillPropertyId ? prefillPropertyId : (properties[0]?.id || ''),
    unit: autoOpenCreate && prefillUnit ? prefillUnit : '',
    assigned_contractor: '',
    assigned_contractor_email: '',
    assigned_contractor_phone: '',
    trade: '',
    customTrade: '',
    contractorKey: '',
    cost: '',
  });

  // Notes refresh counter — bump after any mutation that logs a system note
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);

  // Budget inline-edit state (detail view)
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingPaid, setSavingPaid] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);

  // Contractor re-assignment state (detail view)
  const [editingContractor, setEditingContractor] = useState(false);
  const [contractorEdit, setContractorEdit] = useState({
    name: '',
    email: '',
    phone: '',
    trade: '',
    customTrade: '',
  });
  const [savingContractor, setSavingContractor] = useState(false);
  const [editContractorKey, setEditContractorKey] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sorting (by property name for multi-property owners/managers)
  const [sortColumn, setSortColumn] = useState<'property' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Grouping
  const [groupBy, setGroupBy] = useState<GroupBy>('property');
  const [collapsedByGroup, setCollapsedByGroup] = useState<Record<string, string[]>>({});

  useEffect(() => {
    try {
      const gb = localStorage.getItem('wo-groupby') as GroupBy | null;
      const VALID: GroupBy[] = ['property', 'priority', 'contractor', 'tenant', 'none'];
      if (gb && VALID.includes(gb)) setGroupBy(gb);
      const collapsed = localStorage.getItem('wo-collapsed-groups');
      if (collapsed) setCollapsedByGroup(JSON.parse(collapsed));
    } catch {}
  }, []);

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


  // Set for O(1) banner/icon lookups — derived from maintenance_requests.converted_to_work_order_id
  const linkedSet = useMemo(() => new Set(Object.keys(linkedWorkOrderMap)), [linkedWorkOrderMap]);

  const activeWorkOrders = useMemo(
    () => workOrders.filter((wo) => !archivedIds.has(wo.id)),
    [workOrders, archivedIds]
  );

  const archivedWorkOrders = useMemo(
    () => workOrders.filter((wo) => archivedIds.has(wo.id)),
    [workOrders, archivedIds]
  );

  // Computed sorted list for the current view (client-side for simplicity)
  const sortedWorkOrders = useMemo(() => {
    const list = view === 'active' ? activeWorkOrders : archivedWorkOrders;
    if (!sortColumn) return list;

    return [...list].sort((a, b) => {
      const aName =
        a.properties?.name || properties.find((p) => p.id === a.property_id)?.name || '';
      const bName =
        b.properties?.name || properties.find((p) => p.id === b.property_id)?.name || '';
      const comparison = aName.localeCompare(bName);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [view, activeWorkOrders, archivedWorkOrders, sortColumn, sortDirection, properties]);

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

  // Grouped work orders for the current view
  const groupedOrders = useMemo(() => {
    const list = sortedWorkOrders;
    if (groupBy === 'none') return [{ key: 'all', label: 'All', orders: list }];

    const groups = new Map<string, WorkOrder[]>();
    for (const wo of list) {
      let key: string;
      switch (groupBy) {
        case 'property':
          key = wo.properties?.name || properties.find((p) => p.id === wo.property_id)?.name || 'Unknown Property';
          break;
        case 'priority':
          key = wo.priority || 'None';
          break;
        case 'contractor':
          key = wo.assigned_contractor || 'Unassigned';
          break;
        case 'tenant':
          key = linkedSet.has(wo.id) ? 'From Tenant Request' : 'Created Directly';
          break;
        default:
          key = 'all';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(wo);
    }

    const entries = [...groups.entries()].map(([key, orders]) => ({ key, label: key, orders }));

    if (groupBy === 'priority') {
      entries.sort((a, b) => {
        const ai = PRIORITY_ORDER.indexOf(a.key as typeof PRIORITY_ORDER[number]);
        const bi = PRIORITY_ORDER.indexOf(b.key as typeof PRIORITY_ORDER[number]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    } else {
      entries.sort((a, b) => {
        if (groupBy === 'contractor' && a.key === 'Unassigned') return 1;
        if (groupBy === 'contractor' && b.key === 'Unassigned') return -1;
        return a.key.localeCompare(b.key);
      });
    }

    return entries;
  }, [sortedWorkOrders, groupBy, properties, linkedSet]);

  const collapsedGroups = useMemo(
    () => new Set(collapsedByGroup[groupBy] ?? []),
    [collapsedByGroup, groupBy]
  );

  const toggleGroup = (key: string) => {
    setCollapsedByGroup((prev) => {
      const current = [...(prev[groupBy] ?? [])];
      const idx = current.indexOf(key);
      if (idx >= 0) current.splice(idx, 1); else current.push(key);
      const next = { ...prev, [groupBy]: current };
      try { localStorage.setItem('wo-collapsed-groups', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleSetGroupBy = (val: GroupBy) => {
    setGroupBy(val);
    try { localStorage.setItem('wo-groupby', val); } catch {}
  };

  // Open create dialog (optionally pre-fill property and unit)
  const openCreate = (prefill?: { propertyId?: string; unit?: string }) => {
    setView('active');
    setForm({
      title: '',
      description: '',
      priority: 'Medium',
      due_date: '',
      property_id: prefill?.propertyId || properties[0]?.id || '',
      unit: prefill?.unit || '',
      assigned_contractor: '',
      assigned_contractor_email: '',
      assigned_contractor_phone: '',
      trade: '',
      customTrade: '',
      contractorKey: '',
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
    setLightboxOpen(false);
    setEditingContractor(false);
    setEditContractorKey('');
    setEditingBudget(false);
    setNotesRefreshKey(0);
  };

  const handleSaveContractor = async () => {
    if (!selectedWorkOrder) return;
    setSavingContractor(true);
    try {
      const effectiveTrade =
        contractorEdit.trade === 'Other'
          ? contractorEdit.customTrade.trim() || null
          : contractorEdit.trade || null;
      await updateContractorAssignment(selectedWorkOrder.id, {
        assigned_contractor: contractorEdit.name.trim() || null,
        assigned_contractor_email: contractorEdit.email.trim() || null,
        assigned_contractor_phone: contractorEdit.phone || null,
        trade: effectiveTrade,
      });
      const updated: WorkOrder = {
        ...selectedWorkOrder,
        assigned_contractor: contractorEdit.name.trim() || null,
        assigned_contractor_email: contractorEdit.email.trim() || null,
        assigned_contractor_phone: contractorEdit.phone || null,
        trade: effectiveTrade,
      };
      setSelectedWorkOrder(updated);
      setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setEditingContractor(false);
      setNotesRefreshKey((k) => k + 1);
    } catch {
      alert('Failed to update contractor assignment.');
    } finally {
      setSavingContractor(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!selectedWorkOrder) return;
    setSavingBudget(true);
    try {
      const newCost = budgetDraft.trim() ? parseFloat(budgetDraft) : null;
      await updateWorkOrderBudget(selectedWorkOrder.id, newCost);
      const updated: WorkOrder = { ...selectedWorkOrder, cost: newCost };
      setSelectedWorkOrder(updated);
      setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setEditingBudget(false);
      setNotesRefreshKey((k) => k + 1);
    } catch {
      alert('Failed to update budget.');
    } finally {
      setSavingBudget(false);
    }
  };

  const handleRespondToQuote = async (approved: boolean | null) => {
    if (!selectedWorkOrder) return;
    setSavingQuote(true);
    try {
      await respondToContractorQuote(selectedWorkOrder.id, approved);
      const updated: WorkOrder = { ...selectedWorkOrder, quote_approved: approved };
      setSelectedWorkOrder(updated);
      setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err) {
      console.error('Quote response failed:', err);
    } finally {
      setSavingQuote(false);
    }
  };

  const handleTogglePaid = async () => {
    if (!selectedWorkOrder) return;
    setSavingPaid(true);
    const newPaid = !selectedWorkOrder.paid;
    try {
      await toggleWorkOrderPaid(selectedWorkOrder.id, newPaid);
      const updated: WorkOrder = { ...selectedWorkOrder, paid: newPaid };
      setSelectedWorkOrder(updated);
      setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch {
      alert('Failed to update paid status.');
    } finally {
      setSavingPaid(false);
    }
  };

  // Quick-add a contractor to the Teams directory from within the work order form
  const handleAddContractor = async () => {
    if (!addContractorForm.name.trim()) return;
    setAddingContractor(true);
    try {
      const trade =
        addContractorForm.trade === 'Other'
          ? addContractorForm.customTrade.trim() || null
          : addContractorForm.trade || null;
      const result = await createContractor({
        name: addContractorForm.name.trim(),
        email: addContractorForm.email.trim() || null,
        phone: addContractorForm.phone || null,
        trade,
      });
      if (!result.success) throw new Error(result.error);
      const inserted = result.contractor as unknown as Contractor;
      setLocalContractors((prev) =>
        [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name))
      );
      // Auto-select the new contractor
      updateForm('contractorKey', inserted.id);
      updateForm('assigned_contractor', inserted.name);
      updateForm('assigned_contractor_email', inserted.email ?? '');
      updateForm('assigned_contractor_phone', inserted.phone ?? '');
      if (inserted.trade) {
        if (TRADES_SET.has(inserted.trade)) {
          updateForm('trade', inserted.trade);
          updateForm('customTrade', '');
        } else {
          updateForm('trade', 'Other');
          updateForm('customTrade', inserted.trade);
        }
      }
      setAddContractorOpen(false);
      setAddContractorForm({ name: '', email: '', phone: '', trade: '', customTrade: '' });
    } catch {
      alert('Failed to add contractor.');
    } finally {
      setAddingContractor(false);
    }
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
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[deleteWorkOrder]', msg);
      alert(`Failed to delete work order.\n\n${msg}`);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleArchive = async (wo: WorkOrder) => {
    if (!confirm(`Hide "${wo.title}" from your active list?`)) return;
    // Optimistic: move to archived view immediately
    setArchivedIds((prev) => new Set([...prev, wo.id]));
    closeDetail();
    try {
      await archiveWorkOrderForUser(wo.id);
    } catch {
      // Revert on failure
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(wo.id);
        return next;
      });
      alert('Failed to archive work order.');
    }
  };

  const handleUnarchive = async (wo: WorkOrder) => {
    // Optimistic: move back to active view immediately
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.delete(wo.id);
      return next;
    });
    closeDetail();
    try {
      await unarchiveWorkOrderForUser(wo.id);
    } catch {
      // Revert on failure
      setArchivedIds((prev) => new Set([...prev, wo.id]));
      alert('Failed to unarchive work order.');
    }
  };

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files || []);
    if (raw.length === 0) return;
    e.target.value = '';
    // Convert any HEIC/HEIF files to JPEG before generating previews or uploading.
    const files = await Promise.all(raw.map(ensureJpeg));
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPendingPhotoFiles((prev) => [...prev, ...files]);
    setPendingPhotoPreviews((prev) => [...prev, ...newPreviews]);
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
          uploaded_by: currentUserId || null,
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

  const handleDetailPhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files || []);
    if (raw.length === 0) return;
    e.target.value = '';
    // Convert any HEIC/HEIF files to JPEG before generating previews or uploading.
    const files = await Promise.all(raw.map(ensureJpeg));
    const newPending = files.map((file) => {
      const defaultName = file.name.replace(/\.[^/.]+$/, ''); // strip extension
      return {
        file,
        name: defaultName,
        preview: URL.createObjectURL(file),
      };
    });
    setPendingDetailPhotos((prev) => [...prev, ...newPending]);
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
            uploaded_by: currentUserId || null,
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
      setLightboxOpen(false);
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
    } catch (err) {
      alert('Failed to rename photo.');
    }
  };

  const openFullScreen = (photo: Photo) => {
    const idx = photos.findIndex((p) => p.id === photo.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const closeFullScreen = () => setLightboxOpen(false);

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

      const effectiveTrade =
        form.trade === 'Other'
          ? form.customTrade.trim() || null
          : form.trade || null;

      const result = await createWorkOrder({
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        property_id: form.property_id,
        unit: form.unit.trim() || null,
        assigned_contractor: form.assigned_contractor.trim() || null,
        assigned_contractor_email: form.assigned_contractor_email.trim() || null,
        assigned_contractor_phone: form.assigned_contractor_phone || null,
        trade: effectiveTrade,
        cost: form.cost ? parseFloat(form.cost) : 0,
        propertyName: prop?.name || null,
        unit_label_type: prop?.unit_label_type ?? null,
      });

      if (result.error) {
        setFormError(result.error);
        return;
      }

      const inserted = result.data;
      if (inserted) {
        // Enrich with property name from local list to avoid join permission issues
        const newWO: WorkOrder = {
          ...(inserted as unknown as WorkOrder),
          properties: prop ? { id: prop.id, name: prop.name, unit_label_type: prop.unit_label_type } : null,
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
        'Failed to create work order. Please try again.';
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
      setNotesRefreshKey((k) => k + 1);
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

    const uploadPromises = Array.from(files).map(async (raw) => {
      const file = await ensureJpeg(raw);
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
          uploaded_by: currentUserId || null,
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
      Accepted: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
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
        {view === 'active' && (
          <Button onClick={() => openCreate()} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Work Order
          </Button>
        )}
      </div>

      {/* View tabs + Group by */}
      <div className="flex items-end justify-between border-b">
        <div className="flex gap-1">
          <button
            onClick={() => setView('active')}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              view === 'active'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Active{activeWorkOrders.length > 0 ? ` (${activeWorkOrders.length})` : ''}
          </button>
          <button
            onClick={() => setView('archived')}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              view === 'archived'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Archived{archivedWorkOrders.length > 0 ? ` (${archivedWorkOrders.length})` : ''}
          </button>
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <span className="text-muted-foreground text-xs">Group by</span>
          <Select value={groupBy} onValueChange={(v) => handleSetGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="property">Property</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="tenant">Tenant Request</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
      {sortedWorkOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center sm:py-16">
            <div className="bg-muted text-muted-foreground mb-3 rounded-full p-4 sm:mb-4">
              {view === 'archived' ? (
                <Archive className="h-8 w-8" />
              ) : (
                <ClipboardList className="h-8 w-8" />
              )}
            </div>
            {view === 'archived' ? (
              <>
                <h3 className="mb-2 text-lg font-semibold">No archived work orders</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                  Work orders you archive will appear here. They remain visible only in this view.
                </p>
                <Button variant="outline" onClick={() => setView('active')}>
                  Back to Active
                </Button>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-lg font-semibold">No work orders yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                  Create your first work order to start tracking maintenance and repairs across your properties.
                </p>
                <Button onClick={() => openCreate()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create work order
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : groupBy === 'none' ? (
        /* Flat table (no grouping) */
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead
                  className="hover:bg-muted/50 active:bg-muted/80 cursor-pointer select-none"
                  onClick={() => toggleSort('property')}
                >
                  Property {sortColumn === 'property' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="w-px whitespace-nowrap px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWorkOrders.map((wo) => (
                <WorkOrderRow
                  key={wo.id}
                  wo={wo}
                  groupBy={groupBy}
                  linkedSet={linkedSet}
                  linkedWorkOrderMap={linkedWorkOrderMap}
                  properties={properties}
                  view={view}
                  getPriorityBadge={getPriorityBadge}
                  getStatusBadge={getStatusBadge}
                  onOpen={openDetail}
                  onQuickPhoto={handleQuickPhotoAdd}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  onDelete={requestDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Grouped sections */
        <div className="space-y-2">
          {groupedOrders.map(({ key, label, orders }) => {
            const isCollapsed = collapsedGroups.has(key);
            return (
              <div key={key} className="overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  className="flex w-full items-center gap-3 bg-muted px-4 py-2.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                >
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="overflow-x-auto border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          {groupBy !== 'property' && (
                            <TableHead
                              className="hover:bg-muted/50 active:bg-muted/80 cursor-pointer select-none"
                              onClick={() => toggleSort('property')}
                            >
                              Property {sortColumn === 'property' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                            </TableHead>
                          )}
                          {groupBy !== 'priority' && <TableHead>Priority</TableHead>}
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          {groupBy !== 'contractor' && <TableHead>Assigned To</TableHead>}
                          <TableHead className="w-px whitespace-nowrap px-3 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((wo) => (
                          <WorkOrderRow
                            key={wo.id}
                            wo={wo}
                            groupBy={groupBy}
                            linkedSet={linkedSet}
                            linkedWorkOrderMap={linkedWorkOrderMap}
                            properties={properties}
                            view={view}
                            getPriorityBadge={getPriorityBadge}
                            getStatusBadge={getStatusBadge}
                            onOpen={openDetail}
                            onQuickPhoto={handleQuickPhotoAdd}
                            onArchive={handleArchive}
                            onUnarchive={handleUnarchive}
                            onDelete={requestDelete}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Work Order Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create New Work Order</DialogTitle>
            <DialogDescription>
              Fill out the details below. All fields except description and due date are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="e.g. Fix leaking faucet in kitchen"
                className="!h-11 sm:!h-8"
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
                className="min-h-[80px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Property *</label>
              <Select
                value={form.property_id}
                onValueChange={(val) => updateForm('property_id', val || '')}
              >
                <SelectTrigger className="!h-11 w-full sm:!h-8">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {getLabelWord(properties.find((p) => p.id === form.property_id)?.unit_label_type)}{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                value={form.unit}
                onChange={(e) => updateForm('unit', e.target.value)}
                placeholder="e.g. 12, B, Main House"
                className="!h-11 sm:!h-8"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={form.priority} onValueChange={(val) => updateForm('priority', val || '')}>
                  <SelectTrigger className="!h-11 sm:!h-8">
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
                  className="!h-11 sm:!h-8 bg-background"
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
                className="!h-11 sm:!h-8"
              />
            </div>

            {/* Contractor + photos — grouped so the form feels shorter */}
            <div className="border-border/60 space-y-3 border-t pt-3 sm:space-y-4 sm:pt-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Contractor, Trade &amp; Photos — optional
              </p>

            {/* Trade */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-sm font-medium">Trade</label>
              <Select value={form.trade} onValueChange={(v) => updateForm('trade', v ?? '')}>
                <SelectTrigger className="!h-11 sm:!h-8">
                  <SelectValue placeholder="Select trade (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {TRADES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other / Custom</SelectItem>
                </SelectContent>
              </Select>
              {form.trade === 'Other' && (
                <Input
                  value={form.customTrade}
                  onChange={(e) => updateForm('customTrade', e.target.value)}
                  placeholder="Enter trade name"
                  className="!h-11 sm:!h-8"
                />
              )}
            </div>

            {/* Contractor picker from Teams directory */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Contractor</label>
                <button
                  type="button"
                  onClick={() => {
                    setAddContractorForm({ name: '', email: '', phone: '', trade: '', customTrade: '' });
                    setAddContractorOpen(true);
                  }}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  + Add new
                </button>
              </div>
              <Select
                value={form.contractorKey}
                onValueChange={(val) => {
                  updateForm('contractorKey', val ?? '');
                  const c = localContractors.find((k) => k.id === val);
                  if (c) {
                    updateForm('assigned_contractor', c.name);
                    updateForm('assigned_contractor_email', c.email ?? '');
                    updateForm('assigned_contractor_phone', c.phone ?? '');
                    if (c.trade) {
                      if (TRADES_SET.has(c.trade)) {
                        updateForm('trade', c.trade);
                        updateForm('customTrade', '');
                      } else {
                        updateForm('trade', 'Other');
                        updateForm('customTrade', c.trade);
                      }
                    }
                  }
                }}
              >
                <SelectTrigger className="!h-11 sm:!h-8">
                  <SelectValue placeholder={localContractors.length > 0 ? 'Choose a contractor' : 'No contractors saved yet'}>
                    {(() => {
                      const c = localContractors.find((k) => k.id === form.contractorKey);
                      return c ? `${c.name}${c.trade ? ` · ${c.trade}` : ''}` : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {localContractors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.trade ? ` · ${c.trade}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={form.assigned_contractor}
                onChange={(e) => {
                  updateForm('assigned_contractor', e.target.value);
                  updateForm('contractorKey', '');
                }}
                placeholder="e.g. ACME Plumbing"
                className="!h-11 sm:!h-8"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.assigned_contractor_email}
                  onChange={(e) => {
                    updateForm('assigned_contractor_email', e.target.value);
                    updateForm('contractorKey', '');
                  }}
                  placeholder="contractor@example.com"
                  className="!h-11 sm:!h-8"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <PhoneInput
                  value={form.assigned_contractor_phone || undefined}
                  onChange={(v) => {
                    updateForm('assigned_contractor_phone', v ?? '');
                    updateForm('contractorKey', '');
                  }}
                />
              </div>
            </div>

            {/* Photos upload at creation time */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Photos</label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoFiles}
                disabled={creating}
                className="!h-11 sm:!h-8"
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
            </div> {/* end contractor & photos section */}

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

      {/* Quick-add contractor to Teams directory */}
      <Dialog open={addContractorOpen} onOpenChange={(open) => !open && setAddContractorOpen(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Contractor</DialogTitle>
            <DialogDescription>Save to your Teams directory and auto-assign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
              <Input
                value={addContractorForm.name}
                onChange={(e) => setAddContractorForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. ACME Plumbing"
                className="!h-11 sm:!h-8"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Trade</label>
              <Select
                value={addContractorForm.trade}
                onValueChange={(v) => setAddContractorForm((p) => ({ ...p, trade: v ?? '' }))}
              >
                <SelectTrigger className="!h-11 sm:!h-8">
                  <SelectValue placeholder="Select trade (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {TRADES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other / Custom</SelectItem>
                </SelectContent>
              </Select>
              {addContractorForm.trade === 'Other' && (
                <Input
                  value={addContractorForm.customTrade}
                  onChange={(e) => setAddContractorForm((p) => ({ ...p, customTrade: e.target.value }))}
                  placeholder="Enter trade name"
                  className="!h-11 sm:!h-8"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={addContractorForm.email}
                  onChange={(e) => setAddContractorForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="!h-11 sm:!h-8"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <PhoneInput
                  value={addContractorForm.phone || undefined}
                  onChange={(v) => setAddContractorForm((p) => ({ ...p, phone: v ?? '' }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContractorOpen(false)}>Cancel</Button>
            <Button onClick={handleAddContractor} disabled={addingContractor || !addContractorForm.name.trim()}>
              {addingContractor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add &amp; Assign
            </Button>
          </DialogFooter>
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
                {/* Maintenance request origin banner */}
                {linkedSet.has(selectedWorkOrder.id) && (
                  <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                    <ClipboardList className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="min-w-0 flex-1 text-blue-600 dark:text-blue-400">
                      Converted from a maintenance request
                    </span>
                    <Link
                      href={`/tenants?expandRequest=${linkedWorkOrderMap[selectedWorkOrder.id]?.requestId ?? ''}`}
                      onClick={closeDetail}
                      className="text-primary shrink-0 text-xs underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                      View on Tenants page →
                    </Link>
                  </div>
                )}

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
                    <div>
                      {selectedWorkOrder.properties?.name}
                      {(selectedWorkOrder.unit || linkedWorkOrderMap[selectedWorkOrder.id]?.unit) && (
                        <span className="text-muted-foreground">
                          {' • '}
                          {formatUnit(
                            selectedWorkOrder.unit || linkedWorkOrderMap[selectedWorkOrder.id]!.unit,
                            selectedWorkOrder.properties?.unit_label_type
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">BUDGET</div>
                    {editingBudget ? (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm">
                            $
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={budgetDraft}
                            onChange={(e) => setBudgetDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveBudget();
                              if (e.key === 'Escape') setEditingBudget(false);
                            }}
                            className="h-8 w-32 pl-6 font-mono text-sm"
                            autoFocus
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleSaveBudget}
                          disabled={savingBudget}
                          className="h-8 text-xs"
                        >
                          {savingBudget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingBudget(false)}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono">
                          {selectedWorkOrder.cost != null
                            ? `$${Number(selectedWorkOrder.cost).toFixed(2)}`
                            : 'Not set'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetDraft(
                              selectedWorkOrder.cost != null ? String(selectedWorkOrder.cost) : ''
                            );
                            setEditingBudget(true);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">CONTRACTOR QUOTE</div>
                    {selectedWorkOrder.contractor_quote != null ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold">
                            ${Number(selectedWorkOrder.contractor_quote).toFixed(2)}
                          </span>
                          {selectedWorkOrder.quote_approved === true && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <Check className="h-3 w-3" /> Accepted
                            </span>
                          )}
                          {selectedWorkOrder.quote_approved === false && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <ThumbsDown className="h-3 w-3" /> Declined
                            </span>
                          )}
                          {selectedWorkOrder.quote_approved === true && (
                            <button
                              onClick={handleTogglePaid}
                              disabled={savingPaid}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                                selectedWorkOrder.paid
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border-border text-muted-foreground hover:border-input hover:text-foreground'
                              )}
                            >
                              {savingPaid ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              {selectedWorkOrder.paid ? 'Paid' : 'Mark paid'}
                            </button>
                          )}
                        </div>
                        {selectedWorkOrder.quote_approved == null && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRespondToQuote(true)}
                              disabled={savingQuote}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                            >
                              {savingQuote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespondToQuote(false)}
                              disabled={savingQuote}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                            >
                              <ThumbsDown className="h-3 w-3" /> Decline
                            </button>
                          </div>
                        )}
                        {selectedWorkOrder.quote_approved != null && (
                          <button
                            onClick={() => handleRespondToQuote(null)}
                            disabled={savingQuote}
                            className="text-muted-foreground text-xs underline-offset-2 hover:underline disabled:opacity-50"
                          >
                            Undo decision
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground font-sans text-sm">No quote submitted yet</span>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-muted-foreground mb-1 text-xs">ASSIGNED CONTRACTOR</div>

                    {editingContractor ? (
                      <div className="space-y-3">
                        {localContractors.length > 0 && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Pick from team</label>
                            <Select
                              value={editContractorKey}
                              onValueChange={(val) => {
                                setEditContractorKey(val ?? '');
                                const c = localContractors.find((k) => k.id === val);
                                if (c) {
                                  setContractorEdit({
                                    name: c.name,
                                    email: c.email ?? '',
                                    phone: c.phone ?? '',
                                    trade: c.trade
                                      ? TRADES_SET.has(c.trade) ? c.trade : 'Other'
                                      : '',
                                    customTrade: c.trade && !TRADES_SET.has(c.trade) ? c.trade : '',
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="!h-11 sm:!h-8">
                                <SelectValue placeholder="Choose from your team…">
                                  {(() => {
                                    const c = localContractors.find((k) => k.id === editContractorKey);
                                    return c ? `${c.name}${c.trade ? ` · ${c.trade}` : ''}` : undefined;
                                  })()}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {localContractors.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}{c.trade ? ` · ${c.trade}` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Name</label>
                            <Input
                              value={contractorEdit.name}
                              onChange={(e) =>
                                setContractorEdit((p) => ({ ...p, name: e.target.value }))
                              }
                              placeholder="e.g. ACME Plumbing"
                              className="!h-11 sm:!h-8"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Email</label>
                            <Input
                              type="email"
                              value={contractorEdit.email}
                              onChange={(e) =>
                                setContractorEdit((p) => ({ ...p, email: e.target.value }))
                              }
                              placeholder="contractor@example.com"
                              className="!h-11 sm:!h-8"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Phone</label>
                            <PhoneInput
                              value={contractorEdit.phone || undefined}
                              onChange={(v) => setContractorEdit((p) => ({ ...p, phone: v ?? '' }))}
                            />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-xs font-medium">Trade</label>
                            <Select
                              value={contractorEdit.trade}
                              onValueChange={(v) =>
                                setContractorEdit((p) => ({ ...p, trade: v ?? '' }))
                              }
                            >
                              <SelectTrigger className="!h-11 sm:!h-8">
                                <SelectValue placeholder="Select trade (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                {TRADES.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                                <SelectItem value="Other">Other / Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            {contractorEdit.trade === 'Other' && (
                              <Input
                                value={contractorEdit.customTrade}
                                onChange={(e) =>
                                  setContractorEdit((p) => ({
                                    ...p,
                                    customTrade: e.target.value,
                                  }))
                                }
                                placeholder="Enter trade name"
                                className="mt-2 !h-11 sm:!h-8"
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={savingContractor}
                            onClick={handleSaveContractor}
                          >
                            {savingContractor && (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingContractor(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (() => {
                        // Prefer the contractor's own profile data for registered contractors.
                        const matchedContractor = localContractors.find(
                          (lc) =>
                            lc.email?.toLowerCase() ===
                            (selectedWorkOrder.assigned_contractor_email ?? '').toLowerCase()
                        );
                        const isRegistered = !!matchedContractor?.is_registered;
                        const displayName =
                          matchedContractor?.profile_name ||
                          selectedWorkOrder.assigned_contractor;
                        const displayPhone =
                          matchedContractor?.profile_phone ||
                          selectedWorkOrder.assigned_contractor_phone;
                        return (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {displayName || 'Not assigned'}
                        </span>
                        {selectedWorkOrder.assigned_contractor_email && (
                          <span className="text-muted-foreground text-xs">
                            ({selectedWorkOrder.assigned_contractor_email})
                          </span>
                        )}
                        {displayPhone && (
                          <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Phone className="h-3 w-3" />
                            {formatPhone(displayPhone) ?? displayPhone}
                          </span>
                        )}
                        {selectedWorkOrder.trade && (
                          <Badge variant="secondary" className="text-xs">
                            {selectedWorkOrder.trade}
                          </Badge>
                        )}
                        {/* Registered contractors own their profile — hide edit pencil */}
                        {!isRegistered && (
                          <button
                            type="button"
                            onClick={() => {
                              const currentTrade = selectedWorkOrder.trade ?? '';
                              const isPreset = TRADES_SET.has(currentTrade);
                              setContractorEdit({
                                name: selectedWorkOrder.assigned_contractor ?? '',
                                email: selectedWorkOrder.assigned_contractor_email ?? '',
                                phone: selectedWorkOrder.assigned_contractor_phone ?? '',
                                trade: currentTrade
                                  ? isPreset ? currentTrade : 'Other'
                                  : '',
                                customTrade: isPreset ? '' : currentTrade,
                              });
                              const matched = localContractors.find(
                                (lc) =>
                                  lc.email?.toLowerCase() ===
                                  (selectedWorkOrder.assigned_contractor_email ?? '').toLowerCase()
                              );
                              setEditContractorKey(matched?.id ?? '');
                              setEditingContractor(true);
                            }}
                            className="text-muted-foreground hover:text-foreground -ml-0.5 rounded p-1 transition-colors"
                            aria-label="Edit contractor assignment"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                        );
                      })()}
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
                              className="h-7 text-base md:text-xs"
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
                              className="relative aspect-video cursor-zoom-in overflow-hidden"
                              onClick={() => openFullScreen(photo)}
                            >
                              <img
                                src={photo.url}
                                alt={displayName}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                              {photo.uploaded_by_role === 'contractor' && (
                                <div className="absolute bottom-1 left-1 rounded bg-violet-600/80 px-1 py-0.5 text-[10px] leading-none text-white">
                                  Contractor
                                </div>
                              )}
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
                                className="focus:bg-background w-full rounded bg-transparent text-base font-medium outline-none focus:px-1 md:text-xs"
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

                {/* YARL lightbox — portals to document.body, not trapped by Dialog stacking context */}
                <Lightbox
                  open={lightboxOpen}
                  close={closeFullScreen}
                  index={lightboxIndex}
                  slides={photos.map((p) => ({ src: p.url, alt: p.name || '' }))}
                  plugins={[Counter]}
                />

                {/* Activity log + manual notes */}
                <WorkOrderNotes
                  workOrderId={selectedWorkOrder.id}
                  refreshKey={notesRefreshKey}
                />
              </div>

              <DialogFooter className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={closeDetail}>
                  Close
                </Button>
                {archivedIds.has(selectedWorkOrder.id) ? (
                  <Button variant="outline" onClick={() => handleUnarchive(selectedWorkOrder)}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Unarchive
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => handleArchive(selectedWorkOrder)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                )}
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

function WorkOrderRow({
  wo,
  groupBy,
  linkedSet,
  linkedWorkOrderMap,
  properties,
  view,
  getPriorityBadge,
  getStatusBadge,
  onOpen,
  onQuickPhoto,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  wo: WorkOrder;
  groupBy: GroupBy;
  linkedSet: Set<string>;
  linkedWorkOrderMap: Record<string, { requestId: string; unit: string | null }>;
  properties: Property[];
  view: 'active' | 'archived';
  getPriorityBadge: (p: string) => string;
  getStatusBadge: (s: string) => string;
  onOpen: (wo: WorkOrder) => void;
  onQuickPhoto: (id: string) => void;
  onArchive: (wo: WorkOrder) => void;
  onUnarchive: (wo: WorkOrder) => void;
  onDelete: (wo: WorkOrder) => void;
}) {
  const propName = wo.properties?.name || properties.find((p) => p.id === wo.property_id)?.name || wo.property_id || '—';
  const unit = wo.unit || linkedWorkOrderMap[wo.id]?.unit;
  const unitLabelType = wo.properties?.unit_label_type ?? properties.find((p) => p.id === wo.property_id)?.unit_label_type;

  return (
    <TableRow onClick={() => onOpen(wo)} className="hover:bg-muted/50 active:bg-muted/80 cursor-pointer">
      <TableCell className="max-w-[160px] font-medium" title={wo.title}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{wo.title}</span>
          {linkedSet.has(wo.id) && (
            <span title="Converted from a maintenance request">
              <ClipboardList className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            </span>
          )}
        </span>
      </TableCell>
      {groupBy !== 'property' && (
        <TableCell className="max-w-[160px]">
          {unit ? (
            <span className="block truncate" title={`${propName} • ${formatUnit(unit, unitLabelType)}`}>
              {propName} <span className="text-muted-foreground">• {formatUnit(unit, unitLabelType)}</span>
            </span>
          ) : (
            <span className="block truncate" title={propName}>{propName}</span>
          )}
        </TableCell>
      )}
      {groupBy !== 'priority' && (
        <TableCell>
          <Badge className={getPriorityBadge(wo.priority)}>{wo.priority}</Badge>
        </TableCell>
      )}
      <TableCell>
        <Badge className={getStatusBadge(wo.status)}>{wo.status}</Badge>
      </TableCell>
      <TableCell>
        {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : '—'}
      </TableCell>
      <TableCell className="text-right">
        {wo.contractor_quote != null ? (
          <>
            <div className="font-mono text-sm font-semibold">
              ${Number(wo.contractor_quote).toFixed(2)}
            </div>
            <div className="text-muted-foreground mt-0.5 font-sans text-[11px]">
              Budget: {wo.cost ? `$${Number(wo.cost).toFixed(2)}` : '—'}
            </div>
          </>
        ) : (
          <span className="font-mono text-sm">
            {wo.cost ? `$${Number(wo.cost).toFixed(2)}` : '—'}
          </span>
        )}
      </TableCell>
      {groupBy !== 'contractor' && (
        <TableCell>
          {wo.assigned_contractor || '—'}
          {wo.assigned_contractor_email && (
            <span className="text-muted-foreground ml-1 text-[10px]">
              ({wo.assigned_contractor_email})
            </span>
          )}
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap px-3 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onQuickPhoto(wo.id); }}
            title="Add Photos"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onOpen(wo); }}
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {view === 'archived' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onUnarchive(wo); }}
              title="Unarchive"
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onArchive(wo); }}
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(wo); }}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
