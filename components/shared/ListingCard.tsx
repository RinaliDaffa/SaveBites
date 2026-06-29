/**
 * SaveBites V3 — Listing Card Component
 * Displays a single surplus meal listing in the discovery feed.
 */

'use client';

import React from 'react';
import { MapPin, Clock, Flame, Heart } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { cn } from '@/components/shared/cn';
import { formatIDR, discountPercent } from '@/lib/utils/pricing';

interface ListingCardProps {
  id: string;
  title: string;
  imageUrl?: string;
  merchantName: string;
  merchantDistance: number;
  originalPrice: number;
  surplusPrice: number;
  availableQuantity: number;
  expiresAt: number;
  category: string;
  onFavorite?: (id: string) => void;
  isFavorite?: boolean;
  onClick?: () => void;
}

export function ListingCard({
  id,
  title,
  imageUrl,
  merchantName,
  merchantDistance,
  originalPrice,
  surplusPrice,
  availableQuantity,
  expiresAt,
  category,
  onFavorite,
  isFavorite = false,
  onClick,
}: ListingCardProps) {
  const dp = discountPercent({ originalPrice, surplusPrice });
  const hoursLeft = Math.max(0, Math.floor((expiresAt / 1000 - Date.now() / 1000) / 3600));

  return (
    <Card hover className="overflow-hidden cursor-pointer group" onClick={onClick}>
      {/* Image */}
      <div className="relative h-44 bg-stone-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🍱</div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge variant="emerald">{dp}% OFF</Badge>
          {availableQuantity <= 2 && (
            <Badge variant="warning">Low Stock</Badge>
          )}
        </div>

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavorite?.(id);
          }}
          className="absolute top-3 right-3 p-1.5 bg-white/80 backdrop-blur-sm rounded-full text-stone-400 hover:text-red-500 transition-colors"
        >
          <Heart className={cn('w-4 h-4', isFavorite && 'fill-red-500 text-red-500')} />
        </button>

        {/* Expiry */}
        {hoursLeft <= 2 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs text-white">
            <Clock className="w-3 h-3" />
            Expires in {hoursLeft}h
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-stone-900 line-clamp-1">{title}</h3>
          <span className="text-lg font-bold text-emerald-600 whitespace-nowrap">
            {formatIDR(surplusPrice)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Flame className="w-3 h-3 text-stone-400" />
          <span className="line-clamp-1">{merchantName}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {merchantDistance >= 1000
              ? `${(merchantDistance / 1000).toFixed(1)} km`
              : `${merchantDistance}m`}
          </div>
          {originalPrice > surplusPrice && (
            <span className="line-through text-stone-400">
              {formatIDR(originalPrice)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
