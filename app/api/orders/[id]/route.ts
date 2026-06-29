import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrderByNumber } from '@/lib/queries/orders';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = id;

    // Try fetching by order_number first, then fall back to UUID
    let order = await getOrderByNumber(id);

    if (!order) {
      // Try as UUID directly
      const supabase2 = await createClient();
      const { data, error } = await supabase2
        .from('orders')
        .select('*, listings(title, merchants(name, address)), profiles(full_name, phone)')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[ORDER DETAIL] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
      order = data;
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('[ORDER DETAIL] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
