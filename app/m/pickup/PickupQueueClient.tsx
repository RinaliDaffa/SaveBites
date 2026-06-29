/**
 * SaveBites V3 — Merchant Pickup Queue Client
 */

'use client';

import React, { useState } from 'react';
import { Search, Shield, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Input } from '@/components/primitives/Input';
import { confirmPickupByCodeAction } from '@/lib/actions/orders';

type PickupItem = {
  orderId: string;
  customerName: string;
  mealTitle: string;
  quantity: number;
  pickupCode: string;
  status: 'ready' | 'pending';
  totalPrice: number;
};

interface Props {
  pickups: PickupItem[];
}

export default function PickupQueueClient({ pickups: initialPickups }: Props) {
  const router = useRouter();
  const [searchCode, setSearchCode] = useState('');
  const [processingCode, setProcessingCode] = useState<string | null>(null);

  const handleConfirmPickup = async (code: string) => {
    setProcessingCode(code);
    try {
      const fd = new FormData();
      fd.set('pickupCode', code);
      const result = await confirmPickupByCodeAction(fd);
      if (!result.success) {
        alert(result.error || 'Gagal konfirmasi pickup');
        return;
      }
      router.refresh();
    } catch {
      alert('Gagal memverifikasi kode pickup. Silakan coba lagi.');
    } finally {
      setProcessingCode(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Antrian Pickup</h1>
      <p className="text-sm text-stone-500 mb-6">Kelola pickup pelanggan</p>

      {/* Search by pickup code */}
      <div className="flex gap-3 mb-6">
        <Input
          placeholder="Cari kode pickup..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
          icon={<Search className="w-4 h-4" />}
          className="flex-1"
        />
        <Button
          variant="primary"
          onClick={() => {
            const found = initialPickups.find(p => p.pickupCode === searchCode.toUpperCase());
            if (found) handleConfirmPickup(found.pickupCode);
          }}
        >
          <Shield className="w-4 h-4" />
        </Button>
      </div>

      {/* Active Pickups */}
      {initialPickups.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-stone-900 mb-1">Semua beres!</h3>
          <p className="text-sm text-stone-500">Tidak ada antrian pickup saat ini.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {initialPickups.map((item) => {
            return (
              <Card key={item.orderId}>
                <Card.Body>
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">🍽️</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-stone-900">{item.customerName}</h3>
                        {item.status === 'ready' && <Badge variant="success">Siap</Badge>}
                        {item.status === 'pending' && <Badge variant="neutral">Menunggu</Badge>}
                      </div>

                      <p className="text-sm text-stone-500">{item.mealTitle} x{item.quantity}</p>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3 text-xs text-stone-500">
                          {item.pickupCode && (
                            <code className="bg-stone-100 px-2 py-1 rounded font-mono">
                              {item.pickupCode}
                            </code>
                          )}
                          <span className="font-medium text-stone-700">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.totalPrice)}
                          </span>
                        </div>

                        {item.status === 'ready' && !processingCode && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleConfirmPickup(item.pickupCode)}
                            className="text-sm"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Konfirmasi
                          </Button>
                        )}

                        {item.status === 'ready' && processingCode === item.pickupCode && (
                          <span className="text-sm text-emerald-600">Memverifikasi...</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
