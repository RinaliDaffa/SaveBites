import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMerchantOrders } from '@/lib/queries/merchant';
import type { OrderStatus } from '@/lib/types/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as OrderStatus | null;

    const orders = await getMerchantOrders(user.id, {
      status: status ?? undefined,
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('[ORDERS MERCHANT] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}