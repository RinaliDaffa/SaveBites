import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { orderReserveLimit } from '@/lib/security/rate-limit';
import {
  getClientIp,
  applyRateLimitHeaders,
  rateLimitResponse,
} from '@/lib/security/request';
import { guardBodySize } from '@/lib/security/body-limit';
import { reserveSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    // Body size guard
    const bodyGuard = guardBodySize(request, 2 * 1024);
    if (bodyGuard) return bodyGuard;

    // Rate limit per IP (consumer-side, prevents reservation spamming)
    const ip = getClientIp(request);
    const rlResult = await orderReserveLimit.check(`reserve:${ip}`);
    if (!rlResult.success) {
      return applyRateLimitHeaders(rateLimitResponse(rlResult), rlResult);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = reserveSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    // Call the create_order stored procedure
    const { data, error } = await supabase.rpc('create_order', {
      p_listing_id: parsed.data.listingId,
      p_quantity: parsed.data.quantity,
    });

    if (error) {
      console.error('[ORDER RESERVE] RPC error:', error);
      const resp = NextResponse.json(
        { error: 'Failed to reserve order' },
        { status: 500 }
      );
      return applyRateLimitHeaders(resp, rlResult);
    }

    if (Array.isArray(data) && data.length > 0) {
      const row = data[0];
      const resp = NextResponse.json({
        orderId: row.order_id,
        orderNumber: row.order_number,
        pickupCode: row.pickup_code,
        pickupDeadline: row.pickup_deadline,
        total: Number(row.total),
      });
      return applyRateLimitHeaders(resp, rlResult);
    }

    const resp = NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
    return applyRateLimitHeaders(resp, rlResult);
  } catch (error) {
    console.error('[ORDER RESERVE] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
