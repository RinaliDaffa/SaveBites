/**
 * SaveBites V3 — Merchant Orders Page
 * Server Component that resolves the owner from auth session and delegates to client.
 */

import { getMerchantOrders } from '@/lib/queries/merchant';
import MerchantOrdersClient from './MerchantOrdersClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Order } from '@/lib/types/database';

export default async function MerchantOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/m/orders');
  }

  // Resolve merchant UUID from auth user.
  const ordersRaw = await getMerchantOrders(user.id, { limit: 50 });

  // Normalize to Order type expected by client.
  const orders: Order[] = (ordersRaw as unknown as Array<Partial<Order>>).map((o) => ({
    id: o.id ?? '',
    order_number: o.order_number ?? '',
    consumer_id: o.consumer_id ?? '',
    merchant_id: o.merchant_id ?? '',
    listing_id: o.listing_id ?? '',
    status: o.status ?? 'pending',
    payment_status: o.payment_status ?? 'unpaid',
    payment_method: o.payment_method ?? null,
    subtotal: Number(o.subtotal ?? 0),
    discount_total: Number(o.discount_total ?? 0),
    service_fee: Number(o.service_fee ?? 0),
    quantity: Number(o.quantity ?? 0),
    total: Number(o.total ?? 0),
    pickup_code: o.pickup_code ?? '',
    pickup_deadline: o.pickup_deadline ?? '',
    reserved_until: o.reserved_until ?? o.pickup_deadline ?? '',
    picked_up_at: o.picked_up_at ?? null,
    notes: o.notes ?? null,
    created_at: o.created_at ?? '',
    updated_at: o.updated_at ?? '',
  }));

  // Build listing title map.
  const listingTitles = new Map<string, string>();
  for (const o of orders) {
    if (o.listing_id && !listingTitles.has(o.listing_id)) {
      listingTitles.set(o.listing_id, `Order ${o.order_number}`);
    }
  }

  return <MerchantOrdersClient orders={orders} listingTitleMap={listingTitles} />;
}
