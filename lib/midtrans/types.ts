/**
 * SaveBites V3 — Midtrans Type Definitions
 * Interfaces for charge requests, responses, and webhook payloads.
 */

/** Order item interface matching the project's order structure */
export interface PaymentItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

/** Midtrans charge request interface */
export interface MidtransChargeRequest {
  payment_type: 'qris' | 'gopay' | 'ovo' | 'dana' | 'shopeepay';
  transaction_details: {
    order_id: string;
    gross_amount: number;
  };
  item_details: PaymentItem[];
  customer_details: {
    first_name: string;
    email: string;
    phone: string;
  };
  qris?: {
    acquirer?: string;
  };
}

/** Midtrans charge response */
export interface MidtransChargeResponse {
  status_code: number;
  status_message: string;
  transaction_id: string;
  order_id: string;
  payment_type: string;
  transaction_time: string;
  gross_amount: string;
  signature_key?: string;
  qr_code?: string;       // For QRIS
  qr_length?: number;
  redirect_url?: string;  // For GoPay, OVO, DANA, etc.
  pan?: string;
  acr1?: string;
  acr2?: string;
  eac?: string;
}

/** Midtrans webhook body */
export interface MidtransWebhookBody {
  status_code: string;
  status_message: string;
  service_code: string;
  transaction_type: string;
  transaction_time: string;
  transaction_id: string;
  masked_card?: string;
  expiry_time?: string;
  order_id: string;
  payment_type: string;
  gross_amount: string;
  signature_key: string;
  fc?: string;
  bank?: string;
  etype?: string;
}

/** Map Midtrans transaction status to our internal order status */
export function mapMidtransStatusToOrder(
  statusMessage: string,
  transactionType: string,
  statusCode: string,
): 'pending_payment' | 'paid' | 'cancelled' | 'expired' | 'failed' {
  const code = parseInt(statusCode, 10);
  const type = transactionType;

  if (type === 'authorization' && code === 200) {
    return 'pending_payment';
  }
  if (
    (type === 'credit_card' ||
      type === 'qris' ||
      type === 'gopay' ||
      type === 'ovo' ||
      type === 'dana') &&
    code === 200
  ) {
    return 'paid';
  }
  if (code === 400 || code === 401 || code === 402 || code === 406) {
    return 'cancelled';
  }
  if (type === 'settlement' && code === 200) {
    return 'paid';
  }
  if (statusCode === '201') {
    return 'pending_payment';
  }
  if (statusCode === '203') {
    return 'cancelled';
  }

  // Fallback heuristics
  if (statusMessage.toLowerCase().includes('settlement')) {
    return 'paid';
  }
  if (
    statusMessage.toLowerCase().includes('expire') ||
    statusMessage.toLowerCase().includes('cancel')
  ) {
    return 'cancelled';
  }

  return 'pending_payment';
}
