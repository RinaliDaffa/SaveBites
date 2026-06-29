/**
 * SaveBites V3 — Order Card Component
 * Displays a single order in the orders list (consumer/merchant).
 */

'use client';

import React from 'react';
import { QrCode, MapPin, Clock } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { formatIDR } from '@/lib/utils/pricing';

export type OrderStatus = 'pending' | 'paid' | 'ready' | 'picked_up' | 'completed' | 'cancelled';

const STATUS_CONFIG: Record<OrderStatus, { variant: 'success' | 'warning' | 'error' | 'neutral' | 'emerald'; label: string }> = {
  pending: { variant: 'warning', label: 'Waiting Payment' },
  paid: { variant: 'emerald', label: 'Paid' },
  ready: { variant: 'emerald', label: 'Ready to Pick Up' },
  picked_up: { variant: 'neutral', label: 'Picked Up' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'error', label: 'Cancelled' },
};

interface OrderCardProps {
  orderNumber: string;
  listingTitle: string;
  merchantName: string;
  quantity: number;
  total: number;
  status: OrderStatus;
  pickupCode?: string;
  distance?: string;
  expiresAt?: number;
  showDetails?: boolean;
  onClick?: () => void;
}

export function OrderCard({
  orderNumber,
  listingTitle,
  merchantName,
  quantity,
  total,
  status,
  pickupCode,
  distance,
  expiresAt,
  showDetails = false,
  onClick,
}: OrderCardProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <Card hover className="p-4 cursor-pointer" onClick={onClick}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900">{listingTitle}</span>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
            <p className="text-sm text-stone-500 mt-0.5">
              {quantity}x from {merchantName}
            </p>
          </div>
          <span className="text-lg font-bold text-stone-900">{formatIDR(total)}</span>
        </div>

        {showDetails && (
          <>
            {/* Meta row */}
            <div className="grid grid-cols-3 gap-2 text-xs text-stone-400">
              <div className="flex flex-col items-center gap-1 p-2 bg-stone-50 rounded-lg">
                <Clock className="w-4 h-4" />
                <span>{orderNumber}</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 bg-stone-50 rounded-lg">
                <MapPin className="w-4 h-4" />
                <span>{distance || '—'}</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 bg-stone-50 rounded-lg">
                <QrCode className="w-4 h-4" />
                <span className="font-mono">{pickupCode || '—'}</span>
              </div>
            </div>

            {/* Timer */}
            {expiresAt && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                <Clock className="w-4 h-4" />
                Expires in ~{Math.max(0, Math.floor((expiresAt - Date.now() / 1000) / 3600))}h
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
