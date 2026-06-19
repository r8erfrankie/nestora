'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { deleteAccount } from './actions';

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const canDelete = confirmText === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteAccount();
      // Redirect fires inside deleteAccount — this line is only reached on error
    } catch (err: unknown) {
      setDeleting(false);
      setError(err instanceof Error ? err.message : 'Failed to delete account. Try again.');
    }
  };

  const handleCancel = () => {
    setConfirming(false);
    setConfirmText('');
    setError('');
  };

  if (!confirming) {
    return (
      <Button variant="destructive" onClick={() => setConfirming(true)}>
        Delete Account
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-destructive">This cannot be undone</p>
          <p className="text-muted-foreground text-sm">
            Your account will be permanently deleted. You can immediately sign up again with the
            same email address.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Type <span className="font-mono font-bold">DELETE</span> to confirm
        </label>
        <Input
          value={confirmText}
          onChange={(e) => {
            setConfirmText(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canDelete) handleDelete();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="DELETE"
          disabled={deleting}
          className="font-mono max-w-[160px]"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || deleting}>
          {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {deleting ? 'Deleting…' : 'Delete my account'}
        </Button>
        <Button variant="ghost" onClick={handleCancel} disabled={deleting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
