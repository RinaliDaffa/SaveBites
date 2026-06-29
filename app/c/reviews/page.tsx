/**
 * SaveBites V3 — Rating & Review Screen (Server Component)
 *
 * Server-side: fetches community reviews for a given merchant.
 * Client island: handles submit-review form.
 */

import { notFound } from 'next/navigation';
import { Star, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import SubmitReviewIsland from './submit-review-island';

interface Stats {
  averageRating: number;
  totalReviews: number;
  distribution: Record<string, number>;
}

interface ReviewRowWithProfile {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null }[] | null;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Resolve merchantId: URL param > from user's completed orders
  const params = await searchParams;
  let merchantId = params.merchantId;

  if (!merchantId) {
    const { data: orders } = await supabase
      .from('orders')
      .select('merchant_id')
      .eq('consumer_id', user.id)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle();

    merchantId = orders?.merchant_id ?? null;
  }

  if (!merchantId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-stone-900 mb-3">Reviews</h1>
        <div className="text-5xl mb-4">⭐</div>
        <p className="text-sm text-stone-500">
          Belum ada pesanan selesai untuk diulas.
        </p>
      </div>
    );
  }

  // Fetch community reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select(
      `
        id, rating, comment, created_at,
        profiles!consumer_id ( full_name )
      `,
    )
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  const typedReviews = (reviews ?? []) as ReviewRowWithProfile[];

  // Fetch stats from merchant table
  const { data: merchant } = await supabase
    .from('merchants')
    .select('rating, total_reviews')
    .eq('id', merchantId)
    .maybeSingle();

  const stats: Stats = {
    averageRating: merchant?.rating ?? 0,
    totalReviews: typedReviews.length,
    distribution: buildDistribution(typedReviews),
  };

  const distCounts = [5, 4, 3, 2, 1].map((star) =>
    Number(stats.distribution[String(star)]) || 0,
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Reviews</h1>

      {/* Submit Review Island */}
      <SubmitReviewIsland merchantId={merchantId} />

      {/* Community Reviews */}
      <div>
        <h2 className="text-lg font-bold text-stone-900 mb-3">Ulasan Komunitas</h2>

        {/* Rating Summary */}
        <Card className="mb-4">
          <Card.Body>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-stone-900">
                  {stats.averageRating.toFixed(1)}
                </div>
                <div className="flex gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(stats.averageRating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-stone-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  {stats.totalReviews} ulasan
                </div>
              </div>

              {/* Distribution */}
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const idx = 5 - stars;
                  const count = distCounts[idx] || 0;
                  const pct =
                    stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-stone-500">{stars}</span>
                      <Star className="w-3 h-3 text-stone-300 fill-current" />
                      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-stone-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Review List */}
        <div className="space-y-3">
          {(typedReviews.length ?? 0) > 0 ? (
            typedReviews.map((r) => (
              <Card key={r.id}>
                <Card.Body>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm text-stone-900">
                          {r.profiles?.[0]?.full_name ||
                            'Anonymous'}
                        </h3>
                        <span className="text-xs text-stone-400">
                          {new Date(r.created_at).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <div className="flex gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= r.rating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                      {r.comment && (
                        <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                          {r.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-500">Belum ada ulasan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildDistribution(reviews: { rating: number }[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const r of reviews) {
    const key = String(r.rating);
    dist[key] = (dist[key] || 0) + 1;
  }
  return dist;
}
