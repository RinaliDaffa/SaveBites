import React from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatRupiah } from "@/lib/utils/format";
import { ListingWithMerchant } from "@/lib/types";
import { DiscountBadge } from "./DiscountBadge";
import { StaleBadge } from "@/components/shared/StaleBadge";

export function ListingCard({ listing }: { listing: ListingWithMerchant }) {
  const isSoldOut = listing.remaining_portions <= 0;

  return (
    <Link 
      href={`/consumer/${listing.id}`} 
      className={`block bg-white rounded-2xl overflow-hidden border border-stone-200 hover:shadow-md transition-shadow relative ${isSoldOut ? "opacity-60" : ""}`}
    >
      <div className="h-40 bg-stone-200 relative">
        {listing.merchant.cover_image_url ? (
          <img 
            src={listing.merchant.cover_image_url} 
            alt={listing.merchant.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-stone-300 flex items-center justify-center text-stone-500">
            No image
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
          <DiscountBadge percent={listing.discount_percent} />
        </div>
      </div>
      
      <div className="p-4 flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-semibold text-lg leading-tight text-ink">
            {listing.name}
          </h3>
          <div className="text-right shrink-0">
            <div className="font-bold text-emerald-600">
              {formatRupiah(listing.current_price)}
            </div>
            <div className="text-sm text-stone-400 line-through">
              {formatRupiah(listing.original_price)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 text-sm text-stone-500">
          <span className="font-medium truncate">{listing.merchant.name}</span>
          <span>•</span>
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>{listing.distanceKm.toFixed(1)} km</span>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <StaleBadge targetDate={listing.available_until} />
          {isSoldOut ? (
            <span className="text-xs font-bold text-tomato uppercase bg-red-50 px-2 py-1 rounded">Habis</span>
          ) : (
            <span className="text-xs font-medium text-stone-500">
              {listing.remaining_portions} porsi sisa
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
