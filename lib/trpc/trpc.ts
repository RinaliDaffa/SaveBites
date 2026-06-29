/**
 * SaveBites V3 — Typed API Client (tRPC-like)
 * Vanilla fetch wrapper with inferred types from lib/types/database.
 * Provides a simple `trpc.*` namespace for all consumer/merchant API calls.
 */

import type {
  Listing,
  ListingCard,
  Order,
  Review,
} from '@/lib/types/database';

// ─── HTTP client ────────────────────────────────────────────────

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json();
}

// ─── Discovery ──────────────────────────────────────────────────

export const discovery = {
  /** Fetch active listings near the given coordinates */
  getNearby: (params: {
    lat: number;
    lng: number;
    radius?: number;
    maxPrice?: number;
    limit?: number;
    sortBy?: 'cheapest' | 'nearest' | 'expiring';
  }) =>
    fetchApi<ListingCard[]>(`discovery/nearby`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// ─── Listings ───────────────────────────────────────────────────

export const listing = {
  getById: (id: string) =>
    fetchApi<Listing>(`listings/${id}`),

  getByMerchant: (merchantId: string, status?: string) =>
    fetchApi<Listing[]>(`listings/merchant/${merchantId}${status ? `?status=${status}` : ''}`),

  create: (data: {
    title: string;
    description?: string;
    originalPrice: number;
    surplusPrice: number;
    quantity: number;
    availableUntil: string;
    category?: string;
    dietaryTags?: string[];
  }) => fetchApi<Listing>('listings', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<{ title: string; description: string | null; category: string; originalPrice: number; surplusPrice: number; quantity_available: number; available_until: string; is_active: boolean; is_sold_out: boolean; dietary_tags: string[] }>) =>
    fetchApi<Listing>(`listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    fetchApi<void>(`listings/${id}`, { method: 'DELETE' }),

  search: (query: string, lat?: number, lng?: number, radius?: number) =>
    fetchApi<Listing[]>(`listings/search?q=${encodeURIComponent(query)}${lat ? `&lat=${lat}&lng=${lng}&r=${radius}` : ''}`),
};

// ─── Orders ─────────────────────────────────────────────────────

export const order = {
  reserve: (listingId: string, quantity: number, paymentMethod: string) =>
    fetchApi<{ orderId: string; orderNumber: string; pickupCode: string }>(
      'orders/reserve',
      { method: 'POST', body: JSON.stringify({ listingId, quantity, paymentMethod }) }
    ),

  cancel: (orderId: string) =>
    fetchApi<void>(`orders/${orderId}/cancel`, { method: 'POST' }),

  getConsumerOrders: (statusFilter?: string) =>
    fetchApi<Order[]>(`orders/consumer${statusFilter ? `?status=${statusFilter}` : ''}`),

  getById: (id: string) =>
    fetchApi<Order>(`orders/${id}`),

  getMerchantOrders: (statusFilter?: string) =>
    fetchApi<Order[]>(`orders/merchant${statusFilter ? `?status=${statusFilter}` : ''}`),

  confirmPickup: (pickupCode: string) =>
    fetchApi<Order>(`orders/pickup/${pickupCode}`, { method: 'POST' }),
};

// ─── Merchant ───────────────────────────────────────────────────

export const merchant = {
  getDashboardStats: (days?: number) =>
    fetchApi<{
      totalOrders: number;
      todayOrders: number;
      activeListings: number;
      revenue: number;
      cancellationRate: number;
    }>(`merchant/dashboard${days ? `?days=${days}` : ''}`),

  getListings: (status?: string) =>
    fetchApi<Listing[]>(`merchant/listings${status ? `?status=${status}` : ''}`),

  pauseListing: (id: string) =>
    fetchApi<Listing>(`merchant/listings/${id}/pause`, { method: 'POST' }),

  resumeListing: (id: string) =>
    fetchApi<Listing>(`merchant/listings/${id}/resume`, { method: 'POST' }),

  deleteListing: (id: string) =>
    fetchApi<void>(`merchant/listings/${id}`, { method: 'DELETE' }),
};

// ─── Reviews ────────────────────────────────────────────────────

export const review = {
  getByMerchant: (merchantId: string) =>
    fetchApi<{
      averageRating: number;
      totalReviews: number;
      distribution: Record<string, number>;
    }>(`reviews/merchant/${merchantId}`),

  submit: (data: {
    merchantId: string;
    consumerId: string;
    orderId: string;
    rating: number;
    comment?: string;
  }) =>
    fetchApi<Review>('reviews', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Auth ───────────────────────────────────────────────────────
// Auth lives outside the trpc client: login/register/logout are handled
// either via Supabase browser client directly or via the `loginAction` /
// `registerAction` / `logoutAction` Server Actions in `lib/actions/auth.ts`.
// No `/api/auth/*` routes exist, so this namespace has been removed.

// ─── Export combined namespace (mimics tRPC) ────────────────────

export const trpc = {
  discovery,
  listing,
  order,
  merchant,
  review,
};
