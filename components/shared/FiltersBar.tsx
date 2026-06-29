/**
 * SaveBites V3 — Filters Bar Component
 * Horizontal filter bar for the discovery feed (categories, radius, sort).
 */

'use client';

import React from 'react';
import { FILTER_CATEGORIES, RADIUS_OPTIONS, PRICE_CAP_OPTIONS } from '@/lib/constants';
import { cn } from '@/components/shared/cn';

interface FiltersBarProps {
  selectedCategories: string[];
  selectedRadius: number;
  selectedMaxPrice: number;
  sortBy: string;
  onCategoryChange: (cats: string[]) => void;
  onRadiusChange: (r: number) => void;
  onMaxPriceChange: (p: number) => void;
  onSortChange: (s: string) => void;
}

export function FiltersBar({
  selectedCategories,
  selectedRadius,
  selectedMaxPrice,
  sortBy,
  onCategoryChange,
  onRadiusChange,
  onMaxPriceChange,
  onSortChange,
}: FiltersBarProps) {
  const toggleCategory = (cat: string) => {
    const updated = cat === 'all'
      ? ['all']
      : selectedCategories.includes(cat)
        ? selectedCategories.filter(c => c !== cat)
        : [...selectedCategories.filter(c => c !== 'all'), cat];
    onCategoryChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => toggleCategory(cat.value)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategories.includes(cat.value)
                ? 'bg-emerald-500 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Radius Slider */}
        <div>
          <label className="text-xs font-medium text-stone-500 mb-1 block">
            Radius: {selectedRadius >= 1000 ? `${selectedRadius / 1000}km` : `${selectedRadius}m`}
          </label>
          <input
            type="range"
            min={500}
            max={5000}
            step={500}
            value={selectedRadius}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Harga Maksimum */}
        <div>
          <label className="text-xs font-medium text-stone-500 mb-1 block">
            Harga Maks: Rp {selectedMaxPrice.toLocaleString('id-ID')}
          </label>
          <input
            type="range"
            min={10000}
            max={100000}
            step={5000}
            value={selectedMaxPrice}
            onChange={(e) => onMaxPriceChange(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>
      </div>

      {/* Urutkan */}
      <div className="flex gap-2">
        {[
          { key: 'cheapest', label: 'Termurah' },
          { key: 'expiring', label: 'Cepat Kadaluarsa' },
          { key: 'nearest', label: 'Terdekat' },
        ].map((sort) => (
          <button
            key={sort.key}
            onClick={() => onSortChange(sort.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
              sortBy === sort.key
                ? 'bg-stone-800 text-white'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
            )}
          >
            {sort.label}
          </button>
        ))}
      </div>
    </div>
  );
}
