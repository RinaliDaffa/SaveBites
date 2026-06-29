/**
 * SaveBites V3 — Merchant Server-Side Queries
 * Data fetchers for merchant dashboard, listings management, and analytics.
 * All IDs are UUID strings matching the database schema.
 */

import { createClient } from '@/lib/supabase/server';
import type { Merchant, Listing, Order, OrderStatus } from '@/lib/types/database';

// ─── Merchant Profile ───────────────────────────────────────────

/**
 * Fetch a merchant record by its UUID primary key.
 */
export async function getMerchantById(merchantId: string): Promise<Merchant | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching merchant by id:', error);
    return null;
  }

  return data as Merchant | null;
}

/**
 * Fetch a merchant record by its slug.
 */
export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('Error fetching merchant by slug:', error);
    return null;
  }

  return data as Merchant | null;
}

/**
 * Given an auth user's profile id (owner_id), fetch the linked merchant row.
 * Returns null when the profile has no merchant record.
 */
export async function getMerchantByOwnerId(ownerId: string): Promise<Merchant | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching merchant by owner_id:', error);
    return null;
  }

  return data as Merchant | null;
}

// ─── Dashboard Statistics ───────────────────────────────────────

export type MerchantDashboardStats = {
  totalOrders: number;
  todayOrders: number;
  activeListings: number;
  revenue: number;
  cancellationRate: number;
};

/**
 * Fetch aggregated dashboard stats for a merchant identified by merchant UUID.
 * Counts orders scoped to the merchant's listings, not directly to merchant_id.
 */
export async function getMerchantDashboardStats(
  merchantId: string,
  days: number = 7
): Promise<MerchantDashboardStats> {
  const supabase = await createClient();
  const now = new Date();
  const sinceDaysAgo = new Date(now.getTime() - days * 86400_000);
  const sinceToday = new Date(now);
  sinceToday.setHours(0, 0, 0, 0);

  // 1. Count active listings (is_active=true, is_sold_out=false)
  const { count: activeListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .eq('is_sold_out', false);

  // 2. Get all listing IDs owned by this merchant (for order scoping)
  const { data: listings } = await supabase
    .from('listings')
    .select('id')
    .eq('merchant_id', merchantId);

  const listingIds = (listings as { id: string }[]).map(l => l.id) || [];

  if (listingIds.length === 0) {
    return { totalOrders: 0, todayOrders: 0, activeListings: 0, revenue: 0, cancellationRate: 0 };
  }

  // 3. Total orders in the given window (any status)
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('listing_id', listingIds)
    .gte('created_at', sinceDaysAgo.toISOString());

  // 4. Today's orders
  const { count: todayOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('listing_id', listingIds)
    .gte('created_at', sinceToday.toISOString());

  // 5. Revenue from completed orders
  const { data: completedOrders } = await supabase
    .from('orders')
    .select('total')
    .in('listing_id', listingIds)
    .eq('status', 'completed');

  const revenue = (completedOrders ?? []).reduce(
    (sum, o) => sum + Number(o.total || 0),
    0
  );

  // 6. Cancellation rate
  const { count: cancelledOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('listing_id', listingIds)
    .eq('status', 'cancelled');

  const cancelCount = cancelledOrders ?? 0;
  const totalCount = totalOrders ?? 0;
  const cancellationRate = totalCount > 0 ? Math.round((cancelCount / totalCount) * 10000) / 100 : 0;

  return {
    totalOrders: totalCount,
    todayOrders: todayOrders ?? 0,
    activeListings: activeListings ?? 0,
    revenue,
    cancellationRate,
  };
}

// ─── Listings Management ────────────────────────────────────────

/**
 * Fetch all listings for a merchant identified by merchant UUID.
 * Optionally filter by status flags.
 */
export async function getMerchantListings(
  merchantId: string,
  filters?: {
    is_active?: boolean;
    is_sold_out?: boolean;
  }
): Promise<Listing[]> {
  const supabase = await createClient();

  let query = supabase
    .from('listings')
    .select('*')
    .eq('merchant_id', merchantId);

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }
  if (filters?.is_sold_out !== undefined) {
    query = query.eq('is_sold_out', filters.is_sold_out);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching merchant listings:', error);
    return [];
  }

  return (data ?? []) as Listing[];
}

/**
 * Pause a listing by setting is_active=false.
 */
export async function pauseListing(listingId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('listings')
    .update({ is_active: false })
    .eq('id', listingId);

  return !error;
}

/**
 * Resume a listing by setting is_active=true.
 */
export async function resumeListing(listingId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('listings')
    .update({ is_active: true })
    .eq('id', listingId);

  return !error;
}

/**
 * Mark a listing as sold out.
 */
export async function markSoldOut(listingId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('listings')
    .update({ is_sold_out: true })
    .eq('id', listingId);

  return !error;
}

/**
 * Update listing fields by ID.
 */
export async function updateListing(
  listingId: string,
  updates: Partial<Omit<Listing, 'id' | 'merchant_id' | 'created_at' | 'updated_at'>>
): Promise<Listing | null> {
  const supabase = await createClient();

  // Build partial update: only include defined keys
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  const { data, error } = await supabase
    .from('listings')
    .update(payload)
    .eq('id', listingId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating listing:', error);
    return null;
  }

  return data as Listing | null;
}

/**
 * Delete a listing by ID.
 */
export async function deleteListing(listingId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId);

  return !error;
}

/**
 * Update listing stock (available_quantity).
 */
export async function updateListingStock(
  listingId: string,
  newQuantity: number
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('listings')
    .update({ quantity_available: newQuantity })
    .eq('id', listingId);

  return !error;
}

// ─── Orders ─────────────────────────────────────────────────────

/**
 * Fetch orders for a merchant's listings within a status filter.
 * Identifies merchant by merchant UUID (merchants.id).
 */
export async function getMerchantOrders(
  merchantId: string,
  options?: {
    status?: OrderStatus;
    limit?: number;
    offset?: number;
  }
): Promise<Order[]> {
  const supabase = await createClient();

  // Get listing IDs
  const { data: listings } = await supabase
    .from('listings')
    .select('id')
    .eq('merchant_id', merchantId);

  const listingIds = (listings as { id: string }[]).map(l => l.id) || [];

  if (listingIds.length === 0) return [];

  let query = supabase
    .from('orders')
    .select('*')
    .in('listing_id', listingIds)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching merchant orders:', error);
    return [];
  }

  return (data ?? []) as Order[];
}
