/**
 * SaveBites V3 — POST /api/payments/webhook
 * Receives Midtrans webhook notifications and delegates payment
 * confirmation to the idempotent confirm_payment RPC.
 *
 * Security:
 *   - Rate-limited per remote IP (60 req/min, with in-memory fallback).
 *   - Signature verification before any DB calls.
 *   - Idempotency + audit trail are owned by confirm_payment:
 *       - matches on payments.midtrans_order_id
 *       - guard against terminal states (no double-write)
 *       - records every delivery in payment_webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  verifyWebhookSignature,
  getOrderStatusFromWebhook,
} from '@/lib/midtrans/client';
import type { MidtransWebhookBody } from '@/lib/midtrans/types';
import { paymentWebhookLimit } from '@/lib/security/rate-limit';
import {
  getClientIp,
  applyRateLimitHeaders,
  rateLimitResponse,
} from '@/lib/security/request';
import { logger } from '@/lib/logger';

// Internal payment_attempt_status enum used by the confirm_payment RPC.
function mapToPaymentAttemptStatus(
  status: ReturnType<typeof getOrderStatusFromWebhook>,
): 'pending' | 'settlement' | 'deny' | 'cancel' | 'expire' | 'failure' {
  if (status === 'paid') return 'settlement';
  if (status === 'cancelled' || status === 'failed') return 'deny';
  if (status === 'expired') return 'expire';
  return 'pending';
}

export async function POST(request: NextRequest) {
  try {
    // -- Rate limit (prevents webhook-hammer abuse) ------------------------
    const ip = getClientIp(request);
    const rlResult = await paymentWebhookLimit.check(`webhook-pay:${ip}`);
    if (!rlResult.success) {
      return applyRateLimitHeaders(rateLimitResponse(rlResult), rlResult);
    }

    const body = (await request.json()) as MidtransWebhookBody;
    const signature = request.headers.get('x-signature') ?? '';

    // Require signature (Midtrans HMAC-SHA512) -- unsigned webhooks are rejected
    if (!signature) {
      return NextResponse.json({ error: 'Missing x-signature header' }, { status: 400 });
    }

    const isValid = verifyWebhookSignature(body as unknown as Record<string, unknown>, signature);
    if (!isValid) {
      logger.error(
        { route: '/api/payments/webhook', method: 'POST', statusCode: 400 },
        'Invalid Midtrans webhook signature',
        { orderId: body.order_id, ip },
      );
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const orderId = String(body.order_id ?? '');

    if (!orderId) {
      return NextResponse.json({ error: 'order_id missing in webhook body' }, { status: 400 });
    }

    const internalOrderStatus = getOrderStatusFromWebhook(body);
    const pStatus = mapToPaymentAttemptStatus(internalOrderStatus);

    // Service-role client: required because confirm_payment is granted
    // to service_role only, and payment_webhooks has no RLS policies.
    const supabase = createAdminClient();

    // Delegate everything (status updates on payments + orders, idempotency
    // check, audit trail in payment_webhooks) to the RPC.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'confirm_payment',
      {
        p_midtrans_order_id: orderId,
        p_midtrans_txn_id: String(body.transaction_id ?? ''),
        p_payment_type: String(body.payment_type ?? ''),
        p_fraud_status: String(
          (body as unknown as Record<string, unknown>).fraud_status ?? '',
        ),
        p_status: pStatus,
        p_raw_response: body as unknown as Record<string, unknown>, // jsonb param
      },
    );

    if (rpcError) {
      console.error('[PAYMENTS WEBHOOK] confirm_payment RPC error:', rpcError);
      // "Payment record not found" means we received a webhook for an order
      // that was never initialised -- surface a clear 404 instead of 500.
      const msg = rpcError.message ?? '';
      if (msg.includes('Payment record not found')) {
        return NextResponse.json(
          { error: 'Unknown order_id for this merchant' },
          { status: 404 },
        );
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const alreadyProcessed = Array.isArray(rpcResult)
      ? Boolean(rpcResult[0]?.already_processed)
      : false;

    const resp = NextResponse.json({
      processed: true,
      idempotent: alreadyProcessed,
    });
    return applyRateLimitHeaders(resp, rlResult);
  } catch (error) {
    console.error('[PAYMENTS WEBHOOK] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
