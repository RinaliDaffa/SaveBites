import { NextRequest, NextResponse } from 'next/server';
import { submitReview } from '@/lib/queries/reviews';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId, consumerId, orderId, rating, comment } = body;

    if (!orderId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Valid orderId and rating (1-5) are required' },
        { status: 400 }
      );
    }

    const success = await submitReview({ orderId, rating, comment });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to submit review' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[REVIEW SUBMIT] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
