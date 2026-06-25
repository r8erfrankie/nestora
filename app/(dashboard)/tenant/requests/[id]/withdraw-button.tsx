'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { withdrawTenantRequest } from '../../tenant-actions';

export function WithdrawButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleWithdraw = () => {
    startTransition(async () => {
      await withdrawTenantRequest(requestId);
      router.push('/tenant');
    });
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="flex-1 text-sm text-destructive">Withdraw this request?</p>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={isPending}
          className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Withdrawing…' : 'Yes, withdraw'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 transition-colors"
    >
      Withdraw this request
    </button>
  );
}
