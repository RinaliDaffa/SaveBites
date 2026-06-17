"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, supabaseBrowser } from "@/lib/supabase-browser";
import { useOrdersStore } from "@/lib/orders-store";
import { finalPrice, formatIDR } from "@/lib/format";

interface BookFormProps {
  listingId: string;
  portionsLeft: number;
  originalPrice: number;
  discountPct: number;
}

export function BookForm({
  listingId,
  portionsLeft,
  originalPrice,
  discountPct,
}: BookFormProps) {
  const router = useRouter();
  const bookListing = useOrdersStore((s) => s.bookListing);
  const isLoading = useOrdersStore((s) => s.isLoading);
  const storeError = useOrdersStore((s) => s.error);

  const [portions, setPortions] = useState(1);
  const [localError, setLocalError] = useState<string | null>(null);

  const unitPrice = finalPrice(originalPrice, discountPct);
  const total = unitPrice * portions;
  const error = localError ?? storeError;

  function dec() {
    setLocalError(null);
    setPortions((p) => Math.max(1, p - 1));
  }
  function inc() {
    setLocalError(null);
    setPortions((p) => Math.min(portionsLeft, p + 1));
  }

  async function handleBook() {
    setLocalError(null);
    if (portions < 1) {
      setLocalError("Pick at least 1 portion");
      return;
    }
    if (portions > portionsLeft) {
      setLocalError("Not enough portions left");
      return;
    }
    const user = await getCurrentUser();
    if (!user) {
      setLocalError("Please sign in to book");
      return;
    }
    const order = await bookListing(user.id, listingId, portions);
    if (!order) {
      // store error is already set
      return;
    }
    router.push(`/app/tickets/${order.id}`);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-stone-500">Portions</p>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={dec}
              disabled={portions <= 1 || isLoading}
              className="w-9 h-9 rounded-full border border-stone-300 text-stone-700 font-bold text-lg disabled:opacity-40 hover:bg-stone-50"
              aria-label="Decrease portions"
            >
              −
            </button>
            <span className="font-bold text-lg w-6 text-center">{portions}</span>
            <button
              type="button"
              onClick={inc}
              disabled={portions >= portionsLeft || isLoading}
              className="w-9 h-9 rounded-full border border-stone-300 text-stone-700 font-bold text-lg disabled:opacity-40 hover:bg-stone-50"
              aria-label="Increase portions"
            >
              +
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-500">Total</p>
          <p className="text-xl font-bold text-emerald-600">{formatIDR(total)}</p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-tomato text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleBook}
        disabled={isLoading}
        className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Booking…" : "Book Now"}
      </button>
    </div>
  );
}
