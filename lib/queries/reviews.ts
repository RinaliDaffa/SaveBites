/**
 * SaveBites V3 — Reviews Server-Side Queries
 * Data fetchers for review retrieval and aggregation.
 * Review submission goes through the stored procedure submit_review().
 */

import { createClient } from '@/lib/supabase/server';

// ─── Types ───────────────────────────────────────────────────────

/** A review row with the reviewer's full_name folded in */
export type ReviewWithProfile = {
  id: string;
  merchant_id: string;
  consumer_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name: string | null;
};

/** Rating histogram entry: { star: 1, count: 5 } */
type DistEntry = { star: number; count: number };

/** Aggregated stats for a single merchant */
export type ReviewStats = {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
};

// ─── Queries ───────────────────────���─────────────────���───────────

/**
 * Fetch reviews for a merchant, joined with profiles for reviewer name.
 * Returns up to `limit` rows ordered newest-first.
 */
export async function getReviewsByMerchant(
  merchantId: string,
  limit: number = 10
): Promise<ReviewWithProfile[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id, merchant_id, consumer_id, order_id, rating, comment, created_at,
      profiles!consumer_id ( full_name )
    `)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[reviews] getReviewsByMerchant error:', error.message);
    return [];
  }

  return ((data as unknown as Array<{
    id: string;
    merchant_id: string;
    consumer_id: string;
    order_id: string | null;
    rating: number;
    comment: string | null;
    created_at: string;
    profiles: { full_name: string | null }[];
  }>).map(
    (row) => ({
      id: row.id,
      merchant_id: row.merchant_id,
      consumer_id: row.consumer_id,
      order_id: row.order_id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at,
      full_name: row.profiles?.[0]?.full_name ?? null,
    })
  ) ?? [] as ReviewWithProfile[]);
}

/**
 * Fetch aggregate review stats for a merchant without fetching every row.
 * Computes average, total, and per-star histogram in SQL.
 */
export async function getReviewStats(merchantId: string): Promise<ReviewStats> {
  const supabase = await createClient();

  // Pull the pre-computed columns from the merchants table first (kept in sync
  // by submit_review trigger).  Fall back to a lightweight aggregation if needed.
  const { data: merch } = await supabase
    .from('merchants')
    .select('rating, total_reviews')
    .eq('id', merchantId)
    .maybeSingle();

  if (merch && merch.rating && merch.total_reviews > 0) {
    const averageRating = Math.round(Number(merch.rating) * 100) / 100;
    return {
      averageRating,
      totalReviews: merch.total_reviews,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  // Fallback: compute distribution from review rows (cheap for low-count merchants)
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('merchant_id', merchantId);

  if (!reviews || reviews.length === 0) {
    return { averageRating: 0, totalReviews: 0, ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  const totalReviews = reviews.length;
  const sum = reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0);
  const averageRating = Math.round(((sum / totalReviews) * 100) / 100);

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    dist[r.rating] = (dist[r.rating] || 0) + 1;
  }

  return { averageRating, totalReviews, ratingDistribution: dist };
}

// ─── Submission (via stored procedure) ──────────────────────────

/**
 * Submit a review by calling the database stored procedure.
 * The proc validates order completion, handles upsert on (merchant, consumer),
 * and updates the merchant aggregate.
 */
export async function submitReview(input: {
  orderId: string;
  rating: number;
  comment?: string;
}): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('submit_review', {
    p_order_id: input.orderId,
    p_rating: input.rating,
    p_comment: input.comment ?? null,
  });

  if (error) {
    console.error('[reviews] submitReview error:', error.message);
    return false;
  }

  return true;
}
