'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deleteProperty } from '@/app/(dashboard)/work-orders/actions';
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
import { Plus, Eye, Edit2, Trash2, Loader2, Building2 } from 'lucide-react';

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

  const supabase = createClient();

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFormError('You must be logged in.');
        setSaving(false);
        return;
      }

      if (dialogMode === 'create') {
        const { data: newProperty, error } = await supabase
          .from('properties')
          .insert({
            name: trimmedName,
            address: form.address.trim() || null,
            type: form.type || null,
            notes: form.notes.trim() || null,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        if (newProperty) {
          setProperties((prev) => [newProperty as Property, ...prev]);
        }
      } else if (dialogMode === 'edit' && selectedProperty) {
        const { data: updated, error } = await supabase
          .from('properties')
          .update({
            name: trimmedName,
            address: form.address.trim() || null,
            type: form.type || null,
            notes: form.notes.trim() || null,
          })
          .eq('id', selectedProperty.id)
          .select()
          .single();

        if (error) throw error;

        if (updated) {
          setProperties((prev) =>
            prev.map((p) => (p.id === selectedProperty.id ? (updated as Property) : p))
          );
        }
      }

      closeDialog();
    } catch (err: unknown) {
      // Supabase errors are often PostgrestError objects (plain objects with .message, .details, etc.)
      // not always instanceof Error, so extract safely.
      const supabaseErr = err as { message?: string; details?: string; hint?: string };
      const message =
        supabaseErr?.message ||
        supabaseErr?.details ||
        'Failed to save property. Please try again.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  // Delete flow
  const requestDelete = (property: Property) => {
    setDeleteTarget(property);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await deleteProperty(deleteTarget.id);

      setProperties((prev) => prev.filter((p) => p.id !== deleteTarget.id));

      // Close any open dialogs if the deleted item was selected
      if (selectedProperty?.id === deleteTarget.id) {
        closeDialog();
      }
    } catch (err: unknown) {
      alert('Failed to delete property. Please try again.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
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
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted text-muted-foreground mb-4 rounded-full p-4">
              <Building2 className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No properties yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              No properties yet. Add your first one to start managing your real estate portfolio.
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card key={property.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1 text-lg">{property.name}</CardTitle>
                  {property.type && (
                    <Badge variant="secondary" className="shrink-0">
                      {property.type}
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-1">
                  {property.address || 'No address provided'}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <p className="text-muted-foreground line-clamp-3 text-sm">
                  {property.notes || 'No notes added yet.'}
                </p>
              </CardContent>

              <CardFooter className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground text-xs">
                  {formatDate(property.updated_at)}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openView(property)}
                    className="h-8 px-2"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="sr-only">View</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(property)}
                    className="h-8 px-2"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => requestDelete(property)}
                    className="text-destructive hover:text-destructive h-8 px-2"
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
        <DialogContent className="sm:max-w-[480px]">
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. Sunset Apartments"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  disabled={saving}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input
                  placeholder="123 Main Street, City, State"
                  value={form.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Property Type</label>
                <Select
                  value={form.type}
                  onValueChange={(value) => handleFormChange('type', value || '')}
                  disabled={saving}
                >
                  <SelectTrigger>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  placeholder="Any additional details, tenant info, etc."
                  value={form.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  disabled={saving}
                  rows={4}
                  className="resize-y"
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
            <AlertDialogTitle>Delete Property?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              <span className="font-medium">{deleteTarget?.name}</span> and all associated data.
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
              Delete Property
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
