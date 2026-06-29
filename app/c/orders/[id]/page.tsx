/**
 * SaveBites V3 — Consumer Order Detail Page (Server Component)
 *
 * The Server Component does auth + fetches the order, then hands off the
 * data to an inline <OrderDetail> client island that owns the live countdown
 * and cancel button. All static sections are rendered on the server.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOrderByNumberAction } from '@/lib/actions/orders';
import { Badge } from '@/components/primitives/Badge';
import { Card } from '@/components/primitives/Card';
import { QrCodeSvg } from '@/components/shared/QrCodeSvg';
import OrderDetailIsland from './detail-island';

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─── Server shell ────────────────────────────��──────────────────

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const orderNumber = decodeURIComponent(id);

  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/c/orders/${encodeURIComponent(orderNumber)}`);
  }

  // Server-side data fetch
  const order = await getOrderByNumberAction(orderNumber);

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-stone-900 mb-2">Pesanan tidak ditemukan</h2>
        <p className="text-stone-500 mb-4">
          Pesanan yang kamu cari tidak tersedia atau sudah dihapus.
        </p>
        <Link href="/c/orders" className="text-emerald-600 font-medium hover:underline">
          Kembali ke Pesanan
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Back nav */}
      <Link
        href="/c/orders"
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Link>

      {/* Status Steps */}
      <StatusSteps status={order.status} />

      {/* QR Pickup Ticket */}
      {(order.status === 'paid' || order.status === 'ready') && order.pickup_code && (
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white mb-4">
          <div className="text-center p-6">
            <QrCodeSvg
              payload={order.pickup_code}
              size={220}
              caption={order.pickup_code}
              ariaLabel={`Kode pickup ${order.pickup_code}`}
            />
            <p className="text-sm opacity-80 mt-3">
              Tunjukkan kode QR ini kepada merchant
            </p>
            <p className="text-xs opacity-60 mt-1 font-mono tracking-widest">
              {order.pickup_code}
            </p>
          </div>
        </Card>
      )}

      {/* Payment status banner */}
      <PaymentBanner status={order.status} />

      {/* Order Info */}
      <Card className="mb-4">
        <Card.Body>
          <div className="space-y-3">
            <InfoRow label="Pesanan" value={order.order_number} mono />
            <InfoRow
              label="Makanan"
              value={order.listings?.title ?? '—'}
            />
            <InfoRow label="Jumlah" value={`${order.quantity}x`} />
            {order.discount_total !== null && order.discount_total > 0 && (
              <InfoRow label="Diskon" value={formatRupiah(order.discount_total)} />
            )}
            {order.service_fee !== null && order.service_fee > 0 && (
              <InfoRow label="Biaya Layanan" value={formatRupiah(order.service_fee)} />
            )}
            <InfoRow
              label="Total"
              value={formatRupiah(order.total)}
              accent
            />
            {order.payment_status && order.payment_status !== 'unpaid' && (
              <InfoRow label="Pembayaran" value={order.payment_status} />
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Merchant Info */}
      <Card className="mb-4">
        <Card.Body>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-lg">
              &#x1F3F2;
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-stone-900">
                {order.listings?.merchants?.name ?? 'Merchant'}
              </h3>
              {order.listings?.merchants?.address && (
                <div className="flex items-center gap-1 text-xs text-stone-500 mt-1">
                  <MapPin className="w-3 h-3" />
                  {order.listings.merchants.address}
                </div>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Actions — client island (cancel button + countdown timer) */}
      <OrderDetailIsland
        orderId={order.id}
        status={order.status}
        pickupDeadline={order.pickup_deadline ?? null}
      />
    </div>
  );
}

// ─── Inline Server Components ─────────���─────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
  accent = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-stone-500">{label}</span>
      <span
        className={
          'text-sm font-medium ' +
          (accent
            ? 'font-bold text-emerald-600'
            : mono
              ? 'font-mono text-stone-900'
              : 'text-stone-900')
        }
      >
        {value}
      </span>
    </div>
  );
}

function StatusSteps({ status }: { status: string }) {
  const STEPS: Array<{ key: string; label: string }> = [
    { key: 'pending', label: 'Belum Bayar' },
    { key: 'paid', label: 'Bayar' },
    { key: 'ready', label: 'Siap Pickup' },
    { key: 'completed', label: 'Selesai' },
  ];

  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((step, i) => {
          const isPast = i <= currentIndex;
          const isActive = i === currentIndex + 1 && status !== 'cancelled' && status !== 'completed';
          return (
            <div key={step.key} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isPast
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-emerald-200 text-emerald-700 animate-pulse'
                      : 'bg-stone-200 text-stone-400'
                }`}
              >
                {isPast ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className="text-xs text-stone-500 mt-1">{step.label}</span>
            </div>
          );
        })}
      </div>
      <div className="h-1 bg-stone-100 rounded-full mt-2">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{
            width: currentIndex >= 0 ? `${(currentIndex / (STEPS.length - 1)) * 100}%` : '0%',
          }}
        />
      </div>
    </div>
  );
}

function PaymentBanner({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">Pesanan ini telah dibatalkan.</p>
        </div>
      </Card>
    );
  }

  if (status === 'completed') {
    return (
      <div className="text-center py-3 mb-4">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-1" />
        <Badge variant="emerald" className="text-sm px-4 py-1">
          Selesai
        </Badge>
      </div>
    );
  }

  return null;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'Rp 0';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}
