'use client';

import { useState } from 'react';
import { createProperty, updateProperty, getPropertyDeleteImpact, type PropertyDeleteImpact } from './actions';
import { deleteProperty } from '@/app/(dashboard)/work-orders/crud-actions';
import { Button } from '@/components/ui/button';
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Plus, Eye, Edit2, Trash2, Loader2, Building2, AlertTriangle } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  address: string | null;
  type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  address: string;
  type: string;
  notes: string;
}

const PROPERTY_TYPES = [
  'Apartment',
  'House',
  'Townhouse',
  'Condo',
  'Commercial',
  'Land',
  'Other',
] as const;

export function PropertiesClient({
  initialProperties,
  loadError,
}: {
  initialProperties: Property[];
  loadError?: { message?: string; details?: string; hint?: string; code?: string } | null;
}) {
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [form, setForm] = useState<FormData>({ name: '', address: '', type: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<PropertyDeleteImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);

  // Derive a user-friendly load error message
  const loadErrorMessage = loadError
    ? loadError.message ||
      'Failed to load properties. Make sure you have run the SQL from supabase/properties.sql in your Supabase dashboard.'
    : null;

  // Open create dialog
  const openCreate = () => {
    setDialogMode('create');
    setSelectedProperty(null);
    setForm({ name: '', address: '', type: '', notes: '' });
    setFormError('');
    setIsDialogOpen(true);
  };

  // Open view dialog
  const openView = (property: Property) => {
    setDialogMode('view');
    setSelectedProperty(property);
    setFormError('');
    setIsDialogOpen(true);
  };

  // Open edit dialog (from view or directly)
  const openEdit = (property: Property) => {
    setDialogMode('edit');
    setSelectedProperty(property);
    setForm({
      name: property.name,
      address: property.address || '',
      type: property.type || '',
      notes: property.notes || '',
    });
    setFormError('');
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    // Small delay to allow animation before resetting
    setTimeout(() => {
      setSelectedProperty(null);
      setForm({ name: '', address: '', type: '', notes: '' });
      setFormError('');
    }, 200);
  };

  // Switch from view to edit mode
  const switchToEdit = () => {
    if (selectedProperty) {
      openEdit(selectedProperty);
    }
  };

  const handleFormChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  // Create or Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError('Property name is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        name: trimmedName,
        address: form.address.trim() || null,
        type: form.type || null,
        notes: form.notes.trim() || null,
      };

      if (dialogMode === 'create') {
        const newProperty = await createProperty(payload);
        setProperties((prev) => [newProperty as Property, ...prev]);
      } else if (dialogMode === 'edit' && selectedProperty) {
        const updated = await updateProperty(selectedProperty.id, payload);
        setProperties((prev) =>
          prev.map((p) => (p.id === selectedProperty.id ? (updated as Property) : p))
        );
      }

      closeDialog();
    } catch (err: unknown) {
      const supabaseErr = err as { message?: string; details?: string };
      setFormError(supabaseErr?.message || supabaseErr?.details || 'Failed to save property. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Delete flow
  const requestDelete = (property: Property) => {
    setDeleteTarget(property);
    setDeleteImpact(null);
    setLoadingImpact(true);
    getPropertyDeleteImpact(property.id)
      .then((impact) => setDeleteImpact(impact))
      .catch(() => setDeleteImpact({ tenants: 0, maintenanceRequests: 0, workOrders: 0 }))
      .finally(() => setLoadingImpact(false));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProperty(deleteTarget.id);
      setProperties((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (selectedProperty?.id === deleteTarget.id) closeDialog();
    } catch {
      alert('Failed to delete property. Please try again.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteImpact(null);
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeleteImpact(null);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="text-muted-foreground text-sm">Manage your real estate portfolio</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Load error banner - shows when server failed to fetch (e.g. table not created) */}
      {loadErrorMessage && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
          <strong>Could not load properties:</strong> {loadErrorMessage}
          <div className="mt-2 text-xs">
            Run the SQL from <code>supabase/properties.sql</code> in your Supabase project&apos;s
            SQL Editor, then refresh this page.
          </div>
        </div>
      )}

      {/* Properties Grid */}
      {properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center sm:py-16">
            <div className="bg-muted text-muted-foreground mb-3 rounded-full p-4 sm:mb-4">
              <Building2 className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No properties yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm text-sm sm:mb-6">
              No properties yet. Add your first one to start managing your real estate portfolio.
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {properties.map((property) => (
            <Card key={property.id} className="flex flex-col [--card-spacing:0.75rem] sm:[--card-spacing:1rem]">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1 text-base sm:text-lg">{property.name}</CardTitle>
                  {property.type && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {property.type}
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-1 text-xs sm:text-sm">
                  {property.address || 'No address provided'}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {property.notes || 'No notes added yet.'}
                </p>
              </CardContent>

              <CardFooter className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground text-xs">
                  {formatDate(property.updated_at)}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openView(property)}
                    className="h-10 px-2.5 sm:h-8 sm:px-2"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="sr-only">View</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(property)}
                    className="h-10 px-2.5 sm:h-8 sm:px-2"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => requestDelete(property)}
                    className="text-destructive hover:text-destructive h-10 px-2.5 sm:h-8 sm:px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit / View Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' && 'Add New Property'}
              {dialogMode === 'edit' && 'Edit Property'}
              {dialogMode === 'view' && 'Property Details'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? 'View the details of this property.'
                : 'Fill in the information below.'}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedProperty ? (
            <div className="space-y-4 py-2">
              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
                  Name
                </div>
                <div className="font-medium">{selectedProperty.name}</div>
              </div>

              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
                  Address
                </div>
                <div>
                  {selectedProperty.address || (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
                    Type
                  </div>
                  <div>
                    {selectedProperty.type || (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
                    Last Updated
                  </div>
                  <div>{formatDate(selectedProperty.updated_at)}</div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
                  Notes
                </div>
                <div className="bg-muted/40 rounded-md p-3 text-sm whitespace-pre-wrap">
                  {selectedProperty.notes || (
                    <span className="text-muted-foreground italic">No notes</span>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={closeDialog}>
                  Close
                </Button>
                <Button variant="secondary" onClick={switchToEdit}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    closeDialog();
                    requestDelete(selectedProperty);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. Sunset Apartments"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  disabled={saving}
                  className="!h-11 sm:!h-8"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input
                  placeholder="123 Main Street, City, State"
                  value={form.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                  disabled={saving}
                  className="!h-11 sm:!h-8"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-medium">Property Type</label>
                <Select
                  value={form.type}
                  onValueChange={(value) => handleFormChange('type', value || '')}
                  disabled={saving}
                >
                  <SelectTrigger className="!h-11 sm:!h-8">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  placeholder="Any additional details, tenant info, etc."
                  value={form.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  disabled={saving}
                  rows={3}
                  className="min-h-[80px] resize-y"
                />
              </div>

              {formError && <p className="text-destructive text-sm">{formError}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'create' ? 'Create Property' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              Delete &ldquo;{deleteTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action <span className="font-semibold text-foreground">cannot be undone</span>.
              Deleting this property will permanently remove:
            </AlertDialogDescription>

            {loadingImpact ? (
              <div className="space-y-2 pt-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : deleteImpact ? (
              <ul className="space-y-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
                {deleteImpact.tenants > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    <span>
                      <span className="font-semibold text-foreground">{deleteImpact.tenants}</span>
                      {' '}tenant {deleteImpact.tenants === 1 ? 'lease' : 'leases'}
                    </span>
                  </li>
                )}
                {deleteImpact.maintenanceRequests > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    <span>
                      <span className="font-semibold text-foreground">{deleteImpact.maintenanceRequests}</span>
                      {' '}maintenance {deleteImpact.maintenanceRequests === 1 ? 'request' : 'requests'}
                    </span>
                  </li>
                )}
                {deleteImpact.workOrders > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    <span>
                      <span className="font-semibold text-foreground">{deleteImpact.workOrders}</span>
                      {' '}work {deleteImpact.workOrders === 1 ? 'order' : 'orders'}
                    </span>
                  </li>
                )}
                <li className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  All associated photos, notes, and activity history
                </li>
              </ul>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting || loadingImpact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Property
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
