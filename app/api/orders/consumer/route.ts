import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrdersByConsumer } from '@/lib/queries/orders';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || undefined;

    const orders = await getOrdersByConsumer(user.id, statusFilter);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('[ORDERS CONSUMER] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}