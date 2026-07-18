'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { formatPhone, isValidPhoneNumber } from '@/lib/phone';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Pencil, Trash2, Loader2, Mail, Phone, Building2, ShieldCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/utils';
import { createContractor, updateContractor, deleteContractor, resendContractorInvite } from './contractor-actions';

export interface Contractor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trade: string | null;
  notes: string | null;
  last_invited_at?: string | null;
  // Set when the contractor has a registered Nestora account
  is_registered?: boolean;
  profile_name?: string | null;
  profile_phone?: string | null;
  profile_company_name?: string | null;
  profile_trade?: string | null;
}

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

type ContractorForm = {
  name: string;
  email: string;
  phone: string;
  trade: string;
  customTrade: string;
  notes: string;
};

const emptyForm = (): ContractorForm => ({
  name: '',
  email: '',
  phone: '',
  trade: '',
  customTrade: '',
  notes: '',
});

export function TeamsClient({ initialContractors }: { initialContractors: Contractor[] }) {
  const [contractors, setContractors] = useState<Contractor[]>(initialContractors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contractor | null>(null);
  const [form, setForm] = useState<ContractorForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Contractor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (c: Contractor) => {
    const currentTrade = c.trade ?? '';
    const isPreset = TRADES_SET.has(currentTrade);
    setEditTarget(c);
    setForm({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      trade: currentTrade ? (isPreset ? currentTrade : 'Other') : '',
      customTrade: isPreset ? '' : currentTrade,
      notes: c.notes ?? '',
    });
    setFormError('');
    setDialogOpen(true);
  };

  const update = (field: keyof ContractorForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  const effectiveTrade = (f: ContractorForm) =>
    f.trade === 'Other' ? f.customTrade.trim() || null : f.trade || null;

  const isRegisteredEdit = !!(editTarget?.is_registered);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editTarget) {
        if (isRegisteredEdit) {
          // Registered contractors own their identity — landlord can only update notes.
          await updateContractor(editTarget.id, {
            name: editTarget.name,
            notes: form.notes.trim() || null,
          });
          setContractors((prev) =>
            prev.map((c) =>
              c.id === editTarget.id ? { ...c, notes: form.notes.trim() || null } : c
            )
          );
        } else {
          if (!form.name.trim()) {
            setFormError('Contractor name is required.');
            return;
          }
          if (form.phone && !isValidPhoneNumber(form.phone)) {
            setFormError('Please enter a valid phone number or leave it blank.');
            return;
          }
          const payload = {
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone || null,
            trade: effectiveTrade(form),
            notes: form.notes.trim() || null,
          };
          await updateContractor(editTarget.id, payload);
          setContractors((prev) =>
            prev.map((c) => (c.id === editTarget.id ? { ...c, ...payload } : c))
          );
        }
      } else {
        if (!form.name.trim()) {
          setFormError('Contractor name is required.');
          return;
        }
        if (form.phone && !isValidPhoneNumber(form.phone)) {
          setFormError('Please enter a valid phone number or leave it blank.');
          return;
        }
        const payload = {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone || null,
          trade: effectiveTrade(form),
          notes: form.notes.trim() || null,
        };
        const result = await createContractor(payload);
        if (!result.success) throw new Error(result.error);
        const inserted = result.contractor as unknown as Contractor;
        setContractors((prev) =>
          [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      setDialogOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save contractor.');
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async (contractorId: string) => {
    setResendingIds((prev) => new Set(prev).add(contractorId));
    try {
      const result = await resendContractorInvite(contractorId);
      if (result.success) {
        toast.success(`Invite resent to ${result.email}`);
        // Update last_invited_at locally so the "Invited X ago" refreshes.
        setContractors((prev) =>
          prev.map((c) =>
            c.id === contractorId ? { ...c, last_invited_at: new Date().toISOString() } : c
          )
        );
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to resend invite. Please try again.');
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(contractorId);
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteContractor(deleteTarget.id);
      if (!result.success) {
        alert(result.error);
        return;
      }
      setContractors((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete contractor.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Contractor
        </Button>
      </div>

      {contractors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center sm:py-16">
            <div className="bg-muted text-muted-foreground mb-3 rounded-full p-4 sm:mb-4">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No contractors yet</h3>
            <p className="text-muted-foreground max-w-sm text-sm">
              Add your contractors here to quickly assign them to work orders.
            </p>
            <Button onClick={openAdd} className="mt-3 gap-1.5 sm:mt-4" size="sm">
              <Plus className="h-4 w-4" /> Add your first contractor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contractors.map((c) => (
            <Card key={c.id} className="[--card-spacing:0.75rem] sm:[--card-spacing:1rem]">
              <CardContent>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold leading-snug">
                        {c.is_registered ? (c.profile_name || c.name) : c.name}
                      </span>
                      {c.is_registered && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" />
                          Registered
                        </Badge>
                      )}
                      {(c.is_registered ? c.profile_trade : c.trade) && (
                        <Badge variant="outline" className="text-xs">
                          {c.is_registered ? c.profile_trade : c.trade}
                        </Badge>
                      )}
                    </div>
                    {c.email && (
                      <div className="mt-1.5 space-y-1">
                        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                        {/* Pending invite row — only for unregistered contractors */}
                        {!c.is_registered && (
                          <div className="flex items-center gap-2 pl-4">
                            <span className="text-muted-foreground text-xs">
                              {c.last_invited_at
                                ? `Invited ${timeAgo(c.last_invited_at)}`
                                : 'Not yet invited'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleResend(c.id)}
                              disabled={resendingIds.has(c.id)}
                              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                            >
                              {resendingIds.has(c.id)
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Send className="h-3 w-3" />}
                              Resend
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show profile phone for registered contractors, fallback to directory phone */}
                    {(c.is_registered ? c.profile_phone : c.phone) && (
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{formatPhone(c.is_registered ? c.profile_phone : c.phone) ?? (c.is_registered ? c.profile_phone : c.phone)}</span>
                      </div>
                    )}
                    {c.is_registered && c.profile_company_name && (
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.profile_company_name}</span>
                      </div>
                    )}
                    {c.notes && (
                      <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs italic">{c.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors"
                      aria-label="Edit contractor"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      className="text-muted-foreground hover:text-destructive rounded p-1.5 transition-colors"
                      aria-label="Delete contractor"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Contractor' : 'Add Contractor'}</DialogTitle>
            <DialogDescription>
              {isRegisteredEdit
                ? `${editTarget?.profile_name || editTarget?.name} manages their own profile. You can add private notes below.`
                : editTarget
                ? `Update details for ${editTarget.name}.`
                : 'Add a contractor to your team directory.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1 sm:space-y-4">
            {isRegisteredEdit ? (
              /* Registered contractor — show read-only profile info + editable notes only */
              <>
                <div className="bg-muted/40 rounded-lg border px-4 py-3 space-y-2">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mb-2">
                    Profile (managed by contractor)
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{editTarget?.profile_name || '—'}</span>
                    {editTarget?.profile_company_name && (
                      <>
                        <span className="text-muted-foreground">Company</span>
                        <span>{editTarget.profile_company_name}</span>
                      </>
                    )}
                    {editTarget?.profile_trade && (
                      <>
                        <span className="text-muted-foreground">Trade</span>
                        <span>{editTarget.profile_trade}</span>
                      </>
                    )}
                    {editTarget?.profile_phone && (
                      <>
                        <span className="text-muted-foreground">Phone</span>
                        <span>{formatPhone(editTarget.profile_phone) ?? editTarget.profile_phone}</span>
                      </>
                    )}
                    {editTarget?.email && (
                      <>
                        <span className="text-muted-foreground">Email</span>
                        <span className="truncate">{editTarget.email}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Private notes</label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder="Internal notes about rates, availability, etc. Only visible to you."
                    rows={3}
                  />
                </div>
              </>
            ) : (
              /* Unregistered contractor — fully editable */
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="e.g. ACME Plumbing"
                    className="!h-11 sm:!h-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Trade</label>
                  <Select value={form.trade} onValueChange={(v) => update('trade', v ?? '')}>
                    <SelectTrigger className="!h-11 sm:!h-8">
                      <SelectValue placeholder="Select trade (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRADES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other">Other / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.trade === 'Other' && (
                    <Input
                      value={form.customTrade}
                      onChange={(e) => update('customTrade', e.target.value)}
                      placeholder="Enter trade name"
                      className="!h-11 sm:!h-8"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="contractor@example.com"
                      className="!h-11 sm:!h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Phone</label>
                    <PhoneInput
                      value={form.phone || undefined}
                      onChange={(v) => update('phone', v ?? '')}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder="Rates, availability, specialties, etc."
                    rows={3}
                  />
                </div>
              </>
            )}

            {formError && <p className="text-destructive text-sm">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegisteredEdit ? 'Save Notes' : editTarget ? 'Save Changes' : 'Add Contractor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contractor?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.name}</strong> from your team. Existing work orders
              won&apos;t be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
