/**
 * SaveBites V3 — Payment Status Actions
 * Shown on the order detail page.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { Card } from '@/components/primitives/Card';

interface PaymentStatusActionsProps {
  orderId: string; // UUID
  orderNumber: string;
  status: string;
}

export function PaymentStatusActions({ orderId, orderNumber, status }: PaymentStatusActionsProps) {
  const router = useRouter();

  if (status === 'paid') {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <Badge variant="emerald" className="text-sm px-4 py-1">
          Pembayaran Berhasil
        </Badge>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="text-center py-4">
        <XCircle className="w-10 h-10 text-stone-400 mx-auto mb-2" />
        <Badge variant="neutral" className="text-sm px-4 py-1">
          Dibatalkan
        </Badge>
      </div>
    );
  }

  if (status === 'expired' || status === 'ready' || status === 'completed') {
    return null;
  }

  // Pending — offer payment continuation
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-stone-900">Belum dibayar</p>
          <p className="text-xs text-stone-500">Pesanan {orderNumber} menunggu pembayaran</p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/c/checkout/${orderId}`)}
        >
          Bayar
        </Button>
      </div>
    </Card>
  );
}
