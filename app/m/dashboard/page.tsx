/**
 * SaveBites V3 — Merchant Dashboard Page
 * Overview stats, active listings, and recent orders.
 * Server Component — fetches from Supabase directly.
 */

import { getMerchantDashboardStats, getMerchantListings, getMerchantOrders } from '@/lib/queries/merchant';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { OrderCard } from '@/components/shared/OrderCard';
import { formatIDR } from '@/lib/utils/pricing';
import { TrendingUp, Package, ShoppingBag, AlertTriangle, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function MerchantDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/m/dashboard');
  }

  // Resolve merchant UUID from auth user.
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  const merchantId = merchant?.id ?? null;
  const ownerId = user.id;

  const stats = merchantId ? await getMerchantDashboardStats(merchantId, 7) : null;

  // Fetch listings once and reuse for both stats and display
  const allListings = merchantId ? await getMerchantListings(merchantId) : [];
  const listingTitleMap = new Map<string, string>();
  const activeListings: typeof allListings = [];
  for (const l of allListings) {
    listingTitleMap.set(l.id, l.title);
    if (l.is_active && !l.is_sold_out) {
      activeListings.push(l);
    }
  }

  const orders = merchantId ? await getMerchantOrders(merchantId, { limit: 5 }) : [];

  // No merchant found for this user
  if (!merchantId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <div className="text-6xl mb-4">🏪</div>
        <h2 className="text-xl font-bold text-stone-900">Belum ada merchant</h2>
        <p className="text-stone-500 mt-2">Anda belum terdaftar sebagai merchant. Hubungi admin untuk mendaftar.</p>
      </div>
    );
  }

  // Query failed or returned no data
  if (!stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <div className="text-6xl mb-4">!</div>
        <h2 className="text-xl font-bold text-stone-900">Gagal memuat</h2>
        <p className="text-stone-500 mt-2">Tidak dapat mengambil data dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-sm text-stone-500">Welcome back, Merchant</p>
        </div>
        <Link href="/m/listings/new">
          <Button variant="primary">
            <Package className="w-4 h-4 mr-2" /> New Listing
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Today&apos;s Orders', value: stats.todayOrders, icon: ShoppingBag, color: 'text-emerald-600' },
          { label: 'Active Listings', value: stats.activeListings, icon: Package, color: 'text-blue-600' },
          { label: 'Revenue (7d)', value: formatIDR(stats.revenue), icon: DollarSign, color: 'text-amber-600' },
          { label: 'Cancel Rate', value: `${(stats.cancellationRate * 100).toFixed(1)}%`, icon: AlertTriangle, color: 'text-red-600' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-stone-500">{stat.label}</p>
                <p className="text-lg font-bold text-stone-900">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/m/listings/new">
          <Button variant="outline" className="flex-1">Buat Pesanan Baru</Button>
        </Link>
        <Link href="/m/pickup">
          <Button variant="outline" className="flex-1">Pickup Queue</Button>
        </Link>
        <Link href="/m/listings">
          <Button variant="outline" className="flex-1">Manage Listings</Button>
        </Link>
      </div>

      {/* Active Listings */}
      <div>
        <h2 className="text-lg font-bold text-stone-900 mb-3">Active Listings</h2>
        {activeListings.length === 0 ? (
          <div className="text-center py-10 text-stone-500">No active listings yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeListings.slice(0, 6).map(item => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-900 text-sm truncate">{item.title}</h3>
                    {item.category && <Badge variant="neutral" className="mt-1">{item.category}</Badge>}
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0 ml-2" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-lg font-bold text-emerald-600">{formatIDR(item.surplus_price)}</span>
                    <span className="text-xs text-stone-400 line-through ml-1">{formatIDR(item.original_price)}</span>
                  </div>
                  <span className="text-xs text-stone-500">{item.quantity_available} left</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div>
        <h2 className="text-lg font-bold text-stone-900 mb-3">Recent Orders</h2>
        {orders.length === 0 ? (
          <div className="text-center py-10 text-stone-500">No orders yet.</div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                orderNumber={order.order_number}
                listingTitle={listingTitleMap.get(order.listing_id) ?? order.listing_id.slice(0, 8)}
                merchantName="My Restaurant"
                quantity={order.quantity}
                total={order.total}
                status={order.status as 'pending' | 'paid' | 'ready' | 'picked_up' | 'completed' | 'cancelled'}
                pickupCode={order.pickup_code}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
