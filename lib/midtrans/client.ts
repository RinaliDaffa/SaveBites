/**
 * SaveBites V3 — Midtrans Payment Client
 * Service layer for creating QRIS/GoPay/OVO/DANA charges and verifying webhooks.
 */

import midtransClient from 'midtrans-client';
import type {
  MidtransChargeRequest,
  MidtransChargeResponse,
  MidtransWebhookBody,
} from './types';
import { mapMidtransStatusToOrder } from './types';
import { createRequire } from 'node:module';
import type { createHash } from 'node:crypto';

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';

const require = createRequire(import.meta.url);

/** Create a Snap client for popup-style checkout (optional fallback) */
export function getSnapClient() {
  return new midtransClient.Snap({
    isProduction,
    serverKey,
  });
}

/** Create a Core API client for direct QRIS/GoPay/etc charges */
export function getCoreApiClient() {
  return new midtransClient.CoreApi({
    isProduction,
    serverKey,
  });
}

/**
 * Create a charge with Midtrans.
 * Use `payment_type: 'qris'` for QRIS, or `'gopay' | 'ovo' | 'dana'` for e-wallet redirects.
 */
export async function createCharge(
  payload: MidtransChargeRequest,
): Promise<MidtransChargeResponse> {
  const client = getCoreApiClient();

  const chargeRequest = {
    payment_type: payload.payment_type,
    transaction_details: payload.transaction_details,
    item_details: payload.item_details,
    customer_details: payload.customer_details,
    ...(payload.payment_type === 'qris' ? { qris: payload.qris ?? {} } : {}),
  };

  const response = await client.createTransaction(chargeRequest);
  return response as unknown as MidtransChargeResponse;
}

/**
 * Check the status of an existing Midtrans transaction by its transaction ID.
 */
export async function checkTransactionStatus(
  transactionId: string,
): Promise<Record<string, unknown>> {
  const client = getCoreApiClient();
  const status = await client.getStatus(transactionId);
  return status as Record<string, unknown>;
}

/**
 * Verify a webhook payload's signature.
 * Core API formula: SHA-512(orderId + statusCode + grossAmount + serverKey).
 * NOTE: unlike Snap (which includes transactionId), Core API omits transactionId.
 */
export function verifyWebhookSignature(
  payload: Record<string, unknown>,
  signature: string,
): boolean {
  const orderId = String(payload.order_id ?? '');
  const statusCode = String(payload.status_code ?? '');
  const grossAmount = String(payload.gross_amount ?? '');

  // Dynamically import Node crypto to avoid browser 'crypto' global conflicts
  const cryptoModule = require('crypto') as typeof import('crypto');
  const expectedSignature = cryptoModule
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
  return expectedSignature === signature;
}

/**
 * Map a Midtrans webhook payload to our internal order status string.
 */
export function getOrderStatusFromWebhook(
  payload: MidtransWebhookBody,
): 'pending_payment' | 'paid' | 'cancelled' | 'expired' | 'failed' {
  return mapMidtransStatusToOrder(
    payload.status_message ?? '',
    payload.transaction_type ?? '',
    payload.status_code ?? '',
  );
}
