/**
 * SaveBites V3 — Checkout Client
 * Payment method selector + 10-minute countdown timer + Midtrans integration.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { formatIDR } from '@/lib/utils/pricing';

// ─── Types ─────────────────────────────────────────────────────

type PaymentMethod = 'qris' | 'gopay' | 'ovo' | 'dana' | 'shopeepay';

interface JoinedListing {
  title: string | null;
  description: string | null;
  image_url: string | null;
  surplus_price: number | null;
  merchants?: { name: string | null; address: string | null } | null;
}

interface OrderShape {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  quantity: number;
  subtotal: number | null;
  discount_total: number | null;
  service_fee: number | null;
  total: number;
  pickup_deadline: string | null;
  pickup_code: string | null;
  created_at: string;
  listings: JoinedListing | null;
}

interface CheckoutClientProps {
  order: OrderShape;
}

interface MidtransChargeData {
  transaction_id?: string;
  order_id?: string;
  status_code?: string | number;
  qr_code?: string | null;
  redirect_url?: string | null;
  payment_type?: string;
  [key: string]: unknown;
}

interface PaymentStatusData {
  status?: string;
  midtrans_txn_id?: string;
  [key: string]: unknown;
}

// ─── Constants ─────────────────────────────────────────────────

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; emoji: string }> = [
  { id: 'qris', label: 'QRIS', emoji: '🔳' },
  { id: 'gopay', label: 'GoPay', emoji: '🟢' },
  { id: 'ovo', label: 'OVO', emoji: '🟣' },
  { id: 'dana', label: 'DANA', emoji: '🔵' },
  { id: 'shopeepay', label: 'ShopeePay', emoji: '🟠' },
];

// ─── Component ─────────────────────────────────────────────────

export function CheckoutClient({ order }: CheckoutClientProps) {
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qris');
  const [secondsLeft, setSecondsLeft] = useState<number>(() => computeSecondsLeft(order.pickup_deadline));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargeData, setChargeData] = useState<MidtransChargeData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired' | 'cancelled' | 'failed' | null>(
    order.status === 'paid' ? 'paid' : 'pending'
  );

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If the order is already paid on first render, send the user to the order page.
  useEffect(() => {
    if (order.status === 'paid' || order.status === 'ready') {
      router.replace(`/c/orders/${order.order_number}`);
    }
  }, [order.status, order.order_number, router]);

  // Countdown timer
  useEffect(() => {
    if (!order.pickup_deadline) return;

    const interval = setInterval(() => {
      const remaining = computeSecondsLeft(order.pickup_deadline);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.pickup_deadline]);

  // Polling for payment status
  useEffect(() => {
    if (!chargeData || paymentStatus !== 'pending') {
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status/${order.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { success?: boolean; data?: PaymentStatusData };
        const data = json.data ?? {};

        // Midtrans midtrans_status may be present; fall back to our DB row's `status`.
        const rawStatus: string =
          (data.midtrans_status as unknown as { transaction_status?: string })?.transaction_status ??
          data.status ??
          'pending';

        const normalized = normalizeMidtransStatus(rawStatus);
        if (normalized !== 'pending') {
          setPaymentStatus(normalized);
          stopPolling();
          if (normalized === 'paid') {
            router.replace(`/c/orders/${order.order_number}`);
          }
        }
      } catch {
        // ignore — try again on next tick
      }
    }, 5000);

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeData, paymentStatus, order.id, order.order_number, router]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // ─── Derived values ─────────────────────────────────────────

  const title = order.listings?.title ?? 'Meal';
  const merchantName = order.listings?.merchants?.name ?? 'Merchant';
  const imageUrl =
    order.listings?.image_url ||
    `https://placehold.co/200x200/e7e5e4/78716c?text=${encodeURIComponent(title)}`;

  const totalAmount = Number(order.total ?? order.subtotal ?? 0);

  const countdownDisplay = formatCountdown(secondsLeft);
  const isExpired = secondsLeft <= 0;

  // ─── Handlers ───────────────────────────────────────────────

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, paymentType: paymentMethod }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Gagal membuat pembayaran');
      }

      const json = (await res.json()) as { success?: boolean; data?: MidtransChargeData };
      setChargeData(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setPaying(false);
    }
  };

  // ─── Render states ──────────────────────────────────────────

  if (paymentStatus === 'paid') {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-stone-900 mb-2">Pembayaran Berhasil</h1>
        <p className="text-sm text-stone-500 mb-6">Mengalihkan ke detail pesanan...</p>
        <Button fullWidth onClick={() => router.push(`/c/orders/${order.order_number}`)}>
          Lihat Pesanan
        </Button>
      </div>
    );
  }

  if (paymentStatus === 'expired' || paymentStatus === 'cancelled' || paymentStatus === 'failed' || isExpired) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-stone-900 mb-2">Pembayaran Kedaluwarsa</h1>
        <p className="text-sm text-stone-500 mb-6">
          Reservasi telah berakhir. Silakan buat pesanan baru.
        </p>
        <Button fullWidth onClick={() => router.push('/c/discover')}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Kembali
      </button>

      <h1 className="text-2xl font-bold text-stone-900">Checkout</h1>

      {/* Countdown */}
      <Card className="bg-amber-50 border-amber-200">
        <div className="flex items-center gap-3 px-5 py-4">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-amber-700 font-medium">Selesaikan pembayaran dalam</p>
            <p className="text-lg font-bold text-amber-900 font-mono">{countdownDisplay}</p>
          </div>
        </div>
      </Card>

      {/* Order summary */}
      <Card>
        <div className="p-4">
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden shrink-0">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-stone-900 line-clamp-2">{title}</h3>
              <p className="text-xs text-stone-500 mt-0.5">{merchantName}</p>
              <p className="text-xs text-stone-500 mt-1">{order.quantity}x</p>
            </div>
          </div>

          <div className="border-t border-stone-100 mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Subtotal</span>
              <span className="text-stone-700">{formatIDR(Number(order.subtotal ?? totalAmount))}</span>
            </div>
            {(Number(order.service_fee ?? 0) > 0) && (
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Biaya Layanan</span>
                <span className="text-stone-700">{formatIDR(Number(order.service_fee ?? 0))}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-stone-100">
              <span className="font-semibold text-stone-900">Total</span>
              <span className="text-lg font-bold text-emerald-600">{formatIDR(totalAmount)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment method selector */}
      {!chargeData && (
        <Card>
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-stone-900">Metode Pembayaran</h3>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((m) => {
                const selected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 transition-colors text-left ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="text-xl">{m.emoji}</div>
                    <div className="flex-1">
                      <p className="font-medium text-stone-900 text-sm">{m.label}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 ${
                        selected ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300'
                      }`}
                    >
                      {selected && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* Pay button */}
      {!chargeData && (
        <Button fullWidth size="lg" loading={paying} onClick={handlePay}>
          Bayar Sekarang — {formatIDR(totalAmount)}
        </Button>
      )}

      {/* Charge result — QR or redirect */}
      {chargeData && (
        <Card>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="emerald">
                {chargeData.payment_type?.toUpperCase() ?? paymentMethod.toUpperCase()}
              </Badge>
              <span className="text-xs text-stone-500">Menunggu pembayaran</span>
            </div>

            {paymentMethod === 'qris' && chargeData.qr_code && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="bg-white p-3 rounded-2xl border-2 border-stone-200">
                  <img
                    src={chargeData.qr_code}
                    alt="QRIS"
                    className="w-56 h-56 object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <QrCode className="w-4 h-4" />
                  <span>Scan QRIS untuk membayar</span>
                </div>
              </div>
            )}

            {paymentMethod !== 'qris' && chargeData.redirect_url && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-sm text-stone-600 text-center">
                  Buka aplikasi {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label} untuk menyelesaikan pembayaran
                </p>
                <Button
                  variant="primary"
                  onClick={() => window.open(chargeData.redirect_url!, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Buka Aplikasi Pembayaran
                </Button>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-stone-500 pt-2 border-t border-stone-100">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Memantau status pembayaran...</span>
            </div>
          </div>
        </Card>
      )}

      {/* Order number footer */}
      <p className="text-center text-xs text-stone-400 pt-2">
        Pesanan #{order.order_number}
      </p>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function computeSecondsLeft(reservationExpiresAt: string | null): number {
  if (!reservationExpiresAt) return 0;
  const deadline = new Date(reservationExpiresAt).getTime();
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
}

function formatCountdown(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function normalizeMidtransStatus(
  raw: string
): 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed' {
  const v = raw.toLowerCase();
  if (v === 'paid' || v === 'settlement' || v === 'capture') return 'paid';
  if (v === 'expired') return 'expired';
  if (v === 'cancelled' || v === 'cancel' || v === 'deny') return 'cancelled';
  if (v === 'failed' || v === 'failure') return 'failed';
  return 'pending';
}