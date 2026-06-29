/**
 * SaveBites V3 — Eligible Order API Route
 *
 * Returns the most recent completed order for the current user
 * against a given merchant — used by the review submit form.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const merchantId = url.searchParams.get('merchantId');

  if (!merchantId) {
    return NextResponse.json(
      { error: 'merchantId wajib diisi' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu' },
      { status: 401 },
    );
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('consumer_id', user.id)
    .eq('merchant_id', merchantId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[ELIGIBLE ORDER ERROR]', error);
    return NextResponse.json(
      { error: 'Gagal mencari pesanan' },
      { status: 500 },
    );
  }

  if (!order) {
    return NextResponse.json(
      { error: 'Tidak ada pesanan selesai untuk merchant ini' },
      { status: 404 },
    );
  }

  return NextResponse.json({ orderId: order.id });
}