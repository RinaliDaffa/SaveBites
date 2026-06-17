'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatIDR, finalPrice } from '@/lib/format';
import { createListing } from '@/app/merchant/actions';

function defaultDeadline(): string {
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
  // datetime-local needs YYYY-MM-DDTHH:mm in local time.
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function NewListingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountPct, setDiscountPct] = useState('50');
  const [portions, setPortions] = useState('1');
  const [pickupDeadline, setPickupDeadline] = useState<string>(defaultDeadline());

  const price = originalPrice ? Number(originalPrice) : 0;
  const discount = discountPct ? Number(discountPct) : 0;
  const final = price > 0 ? finalPrice(price, discount) : 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    // Convert local datetime-local string to ISO with timezone so Supabase stores
    // a proper timestamptz.
    const local = String(formData.get('pickupDeadline') ?? '');
    if (local) {
      const iso = new Date(local).toISOString();
      formData.set('pickupDeadline', iso);
    }

    startTransition(async () => {
      const res = await createListing(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push('/merchant');
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col gap-5"
    >
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
        <input
          type="text"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Nasi Uduk Surplus"
          className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Description <span className="text-stone-400 font-normal">(optional)</span>
        </label>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What comes with the meal?"
          className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Image URL <span className="text-stone-400 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          name="imageUrl"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Original price (IDR)</label>
          <input
            type="number"
            name="originalPrice"
            required
            min={1}
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            placeholder="25000"
            className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Portions</label>
          <input
            type="number"
            name="portions"
            required
            min={1}
            value={portions}
            onChange={(e) => setPortions(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Discount: <span className="font-bold text-emerald-600">{discountPct}%</span>
        </label>
        <input
          type="range"
          name="discountPct"
          min={0}
          max={90}
          step={5}
          value={discountPct}
          onChange={(e) => setDiscountPct(e.target.value)}
          className="w-full accent-emerald-600"
        />
        <div className="flex justify-between text-xs text-stone-400 mt-1">
          <span>0%</span>
          <span>90%</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Pickup deadline</label>
        <input
          type="datetime-local"
          name="pickupDeadline"
          required
          value={pickupDeadline}
          onChange={(e) => setPickupDeadline(e.target.value)}
          className="w-full border border-stone-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="text-xs text-stone-500 mt-1">Default: 4 hours from now.</p>
      </div>

      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center">
        <span className="text-sm text-stone-600">Final price</span>
        <span className="text-xl font-bold text-emerald-600">{formatIDR(final)}</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href="/merchant"
          className="flex-1 text-center py-3 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-100"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </form>
  );
}
