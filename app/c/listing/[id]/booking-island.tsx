/**
 * SaveBites V3 — Booking Client Island
 *
 * Handles quantity selector + reservation form. Server passes static
 * data (price, availability) so zero re-fetching is needed.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { createReservationAction } from '@/lib/actions/orders';
import { formatIDR } from '@/lib/utils/pricing';

export default function BookingIsland({
  listingId,
  quantityAvailable,
  surplusPrice,
}: {
  listingId: string;
  quantityAvailable: number;
  surplusPrice: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [bookPending, setBookPending] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDecrement = () => setQuantity((q) => Math.max(1, q - 1));
  const handleIncrement = () => setQuantity((q) => Math.min(quantityAvailable, q + 1));

  const handleBook = () => {
    setBookPending(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('listingId', listingId);
      fd.set('quantity', String(quantity));

      const result = await createReservationAction(fd);

      if (result.success && result.data) {
        // Redirect to checkout/payment
        router.push(`/c/checkout/${result.data.orderId}`);
      } else {
        alert(result.error ?? 'Reservasi gagal');
        setBookPending(false);
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-stone-700">Jumlah porsi:</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleDecrement}
          >
            -
          </Button>
          <span className="w-8 text-center font-medium">{quantity}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleIncrement}
            disabled={quantity >= quantityAvailable}
          >
            +
          </Button>
        </div>
        <span className="text-xs text-stone-500">
          {quantityAvailable} tersisa
        </span>
      </div>

      {/* Total + Book button */}
      <Button
        className="w-full"
        size="lg"
        disabled={bookPending || isPending}
        onClick={handleBook}
      >
        <ShoppingCart className="w-4 h-4 mr-2" />
        Pesan {quantity}x — {formatIDR(surplusPrice * quantity)}
      </Button>
    </div>
  );
}
