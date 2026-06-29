/**
 * Local ambient declaration for the `midtrans-client` package, which ships
 * JavaScript-only (no shipped .d.ts).
 */

declare module 'midtrans-client' {
  interface SnapOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  interface CoreApiOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  interface SnapTransactionRequest {
    transaction_details: {
      order_id: string;
      gross_amount: number;
    };
    item_details?: unknown[];
    customer_details?: Record<string, unknown>;
    enabled_payments?: string[];
    callbacks?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface CoreApiTransactionRequest {
    payment_type: string;
    transaction_details: {
      order_id: string;
      gross_amount: number;
    };
    item_details?: unknown[];
    customer_details?: Record<string, unknown>;
    qris?: { acquirer?: string };
    gopay?: Record<string, unknown>;
    [key: string]: unknown;
  }

  class Snap {
    constructor(options: SnapOptions);
    createTransaction(
      payload: SnapTransactionRequest,
    ): Promise<Record<string, unknown>>;
    createTransactionToken(
      payload: SnapTransactionRequest,
    ): Promise<string>;
    createTransactionRedirectUrl(
      payload: SnapTransactionRequest,
    ): Promise<string>;
  }

  class CoreApi {
    constructor(options: CoreApiOptions);
    createTransaction(
      payload: CoreApiTransactionRequest,
    ): Promise<Record<string, unknown>>;
    getStatus(transactionId: string): Promise<Record<string, unknown>>;
    approve(transactionId: string): Promise<Record<string, unknown>>;
    cancel(transactionId: string): Promise<Record<string, unknown>>;
    expire(transactionId: string): Promise<Record<string, unknown>>;
    refund(
      transactionId: string,
      payload?: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  }

  const midtrans: {
    Snap: typeof Snap;
    CoreApi: typeof CoreApi;
  };

  export default midtrans;
}