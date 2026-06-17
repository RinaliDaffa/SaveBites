'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPickup } from '@/app/merchant/actions';

interface Props {
  qrToken: string;
}

export function ConfirmPickupButton({ qrToken }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await confirmPickup(qrToken);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full mt-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-sm hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPending ? 'Confirming…' : 'Confirm pickup'}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1.5 text-center">{error}</p>
      )}
    </div>
  );
}
