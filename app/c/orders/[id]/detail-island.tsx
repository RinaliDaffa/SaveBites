/**
 * SaveBites V3 — Consumer Order Detail Island (Client Component)
 *
 * This island owns the live countdown ticker and the cancel button.
 * Everything else (status steps, QR, order info, merchant) is rendered
 * statically on the server in `page.tsx`. The island only re-renders
 * when the user interacts with it.
 *
 * The countdown recomputes from a fixed `pickupDeadline` timestamp, so
 * the server-rendered value stays consistent with the client at the
 * moment of hydration (no flash of mismatched content).
 */

'use client';

import { useEffect, useState, useTransition } from 'react';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { cancelOrderAction } from '@/lib/actions/orders';

interface OrderDetailIslandProps {
  orderId: string;
  status: string;
  pickupDeadline: string | null;
}

export default function OrderDetailIsland({
  orderId,
  status,
  pickupDeadline,
}: OrderDetailIslandProps) {
  // Live countdown (ticks every second when there's a deadline)
  const [remaining, setRemaining] = useState<number | null>(() => {
    if (!pickupDeadline) return null;
    return Math.max(0, Math.floor((new Date(pickupDeadline).getTime() - Date.now()) / 1000));
  });

  const [cancelling, startCancelTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!pickupDeadline) return;
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((new Date(pickupDeadline).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    }, 1000);
    return () => clearInterval(interval);
  }, [pickupDeadline]);

  const handleCancel = () => {
    if (!confirm('Yakin mau batalkan pesanan ini?')) return;
    setCancelError(null);
    startCancelTransition(async () => {
      const fd = new FormData();
      fd.set('orderId', orderId);
      const result = await cancelOrderAction(fd);
      if (!result.success) {
        setCancelError(result.error ?? 'Gagal membatalkan pesanan');
      } else {
        // Refresh the page to show new server state
        window.location.reload();
      }
    });
  };

  const showCountdown =
    pickupDeadline !== null &&
    (status === 'paid' || status === 'ready') &&
    remaining !== null;

  return (
    <>
      {/* Live countdown — overrides the static server-rendered one */}
      {showCountdown && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm text-stone-500">Berakhir dalam</p>
              <p className="text-lg font-bold text-stone-900 font-mono tabular-nums">
                {formatCountdown(remaining!)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cancel button — only when pending */}
      {status === 'pending' && (
        <Button
          variant="outline"
          fullWidth
          className="mb-3 border-red-300 text-red-600 hover:bg-red-50"
          onClick={handleCancel}
          loading={cancelling}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Batalkan Pesanan
        </Button>
      )}

      {/* Cancel error */}
      {cancelError && (
        <Card className="mb-4">
          <p className="text-sm text-red-600">{cancelError}</p>
        </Card>
      )}

      {/* Back to orders */}
      <Button
        variant="secondary"
        fullWidth
        onClick={() => {
          window.location.href = '/c/orders';
        }}
      >
        Kembali ke Pesanan
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </>
  );
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return 'Telah berakhir';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
