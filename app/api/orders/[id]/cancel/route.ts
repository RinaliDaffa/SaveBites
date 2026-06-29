import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
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

    // Verify ownership
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Cancel the order
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      console.error('[ORDER CANCEL] error:', error);
      return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ORDER CANCEL] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}