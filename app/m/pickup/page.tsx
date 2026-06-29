/**
 * SaveBites V3 — Merchant Pickup Queue Page
 * Server Component that resolves merchant from auth session and fetches real orders.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PickupQueueClient from './PickupQueueClient';

export default async function PickupQueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/m/pickup');
  }

  // Resolve merchant UUID from auth user.
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-stone-900">Akses Ditolak</h2>
        <p className="text-stone-500 mt-2">Halaman pickup queue hanya untuk merchant.</p>
      </div>
    );
  }

  // Fetch orders that are in 'paid' or 'ready' status for this merchant.
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, pickup_code, quantity, total, created_at, listing_id')
    .eq('merchant_id', merchant.id)
    .in('status', ['paid', 'ready'])
    .order('created_at', { ascending: false });

  type OrderRow = NonNullable<typeof orders>[number];
  const pickups = (orders ?? []).map((o: OrderRow) => ({
    orderId: o.id,
    customerName: 'Pelanggan',
    mealTitle: `Pesanan ${o.order_number}`,
    quantity: Number(o.quantity) || 1,
    pickupCode: o.pickup_code || '',
    status: o.status === 'paid' ? 'pending' : 'ready' as 'pending' | 'ready',
    expiresAt: Date.now() / 1000 + 3600,
    totalPrice: Number(o.total) || 0,
  }));

  return <PickupQueueClient pickups={pickups} />;
}
