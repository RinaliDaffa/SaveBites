/**
 * SaveBites V3 — Reviews Server Actions
 *
 * Direct insert path for reviews. The schema has `unique (merchant_id,
 * consumer_id)` and the stored procedure `submit_review()` provides the
 * canonical path (used by /api/reviews). These actions duplicate that
 * behavior for form-based callers, with manual aggregate recalculation
 * on the merchants row.
 *
 * Note: when a consumer already reviewed the same merchant via a
 * different completed order, the unique constraint will reject the
 * insert. The action pre-checks by `order_id` (the common case) and
 * also handles the conflict by surfacing a clean error.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ─── Schemas ────────────────────────────────────────────────────

const createReviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(500),
});

const deleteReviewSchema = z.object({
  reviewId: z.string().uuid(),
});

// ─── Result Type ────────────────────────────────────────────────

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ─── Helpers ────────────────────────────────────────────────────

/** Parse a FormData numeric value defensively. */
function parseNumber(raw: FormDataEntryValue | null): number {
  if (typeof raw !== 'string') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Recompute and persist the merchant's aggregate rating + total_reviews
 * from the reviews table. Falls back to zeroes when no reviews exist.
 */
async function recalculateMerchantRating(
  supabase: Awaited<ReturnType<typeof createClient>>,
  merchantId: string,
): Promise<void> {
  const { data: reviews, error: reviewError } = await supabase
    .from('reviews')
    .select('rating')
    .eq('merchant_id', merchantId);

  if (reviewError) {
    console.error('[RECALCULATE RATING ERROR]', reviewError);
    return;
  }

  if (!reviews || reviews.length === 0) {
    await supabase
      .from('merchants')
      .update({ rating: 0, total_reviews: 0 })
      .eq('id', merchantId);
    return;
  }

  const totalReviews = reviews.length;
  const sum = reviews.reduce(
    (acc, r) => acc + Number((r as { rating: number }).rating),
    0,
  );
  // Round to 2 decimal places to match the numeric(3,2) column.
  const avg = Math.round((sum / totalReviews) * 100) / 100;

  await supabase
    .from('merchants')
    .update({ rating: avg, total_reviews: totalReviews })
    .eq('id', merchantId);
}

// ─── Create Review ──────────────────────────────────────────────

export async function createReviewAction(
  formData: FormData
): Promise<ActionResult<{ reviewId: string }>> {
  const parsed = createReviewSchema.safeParse({
    orderId: formData.get('orderId'),
    rating: parseNumber(formData.get('rating')),
    comment: formData.get('comment'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Input tidak valid',
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Silakan login terlebih dahulu' };

  // Verify the order belongs to this user and is completed.
  // RLS already limits us to own orders, but we also need the merchant_id
  // and listing_id from the row to satisfy the reviews schema.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, consumer_id, merchant_id, listing_id, status')
    .eq('id', parsed.data.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { success: false, error: 'Pesanan tidak ditemukan' };
  }
  if (order.consumer_id !== user.id) {
    return { success: false, error: 'Tidak memiliki akses' };
  }
  if (order.status !== 'completed') {
    return {
      success: false,
      error: 'Hanya pesanan yang sudah selesai yang dapat diulas',
    };
  }

  // Pre-check by order_id — the common case is one review per order.
  // The DB's unique (merchant_id, consumer_id) catches the edge case
  // where the same user reviewed the same merchant via a different order.
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', parsed.data.orderId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Anda sudah mengulas pesanan ini' };
  }

  // Create the review. The unique constraint on (merchant_id, consumer_id)
  // is the final guard — catch a 23505 conflict and translate to Indonesian.
  // Note: reviews table does NOT have a listing_id column.
  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      order_id: parsed.data.orderId,
      consumer_id: user.id,
      merchant_id: order.merchant_id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    })
    .select('id')
    .single();

  if (error || !review) {
    // 23505 = unique_violation in PostgREST / Postgres.
    if (error?.code === '23505') {
      return {
        success: false,
        error: 'Anda sudah pernah mengulas merchant ini',
      };
    }
    console.error('[CREATE REVIEW ERROR]', error);
    return { success: false, error: 'Gagal membuat ulasan' };
  }

  // Keep the merchant aggregate in sync (the DB trigger would also do this,
  // but we want this action to work even if the trigger is not present).
  await recalculateMerchantRating(supabase, order.merchant_id);

  revalidatePath(`/c/orders/${parsed.data.orderId}`);
  revalidatePath('/c/reviews');
  revalidatePath(`/c/listing/${order.listing_id}`);
  return { success: true, data: { reviewId: review.id } };
}

// ─── Delete Review ──────────────────────────────────────────────

export async function deleteReviewAction(formData: FormData): Promise<ActionResult> {
  const rawReviewId = formData.get('reviewId');
  if (typeof rawReviewId !== 'string') {
    return { success: false, error: 'Review ID tidak valid' };
  }

  const parsed = deleteReviewSchema.safeParse({ reviewId: rawReviewId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Review ID tidak valid' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Silakan login terlebih dahulu' };

  const { data: review } = await supabase
    .from('reviews')
    .select('consumer_id, merchant_id')
    .eq('id', rawReviewId)
    .maybeSingle();

  if (!review) return { success: false, error: 'Ulasan tidak ditemukan' };
  if (review.consumer_id !== user.id) {
    return { success: false, error: 'Tidak memiliki akses' };
  }

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', rawReviewId);

  if (error) {
    console.error('[DELETE REVIEW ERROR]', error);
    return { success: false, error: 'Gagal menghapus ulasan' };
  }

  // Recalculate merchant aggregate so the deletion is reflected in the UI.
  await recalculateMerchantRating(supabase, review.merchant_id);

  revalidatePath('/c/reviews');
  revalidatePath('/c/discover');
  return { success: true };
}