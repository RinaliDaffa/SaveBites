'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPickup } from '@/app/merchant/actions';

export function ConfirmPickupInput() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [qrToken, setQrToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const token = qrToken.trim();
    if (!token) return;

    startTransition(async () => {
      const result = await confirmPickup(token);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess('Pickup confirmed.');
      setQrToken('');
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded-2xl border border-stone-200"
    >
      <label className="block text-sm font-medium text-stone-700 mb-2">
        Manual QR entry
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={qrToken}
          onChange={(e) => setQrToken(e.target.value)}
          placeholder="Paste or type the qr_token"
          className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={isPending || !qrToken.trim()}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? '…' : 'Confirm'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {success && <p className="text-xs text-emerald-700 mt-2">{success}</p>}
    </form>
  );
}
