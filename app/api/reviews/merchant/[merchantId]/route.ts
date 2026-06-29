import { NextResponse } from 'next/server';
import { getReviewStats, getReviewsByMerchant } from '@/lib/queries/reviews';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const { merchantId } = await params;

    const stats = await getReviewStats(merchantId);
    const reviews = await getReviewsByMerchant(merchantId, 10);

    const distribution: Record<string, number> = {};
    for (let i = 1; i <= 5; i++) {
      distribution[String(i)] = stats.ratingDistribution[i] || 0;
    }

    return NextResponse.json({
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
      distribution,
      reviews: reviews.map((r) => ({
        id: r.id,
        reviewerName: r.full_name || 'Anonymous',
        rating: r.rating,
        comment: r.comment || undefined,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('[REVIEWS] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
