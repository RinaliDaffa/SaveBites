/**
 * SaveBites V3 — Verify pickup code (lookup only, no mutation)
 *
 * POST /api/orders/verify-pickup
 * Body: { pickupCode: "ABC123" }
 *
 * Returns the matching order (merchant-scoped) so the scanner can preview the
 * order details before the merchant confirms. Used to display "Pesanan #XYZ
 * oleh Customer ABC — konfirmasi?" in the confirm modal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickupVerifyLimit } from '@/lib/security/rate-limit';
import {
  getClientIp,
  rateLimitResponse,
  applyRateLimitHeaders,
} from '@/lib/security/request';
import { pickupVerifySchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit (IP-based, sliding window) ─────────────────────────────
    const ip = getClientIp(request);
    const rlResult = await pickupVerifyLimit.check(`verify-pickup:${ip}`);
    if (!rlResult.success) {
      return applyRateLimitHeaders(rateLimitResponse(rlResult), rlResult);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = pickupVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message ?? 'Invalid pickup code' },
        { status: 400 }
      );
    }

    const pickupCode = parsed.data.pickupCode.toUpperCase();

    // Resolve user → merchant (the merchant's merchant_id, not owner_id).
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant tidak ditemukan' }, { status: 403 });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        `
          id,
          order_number,
          status,
          payment_status,
          quantity,
          total,
          created_at,
          pickup_code,
          listings:listing_id (
            title
          ),
          profiles:consumer_id (
            full_name
          )
        `
      )
      .eq('merchant_id', merchant.id)
      .eq('pickup_code', pickupCode)
      .maybeSingle();

    if (error) {
      console.error('[VERIFY-PICKUP] error:', error);
      return NextResponse.json(
        { error: 'Gagal memverifikasi kode pickup' },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Kode pickup tidak ditemukan' },
        { status: 404 }
      );
    }

    const resp = NextResponse.json({ success: true, order });
    return applyRateLimitHeaders(resp, rlResult);
  } catch (error) {
    console.error('[VERIFY-PICKUP] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
