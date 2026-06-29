/**
 * SaveBites V3 — Orders Server-Side Queries
 * Data fetchers for consumer orders and merchant order management.
 * Uses UUID-based IDs and schema-compliant column names throughout.
 */

import { createClient } from '@/lib/supabase/server';
import type { Order, Listing, Merchant } from '@/lib/types/database';

/** Profile row returned from the profiles table join */
interface ProfileSummary {
  full_name: string | null;
  phone: string | null;
}

/**
 * Enriched order row from Supabase select with joins.
 * Matches what the consumer and merchant API routes expect.
 */
type EnrichedOrder = Order & {
  listings?: (Pick<Listing, 'title' | 'category' | 'merchant_id' | 'original_price' | 'surplus_price'> & {
    merchants?: Pick<Merchant, 'name' | 'address' | 'city' | 'latitude' | 'longitude'>;
  }) | null;
  profiles?: ProfileSummary | null;
};

/**
 * Fetch orders by consumer ID with optional status filter.
 * Joins listings -> merchants for consumer-facing context.
 */
export async function getOrdersByConsumer(
  consumerId: string,
  statusFilter?: string,
): Promise<EnrichedOrder[]> {
  const supabase = await createClient();

  let query = supabase
    .from('orders')
    .select(
      `*,
       listings(title, category, merchant_id, original_price, surplus_price,
        merchants(name, address, city, latitude, longitude)
       )`
    )
    .eq('consumer_id', consumerId)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching consumer orders:', error);
    return [];
  }

  return (data ?? []) as EnrichedOrder[];
}

/**
 * Fetch orders by merchant ID with optional status filter.
 * Queries orders.merchant_id directly (schema stores merchant_id on orders).
 * Joins listings and consumer profiles for context.
 */
export async function getOrdersByMerchant(
  merchantId: string,
  statusFilter?: string,
): Promise<EnrichedOrder[]> {
  const supabase = await createClient();

  let query = supabase
    .from('orders')
    .select('*, listings(title), profiles(full_name, phone)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching merchant orders:', error);
    return [];
  }

  return (data ?? []) as EnrichedOrder[];
}

/**
 * Fetch a single order by order_number string.
 * Returns enriched shape: order + listing + merchant info.
 */
export async function getOrderByNumber(
  orderNumber: string,
): Promise<EnrichedOrder | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `*,
       listings(title, merchants(name, address)),
       profiles(full_name, phone)`
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    console.error('Error fetching order:', error);
    return null;
  }

  return (data ?? null) as EnrichedOrder | null;
}

/**
 * Create an order by calling the stored procedure public.create_order().
 * The procedure handles: stock validation, atomic decrement,
 * order_number/pickup_code generation, subtotal/total calculation,
 * listing is_sold_out update, and order row insertion.
 *
 * Note: consumer_id is read from auth.uid() inside the procedure.
 * payment_method is not set by the procedure; callers should update it
 * afterwards via RPC or an RLS policy that permits it.
 */
export async function createOrder(input: {
  listingId: string;
  quantity: number;
}): Promise<
  | {
      orderId: string;
      orderNumber: string;
      pickupCode: string;
      pickupDeadline: string;
      total: number;
    }
  | null
> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_order', {
    p_listing_id: input.listingId,
    p_quantity: input.quantity,
  });

  if (error) {
    console.error('Error creating order:', error);
    return null;
  }

  if (Array.isArray(data) && data.length > 0) {
    const row = data[0] as {
      order_id: string;
      order_number: string;
      pickup_code: string;
      pickup_deadline: string;
      total: number;
    };
    return {
      orderId: row.order_id,
      orderNumber: row.order_number,
      pickupCode: row.pickup_code,
      pickupDeadline: row.pickup_deadline,
      total: Number(row.total),
    };
  }

  return null;
}
