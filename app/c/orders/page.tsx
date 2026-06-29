/**
 * SaveBites V3 — Consumer Orders Page (Server Component)
 * Renders the consumer's order history directly on the server, with the
 * status filter driven by a search param. The list revalidates whenever an
 * order is created, cancelled, or paid.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getConsumerOrdersAction } from '@/lib/actions/orders';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { OrderCard } from '@/components/shared/OrderCard';
import type { EnrichedServerOrder } from '@/lib/actions/orders';

const FILTERS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'Semua' },
  { value: 'pending', label: 'Belum Bayar' },
  { value: 'paid', label: 'Sudah Bayar' },
  { value: 'ready', label: 'Siap Pickup' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  // Await search params (Next.js 15 contract)
  const params = await searchParams;
  const statusFilter = params.status;

  // Auth guard at the server boundary
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/c/orders');
  }

  const orders = await getConsumerOrdersAction(statusFilter);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Pesanan Saya</h1>
        <Badge variant="neutral" className="text-xs">
          {orders.length} pesanan
        </Badge>
      </div>

      {/* Status filter — server-driven via search params */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const isActive = statusFilter === f.value;
          const href = f.value ? `/c/orders?status=${f.value}` : '/c/orders';
          return (
            <Link
              key={String(f.value ?? 'all')}
              href={href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-emerald-500 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <EmptyState statusFilter={statusFilter} />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCardLink key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function OrderCardLink({ order }: { order: EnrichedServerOrder }) {
  const listing = order.listings;
  const merchant = listing?.merchants;
  return (
    <Link href={`/c/orders/${order.order_number}`} className="block group">
      <Card className="p-4 transition-shadow group-hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-mono text-stone-500">
                {order.order_number}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <h3 className="font-semibold text-stone-900 truncate">
              {listing?.title ?? 'Meal'}
            </h3>
            <p className="text-sm text-stone-500 truncate">
              {merchant?.name ?? 'Merchant'}
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-stone-500">
                {order.quantity}x • {formatRupiah(order.total)}
              </span>
              <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                Detail <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'completed'
      ? 'emerald'
      : status === 'paid' || status === 'ready'
        ? 'success'
        : status === 'cancelled' || status === 'expired'
          ? 'neutral'
          : 'warning';
  const label = STATUS_LABELS[status] ?? status;
  return (
    <Badge variant={variant as 'emerald' | 'success' | 'neutral' | 'warning'} className="text-xs">
      {label}
    </Badge>
  );
}

function EmptyState({ statusFilter }: { statusFilter?: string }) {
  return (
    <Card className="p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
        <Package className="w-8 h-8 text-stone-400" />
      </div>
      <h3 className="text-lg font-semibold text-stone-900 mb-2">
        {statusFilter ? 'Tidak ada pesanan' : 'Belum ada pesanan'}
      </h3>
      <p className="text-stone-500 mb-4">
        {statusFilter
          ? `Tidak ada pesanan dengan status "${STATUS_LABELS[statusFilter] ?? statusFilter}".`
          : 'Yuk, mulai temukan makanan surplus di dekatmu!'}
      </p>
      <Link
        href="/c/discover"
        className="text-emerald-600 font-medium hover:underline"
      >
        Cari Makanan
      </Link>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Belum Bayar',
  paid: 'Sudah Bayar',
  ready: 'Siap Pickup',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

function formatRupiah(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}
