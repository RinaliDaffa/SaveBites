/**
 * SaveBites V3 — GET /api/payments/status/[orderId]
 * Returns the current payment status, refreshing from Midtrans when possible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkTransactionStatus } from '@/lib/midtrans/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;

    const supabase = await createClient();
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('midtrans_order_id', orderId)
      .maybeSingle();

    if (paymentError) {
      console.error('[PAYMENT STATUS] payment fetch error:', paymentError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Refresh status from Midtrans if we have a transaction ID
    if (payment.midtrans_txn_id) {
      try {
        const status = await checkTransactionStatus(payment.midtrans_txn_id);
        return NextResponse.json({ success: true, data: { ...payment, midtrans_status: status } });
      } catch (err) {
        console.warn('[PAYMENT STATUS] midtrans refresh failed, returning local:', err);
        // Fall through to local status
      }
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    console.error('[PAYMENT STATUS] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
