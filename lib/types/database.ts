/**
 * SaveBites V3 — Database types.
 *
 * Hand-authored mirror of supabase/migrations/*.sql. Used everywhere the
 * Supabase client returns rows. To regenerate after schema changes:
 *
 *     1. Ensure the local DB is up: `supabase start`
 *     2. Apply migrations:           `supabase db reset`
 *     3. Regenerate:                 `npx supabase gen types typescript
 *                                      --local > lib/types/database.gen.ts`
 *     4. Move the relevant types into this file (or rename the .gen.ts
 *        file to be the source of truth). Commit the result.
 *
 * Until step 3 runs in CI, this file is the contract. Keep the column
 * lists in sync with the migrations by hand.
 *
 * Out of scope:
 *   - RPC return types (these are hand-declared next to each caller).
 *   - Views (none currently).
 *   - Generated columns (none currently).
 */

export type UserRole = 'consumer' | 'merchant';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums ────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';

export type PaymentAttemptStatus =
  | 'pending'
  | 'settlement'
  | 'capture'
  | 'deny'
  | 'cancel'
  | 'expire'
  | 'refund'
  | 'partial_refund'
  | 'chargeback'
  | 'failure';

export type LedgerKind = 'gross' | 'fee' | 'refund' | 'adjustment';

export type SettlementStatus = 'pending' | 'transferred' | 'failed' | 'held';

export type ErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type PaymentMethodCode = 'qris' | 'gopay' | 'ovo' | 'dana' | 'shopeepay' | 'cash';

// ─── Tables (mirror of supabase/migrations/) ──────────────────

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  dietary_tags: string[];
  last_lat: number | null;
  last_lng: number | null;
  created_at: string;
  updated_at: string;
};

export type MerchantRow = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  rating: number;
  total_reviews: number;
  is_active: boolean;
  verified: boolean;
  opening_hours: Record<string, { open: string; close: string }>;
  created_at: string;
  updated_at: string;
};

export type ListingRow = {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string;
  original_price: number;
  surplus_price: number;
  quantity_available: number;
  available_from: string;
  available_until: string;
  is_active: boolean;
  is_sold_out: boolean;
  dietary_tags: string[];
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  order_number: string;
  consumer_id: string;
  merchant_id: string;
  listing_id: string;
  quantity: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethodCode | null;
  subtotal: number;
  discount_total: number;
  service_fee: number;
  total: number;
  pickup_code: string;
  pickup_deadline: string;
  reserved_until: string;
  picked_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  order_id: string;
  consumer_id: string;
  merchant_id: string;
  amount: number;
  payment_method: string | null;
  status: PaymentAttemptStatus;
  midtrans_order_id: string;
  midtrans_txn_id: string | null;
  midtrans_payment_type: string | null;
  midtrans_fraud_status: string | null;
  raw_response: Json;
  paid_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentWebhookRow = {
  id: string;
  order_id: string | null;
  payment_id: string | null;
  midtrans_order_id: string;
  midtrans_txn_id: string | null;
  internal_status: string | null;
  raw_payload: Json;
  received_at: string;
  processed_at: string | null;
  processing_error: string | null;
};

export type MerchantLedgerRow = {
  id: string;
  merchant_id: string;
  order_id: string;
  payment_id: string | null;
  settlement_id: string | null;
  kind: LedgerKind;
  amount_idr: number;
  currency: string;
  memo: string | null;
  created_at: string;
};

export type SettlementRow = {
  id: string;
  merchant_id: string;
  period_date: string;
  gross_idr: number;
  fee_idr: number;
  net_idr: number;
  order_count: number;
  status: SettlementStatus;
  transferred_at: string | null;
  transfer_reference: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  id: string;
  merchant_id: string;
  consumer_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ErrorLogRow = {
  id: string;
  level: ErrorLevel;
  route: string;
  method: string | null;
  request_id: string | null;
  user_id: string | null;
  status_code: number | null;
  message: string;
  details: Json | null;
  created_at: string;
};

// ─── Database shape (for generic SupabaseClient<Database>) ────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProfileRow>;
      };
      merchants: {
        Row: MerchantRow;
        Insert: Omit<MerchantRow, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MerchantRow>;
      };
      listings: {
        Row: ListingRow;
        Insert: Omit<ListingRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ListingRow>;
      };
      orders: {
        Row: OrderRow;
        Insert: Omit<OrderRow, 'id' | 'created_at' | 'updated_at' | 'reserved_until'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          reserved_until?: string;
        };
        Update: Partial<OrderRow>;
      };
      payments: {
        Row: PaymentRow;
        Insert: Omit<PaymentRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<PaymentRow>;
      };
      payment_webhooks: {
        Row: PaymentWebhookRow;
        Insert: Omit<PaymentWebhookRow, 'id' | 'received_at'> & {
          id?: string;
          received_at?: string;
        };
        Update: Partial<PaymentWebhookRow>;
      };
      merchant_ledger: {
        Row: MerchantLedgerRow;
        Insert: Omit<MerchantLedgerRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<MerchantLedgerRow>;
      };
      settlements: {
        Row: SettlementRow;
        Insert: Omit<SettlementRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SettlementRow>;
      };
      reviews: {
        Row: ReviewRow;
        Insert: Omit<ReviewRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ReviewRow>;
      };
      error_logs: {
        Row: ErrorLogRow;
        Insert: Omit<ErrorLogRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ErrorLogRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      payment_attempt_status: PaymentAttemptStatus;
      ledger_kind: LedgerKind;
      settlement_status: SettlementStatus;
      error_level: ErrorLevel;
      user_role: UserRole;
    };
  };
};

// ─── Convenience aliases ──────────────────────────────────────

export type Profile = ProfileRow;
export type Merchant = MerchantRow;
export type Listing = ListingRow;
export type Order = OrderRow;
export type Payment = PaymentRow;
export type Review = ReviewRow;
export type Settlement = SettlementRow;

// ─── Domain input/output types ────────────────────────────────

export interface CreateListingInput {
  title: string;
  description?: string;
  category?: string;
  originalPrice: number;
  surplusPrice: number;
  quantity: number;
  availableUntil: string;
  dietaryTags?: string[];
}

// ─── Consumer-facing listing card (distance merged) ───────────

export type ListingCard = ListingRow & {
  merchant_name: string;
  merchant_address: string;
  merchant_category: string;
  merchant_latitude: number;
  merchant_longitude: number;
  distance_km: number;
};

// ─── Domain result types ──────────────────────────────────────

export type OrderWithDetails = OrderRow & {
  merchant: MerchantRow;
  listing: ListingRow;
};