/**
 * SaveBites V3 — Merchant New Listing Page
 * Form to create a new surplus meal listing using server actions.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Select } from '@/components/shared/Select';
import { createListingAction } from '@/lib/actions/listings';

// Map DB category values to the form constants.
const DB_CATEGORIES: Record<string, string> = {
  'meals': 'Rice Dishes',
  'baked': 'Bakery',
  'produce': 'Produce',
  'other': 'Other',
};

const REVERSE_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(DB_CATEGORIES).map(([db, ui]) => [ui, db])
);

const CATEGORY_LABELS: Record<string, string> = {
  'Rice Dishes': 'Makanan Utama',
  'Bakery': 'Roti & Kue',
  'Produce': 'Sayur & Buah',
  'Other': 'Lainnya',
};

export default function NewListingPage() {
  const router = useRouter();

  const [form, setForm] = React.useState({
    title: 'Surprise Bento Box',
    description: 'Lezat dan berkualitas!',
    originalPrice: '45000',
    discountedPrice: '15000',
    quantity: '5',
    pickupStart: (() => {
      const d = new Date();
      d.setMinutes(d.getMinutes() + 30);
      return d.toISOString();
    })(),
    pickupEnd: (() => {
      const d = new Date();
      d.setHours(d.getHours() + 1);
      return d.toISOString();
    })(),
    category: 'meals',
    imageUrl: '',
    dietaryTags: '',
  });

  const updateField = (field: string) => (value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    // Set numeric values correctly.
    fd.set('originalPrice', form.originalPrice);
    fd.set('discountedPrice', form.discountedPrice);
    fd.set('quantity', form.quantity);
    fd.set('pickupStart', form.pickupStart);
    fd.set('pickupEnd', form.pickupEnd);
    fd.set('category', form.category);
    fd.set('imageUrl', form.imageUrl);

    const result = await createListingAction(fd);

    if (result.success) {
      router.push('/m/listings');
      router.refresh();
    } else {
      alert(result.error || 'Gagal membuat listing');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="p-1" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-stone-900">Tambah Listing Baru</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo Upload */}
        <Card className="border-2 border-dashed border-stone-300 cursor-pointer hover:border-emerald-400 transition-colors">
          <div className="flex flex-col items-center py-8 text-center">
            <Camera className="w-10 h-10 text-stone-400 mb-2" />
            <p className="text-sm font-medium text-stone-600">Upload Foto</p>
            <p className="text-xs text-stone-400 mt-1">PNG, JPG up to 10MB</p>
          </div>
        </Card>

        <Input
          label="Judul *"
          placeholder="e.g., Surprise Bento Box"
          value={form.title}
          onChange={(e) => updateField('title')(e.target.value)}
        />

        <div>
          <label className="text-sm font-medium text-stone-700 mb-1 block">Deskripsi</label>
          <textarea
            className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            rows={3}
            placeholder="Jelaskan makanannya..."
            value={form.description}
            onChange={(e) => updateField('description')(e.target.value)}
          />
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Harga Asli (Rp) *"
            type="number"
            placeholder="45000"
            value={form.originalPrice}
            onChange={(e) => updateField('originalPrice')(e.target.value)}
          />
          <Input
            label="Harga Diskon (Rp) *"
            type="number"
            placeholder="15000"
            value={form.discountedPrice}
            onChange={(e) => updateField('discountedPrice')(e.target.value)}
          />
        </div>

        {/* Quantity */}
        <Input
          label="Jumlah *"
          type="number"
          placeholder="5"
          value={form.quantity}
          onChange={(e) => updateField('quantity')(e.target.value)}
        />

        {/* Category */}
        <div>
          <label className="text-sm font-medium text-stone-700 mb-1 block">Kategori</label>
          <Select
            value={form.category}
            options={[
              { value: '', label: 'Pilih kategori...' },
              ...Object.values(DB_CATEGORIES).map(c => ({ value: REVERSE_CATEGORY[c] ?? c, label: CATEGORY_LABELS[c] ?? c })),
            ]}
            onChange={(value) => updateField('category')(value)}
          />
        </div>

        {/* Pickup Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1 block">Waktu Mulai *</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={form.pickupStart.slice(0, 16)}
              onChange={(e) => updateField('pickupStart')(new Date(e.target.value).toISOString())}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1 block">Waktu Selesai *</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={form.pickupEnd.slice(0, 16)}
              onChange={(e) => updateField('pickupEnd')(new Date(e.target.value).toISOString())}
              required
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            Batal
          </Button>
          <Button type="submit" className="flex-1">
            Buat Listing
          </Button>
        </div>
      </form>
    </div>
  );
}
