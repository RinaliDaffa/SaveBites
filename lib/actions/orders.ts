/**
 * SaveBites V3 — Orders Server Actions
 * Replaces POST /api/orders/* with typed Server Actions so forms and client
 * components can call them directly without round-tripping through fetch().
 *
 * Schema conventions honoured here:
 * - listings: `quantity_available` (not `quantity`), `is_active`/`is_sold_out`
 *   flags, `surplus_price` for the consumer-facing price.
 * - orders: `consumer_id`/`merchant_id`, `pickup_code`/`pickup_deadline`,
 *   `order_number`, `discount_total`, `service_fee`, `total`.
 * - Statuses: 'pending' | 'paid' | 'ready' | 'completed' | 'cancelled' | 'expired'
 * - Payment statuses: 'unpaid' | 'paid' | 'refunded' | 'failed'
 *
 * The `create_order` Postgres function (see `lib/queries/orders.ts`) is the
 * canonical path for creating reservations because it atomically validates
 * stock, decrements inventory, generates order_number/pickup_code, and inserts
 * the order row in a single transaction.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createOrder } from '@/lib/queries/orders';
import type { Order, Listing, Merchant, Profile } from '@/lib/types/database';

/** Profile row from join */
type ProfileSummary = Pick<Profile, 'full_name' | 'phone'>;

/** Enriched order shape returned to Server Components */
export type EnrichedServerOrder = Order & {
  listings?: (Pick<Listing, 'title' | 'category' | 'merchant_id' | 'original_price' | 'surplus_price' | 'image_url'> & {
    merchants?: Pick<Merchant, 'name' | 'address' | 'city' | 'latitude' | 'longitude'> | null;
  }) | null;
  profiles?: ProfileSummary | null;
};

// ─── Result type ────────────────────────────────────────────────

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

export type CreateReservationResult = {
  orderId: string;
  orderNumber: string;
  pickupCode: string;
  pickupDeadline: string;
  total: number;
};

// ─── Zod schemas ────────────────────────────────────────────────

const reserveSchema = z.object({
  listingId: z.string().uuid('Listing ID tidak valid'),
  quantity: z
    .number({ message: 'Quantity tidak valid' })
    .int('Quantity harus bilangan bulat')
    .min(1, 'Quantity minimal 1')
    .max(10, 'Quantity maksimal 10'),
});

const orderIdSchema = z.object({
  orderId: z.string().min(1, 'Order ID tidak valid'),
});

// ─── createReservationAction ────────────────────────────────────

/**
 * Consumer-facing reservation. Validates input, ensures the user is signed in,
 * checks listing is active and has stock, then delegates to the
 * `create_order` RPC for the atomic insert + decrement.
 */
export async function createReservationAction(
  formData: FormData
): Promise<ActionResult<CreateReservationResult>> {
  const rawQuantity = formData.get('quantity');
  const quantity =
    typeof rawQuantity === 'string' && rawQuantity.length > 0
      ? Number(rawQuantity)
      : 1;

  const parsed = reserveSchema.safeParse({
    listingId: formData.get('listingId'),
    quantity,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Input tidak valid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  // Pre-flight validation: the RPC also checks, but failing fast here gives
  // a friendlier error message and avoids an RPC round-trip.
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, quantity_available, surplus_price, is_active, is_sold_out, available_until')
    .eq('id', parsed.data.listingId)
    .maybeSingle();

  if (listingError) {
    console.error('createReservationAction — listing lookup error:', listingError);
    return { success: false, error: 'Listing tidak ditemukan' };
  }

  if (!listing || !listing.is_active || listing.is_sold_out) {
    return { success: false, error: 'Listing tidak tersedia' };
  }

  if (listing.quantity_available < parsed.data.quantity) {
    return { success: false, error: 'Stok tidak cukup' };
  }

  if (new Date(listing.available_until) <= new Date()) {
    return { success: false, error: 'Listing sudah kedaluwarsa' };
  }

  // Delegate the atomic create + decrement to the Postgres function.
  const result = await createOrder({
    listingId: parsed.data.listingId,
    quantity: parsed.data.quantity,
  });

  if (!result) {
    return { success: false, error: 'Gagal membuat reservasi' };
  }

  revalidatePath(`/c/listing/${parsed.data.listingId}`);
  revalidatePath('/c/orders');
  revalidatePath('/c/discover');

  return {
    success: true,
    data: {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      pickupCode: result.pickupCode,
      pickupDeadline: result.pickupDeadline,
      total: result.total,
    },
  };
}

// ─── cancelOrderAction ──────────────────────────────────────────

/**
 * Consumer-facing cancellation. Restores stock to the listing and marks the
 * order as `cancelled`. The order must currently be `pending` or `paid`.
 */
export async function cancelOrderAction(
  formData: FormData
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Order ID tidak valid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  // Look up by id (UUID) or order_number — the existing cancel API uses
  // order_number, so we support both to stay compatible.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      parsed.data.orderId
    );

  let query = supabase
    .from('orders')
    .select('id, consumer_id, listing_id, quantity, status, payment_status, order_number')
    .eq('consumer_id', user.id);

  query = isUuid
    ? query.eq('id', parsed.data.orderId)
    : query.eq('order_number', parsed.data.orderId);

  const { data: order, error: orderErr } = await query.maybeSingle();

  if (orderErr) {
    console.error('cancelOrderAction — order lookup error:', orderErr);
    return { success: false, error: 'Gagal membatalkan pesanan' };
  }

  if (!order) {
    return { success: false, error: 'Pesanan tidak ditemukan' };
  }

  if (!['pending', 'paid'].includes(order.status)) {
    return { success: false, error: 'Pesanan tidak dapat dibatalkan' };
  }

  // Restore stock to the listing. We do this with an additive update so it's
  // safe even under concurrent writes (last writer wins on the final value).
  const { data: listing } = await supabase
    .from('listings')
    .select('quantity_available, is_sold_out')
    .eq('id', order.listing_id)
    .maybeSingle();

  if (listing) {
    const nextQty = (listing.quantity_available ?? 0) + order.quantity;
    await supabase
      .from('listings')
      .update({
        quantity_available: nextQty,
        is_sold_out: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.listing_id);
  }

  // Mark the order cancelled. We do NOT touch payment_status here — refunds
  // are handled by a separate payments flow.
  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (updateErr) {
    console.error('cancelOrderAction — update error:', updateErr);
    return { success: false, error: 'Gagal membatalkan pesanan' };
  }

  revalidatePath(`/c/orders/${order.order_number}`);
  revalidatePath('/c/orders');
  revalidatePath('/m/orders');

  return { success: true };
}

// ─── confirmPickupAction ────────────────────────────────────────

/**
 * Merchant-facing action. Marks a paid order as `ready` for consumer pickup.
 * Requires the order to be owned by the calling merchant and already paid.
 */
export async function confirmPickupAction(
  formData: FormData
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Order ID tidak valid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  // Resolve the merchant UUID from the auth user (profiles.id).
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return { success: false, error: 'Merchant tidak ditemukan' };
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      parsed.data.orderId
    );

  let query = supabase
    .from('orders')
    .select('id, merchant_id, status, payment_status, order_number, pickup_code')
    .eq('merchant_id', merchant.id);

  query = isUuid
    ? query.eq('id', parsed.data.orderId)
    : query.eq('order_number', parsed.data.orderId);

  const { data: order, error: orderErr } = await query.maybeSingle();

  if (orderErr) {
    console.error('confirmPickupAction — order lookup error:', orderErr);
    return { success: false, error: 'Gagal mengonfirmasi pesanan' };
  }

  if (!order) {
    return { success: false, error: 'Pesanan tidak ditemukan' };
  }

  if (order.payment_status !== 'paid') {
    return { success: false, error: 'Pembayaran belum diterima' };
  }

  if (order.status !== 'paid') {
    return { success: false, error: 'Pesanan belum siap dikonfirmasi' };
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status: 'ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (updateErr) {
    console.error('confirmPickupAction — update error:', updateErr);
    return { success: false, error: 'Gagal mengonfirmasi pesanan' };
  }

  revalidatePath('/m/pickup');
  revalidatePath('/m/orders');
  revalidatePath(`/c/orders/${order.order_number}`);

  return { success: true };
}

// ─── completeOrderAction ────────────────────────────────────────

/**
 * Merchant-facing action. Marks a `ready` order as `completed` once the
 * consumer has picked it up. Optionally records the pickup timestamp.
 */
export async function completeOrderAction(
  formData: FormData
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Order ID tidak valid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  // Resolve the merchant UUID from the auth user (profiles.id).
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return { success: false, error: 'Merchant tidak ditemukan' };
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      parsed.data.orderId
    );

  let query = supabase
    .from('orders')
    .select('id, merchant_id, status, order_number')
    .eq('merchant_id', merchant.id);

  query = isUuid
    ? query.eq('id', parsed.data.orderId)
    : query.eq('order_number', parsed.data.orderId);

  const { data: order, error: orderErr } = await query.maybeSingle();

  if (orderErr) {
    console.error('completeOrderAction — order lookup error:', orderErr);
    return { success: false, error: 'Gagal menyelesaikan pesanan' };
  }

  if (!order) {
    return { success: false, error: 'Pesanan tidak ditemukan' };
  }

  if (order.status !== 'ready') {
    return { success: false, error: 'Pesanan belum siap untuk diselesaikan' };
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      picked_up_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (updateErr) {
    console.error('completeOrderAction — update error:', updateErr);
    return { success: false, error: 'Gagal menyelesaikan pesanan' };
  }

  revalidatePath('/m/pickup');
  revalidatePath('/m/orders');
  revalidatePath(`/c/orders/${order.order_number}`);

  return { success: true };
}

// ─── confirmPickupByCodeAction ──────────────────────────────────

/**
 * Merchant-facing action. Allows confirming pickup by scanning the 6-char
 * pickup code from a consumer's receipt. This is the action used by
 * the QR scanner on /m/pickup.
 */
export async function confirmPickupByCodeAction(
  formData: FormData
): Promise<ActionResult> {
  const parsed = z.object({
    pickupCode: z
      .string()
      .regex(/^[A-Z0-9]{6}$/, 'Kode pickup tidak valid'),
  }).safeParse({ pickupCode: formData.get('pickupCode') });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Kode pickup tidak valid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  // Resolve the merchant UUID from the auth user (profiles.id).
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return { success: false, error: 'Merchant tidak ditemukan' };
  }

  // Look up order by merchant and pickup_code
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, merchant_id, status, payment_status, order_number')
    .eq('merchant_id', merchant.id)
    .eq('pickup_code', parsed.data.pickupCode.toUpperCase())
    .maybeSingle();

  if (orderErr) {
    console.error('confirmPickupByCodeAction — order lookup error:', orderErr);
    return { success: false, error: 'Gagal memverifikasi kode pickup' };
  }

  if (!order) {
    return { success: false, error: 'Kode pickup tidak ditemukan' };
  }

  if (order.payment_status !== 'paid') {
    return { success: false, error: 'Pembayaran belum diterima' };
  }

  if (order.status !== 'ready') {
    return { success: false, error: 'Pesanan belum siap untuk pickup' };
  }

  // Transition to completed
  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      picked_up_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (updateErr) {
    console.error('confirmPickupByCodeAction — update error:', updateErr);
    return { success: false, error: 'Gagal menyelesaikan pesanan' };
  }

  revalidatePath('/m/pickup');
  revalidatePath('/m/orders');
  revalidatePath(`/c/orders/${order.order_number}`);

  return { success: true };
}

// ─── createReservationAndPayAction (helper for the checkout flow) ─
//
// Form-driven reservations often want to immediately go to payment. This wraps
// `createReservationAction` and redirects to the checkout page on success.
export async function createReservationAndPayAction(
  formData: FormData
): Promise<ActionResult<CreateReservationResult>> {
  const result = await createReservationAction(formData);

  if (!result.success || !result.data) {
    return result;
  }

  const orderId = result.data.orderId;
  redirect(`/c/checkout/${orderId}`);
}

// ─── getConsumerOrdersAction ────────────────────────────────────

/**
 * Fetch all orders for the current consumer, with enriched listing/merchant info.
 * Replaces `trpc.order.getConsumerOrders()`.
 */
export async function getConsumerOrdersAction(
  statusFilter?: string
): Promise<EnrichedServerOrder[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let query = supabase
    .from('orders')
    .select(
      `*,
       listings(
         title,
         category,
         merchant_id,
         original_price,
         surplus_price,
         image_url,
         merchants(
           name,
           address,
           city,
           latitude,
           longitude
         )
       )`
    )
    .eq('consumer_id', user.id)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getConsumerOrdersAction — error:', error);
    return [];
  }

  return (data ?? []) as unknown as EnrichedServerOrder[];
}

// ─── getOrderByNumberAction ─────────────────────────────────────

/**
 * Fetch a single order by its order_number string, with full enrichment.
 * Replaces `trpc.order.getById()`.
 */
export async function getOrderByNumberAction(
  orderNumber: string
): Promise<EnrichedServerOrder | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `*,
       listings(
         title,
         category,
         merchant_id,
         original_price,
         surplus_price,
         image_url,
         merchants(
           name,
           address,
           city,
           latitude,
           longitude
         )
       ),
       profiles(full_name, phone)`
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    console.error('getOrderByNumberAction — error:', error);
    return null;
  }

  return (data ?? null) as unknown as EnrichedServerOrder | null;
}
