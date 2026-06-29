/**
 * SaveBites V3 — POST /api/payments/create
 * Initiates a Midtrans payment charge for a given order.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCharge } from '@/lib/midtrans/client';
import type { PaymentItem } from '@/lib/midtrans/types';
import { SERVICE_FEE_FLAT_IDR } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, paymentType = 'qris' } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Fetch the order with listing and consumer profile info
    const supabase2 = await createClient();
    const { data: order, error: orderError } = await supabase2
      .from('orders')
      .select('*, listings(title, original_price, surplus_price), profiles(full_name, phone, email)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('[PAYMENTS CREATE] order fetch error:', orderError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.consumer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized — order does not belong to you' }, { status: 403 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Order is not in pending state' }, { status: 400 });
    }

    // Build payment items from order data. The order row is the source
    // of truth — subtotal and service_fee are written by the create_order
    // RPC. The route does NOT recompute the fee on top; if the values
    // drift, the Midtrans charge will be rejected by the consumer's
    // payment app, which surfaces the mismatch immediately.
    const itemSubtotal = Number(order.subtotal ?? 0);
    const itemFee = Number(order.service_fee ?? SERVICE_FEE_FLAT_IDR);
    const grossAmount = itemSubtotal + itemFee;
    const itemQuantity = order.quantity ?? 1;

    const paymentItems: PaymentItem[] = [
      {
        id: order.listings?.id ?? order.listing_id ?? 'meal',
        name: order.listings?.title ?? 'Meal Reservation',
        price: itemSubtotal,
        quantity: itemQuantity,
      },
    ];

    // Create Midtrans charge
    const profile = order.profiles;
    const chargeResult = await createCharge({
      payment_type: paymentType as 'qris' | 'gopay' | 'ovo' | 'dana' | 'shopeepay',
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: paymentItems,
      customer_details: {
        first_name: profile?.full_name ?? 'Customer',
        email: profile?.email ?? user.email ?? '',
        phone: profile?.phone ?? '',
      },
    });

    // Create payments record (merchant_id resolved from the order)
    const { error: paymentError } = await supabase.from('payments').insert({
      order_id: orderId,
      consumer_id: user.id,
      merchant_id: order.merchant_id,
      amount: grossAmount,
      payment_method: paymentType,
      status: 'pending',
      midtrans_order_id: chargeResult.order_id,
      midtrans_txn_id: chargeResult.transaction_id,
      raw_response: chargeResult as unknown as Record<string, unknown>,
    });

    if (paymentError) {
      console.error('[PAYMENTS CREATE] payment insert error:', paymentError);
      // Best-effort — do not fail the charge creation if payment insert fails
    }

    return NextResponse.json({
      success: true,
      data: chargeResult,
    });
  } catch (error) {
    console.error('[PAYMENTS CREATE] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
