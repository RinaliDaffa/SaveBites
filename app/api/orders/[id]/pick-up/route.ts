/**
 * SaveBites V3 — Merchant pickup confirmation API route
 *
 * POST /api/orders/:id/pick-up
 *
 * Called by the merchant QR scanner island. Accepts JSON body, authenticates
 * via Supabase session cookie, and transitions the order from 'ready' ->
 * 'completed' with picked_up_at set.
 *
 * Security:
 *   - Body size guard to prevent oversized payloads.
 *   - Rate limiting per merchant session (global, not per-ID) to prevent
 *     brute-force pickup confirmations.
 *   - Constant-time comparison on the pickup code before doing any DB query.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { orderPickupLimit } from '@/lib/security/rate-limit';
import {
  guardBodySize,
} from '@/lib/security/body-limit';
import {
  constantTimeEquals,
  normalizeCode,
  getClientIp,
  applyRateLimitHeaders,
  rateLimitResponse,
} from '@/lib/security/request';
import { pickupConfirmSchema } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Body size guard (prevents memory exhaustion) ────────────────────
    const bodyGuard = guardBodySize(request, 2 * 1024); // 2 KB for JSON
    if (bodyGuard) return bodyGuard;

    // Rate limit per IP (anti-brute-force on pickup codes)
    const ip = getClientIp(request);
    const rlResult = await orderPickupLimit.check(`pickup:${ip}`);
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
    const parsed = pickupConfirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message ?? 'Invalid pickup code' },
        { status: 400 }
      );
    }

    // Normalise before timing-safe compare.
    const userProvided = normalizeCode(parsed.data.pickupCode);

    const resolvedParams = await params;

    // Look up the specific order by its ID — verify the merchant owns it.
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, merchant_id, status, payment_status, order_number, pickup_code')
      .eq('id', resolvedParams.id)
      .eq('merchant_id', user.id)
      .maybeSingle();

    if (orderErr) {
      console.error('[PICKUP] order lookup error:', orderErr);
      return NextResponse.json(
        { error: 'Gagal memverifikasi kode pickup' },
        { status: 500 }
      );
    }

    // If no order matches the merchant, perform a constant-time dummy compare
    // to keep the response timing consistent regardless of whether the
    // merchant exists.
    if (!order) {
      // Dummy compare so an attacker cannot distinguish "merchant not found"
      // from "wrong code" by measuring response time.
      constantTimeEquals(userProvided, 'XXXXXXXXXX');
      return NextResponse.json(
        { error: 'Kode pickup tidak ditemukan' },
        { status: 404 }
      );
    }

    // Constant-time pickup code comparison to prevent timing attacks.
    const orderCode = normalizeCode(order.pickup_code ?? '');
    if (!constantTimeEquals(userProvided, orderCode)) {
      return NextResponse.json(
        { error: 'Kode pickup tidak ditemukan' },
        { status: 404 }
      );
    }

    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Pembayaran belum diterima' },
        { status: 400 }
      );
    }

    if (order.status !== 'ready') {
      return NextResponse.json(
        { error: 'Pesanan belum siap untuk pickup' },
        { status: 400 }
      );
    }

    // Transition to completed
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        picked_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateErr) {
      console.error('[PICKUP] update error:', updateErr);
      return NextResponse.json(
        { error: 'Gagal menyelesaikan pesanan' },
        { status: 500 }
      );
    }

    // Invalidate stale cache
    revalidatePath('/m/pickup');
    revalidatePath('/m/orders');
    revalidatePath(`/c/orders/${order.order_number}`);

    const resp = NextResponse.json({
      success: true,
      order_number: order.order_number,
      status: 'completed',
    });
    return applyRateLimitHeaders(resp, rlResult);
  } catch (error) {
    console.error('[PICKUP] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
