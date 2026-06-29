/**
 * SaveBites V3 — Merchant Orders Client Page
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { OrderCard } from '@/components/shared/OrderCard';
import type { OrderStatus } from '@/components/shared/OrderCard';
import type { Order } from '@/lib/types/database';

interface Props {
  orders: Order[];
  listingTitleMap: Map<string, string>;
}

export default function MerchantOrdersClient({ orders, listingTitleMap }: Props) {
  const [activeStatus, setActiveStatus] = useState('All');

  const filteredOrders = orders.filter(order => {
    if (activeStatus === 'All') return true;
    return order.status === activeStatus;
  });

  const statusTabs = ['All', 'pending', 'paid', 'ready', 'completed', 'cancelled'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Pesanan</h1>
      </div>

      {/* Status filters */}
      <div className="flex gap-1 mb-6 bg-stone-100 rounded-xl p-1 w-fit flex-wrap">
        {statusTabs.map(status => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              status === activeStatus
                ? 'bg-white shadow-sm text-emerald-600'
                : 'text-stone-500 hover:bg-stone-200'
            }`}
          >
            {status === 'All' ? 'Semua' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#128230;</div>
          <h3 className="text-lg font-semibold text-stone-900 mb-1">Belum ada pesanan</h3>
          <p className="text-sm text-stone-500">Pesanan dari pelanggan akan muncul di sini.</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 text-stone-500">
          <p>Tidak ada pesanan {activeStatus === 'All' ? '' : activeStatus}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => {
            const statusDisplay = mapToOrderCardStatus(order.status);
            const listingTitle = listingTitleMap.get(order.listing_id) ?? 'Pesanan';

            return (
              <OrderCard
                key={order.id}
                orderNumber={order.order_number}
                listingTitle={listingTitle}
                merchantName="Restoran Saya"
                quantity={order.quantity}
                total={order.total}
                status={statusDisplay}
                pickupCode={order.pickup_code}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function mapToOrderCardStatus(status: Order['status']): OrderStatus {
  const mapping: Record<string, OrderStatus> = {
    pending: 'pending',
    paid: 'paid',
    ready: 'ready',
    completed: 'completed',
    cancelled: 'cancelled',
    expired: 'cancelled',
  };
  return mapping[status] ?? 'pending';
}
